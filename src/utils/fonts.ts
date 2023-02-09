import fs from 'fs'
import rootPath from 'app-root-path'

const fontExtensinon = /\.(ttf|otf)$/
const availableFonts = fs.readdirSync(rootPath.resolve('./fonts')).filter(name => name.match(fontExtensinon))
const availableFontsName = availableFonts.map(name => name.replace(fontExtensinon, ''))

export default {
	availableFonts,
	availableFontsName
}
