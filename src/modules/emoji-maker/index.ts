import autobind from 'autobind-decorator'
import kuroshiro from 'kuroshiro'
import Misskey from 'misskey-js'
import * as mfm from 'mfm-js'
import Module from '@/module'
import Message from '@/message'
import serifs from '@/serifs'
import { mecab } from '@/utils/mecab'
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

		// ノートの詳細を取得
		const referNote = await this.aira.api('notes/show', {
			noteId: msg.id
		})

		// 絵文字の削除処理
		if (msg.includes(['削除', '消して'])) {
			this.removeEmoji(msg, referNote.text as string, referNote.user.username)
			return true
		}

		// オプションのパース
		const args = referNote.text!.replace(/ +/g, ' ').split(' ')
		const options = {} as { [key: string]: string }

		for (let i = 0; i < args.length; i++) {
			const arg = args[i]
			if (!arg.startsWith('--')) continue
			const parsedArg = arg.replace('--', '').split('=')
			options[parsedArg[0]] = parsedArg[1] ?? 'true'
		}

		// 引数から入力されたテキストを使用するかどうか
		const useArgInput = !!options.text

		const text = useArgInput ? options.text.replace('$', '\n') : referNote.reply?.text
		const author = useArgInput ? referNote.user.username : referNote.reply?.user.username
		if (!text || !author) {
			msg.reply(serifs.emojiMaker.noteNotFound)
			return true
		}

		// 文字列をmecabでカタカナに変換してからローマ字に変換
		// 最大64文字
		const yomigana = (await mecab(text.replace('\n', ''))).map(char => char[8]).join('')

		// IDが指定されていればそっちを優先してあげる
		const emojiName = (options.id || kuroshiro.Util.kanaToRomaji(yomigana) || text).toLowerCase().replace(/[^0-9a-z_]/gi, '').substring(0, 64)

		// 絵文字IDが空ならエラーを返す
		if (!emojiName) {
			msg.reply(serifs.emojiMaker.noEmojiId)
			return true
		}

		const isRegister = options.register || msg.includes(['登録', '追加'])
		if (isRegister) {
			// 既に対象の絵文字が登録されていないかチェック
			const existsCheck = (await this.aira.api('admin/emoji/list', {
				query: emojiName
			}))?.some((emoji: Misskey.entities.CustomEmoji) => emoji.name === emojiName)

			if (existsCheck) {
				msg.reply(serifs.emojiMaker.exists(emojiName))
				return true
			}

			// 対象の文字列が32文字以上だったら絵文字化しない
			const lengthLimit = 32
			if (text.length > lengthLimit) {
				msg.reply(serifs.emojiMaker.tooLongText(lengthLimit))
				return true
			}
		}

		this.log('Emoji rendering...')
		const img = renderEmoji(text, emojiName, options)

		this.log('Image uploading...')
		const file = await this.aira.upload(img, {
			filename: `emoji-${emojiName}.png`,
			contentType: 'image/png'
		})

		this.log(`Image uploaded! filename is ${file.name}`)

		if (isRegister) {
			this.log('Adding emoji...')
			const emojiRes = await this.aira.api('admin/emoji/add', {
				fileId: file.id
			})

			if (!emojiRes) return true

			const emojiRegisterName = referNote.user.username
			const license = [emojiRegisterName]

			if (emojiRegisterName !== author) license.push(author)

			await this.aira.api('admin/emoji/update', {
				id: emojiRes.id,
				name: emojiName,
				category: 'カスタム文字',
				aliases: [],
				license: license.join(',')
			})
		}

		msg.reply(isRegister ? serifs.emojiMaker.successWithEmoji(emojiName) : serifs.emojiMaker.success, { file: isRegister ? undefined : file })

		return true
	}

	@autobind
	private async removeEmoji(msg: Message, text: string, author: string): Promise<void> {
		const emojis = mfm.parseSimple(text).filter(node => node.type === 'emojiCode').map(node => (node as mfm.MfmEmojiCode).props.name)
		const remoteEmojis = await this.aira.api('admin/emoji/list', {
			query: author,
			limit: 100
		}) as Misskey.entities.CustomEmoji[]

		const result = {} as {[key: string]: boolean}
		
		for (const emoji of emojis) {
			const target = remoteEmojis.find(item => item.name === emoji && item.license.split(',').includes(author))
			if (!target) {
				result[emoji] = false
				continue
			}

			await this.aira.api('admin/emoji/delete' as any, {
				id: target.id
			})

			result[emoji] = true
		}

		const isFailedDeleted = Object.values(result).some(res => !res)
		const isFailedAll = isFailedDeleted ? Object.values(result).every(res => !res) : false

		const message = isFailedAll ? serifs.emojiMaker.deleteAllError : isFailedDeleted ? serifs.emojiMaker.deleteWithError(Object.keys(result)) : serifs.emojiMaker.deleteSuccess
		msg.reply(message)
	}
}
