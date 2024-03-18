import { bindThis } from '@/decorators.js';
import cron from 'node-cron'
import dayjs from 'dayjs'
import 'dayjs/locale/ja.js'
import isLeapYear from 'dayjs/plugin/isLeapYear.js'
import Module from '@/module.js'
import serifs from '@/serifs.js'
import config from '@/config.js'

dayjs.locale('ja')
dayjs.extend(isLeapYear)

export default class extends Module {
	public readonly name = 'time-signal'

	@bindThis
	public install() {
		if (config.timeSignalEnabled === false) return {}

		cron.schedule('0 0 0 * * *', this.post)

		return {}
	}

	@bindThis
	private async post() {
		const today = dayjs().format('YYYY年 M月 D日 (ddd)')
		const baseDays = dayjs().isLeapYear() ? 366 : 365
		const leftDays = dayjs(dayjs().endOf('year')).diff(dayjs(), 'days') + 1
		const percentage = Math.round(leftDays / baseDays * 1000) / 10

		this.log('Posting...')
		this.aira.post({
			text: serifs.timeSignal.changeDate(today, leftDays, percentage)
		})
	}
}
