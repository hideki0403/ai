// Aira CORE

import * as fs from 'fs';
import * as Misskey from 'misskey-js';
import { bindThis } from '@/decorators.js';
import Loki from 'lokijs';
import got from 'got';
import ws from 'ws';
import { FormData, File } from 'formdata-node';
import chalk from 'chalk';
import { v4 as uuid } from 'uuid';

import config from '@/config.js';
import Module from '@/module.js';
import Message from '@/message.js';
import Friend, { FriendDoc } from '@/friend.js';
import log from '@/utils/log.js';
import { sleep } from '@/utils/sleep.js';
import promiseRetry from 'promise-retry';

type MentionHook = (msg: Message) => Promise<boolean | HandlerResult>
type ContextHook = (key: any, msg: Message, data?: any) => Promise<void | boolean | HandlerResult>
type TimeoutCallback = (data?: any) => void

export type HandlerResult = {
	reaction?: string | null
	immediate?: boolean
}

export type InstallerResult = {
	mentionHook?: MentionHook
	contextHook?: ContextHook
	timeoutCallback?: TimeoutCallback
}

export type Meta = {
	[key: string]: string | number | undefined
	lastWakingAt: number
}

/**
 * あいら
 */
export default class Aira {
	public readonly version = config.version
	public account!: Misskey.entities.UserDetailed
	public modules: Module[] = []
	private mentionHooks: MentionHook[] = []
	private contextHooks: { [moduleName: string]: ContextHook } = {}
	private timeoutCallbacks: { [moduleName: string]: TimeoutCallback } = {}
	private watchDogTimer: NodeJS.Timeout | null = null
	public db!: Loki
	public lastSleepedAt!: number
	private meta!: Loki.Collection<Meta>

	private contexts!: Loki.Collection<{
		noteId?: string
		userId?: string
		module: string
		key: string | null
		data?: any
	}>

	private timers!: Loki.Collection<{
		id: string
		module: string
		insertedAt: number
		delay: number
		data?: any
	}>

	public friends!: Loki.Collection<FriendDoc>
	public moduleData!: Loki.Collection<any>

	public api: Misskey.api.APIClient['request']
	public stream: Misskey.Stream

	/**
	 * あいらインスタンスを生成します
	 * @param modules モジュール。先頭のモジュールほど高優先度
	 */
	constructor(modules: Module[]) {
		this.modules = modules
		
		const api = new Misskey.api.APIClient({
			origin: config.host,
			credential: config.token,
			fetch
		})

		// this.api = api.request にするとrequest内のthisがAPIClientではなくAiraを指してしまうのでこのような形にする
		this.api = (...args: Parameters<typeof api.request>) => api.request(...args)
		this.stream = new Misskey.Stream(config.host, { token: config.token }, { WebSocket: ws })

		this.initialize()
	}

	@bindThis
	private async initialize() {
		const account = await promiseRetry(retry => {
			log(`Account fetching... ${chalk.gray(config.host)}`)
			return this.api('i', {}).catch(retry)
		}, {
			retries: 3
		}).catch(() => {
			log(chalk.red('Failed to fetch the account'))
		})

		// アカウントの取得に失敗したら終了
		if (!account) return process.exit(1)

		this.account = account
		log(chalk.green(`Account fetched successfully: ${chalk.underline(`@${account.username}`)}`))

		const memoryDir = config.memoryDir ?? '.'
		const file = process.env.NODE_ENV === 'test' ? `${memoryDir}/test.memory.json` : `${memoryDir}/memory.json`

		this.log(`Loading the memory from ${file}...`)

		this.db = new Loki(file, {
			autoload: true,
			autosave: true,
			autosaveInterval: 1000,
			autoloadCallback: err => {
				// 読み込みに失敗したら終了
				if (err) return this.log(chalk.red(`Failed to load the memory: ${err}`))

				this.log(chalk.green('The memory loaded successfully'))
				this.run()
			}
		})

		// WatchDog
		if (config.watchDog) {
			this.log('WatchDog enabled')

			this.stream.on('ping' as any, () => {
				clearTimeout(this.watchDogTimer ?? undefined)
			})

			setInterval(() => {
				this.watchDogTimer = setTimeout(() => {
					this.log(chalk.red('Websocket connection is dead. Restarting...'))
					process.exit(1)
				}, config.watchDogTimeout ?? 30000)
				this.stream.send('ping', null)
			}, config.watchDogInterval ?? 60000)
		}
	}

