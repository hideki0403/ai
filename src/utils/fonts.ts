import fs from 'fs'
import rootPath from 'app-root-path'

const fontExtensinon = /\.(ttf|otf)$/
const availableFonts = fs.readdirSync(rootPath.resolve('./fonts')).filter(name => name.match(fontExtensinon))
const availableFontsName = availableFonts.map(name => name.replace(fontExtensinon, ''))

function findFont(fontName = 'default') {
	const filename = availableFonts.find(name => name.includes(fontName))
	return rootPath.resolve(`./fonts/${filename}`)
}

export default {
	availableFonts,
	availableFontsName,
	findFont
}
