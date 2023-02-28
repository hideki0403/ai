import autobind from 'autobind-decorator'
import Aira from '@/aira'
import IModule from '@/module'
import getDate from '@/utils/get-date'
import Misskey from 'misskey-js'
import { genItem } from '@/vocabulary'

export type FriendDoc = {
	userId: string
	user: Misskey.entities.User
	name?: string | null
	love?: number
	lastLoveIncrementedAt?: string
	todayLoveIncrements?: number
	perModulesData?: any
	married?: boolean
	transferCode?: string
}

export default class Friend {
	private aira: Aira

	public get userId() {
		return this.doc.userId
	}

	public get name() {
		return this.doc.name
	}

	public get love() {
		return this.doc.love || 0
	}

	public get married() {
		return this.doc.married
	}

	public doc: FriendDoc

	constructor(aira: Aira, opts: { user?: Misskey.entities.User, doc?: FriendDoc }) {
		this.aira = aira

		if (opts.user) {
			const exist = this.aira.friends.findOne({
				userId: opts.user.id
			})

			if (exist == null) {
				const inserted = this.aira.friends.insertOne({
					userId: opts.user.id,
					user: opts.user
				})

				if (inserted == null) {
					throw new Error('Failed to insert friend doc')
				}

				this.doc = inserted
			} else {
				this.doc = exist
				this.doc.user = { ...this.doc.user, ...opts.user }
				this.save()
			}
		} else if (opts.doc) {
			this.doc = opts.doc
		} else {
			throw new Error('No friend info specified')
		}
	}

	@autobind
	public updateUser(user: Partial<Misskey.entities.User>) {
		this.doc.user = {
			...this.doc.user,
			...user,
		}
		this.save()
	}

	@autobind
	public getPerModulesData(module: IModule) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {}
			this.doc.perModulesData[module.name] = {}
			this.save()
		} else if (this.doc.perModulesData[module.name] == null) {
			this.doc.perModulesData[module.name] = {}
			this.save()
		}

		return this.doc.perModulesData[module.name]
	}

	@autobind
	public setPerModulesData(module: IModule, data: any) {
		if (this.doc.perModulesData == null) {
			this.doc.perModulesData = {}
		}

		this.doc.perModulesData[module.name] = data

		this.save()
	}

	@autobind
	public incLove(amount = 1) {
		const today = getDate()

		if (this.doc.lastLoveIncrementedAt != today) {
			this.doc.todayLoveIncrements = 0
		}

		// 1日に上げられる親愛度は最大3
		if (this.doc.lastLoveIncrementedAt == today && (this.doc.todayLoveIncrements || 0) >= 3) return

		if (this.doc.love == null) this.doc.love = 0
		this.doc.love += amount

		// 最大 100
		if (this.doc.love > 100) this.doc.love = 100

		this.doc.lastLoveIncrementedAt = today
		this.doc.todayLoveIncrements = (this.doc.todayLoveIncrements || 0) + amount
		this.save()

		this.aira.log(`💗 ${this.userId} +${amount}`)
	}

	@autobind
	public decLove(amount = 1) {
		// 親愛度MAXなら下げない
		if (this.doc.love === 100) return

		if (this.doc.love == null) this.doc.love = 0
		this.doc.love -= amount

		// 最低 -30
		if (this.doc.love < -30) this.doc.love = -30

		// 親愛度マイナスなら名前を忘れる
		if (this.doc.love < 0) {
			this.doc.name = null
		}

		this.save()

		this.aira.log(`💢 ${this.userId} -${amount}`)
	}

	@autobind
	public updateName(name: string) {
		this.doc.name = name
		this.save()
	}

	@autobind
	public save() {
		this.aira.friends.update(this.doc)
	}

	@autobind
	public generateTransferCode(): string {
		const code = genItem()

		this.doc.transferCode = code
		this.save()

		return code
	}

	@autobind
	public transferMemory(code: string): boolean {
		const src = this.aira.friends.findOne({
			transferCode: code
		})

		if (src == null) return false

		this.doc.name = src.name
		this.doc.love = src.love
		this.doc.married = src.married
		this.doc.perModulesData = src.perModulesData
		this.save()

		// TODO: 合言葉を忘れる

		return true
	}
}
