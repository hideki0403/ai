import * as libemoji from '@hideki0403/libemoji.js'
import chroma from 'chroma-js'
import random from 'random-seed'
import parseBoolean from '@/utils/parse-boolean'
import fonts from '@/utils/fonts'

type renderEmojiOptions = {
	font?: string,
	resolution?: string,
	color?: string,
	align?: string,
	'fixed-text'?: string,
	'no-stretch'?: string
}

export function renderEmoji(text: string, colorSeed?: string, options: renderEmojiOptions = {}) {
	const rnd = random.create(colorSeed ?? text).random()
	const fontFile = fonts.findFont(options.font ?? 'notosans')
	const resolution = options.resolution && isNaN(Number(options.resolution)) ? Math.min(512, Number(options.resolution)) : 256
	const color = ((options.color ? chroma(options.color).hex() : chroma.hsv(360 * rnd, 0.5, 0.7).hex()) + 'FF').substring(0, 9)
	const textAlign = options.align && ['left', 'center', 'right'].includes(options.align) ? options.align as libemoji.EmojiOptions['textAlign'] : 'center'

	const result = libemoji.generate(text, {
		width: resolution,
		height: resolution,
		color: color,
		disableStretch: options['no-stretch'] ? parseBoolean(options['no-stretch']) : false,
		typefaceFile: fontFile,
		textSizeFixed: options['fixed-text'] ? parseBoolean(options['fixed-text']) : false,
		textAlign: textAlign
	})

	return result.buffer
}

