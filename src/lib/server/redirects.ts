/**
 * ค่าที่รับมาจาก query string แล้วเอาไป redirect ต่อได้เฉพาะ path ภายในเว็บเท่านั้น
 * กัน open redirect เช่น ?next=https://evil.com หรือ ?next=//evil.com
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
	if (typeof value !== 'string' || value.length === 0) return fallback;
	if (!value.startsWith('/')) return fallback;
	if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
	// backslash บางไคลเอนต์ normalize เป็น '/' จึงกันไว้ด้วย
	if (value.includes('\\')) return fallback;
	return value;
}
