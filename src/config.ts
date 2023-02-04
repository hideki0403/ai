type Config = {
	version: string,
	host: string,
	i: string,
	master?: string,
	wsUrl: string,
	apiUrl: string,
	keywordEnabled: boolean,
	reversiEnabled: boolean,
	notingEnabled: boolean,
	chartEnabled: boolean,
	serverMonitoring: boolean,
	mecab?: string,
	mecabDic?: string,
	memoryDir?: string
}

const config = require('../config.json')
const packageJson = require('../package.json')

config.version = packageJson.version
config.wsUrl = config.host.replace('http', 'ws')
config.apiUrl = config.host + '/api'

export default config as Config
