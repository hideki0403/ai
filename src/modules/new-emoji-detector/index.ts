import { bindThis } from '@/decorators.js';
import * as Misskey from 'misskey-js'
import serifs from '@/serifs.js'
import Module from '@/module.js'
import config from '@/config.js'


export default class extends Module {
	public readonly name = 'new-emoji-detector'
	private ignoreCategory: string[] = []
	private bulkNotifyEmojis: string[] = []
	private bulkNotifyCooldownTimer: NodeJS.Timeout | null = null

	@bindThis
	public install() {
		if (config.newEmojiDetectorEnabled === false) return {}
		this.aira.stream.addListener('emojiAdded', (payload) => this.onEmojiAdded(payload.emoji))
		this.ignoreCategory = config.ignoreCategory?.split(',') ?? []
		return {}
	}

	@bindThis
	private async onEmojiAdded(emoji: Misskey.entities.EmojiDetailed) {
		if (emoji.category && this.ignoreCategory.includes(emoji.category)) return
		this.log(`New emoji detected: ${emoji.name}`)

		if (config.newEmojiAnnouncementAtOnce) {
			this.bulkNotifyEmojis.push(emoji.name)
			if (this.bulkNotifyCooldownTimer) clearTimeout(this.bulkNotifyCooldownTimer)
			this.bulkNotifyCooldownTimer = setTimeout(this.bulkNotify, 1000 * 60 * 3)
		} else {
			await this.aira.post({
				text: serifs.newEmojiDetector.notify(emoji.name),
			})
		}
	}

	@bindThis
	private async bulkNotify() {
		this.bulkNotifyCooldownTimer = null
		await this.aira.post({
			text: serifs.newEmojiDetector.bulkNotify(this.bulkNotifyEmojis),
		})
		this.bulkNotifyEmojis = []
	}
}
