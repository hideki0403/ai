import autobind from 'autobind-decorator'
import { v1 as uuid } from 'uuid'
import Module from '@/module'
import Message from '@/message'
import serifs from '@/serifs'
import { renderEmoji } from './render-emoji'

export default class extends Module {
	public readonly name = 'emoji-maker'

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		}
	}

	@autobind
	private async mentionHook(msg: Message): Promise<boolean> {
		if (!msg.includes(['絵文字', 'emoji'])) return false
		if (msg.isDm) {
			msg.reply(serifs.emojiMaker.noDm)
			return true
		}

		// 絵文字にする文字列を取得
		const referNote = await this.aira.api('notes/show', {
			noteId: msg.id
		})

		const text = referNote.reply?.text
		if (!text) {
			msg.reply(serifs.emojiMaker.noteNotFound)
			return true
		}

		// 対象の文字列が128文字以上だったら絵文字化しない
		if (text.length > 128) {
			msg.reply(serifs.emojiMaker.tooLongText)
			return true
		}

		// オプションのパース
		const args = referNote.text!.replace(/ +/g, ' ').split(' ')
		const options = {} as { [key: string]: string }

		console.log(args)

		for (let i = 0; i < args.length; i++) {
			const arg = args[i]
			if (!arg.startsWith('--')) continue
			const parsedArg = arg.replace('--', '').split('=')
			options[parsedArg[0]] = parsedArg[1] ?? 'true'
		}

		this.log('Emoji rendering...')
		const img = renderEmoji(text, options)

		this.log('Image uploading...')
		const file = await this.aira.upload(img, {
			filename: `emoji-${uuid()}.png`,
			contentType: 'image/png'
		})

		this.log(`Image uploaded! filename is ${file.name}`)

		this.log('Posting...')

		msg.reply(serifs.emojiMaker.success, { file })

		return true
	}
}
