import autobind from 'autobind-decorator'
import Module from '@/module'

export default class extends Module {
	public readonly name = 'welcome'

	@autobind
	public install() {
		const tl = this.aira.stream.useChannel('localTimeline')

		tl.on('note', this.onLocalNote)

		return {}
	}

	@autobind
	private onLocalNote(note: any) {
		if (note.isFirstNote) {
			setTimeout(() => {
				this.aira.api('notes/create', {
					renoteId: note.id
				})
			}, 3000)

			setTimeout(() => {
				this.aira.api('notes/reactions/create', {
					noteId: note.id,
					reaction: 'congrats'
				})
			}, 5000)
		}
	}
}
