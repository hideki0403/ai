import autobind from 'autobind-decorator'
import Aira, { InstallerResult } from '@/aira'

export default abstract class Module {
	public abstract readonly name: string

	protected aira!: Aira
	private doc: any

	public init(aira: Aira) {
		this.aira = aira

		this.doc = this.aira.moduleData.findOne({
			module: this.name
		})

		if (this.doc == null) {
			this.doc = this.aira.moduleData.insertOne({
				module: this.name,
				data: {}
			})
		}
	}

	public abstract install(): InstallerResult

	@autobind
	protected log(msg: string) {
		this.aira.log(`[${this.name}]: ${msg}`)
	}

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param key コンテキストを識別するためのキー
	 * @param id トークメッセージ上のコンテキストならばトーク相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@autobind
	protected subscribeReply(key: string | null, id: string, data?: any) {
		this.aira.subscribeReply(this, key, id, data);
	}

	/**
	 * 返信の待ち受けを解除します
	 * @param key コンテキストを識別するためのキー
	 */
	@autobind
	protected unsubscribeReply(key: string | null) {
		this.aira.unsubscribeReply(this, key)
	}

	/**
	 * 指定したミリ秒経過後に、タイムアウトコールバックを呼び出します。
	 * このタイマーは記憶に永続化されるので、途中でプロセスを再起動しても有効です。
	 * @param delay ミリ秒
	 * @param data オプションのデータ
	 */
	@autobind
	public setTimeoutWithPersistence(delay: number, data?: any) {
		this.aira.setTimeoutWithPersistence(this, delay, data)
	}

	@autobind
	protected getData() {
		return this.doc.data
	}

	@autobind
	protected setData(data: any) {
		this.doc.data = data
		this.aira.moduleData.update(this.doc)
	}
}
