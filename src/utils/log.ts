import chalk from 'chalk';
import zeroPad from './zero-padding.js';

export default function (msg: string) {
	const now = new Date();
	const date = `${zeroPad(now.getHours())}:${zeroPad(now.getMinutes())}:${zeroPad(now.getSeconds())}`;
	console.log(`${chalk.gray(date)} ${msg}`);
}
