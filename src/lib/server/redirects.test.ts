import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './redirects.ts';

describe('safeInternalPath', () => {
	it('ปล่อยผ่าน path ภายในตามเดิม', () => {
		expect(safeInternalPath('/chat/1')).toBe('/chat/1');
		expect(safeInternalPath('/settings/providers')).toBe('/settings/providers');
	});

	it('กัน open redirect ทุกแบบที่รู้จัก', () => {
		expect(safeInternalPath('//evil.com')).toBe('/');
		expect(safeInternalPath('https://evil.com')).toBe('/');
		expect(safeInternalPath('/\\evil.com')).toBe('/');
		expect(safeInternalPath('/a\\b')).toBe('/');
		expect(safeInternalPath('javascript:alert(1)')).toBe('/');
	});

	it('ค่าเปล่า/ผิดรูปได้ fallback', () => {
		expect(safeInternalPath(null)).toBe('/');
		expect(safeInternalPath(undefined)).toBe('/');
		expect(safeInternalPath('')).toBe('/');
		expect(safeInternalPath('chat')).toBe('/');
	});

	it('ใช้ fallback ที่กำหนดเองได้', () => {
		expect(safeInternalPath('//evil.com', '/chat')).toBe('/chat');
	});
});
