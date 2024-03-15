import { bindThis } from '@/decorators.js';
import Message from '@/message.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';
import type { Note } from '@/misskey/note.js';

export default class extends Module {
	public readonly name = 'poll'

	@bindThis
	public install() {
		setInterval(() => {
			if (Math.random() < 0.1) {
				this.post()
			}
		}, 1000 * 60 * 60)

		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback,
		}
	}

	@bindThis
	private async post() {
		const duration = 1000 * 60 * 15

		const polls = [ // TODO: Extract serif
			['珍しそうなもの', 'みんなはどれがいちばん珍しいと思う？'],
			['美味しそうなもの', 'みんなはどれがいちばん美味しいと思う？'],
			['重そうなもの', 'みんなはどれがいちばん重いと思う？'],
			['欲しいもの', 'みんなはどれがいちばん欲しい？'],
			['無人島に持っていきたいもの', 'みんなは無人島にひとつ持っていけるとしたらどれにする？'],
			['家に飾りたいもの', 'みんなは家に飾るとしたらどれにする？'],
			['売れそうなもの', 'みんなはどれがいちばん売れそうだと思う？'],
			['降ってきてほしいもの', 'みんなはどれが空から降ってきてほしい？'],
			['携帯したいもの', 'みんなはどれを携帯したい？'],
			['商品化したいもの', 'みんなは商品化するとしたらどれにする？'],
			['発掘されそうなもの', 'みんなは遺跡から発掘されそうなものはどれだと思う？'],
			['良い香りがしそうなもの', 'みんなはどれがいちばんいい香りがすると思う？'],
			['高値で取引されそうなもの', 'みんなはどれがいちばん高値で取引されると思う？'],
			['地球周回軌道上にありそうなもの', 'みんなはどれが地球周回軌道上を漂っていそうだと思う？'],
			['プレゼントしたいもの', 'みんなはあいらにプレゼントしてくれるとしたらどれにする？'],
			['プレゼントされたいもの', 'みんなはプレゼントでもらうとしたらどれにする？'],
			['私が持ってそうなもの', 'みんなはあいらが持ってそうなものはどれだと思う？'],
			['流行りそうなもの', 'みんなはどれが流行りそうだと思う？'],
			['朝ごはん', 'みんなは朝ごはんにどれが食べたい？'],
			['お昼ごはん', 'みんなはお昼ごはんにどれが食べたい？'],
			['お夕飯', 'みんなはお夕飯にどれが食べたい？'],
			['体に良さそうなもの', 'みんなはどれが体に良さそうだと思う？'],
			['後世に遺したいもの', 'みんなはどれを後世に遺したい？'],
			['楽器になりそうなもの', 'みんなはどれが楽器になりそうだと思う？'],
			['お味噌汁の具にしたいもの', 'みんなはお味噌汁の具にするとしたらどれがいい？'],
			['ふりかけにしたいもの', 'みんなはどれをごはんにふりかけたい？'],
			['よく見かけるもの', 'みんなはどれをよく見かける？'],
			['道に落ちてそうなもの', 'みんなは道端に落ちてそうなものはどれだと思う？'],
			['美術館に置いてそうなもの', 'みんなはこの中で美術館に置いてありそうなものはどれだと思う？'],
			['教室にありそうなもの', 'みんなは教室にありそうなものってどれだと思う？'],
			['絵文字になってほしいもの', '絵文字になってほしいものはどれ？'],
			['Misskey本部にありそうなもの', 'みんなはMisskey本部にありそうなものはどれだと思う？'],
			['燃えるゴミ', 'みんなはどれが燃えるゴミだと思う？'],
			['好きなおにぎりの具', 'みんなが好きなおにぎりの具ってなにかな？'],
		]

		const poll = polls[Math.floor(Math.random() * polls.length)]

		const choices = [
			genItem(),
			genItem(),
			genItem(),
			genItem(),
		]

		const note = await this.aira.post({
			text: poll[1],
			poll: {
				choices,
				expiredAfter: duration,
				multiple: false,
			}
		})

		// タイマーセット
		this.setTimeoutWithPersistence(duration + 3000, {
			title: poll[0],
			noteId: note.id,
		})
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (!msg.or(['/poll']) || msg.user.username !== config.master) {
			return false
		} else {
			this.log('Manualy poll requested')
		}

		this.post()

		return true
	}

	@bindThis
	private async timeoutCallback({ title, noteId }) {
		const note: Note = await this.aira.api('notes/show', { noteId });

		const choices = note.poll!.choices

		let mostVotedChoice: typeof choices[0] | null = null

		for (const choice of choices) {
			if (mostVotedChoice == null) {
				mostVotedChoice = choice
				continue
			}

			if (choice.votes > mostVotedChoice.votes) {
				mostVotedChoice = choice
			}
		}

		if (!mostVotedChoice) return

		const mostVotedChoices = choices.filter(choice => choice.votes === mostVotedChoice!.votes)

		if (mostVotedChoice.votes === 0) {
			// 投票がなければ結果発表はしない
			// this.aira.post({ // TODO: Extract serif
			// 	text: '投票はありませんでした',
			// 	renoteId: noteId,
			// })
		} else if (mostVotedChoices.length === 1) {
			this.aira.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表！`,
				text: `結果は${mostVotedChoice.votes}票の「${mostVotedChoice.text}」だったよ！`,
				renoteId: noteId,
			})
		} else {
			const choices = mostVotedChoices.map(choice => `「${choice.text}」`).join('と')
			this.aira.post({ // TODO: Extract serif
				cw: `${title}アンケートの結果発表！`,
				text: `結果は${mostVotedChoice.votes}票の${choices}だったよ！`,
				renoteId: noteId,
			})
		}
	}
}
