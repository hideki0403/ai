import { bindThis } from '@/decorators.js';
import Module from '@/module.js';

export default class extends Module {
	public readonly name = 'welcome'

	@bindThis
	public install() {
		const tl = this.aira.stream.useChannel('localTimeline')

		tl.on('note', this.onLocalNote)

		return {}
	}

	@bindThis
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
