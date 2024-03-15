import * as libemoji from '@hideki0403/emoji.js'
import chroma from 'chroma-js'
import random from 'random-seed'
import parseBoolean from '@/utils/parse-boolean.js'
import fonts from '@/utils/fonts.js'

type renderEmojiOptions = {
	font?: string,
	resolution?: string,
	color?: string,
	align?: string,
	'fixed-text'?: string,
	'no-stretch'?: string,
	'flexible-width'?: string,
	'no-outline'?: string,
	'outline-color'?: string,
}

export function renderEmoji(text: string, colorSeed?: string, options: renderEmojiOptions = {}) {
	const rnd = random.create(colorSeed ?? text).random()
	const fontFile = fonts.findFont(options.font ?? 'default')
	// const resolution = options.resolution && isNaN(Number(options.resolution)) ? Math.min(512, Number(options.resolution)) : 256
	const resolution = 128
	const color = ((options.color ? chroma(options.color).hex() : chroma.hsv(360 * rnd, 0.5, 0.7).hex()) + 'FF').substring(0, 9)
	const textAlign = options.align && ['left', 'center', 'right'].includes(options.align) ? options.align as libemoji.EmojiOptions['textAlign'] : 'center'
	const flexibleWidth = options['flexible-width'] ? parseBoolean(options['flexible-width']) : false

	const [r, g, b] = chroma(color).rgb()
	const outlineColor = ((((r * 299) + (g * 587) + (b * 114)) / 1000) < 128) ? '#E5E9F0' : '#181825'

	const result = libemoji.generate(text, {
		width: resolution,
		height: resolution,
		color: color,
		disableStretch: options['no-stretch'] ? parseBoolean(options['no-stretch']) : false,
		typefaceFile: fontFile,
		textSizeFixed: options['fixed-text'] ? parseBoolean(options['fixed-text']) : false,
		textAlign: textAlign,
		flexibleWidth: flexibleWidth,
		disableOutline: options['no-outline'] ? parseBoolean(options['no-outline']) : false,
		outlineWidth: flexibleWidth ? 18 : 12,
		outlineColor: options['outline-color'] ? chroma(options['outline-color']).hex() : outlineColor,
	})

	return result
}
