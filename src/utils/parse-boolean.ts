import includes from './includes.js'

export default function parseBoolean(str: any) {
	if (typeof str === 'string' && includes(str, ['false', 'no', 'いいえ', ])) return false
	return !!str
}
