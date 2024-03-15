import { bindThis } from '@/decorators.js';
import * as Misskey from 'misskey-js'
import serifs from '@/serifs.js'
import Module from '@/module.js'
import config from '@/config.js'


export default class extends Module {
	public readonly name = 'new-emoji-detector'
	private ignoreCategory: string[] = []

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
		await this.aira.post({
			text: serifs.newEmojiDetector.notify(emoji.name),
		})
	}
}
