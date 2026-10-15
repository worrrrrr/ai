import { describe, expect, it } from 'vitest';
import { decideRoute, type CredentialLike } from './providerRouting.ts';

const ready: CredentialLike = {
	id: 'p1',
	label: '  OpenRouter  ',
	base_url: 'https://openrouter.ai/api/v1',
	key_sealed: 'iv.cipher'
};

describe('decideRoute', () => {
	it('ไม่ตั้งผู้ให้บริการ -> ใช้ค่าเริ่มต้นของระบบ (Ollama)', () => {
		expect(decideRoute(null, [ready])).toEqual({ kind: 'default' });
		expect(decideRoute('   ', [ready])).toEqual({ kind: 'default' });
	});

	it('ตั้งไว้และพร้อมใช้ -> คืนปลายทางจริง พร้อม ciphertext ของคีย์ (ตัดช่องว่างชื่อ)', () => {
		expect(decideRoute('p1', [ready])).toEqual({
			kind: 'provider',
			label: 'OpenRouter',
			baseUrl: 'https://openrouter.ai/api/v1',
			sealed: 'iv.cipher'
		});
	});

	it('หาผู้ให้บริการไม่เจอ -> ล้ม ห้ามยิงที่อื่นแทน', () => {
		const decision = decideRoute('p9', [ready]);
		expect(decision.kind).toBe('error');
		if (decision.kind === 'error') expect(decision.message).toContain('ไม่พบข้อมูลผู้ให้บริการ');
	});

	it('ไม่มี base URL -> ล้มพร้อมบอกชื่อผู้ให้บริการ', () => {
		const decision = decideRoute('p1', [{ ...ready, base_url: '  ' }]);
		expect(decision.kind).toBe('error');
		if (decision.kind === 'error') expect(decision.message).toContain('OpenRouter');
	});

	it('ยังไม่มีคีย์ -> ล้ม (ไม่แอบใช้ค่าเริ่มต้น)', () => {
		const decision = decideRoute('p1', [{ ...ready, key_sealed: null }]);
		expect(decision.kind).toBe('error');
		if (decision.kind === 'error') expect(decision.message).toContain('ยังไม่มีคีย์');
	});

	it('ชื่อว่าง -> ใช้ id แทนในข้อความ error (ยังรู้ว่าเป็นตัวไหน)', () => {
		const decision = decideRoute('p1', [{ ...ready, label: null, key_sealed: null }]);
		if (decision.kind === 'error') expect(decision.message).toContain('p1');
	});
});
