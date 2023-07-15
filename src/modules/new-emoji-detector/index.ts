import autobind from 'autobind-decorator'
import Misskey from 'misskey-js'
import serifs from '@/serifs'
import Module from '@/module'
import config from '@/config'


export default class extends Module {
	public readonly name = 'new-emoji-detector'
	private ignoreCategory: string[] = []

	@autobind
	public install() {
		if (config.newEmojiDetectorEnabled === false) return {}
		this.aira.stream.addListener('emojiAdded', (payload) => this.onEmojiAdded(payload.emoji))
		this.ignoreCategory = config.ignoreCategory?.split(',') ?? []
		return {}
	}

	@autobind
	private async onEmojiAdded(emoji: Misskey.entities.CustomEmoji) {
		if (this.ignoreCategory.includes(emoji.category)) return
		this.log(`New emoji detected: ${emoji.name}`)
		await this.aira.post({
			text: serifs.newEmojiDetector.notify(emoji.name),
		})
	}
}
