import autobind from 'autobind-decorator'
import pico from 'picocolors'
import Misskey from 'misskey-js'

import Aira from '@/aira'
import Friend from '@/friend'
import includes from '@/utils/includes'
import or from '@/utils/or'
import config from '@/config'
import delay from '@/utils/delay'

export default class Message {
	private aira: Aira
	private note: any;

	public get id(): string {
		return this.note.id;
	}

	public get user(): Misskey.entities.UserDetailed {
		return this.note.user;
	}

	public get userId(): string {
		return this.note.userId;
	}

	public get text(): string {
		return this.note.text;
	}

	public get quoteId(): string | null {
		return this.note.renoteId;
	}

	public get visibility(): string {
		return this.note.visibility;
	}

	/**
	 * メンション部分を除いたテキスト本文
	 */
	public get extractedText(): string {
		const host = new URL(config.host).host.replace(/\./g, '\\.')
		return this.text
			.replace(new RegExp(`^@${this.aira.account.username}@${host}\\s`, 'i'), '')
			.replace(new RegExp(`^@${this.aira.account.username}\\s`, 'i'), '')
			.trim()
	}

	public get replyId(): string {
		return this.note.replyId;
	}

	public friend: Friend

	constructor(aira: Aira, note: any) {
		this.aira = aira
		this.note = note;

		this.friend = new Friend(aira, { user: this.user })

		// メッセージなどに付いているユーザー情報は省略されている場合があるので完全なユーザー情報を持ってくる
		this.aira.api('users/show', {
			userId: this.userId
		}).then(user => {
			this.friend.updateUser(user)
		})
	}

	@autobind
	public async reply(text: string | null, opts?: {
		file?: any
		cw?: string
		renote?: string
		immediate?: boolean
	}) {
		if (text == null) return

		this.aira.log(`>>> Sending reply to ${pico.underline(this.id)}`)

		if (!opts?.immediate) {
			await delay(2000)
		}

		return await this.aira.post({
			replyId: this.note.id,
			text: text,
			fileIds: opts?.file ? [opts?.file.id] : undefined,
			cw: opts?.cw,
			renoteId: opts?.renote
		});
	}

	@autobind
	public includes(words: string[]): boolean {
		return includes(this.text, words)
	}

	@autobind
	public or(words: (string | RegExp)[]): boolean {
		return or(this.text, words)
	}
}
