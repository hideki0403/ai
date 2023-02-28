export default function zeroPad(num: number, length: number = 2): string {
	return num.toString().padStart(length, '0')
}
