import { describe, expect, it } from 'vitest';
import { callAgent } from './agentCall.ts';
import type { CredentialLike } from './providerRouting.ts';

const ready: CredentialLike = {
	id: 'p1',
	label: 'OpenRouter',
	base_url: 'https://openrouter.ai/api/v1',
	key_sealed: 'iv.cipher'
};

const base = {
	model: 'm',
	system: null as string | null,
	prompt: 'ถาม',
	temperature: 0.5,
	providerId: null as string | null,
	credentials: [] as CredentialLike[],
	keySecret: 'secret' as string | null,
	runDefault: async () => 'จากค่าเริ่มต้น'
};

describe('callAgent', () => {
	it('ไม่มีผู้ให้บริการ -> ใช้ค่าเริ่มต้น และบอกว่าใช้ทางไหน/ชื่ออะไร', async () => {
		const result = await callAgent(base);
		expect(result).toEqual({
			text: 'จากค่าเริ่มต้น',
			error: null,
			used: 'default',
			label: 'ค่าเริ่มต้นของระบบ'
		});
	});

	it('ค่าเริ่มต้นล้ม -> คืน error ไม่โยนออกไป', async () => {
		const result = await callAgent({
			...base,
			runDefault: async () => {
				throw new Error('Ollama ไม่ตอบ');
			}
		});
		expect(result.text).toBeNull();
		expect(result.error).toBe('Ollama ไม่ตอบ');
	});

	it('ตั้งผู้ให้บริการไว้แต่ไม่มีคีย์ -> ล้ม (ไม่ถอยไปค่าเริ่มต้น)', async () => {
		const result = await callAgent({
			...base,
			providerId: 'p1',
			credentials: [{ ...ready, key_sealed: null }]
		});
		expect(result.text).toBeNull();
		expect(result.used).toBe('provider');
		expect(result.error).toContain('ยังไม่มีคีย์');
	});

	it('ตั้งผู้ให้บริการไว้แต่หาข้อมูลไม่เจอ -> ล้ม ไม่ยิงที่อื่นแทน', async () => {
		const result = await callAgent({ ...base, providerId: 'p9', credentials: [ready] });
		expect(result.text).toBeNull();
		expect(result.error).toContain('ไม่พบข้อมูลผู้ให้บริการ');
	});

	it('ยังไม่ได้ตั้ง PROVIDER_KEY_SECRET -> บอกเหตุชัดเจนก่อนเปิดคีย์', async () => {
		const result = await callAgent({
			...base,
			providerId: 'p1',
			credentials: [ready],
			keySecret: null
		});
		expect(result.text).toBeNull();
		expect(result.error).toContain('PROVIDER_KEY_SECRET');
	});

	it('คีย์เปิดไม่ได้ (รหัสคนละตัว) -> บอกชื่อผู้ให้บริการ ไม่ทำให้ทั้งรอบล้ม', async () => {
		const result = await callAgent({
			...base,
			providerId: 'p1',
			credentials: [ready],
			keySecret: 'secret-ผิด'
		});
		expect(result.text).toBeNull();
		expect(result.label).toBe('OpenRouter');
		expect(result.error).toContain('เปิดคีย์');
	});
});
