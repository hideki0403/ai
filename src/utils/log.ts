import pico from 'picocolors'
import zeroPad from './zero-padding'

export default function(msg: string) {
	const now = new Date()
	const date = `${zeroPad(now.getHours())}:${zeroPad(now.getMinutes())}:${zeroPad(now.getSeconds())}`
	console.log(`${pico.gray(date)} ${msg}`)
}
