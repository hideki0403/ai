import * as fs from 'fs'
import * as yaml from 'js-yaml'
import rootPath from 'app-root-path'

const config = yaml.load(fs.readFileSync(rootPath.resolve('config.yaml'), 'utf8'), { schema: yaml.FAILSAFE_SCHEMA }) as Config
const packageJson = require(rootPath.resolve('package.json')) as { version: string }

config.version = packageJson.version
config.wsUrl = config.host.replace('http', 'ws')
config.apiUrl = config.host + '/api'

export default config as Config

type Config = {
	version: string,
	host: string,
	token: string,
	master?: string,
	wsUrl: string,
	apiUrl: string,
	keywordEnabled: boolean,
	notingEnabled: boolean,
	chartEnabled: boolean,
	serverMonitoring: boolean,
	mecab?: string,
	mecabDic?: string,
	memoryDir?: string
}