	@bindThis
	public log(msg: string) {
		log(`[${chalk.magenta('AiraOS')}]: ${msg}`);
	}

	@bindThis
	private run() {
		//#region Init DB
		this.meta = this.getCollection('meta', {})

		this.contexts = this.getCollection('contexts', {
			indices: ['key']
		})

		this.timers = this.getCollection('timers', {
			indices: ['module']
		})

		this.friends = this.getCollection('friends', {
			indices: ['userId']
		})

		this.moduleData = this.getCollection('moduleData', {
			indices: ['module']
		})
		//#endregion

		const meta = this.getMeta()
		this.lastSleepedAt = meta.lastWakingAt

		//#region Main stream
		const mainStream = this.stream.useChannel('main')

		// メンションされたとき
		mainStream.on('mention', async data => {
			if (data.userId == this.account.id) return // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) {
				// Misskeyのバグで投稿が非公開扱いになる
				if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
				this.onReceiveMessage(new Message(this, data));
			}
		})

		// 返信されたとき
		mainStream.on('reply', async data => {
			if (data.userId == this.account.id) return // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) return
			// Misskeyのバグで投稿が非公開扱いになる
			if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
			this.onReceiveMessage(new Message(this, data));
		});

		// Renoteされたとき
		mainStream.on('renote', async data => {
			if (data.userId == this.account.id) return // 自分は弾く
			if (data.text == null && (data.files || []).length == 0) return

			// リアクションする
			this.api('notes/reactions/create', {
				noteId: data.id,
				reaction: 'love'
			})
		})

		// 通知
		mainStream.on('notification', data => {
			this.onNotification(data)
		})
		//#endregion

		// Install modules
		this.modules.forEach(m => {
			this.log(`Installing ${chalk.cyan(chalk.italic(m.name))}\tmodule...`)
			m.init(this)
			const res = m.install()
			if (res != null) {
				if (res.mentionHook) this.mentionHooks.push(res.mentionHook)
				if (res.contextHook) this.contextHooks[m.name] = res.contextHook
				if (res.timeoutCallback) this.timeoutCallbacks[m.name] = res.timeoutCallback
			}
		})

		// タイマー監視
		this.crawleTimer()
		setInterval(this.crawleTimer, 1000)
		setInterval(this.logWaking, 10000)

