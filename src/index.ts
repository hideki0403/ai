// AiraOS bootstrapper
import pico from 'picocolors'

import Aira from '@/aira.js'
import config from '@/config.js'
import _log from '@/utils/log.js'

import CoreModule from '@/modules/core/index.js'
import TalkModule from '@/modules/talk/index.js'
import BirthdayModule from '@/modules/birthday/index.js'
import PingModule from '@/modules/ping/index.js'
import EmojiMakerModule from '@/modules/emoji-maker/index.js'
import EmojiModule from '@/modules/emoji/index.js'
import EmojiReactModule from '@/modules/emoji-react/index.js'
import NewEmojiDetectorModule from '@/modules/new-emoji-detector/index.js'
import FortuneModule from '@/modules/fortune/index.js'
import GuessingGameModule from '@/modules/guessing-game/index.js'
import KazutoriModule from '@/modules/kazutori/index.js'
import KeywordModule from '@/modules/keyword/index.js'
import WelcomeModule from '@/modules/welcome/index.js'
import TimerModule from '@/modules/timer/index.js'
import TimeSignalModule from '@/modules/time-signal/index.js'
import DiceModule from '@/modules/dice/index.js'
import ServerModule from '@/modules/server/index.js'
import FollowModule from '@/modules/follow/index.js'
import ValentineModule from '@/modules/valentine/index.js'
import MazeModule from '@/modules/maze/index.js'
import ChartModule from '@/modules/chart/index.js'
import SleepReportModule from '@/modules/sleep-report/index.js'
import NotingModule from '@/modules/noting/index.js'
import PollModule from '@/modules/poll/index.js'
import ReminderModule from '@/modules/reminder/index.js'

console.log(pico.green(`
 _____ _            _____ _____ 
|  _  |_|___ ___   |     |   __|
|     | |  _| .'|  |  |  |__   |
|__|__|_|_| |__,|  |_____|_____|
`))

function log(msg: string): void {
	_log(`[Boot]: ${msg}`)
}

log(pico.bold(`Aira v${config.version}`))
log('Starting AiraOS...')

// あいらを起動
new Aira([
	new CoreModule(),
	new EmojiMakerModule(),
	new EmojiModule(),
	new EmojiReactModule(),
	new NewEmojiDetectorModule(),
	new FortuneModule(),
	new GuessingGameModule(),
	new KazutoriModule(),
	new TimerModule(),
	new TimeSignalModule(),
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
	new PollModule(),
	new ReminderModule(),
])
