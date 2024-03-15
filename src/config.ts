import * as fs from 'fs'
import * as yaml from 'js-yaml'
import rootPath from 'app-root-path'

const config = yaml.load(fs.readFileSync(rootPath.resolve('config.yaml'), 'utf8')) as Config
const packageJson = require(rootPath.resolve('package.json')) as { version: string }

config.version = packageJson.version

type Config = {
	version: string,
	host: string,
	token: string,
	master?: string,
	keywordEnabled: boolean,
	reversiEnabled: boolean,
	notingEnabled: boolean,
	chartEnabled: boolean,
	mazeEnabled: boolean,
	timeSignalEnabled: boolean,
	newEmojiDetectorEnabled: boolean,
	newEmojiAnnouncementAtOnce?: boolean,
	ignoreCategory: string,
	serverMonitoring: boolean,
	mecab?: string,
	mecabDic?: string,
	memoryDir?: string,
	watchDog?: boolean,
	watchDogInterval?: number,
	watchDogTimeout?: number,
}

export default config as Config;