		this.log(chalk.green(chalk.bold('Aira am now running!')))
	}

	/**
	 * ユーザーから話しかけられたとき
	 * (メンション、リプライ、トークのメッセージ)
	 */
	@bindThis
	private async onReceiveMessage(msg: Message): Promise<void> {
		this.log(chalk.gray(`<<< An message received: ${chalk.underline(msg.id)}`))


		// Ignore message if the user is a bot
		// To avoid infinity reply loop.
		if (msg.user.isBot) return

		const isNoContext = msg.replyId == null;

		// Look up the context
		const context = isNoContext ? null : this.contexts.findOne({
			noteId: msg.replyId
		})

		let reaction: string | null = 'love'
		let immediate: boolean = false

		//#region
		const invokeMentionHooks = async () => {
			let res: boolean | HandlerResult | null = null

			for (const handler of this.mentionHooks) {
				res = await handler(msg)
				if (res === true || typeof res === 'object') break
			}

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction
				if (res.immediate != null) immediate = res.immediate
			}
		}

		// コンテキストがあればコンテキストフック呼び出し
		// なければそれぞれのモジュールについてフックが引っかかるまで呼び出し
		if (context != null) {
			const handler = this.contextHooks[context.module]
			const res = await handler(context.key, msg, context.data)

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction
				if (res.immediate != null) immediate = res.immediate
			}

			if (res === false) {
				await invokeMentionHooks()
			}
		} else {
			await invokeMentionHooks()
		}
		//#endregion

		if (!immediate) {
			await sleep(1000);
		}

		// リアクションする
		if (reaction) {
			this.api('notes/reactions/create', {
				noteId: msg.id,
				reaction: reaction
			});
		}
	}

	@bindThis
	private onNotification(notification: Misskey.entities.Notification) {
		switch (notification.type) {
			// リアクションされたら親愛度を少し上げる
			// TODO: リアクション取り消しをよしなにハンドリングする
			case 'reaction': {
				const friend = new Friend(this, { user: notification.user })
				friend.incLove(0.1)
				break
			}
		}
	}

	@bindThis
	private crawleTimer() {
		const timers = this.timers.find()
		for (const timer of timers) {
			// タイマーが時間切れかどうか
			if (Date.now() - (timer.insertedAt + timer.delay) >= 0) {
				this.log(`Timer expired: ${timer.module} ${timer.id}`)
				this.timers.remove(timer)
				this.timeoutCallbacks[timer.module](timer.data)
			}
		}
	}

	@bindThis
	private logWaking() {
		this.setMeta({
			lastWakingAt: Date.now(),
		})
	}

	/**
	 * データベースのコレクションを取得します
	 */
	@bindThis
	public getCollection(name: string, opts?: any): Loki.Collection {
		let collection: Loki.Collection;

		collection = this.db.getCollection(name)

		if (collection == null) {
			collection = this.db.addCollection(name, opts)
		}

		return collection
	}

	@bindThis
	public lookupFriend(userId: Misskey.entities.User['id']): Friend | null {
		const doc = this.friends.findOne({
			userId: userId
		})

		if (doc == null) return null
		return new Friend(this, { doc: doc })
	}

	/**
	 * ファイルをドライブにアップロードします
	 */
	@bindThis
	public async upload(file: Buffer | fs.ReadStream, meta: { filename: string, contentType: string }) {
		const form = new FormData();
		form.set('i', config.token);
		form.set('file', new File([file], meta.filename, { type: meta.contentType }));

		const res = await got.post({
			url: `${config.host}/api/drive/files/create`,
			body: form
		}).json();
		return res;
	}

	/**
	 * 投稿します
	 */
	@bindThis
	public async post(param: any) {
		const res = await this.api('notes/create', param)
		return res.createdNote
	}

	/**
	 * 指定ユーザーにトークメッセージを送信します
	 */
	@bindThis
	public sendMessage(userId: any, param: any) {
		return this.post(Object.assign({
			visibility: 'specified',
			visibleUserIds: [userId],
		}, param));
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param module 待ち受けるモジュール名
	 * @param key コンテキストを識別するためのキー
	 * @param id トークメッセージ上のコンテキストならばトーク相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@bindThis
	public subscribeReply(module: Module, key: string | null, id: string, data?: any) {
		this.contexts.insertOne({
			noteId: id,
			module: module.name,
			key: key,
			data: data
		})
	}

	/**
	 * 返信の待ち受けを解除します
	 * @param module 解除するモジュール名
	 * @param key コンテキストを識別するためのキー
	 */
	@bindThis
	public unsubscribeReply(module: Module, key: string | null) {
		this.contexts.findAndRemove({
			key: key,
			module: module.name
		})
	}

	/**
	 * 指定したミリ秒経過後に、そのモジュールのタイムアウトコールバックを呼び出します。
	 * このタイマーは記憶に永続化されるので、途中でプロセスを再起動しても有効です。
	 * @param module モジュール名
	 * @param delay ミリ秒
	 * @param data オプションのデータ
	 */
	@bindThis
	public setTimeoutWithPersistence(module: Module, delay: number, data?: any) {
		const id = uuid()
		this.timers.insertOne({
			id: id,
			module: module.name,
			insertedAt: Date.now(),
			delay: delay,
			data: data
		})

		this.log(`Timer persisted: ${module.name} ${id} ${delay}ms`)
	}

	@bindThis
	public getMeta() {
		const rec = this.meta.findOne()

		if (rec) {
			return rec
		} else {
			const initial: Meta = {
				lastWakingAt: Date.now(),
			}

			this.meta.insertOne(initial)
			return initial
		}
	}

	@bindThis
	public setMeta(meta: Partial<Meta>) {
		const rec = this.getMeta()

		for (const [k, v] of Object.entries(meta)) {
			rec[k] = v
		}

		this.meta.update(rec)
	}
}
