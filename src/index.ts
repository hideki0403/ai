// AiraOS bootstrapper
import pico from 'picocolors'

import Aira from './aira'
import config from './config'
import _log from './utils/log'

import CoreModule from './modules/core'
import TalkModule from './modules/talk'
import BirthdayModule from './modules/birthday'
import PingModule from './modules/ping'
import EmojiModule from './modules/emoji'
import EmojiReactModule from './modules/emoji-react'
import FortuneModule from './modules/fortune'
import GuessingGameModule from './modules/guessing-game'
import KazutoriModule from './modules/kazutori'
import KeywordModule from './modules/keyword'
import WelcomeModule from './modules/welcome'
import TimerModule from './modules/timer'
import DiceModule from './modules/dice'
import ServerModule from './modules/server'
import FollowModule from './modules/follow'
import ValentineModule from './modules/valentine'
import MazeModule from './modules/maze'
import ChartModule from './modules/chart'
import SleepReportModule from './modules/sleep-report'
import NotingModule from './modules/noting'
import PollModule from './modules/poll'
import ReminderModule from './modules/reminder'

console.log(`
 _____ _            _____ _____ 
|  _  |_|___ ___   |     |   __|
|     | |  _| .'|  |  |  |__   |
|__|__|_|_| |__,|  |_____|_____|
`)

function log(msg: string): void {
	_log(`[Boot]: ${msg}`)
}

log(pico.bold(`Aira v${config.version}`))
log('Starting AiraOS...')

// あいらを起動
new Aira([
	new CoreModule(),
	new EmojiModule(),
	new EmojiReactModule(),
	new FortuneModule(),
	new GuessingGameModule(),
	new KazutoriModule(),
	new TimerModule(),
	new DiceModule(),
	new TalkModule(),
	new PingModule(),
	new WelcomeModule(),
	new ServerModule(),
	new FollowModule(),
	new BirthdayModule(),
	new ValentineModule(),
	new KeywordModule(),
	new MazeModule(),
	new ChartModule(),
	new SleepReportModule(),
	new NotingModule(),
	// new PollModule(),
	new ReminderModule(),
])
