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
				text: `${serifs.newEmojiDetector.notifyMessage}\n${serifs.newEmojiDetector.emojiTemplate(emoji.name)}`,
			})
		}
	}

	@bindThis
	private async bulkNotify() {
		this.bulkNotifyCooldownTimer = null

		let text = ''
		let beforeNoteId: Misskey.entities.Note['id'] | null = null

		for (let i = 0; i < this.bulkNotifyEmojis.length; i++) {
			if (text.length !== 0) text += '\n'
			text += serifs.newEmojiDetector.emojiTemplate(this.bulkNotifyEmojis[i])

			if (i === this.bulkNotifyEmojis.length - 1 || text.length > 2000) {
				const note = await this.aira.post({
					text: beforeNoteId == null ? `${serifs.newEmojiDetector.notifyMessage}\n\n${text}` : text,
					replyId: beforeNoteId,
				})

				beforeNoteId = note.id
				text = ''
			}
		}

		this.bulkNotifyEmojis = []
	}
}
