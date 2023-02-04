// Aira CORE

import * as fs from 'fs'
import autobind from 'autobind-decorator'
import * as loki from 'lokijs'
import pico from 'picocolors'
import { createColorize } from 'colorize-template'
import { v4 as uuid } from 'uuid'
import * as Misskey from 'misskey-js'
import fetch from 'node-fetch'
import FormData from 'form-data'
import promiseRetry from 'promise-retry'

import config from '@/config'
import Module from '@/module'
import Message from '@/message'
import Friend, { FriendDoc } from '@/friend'
import log from '@/utils/log'

const delay = (msec: number) => new Promise(resolve => setTimeout(resolve, msec))
const colorize = createColorize(pico)

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
	public account!: Misskey.entities.User
	public modules: Module[] = []
	private mentionHooks: MentionHook[] = []
	private contextHooks: { [moduleName: string]: ContextHook } = {}
	private timeoutCallbacks: { [moduleName: string]: TimeoutCallback } = {}
	public db!: loki
	public lastSleepedAt!: number
	private meta!: loki.Collection<Meta>

	private contexts!: loki.Collection<{
		isDm: boolean
		noteId?: string
		userId?: string
		module: string
		key: string | null
		data?: any
	}>

	private timers!: loki.Collection<{
		id: string
		module: string
		insertedAt: number
		delay: number
		data?: any
	}>

	public friends!: loki.Collection<FriendDoc>
	public moduleData!: loki.Collection<any>

	public api = new Misskey.api.APIClient({
		origin: config.host,
		credential: config.token,
		fetch
	}).request

	public stream = new Misskey.Stream(config.host, {
		token: config.token
	})

	/**
	 * あいらインスタンスを生成します
	 * @param modules モジュール。先頭のモジュールほど高優先度
	 */
	constructor(modules: Module[]) {
		this.modules = modules
		this.initialize()
	}

	@autobind
	private async initialize() {
		const account = await promiseRetry(retry => {
			log(`Account fetching... ${pico.gray(config.host)}`)
			return this.api('i').catch(retry)
		}, {
			retries: 3
		}).catch(() => {
			log(pico.red('Failed to fetch the account'))
		})

		// アカウントの取得に失敗したら終了
		if (!account) return

		this.account = account
		log(pico.green(`Account fetched successfully: ${pico.underline(`@${account.username}`)}`))

		const memoryDir = config.memoryDir ?? '.'
		const file = process.env.NODE_ENV === 'test' ? `${memoryDir}/test.memory.json` : `${memoryDir}/memory.json`

		this.log(`Loading the memory from ${file}...`)

		this.db = new Loki(file, {
			autoload: true,
			autosave: true,
			autosaveInterval: 1000,
			autoloadCallback: err => {
				// 読み込みに失敗したら終了
				if (err) return this.log(pico.red(`Failed to load the memory: ${err}`))

				this.log(pico.green('The memory loaded successfully'))
				this.run()
			}
		})
	}

	@autobind
	public log(msg: string) {
		log(colorize`[{magenta AiraOS}]: ${msg}`)
	}

	@autobind
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
				if (data.text == null) data = await this.api('notes/show', { noteId: data.id })
				this.onReceiveMessage(new Message(this, data, false))
			}
		})

		// 返信されたとき
		mainStream.on('reply', async data => {
			if (data.userId == this.account.id) return // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) return
			// Misskeyのバグで投稿が非公開扱いになる
			if (data.text == null) data = await this.api('notes/show', { noteId: data.id })
			this.onReceiveMessage(new Message(this, data, false))
		})

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

		// メッセージ
		mainStream.on('messagingMessage', data => {
			if (data.userId == this.account.id) return // 自分は弾く
			this.onReceiveMessage(new Message(this, data, true))
		})

		// 通知
		mainStream.on('notification', data => {
			this.onNotification(data)
		})
		//#endregion

		// Install modules
		this.modules.forEach(m => {
			this.log(`Installing ${pico.cyan(pico.italic(m.name))}\tmodule...`)
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

		this.log(pico.green(pico.bold('Aira am now running!')))
	}

	/**
	 * ユーザーから話しかけられたとき
	 * (メンション、リプライ、トークのメッセージ)
	 */
	@autobind
	private async onReceiveMessage(msg: Message): Promise<void> {
		this.log(pico.gray(`<<< An message received: ${pico.underline(msg.id)}`))

		// Ignore message if the user is a bot
		// To avoid infinity reply loop.
		if (msg.user.isBot) return

		const isNoContext = !msg.isDm && msg.replyId == null

		// Look up the context
		const context = isNoContext ? null : this.contexts.findOne(msg.isDm ? {
			isDm: true,
			userId: msg.userId
		} : {
			isDm: false,
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
			await delay(1000)
		}

		if (msg.isDm) {
			// 既読にする
			this.api('messaging/messages/read', {
				messageId: msg.id,
			})
		} else {
			// リアクションする
			if (reaction) {
				this.api('notes/reactions/create', {
					noteId: msg.id,
					reaction: reaction
				})
			}
		}
	}

	@autobind
	private onNotification(notification: any) {
		switch (notification.type) {
			// リアクションされたら親愛度を少し上げる
			// TODO: リアクション取り消しをよしなにハンドリングする
			case 'reaction': {
				const friend = new Friend(this, { user: notification.user })
				friend.incLove(0.1)
				break
			}

			default: break
		}
	}

	@autobind
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

	@autobind
	private logWaking() {
		this.setMeta({
			lastWakingAt: Date.now(),
		})
	}

	/**
	 * データベースのコレクションを取得します
	 */
	@autobind
	public getCollection(name: string, opts?: any): loki.Collection {
		let collection: loki.Collection

		collection = this.db.getCollection(name)

		if (collection == null) {
			collection = this.db.addCollection(name, opts)
		}

		return collection
	}

	@autobind
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
	@autobind
	public async upload(file: Buffer | fs.ReadStream, meta: any) {
		const formData = new FormData()
		formData.append('i', config.token)
		formData.append('file', file, meta)

		const res = await fetch(`${config.apiUrl}/drive/files/create`, {
			method: 'POST',
			body: formData
		})
		return res
	}

	/**
	 * 投稿します
	 */
	@autobind
	public async post(param: any) {
		const res = await this.api('notes/create', param)
		return res.createdNote
	}

	/**
	 * 指定ユーザーにトークメッセージを送信します
	 */
	@autobind
	public sendMessage(userId: any, param: any) {
		return this.api('messaging/messages/create', Object.assign({
			userId: userId,
		}, param))
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param module 待ち受けるモジュール名
	 * @param key コンテキストを識別するためのキー
	 * @param isDm トークメッセージ上のコンテキストかどうか
	 * @param id トークメッセージ上のコンテキストならばトーク相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@autobind
	public subscribeReply(module: Module, key: string | null, isDm: boolean, id: string, data?: any) {
		this.contexts.insertOne(isDm ? {
			isDm: true,
			userId: id,
			module: module.name,
			key: key,
			data: data
		} : {
			isDm: false,
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
	@autobind
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
	@autobind
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

	@autobind
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

	@autobind
	public setMeta(meta: Partial<Meta>) {
		const rec = this.getMeta()

		for (const [k, v] of Object.entries(meta)) {
			rec[k] = v
		}

		this.meta.update(rec)
	}
}
