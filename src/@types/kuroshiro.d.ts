declare module 'kuroshiro' {
  export default class {
	convert: (text: string, options: { [key: string]: string }) => Promise<string>
  } 
}
