import { describe, expect, it } from 'vitest';
import { envProviders } from './providerEnv.ts';

describe('envProviders', () => {
	it('env ว่าง/ไม่มีค่า -> ไม่มีผู้ให้บริการ (ไม่แต่งขึ้นเอง)', () => {
		expect(envProviders(undefined)).toEqual([]);
		expect(envProviders({})).toEqual([]);
		expect(envProviders({ GROQ_API_KEY: '   ' })).toEqual([]);
	});

	it('มีคีย์ -> ได้ผู้ให้บริการ พร้อม base URL/โมเดลมาตรฐาน', () => {
		const providers = envProviders({ GROQ_API_KEY: 'k1' });

		expect(providers).toHaveLength(1);
		expect(providers[0]).toEqual({
			id: 'env:groq',
			label: 'Groq (.env)',
			baseUrl: 'https://api.groq.com/openai/v1',
			apiKey: 'k1',
			model: 'openai/gpt-oss-20b'
		});
	});

	it('ใช้ค่า BASE_URL / MODEL ที่ตั้งเองได้', () => {
		const [provider] = envProviders({
			DEEPSEEK_API_KEY: 'k2',
			DEEPSEEK_BASE_URL: ' https://proxy.example.com/v1 ',
			DEEPSEEK_MODEL: ' deepseek-v4-flash '
		});

		expect(provider.baseUrl).toBe('https://proxy.example.com/v1');
		expect(provider.model).toBe('deepseek-v4-flash');
	});

	it('มีหลายคีย์ -> ได้ครบ และ id ไม่ชนกับของฐานข้อมูล (ขึ้นต้น env:)', () => {
		const providers = envProviders({
			GROQ_API_KEY: 'a',
			GEMINI_API_KEY: 'b',
			DEEPSEEK_API_KEY: 'c'
		});

		expect(providers.map((provider) => provider.id)).toEqual([
			'env:groq',
			'env:gemini',
			'env:deepseek'
		]);
		expect(providers.every((provider) => provider.id.startsWith('env:'))).toBe(true);
	});
});
