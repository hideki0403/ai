import { bindThis } from '@/decorators.js';
import { parse } from 'twemoji-parser';
import * as Misskey from 'misskey-js';

import Module from '@/module.js';
import includes from '@/utils/includes.js';
import { sleep } from '@/utils/sleep.js';

export default class extends Module {
	public readonly name = 'emoji-react'

	private htl!: Misskey.ChannelConnection<Misskey.Channels['homeTimeline']>

	@bindThis
	public install() {
		this.htl = this.aira.stream.useChannel('homeTimeline')
		this.htl.on('note', this.onNote)

		return {}
	}

	@bindThis
	private async onNote(note: Misskey.entities.Note) {
		if (note.userId === this.aira.account.id) return; // あいら自身の投稿にはリアクションしない
		if (note.reply != null) return;
		if (note.text == null) return;
		if (note.text.includes('@')) return; // (自分または他人問わず)メンションっぽかったらreject

		const react = async (reaction: string, immediate = false) => {
			if (!immediate) {
				await sleep(1500);
			}
			this.aira.api('notes/reactions/create', {
				noteId: note.id,
				reaction: reaction
			})
		}

		const customEmojis = note.text.match(/:([^\n:]+?):/g)
		if (customEmojis) {
			// カスタム絵文字が複数種類ある場合はキャンセル
			if (!customEmojis.every((val, i, arr) => val === arr[0])) return

			this.log(`Custom emoji detected - ${customEmojis[0]}`)

			return react(customEmojis[0])
		}

		const emojis = parse(note.text).map(x => x.text)
		if (emojis.length > 0) {
			// 絵文字が複数種類ある場合はキャンセル
			if (!emojis.every((val, i, arr) => val === arr[0])) return

			this.log(`Emoji detected - ${emojis[0]}`)

			let reaction = emojis[0]

			switch (reaction) {
				case '✊': return react('🖐', true)
				case '✌': return react('✊', true)
				case '🖐': case '✋': return react('✌', true)
			}

			return react(reaction)
		}

		if (includes(note.text, ['ぴざ'])) return react('🍕')
		if (includes(note.text, ['ぷりん'])) return react('🍮')
		if (includes(note.text, ['寿司', 'sushi']) || note.text === 'すし') return react('🍣')

		if (includes(note.text, ['あいら'])) return react('🙌')
	}
}
