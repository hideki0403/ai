import * as childProcess from 'child_process';
import * as Misskey from 'misskey-js';
import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import config from '@/config.js';
import Message from '@/message.js';
import Friend from '@/friend.js';
import getDate from '@/utils/get-date.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

type EventsToIPC<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => void ? {
		type: K;
		body: A[number];
	} : never;
}[keyof T]

export type IPCTypes = {
	parent: {
		type: '_init_',
		body: {
			game: any;
			form: any;
			account: any;
		};
	} | {
		type: 'noteId',
		body: {
			noteId: string;
		}
	} | EventsToIPC<Misskey.Channels['reversiGame']['events']>,
	child: {
		type: 'putStone';
		pos: number;
		id: string;
	} | {
		type: 'ended';
	} | {
		type: 'postNote';
		text: string;
		renoteId?: string;
		throwNoteId?: boolean;
	}
}

export default class extends Module {
	public readonly name = 'reversi';

	/**
	 * リバーシストリーム
	 */
	// @ts-expect-error ライブラリ側に型定義がない
	private reversiConnection?: Misskey.ChannelConnection<Misskey.Channels['reversi']>;

	@bindThis
	public install() {
		if (!config.reversiEnabled) return {};

		// @ts-expect-error ライブラリ側に型定義がない
		this.reversiConnection = this.aira.stream.useChannel('reversi');

		// 招待されたとき
		this.reversiConnection.on('invited', msg => this.onReversiInviteMe(msg.user));

		// マッチしたとき
		this.reversiConnection.on('matched', msg => this.onReversiGameStart(msg.game));

		if (config.reversiEnabled) {
			const mainStream = this.aira.stream.useChannel('main');
			mainStream.on('pageEvent', msg => {
				if (msg.event === 'inviteReversi') {
					this.aira.api('reversi/match', {
						userId: msg.user.id
					});
				}
			});
		}

		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.includes(['リバーシ', 'オセロ', 'reversi', 'othello'])) {
			if (config.reversiEnabled) {
				msg.reply(serifs.reversi.ok);

				if (msg.includes(['接待'])) {
					msg.friend.updateReversiStrength(0);
				}

				this.aira.api('reversi/match', {
					userId: msg.userId
				});
			} else {
				msg.reply(serifs.reversi.decline);
			}

			return true;
		} else {
			return false;
		}
	}

	@bindThis
	private async onReversiInviteMe(inviter: any) {
		this.log(`Someone invited me: @${inviter.username}`);

		if (config.reversiEnabled) {
			// 承認
			const game = await this.aira.api('reversi/match', {
				userId: inviter.id
			});

			this.onReversiGameStart(game);
		} else {
			// todo (リバーシできない旨をメッセージで伝えるなど)
		}
	}

	@bindThis
	private onReversiGameStart(game: any) {
		let strength = 4;
		const friend = this.aira.lookupFriend(game.user1Id !== this.aira.account.id ? game.user1Id : game.user2Id)!;
		if (friend != null) {
			strength = friend.doc.reversiStrength ?? 4;
			friend.updateReversiStrength(null);
		}

		this.log(`enter reversi game room: ${game.id}`);

		// ゲームストリームに接続
		const gw = this.aira.stream.useChannel('reversiGame', {
			gameId: game.id
		});

		// フォーム
		const form = [{
			id: 'publish',
			type: 'switch',
			label: 'あいらが対局情報を投稿するのを許可する',
			value: true,
		}, {
			id: 'strength',
			type: 'radio',
			label: '強さ',
			value: strength,
			items: [{
				label: '接待',
				value: 0
			}, {
				label: '弱',
				value: 2
			}, {
				label: '中',
				value: 3
			}, {
				label: '強',
				value: 4
			}, {
				label: '最強',
				value: 5
			}]
		}];

		//#region バックエンドプロセス開始
		const ai = childProcess.fork(_dirname + '/back.js');

		// バックエンドプロセスに情報を渡す
		this.ipcSend(ai, '_init_', {
			game: game,
			form: form,
			account: this.aira.account
		});

		ai.on('message', (msg: IPCTypes['child']) => {
			if (msg.type == 'putStone') {
				gw.send('putStone', {
					pos: msg.pos,
					id: msg.id,
				});
			} else if (msg.type == 'ended') {
				gw.dispose();
				this.onGameEnded(game);
			} else if (msg.type == 'postNote') {
				this.aira.api('notes/create', {
					text: msg.text,
					renoteId: msg.renoteId,
					visibility: 'home',
				}).catch(e => {
					console.error(e);
					return null;
				}).then(note => {
					if (note != null && msg.throwNoteId) {
						this.ipcSend(ai, 'noteId', {
							noteId: note.createdNote.id
						});
					}
				});
			}
		});

		// ゲームストリームから情報が流れてきたらそのままバックエンドプロセスに伝える
		gw.on('started', message => this.ipcSend(ai, 'started', message))
		gw.on('ended', message => this.ipcSend(ai, 'ended', message))
		gw.on('canceled', message => this.ipcSend(ai, 'canceled', message))
		gw.on('changeReadyStates', message => this.ipcSend(ai, 'changeReadyStates', message))
		gw.on('log', message => this.ipcSend(ai, 'log', message))
		gw.on('updateSettings', message => {
			this.ipcSend(ai, 'updateSettings', message)
			if (message.key === 'canPutEverywhere') gw.send('ready', !message.value)
		})
		//#endregion

		// どんな設定内容の対局でも受け入れる
		setTimeout(() => {
			gw.send('ready', true);
		}, 1000);
	}

	@bindThis
	private ipcSend<T extends IPCTypes['parent']['type']>(ai: childProcess.ChildProcess, type: T, body: Extract<IPCTypes['parent'], { type: T }>['body']) {
		ai.send({ type, body });
	}

	@bindThis
	private onGameEnded(game: any) {
		const user = game.user1Id == this.aira.account.id ? game.user2 : game.user1;

		//#region 1日に1回だけ親愛度を上げる
		const today = getDate();

		const friend = new Friend(this.aira, { user: user });

		const data = friend.getPerModulesData(this);

		if (data.lastPlayedAt != today) {
			data.lastPlayedAt = today;
			friend.setPerModulesData(this, data);

			friend.incLove();
		}
		//#endregion
	}
}
