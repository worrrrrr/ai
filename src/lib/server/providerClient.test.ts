import { describe, expect, it } from 'vitest';
import {
	buildProviderChatRequest,
	chatCompletionsUrl,
	pickChatModel,
	readProviderChatText,
	readProviderError
} from './providerClient.ts';

describe('pickChatModel', () => {
	it('เลือกตัวแรกที่แชทได้ และข้ามโมเดลที่ไม่รองรับแชท', () => {
		expect(pickChatModel(['whisper-large-v3', 'llama-3.1-8b-instant'])).toBe(
			'llama-3.1-8b-instant'
		);
		expect(pickChatModel(['tts-1', 'text-embedding-3-small'])).toBeNull();
	});

	it('ถ้าผู้ใช้ตั้งโมเดลที่แชทได้และอยู่ในรายการ -> ใช้ตัวนั้นก่อน', () => {
		expect(pickChatModel(['a', 'b'], 'b')).toBe('b');
	});

	it('โมเดลที่ตั้งไว้ไม่เหมาะ/ไม่อยู่ในรายการ -> ถอยไปตัวแรกที่แชทได้', () => {
		expect(pickChatModel(['llama-3.1-8b', 'whisper-1'], 'whisper-1')).toBe('llama-3.1-8b');
		expect(pickChatModel(['llama-3.1-8b'], 'ไม่มีอยู่')).toBe('llama-3.1-8b');
	});

	it('รายการว่าง/มีแต่ช่องว่าง -> null (ผู้เรียกต้องข้ามการทดสอบ ไม่เดา)', () => {
		expect(pickChatModel([])).toBeNull();
		expect(pickChatModel(['  ', ''])).toBeNull();
	});
});

describe('chatCompletionsUrl', () => {
	it('ต่อท้ายให้เองถ้ายังไม่มี', () => {
		expect(chatCompletionsUrl('https://api.example.com/v1')).toBe(
			'https://api.example.com/v1/chat/completions'
		);
	});

	it('ไม่ต่อซ้ำ และทนเครื่องหมาย / เกิน', () => {
		expect(chatCompletionsUrl('https://api.example.com/v1/chat/completions')).toBe(
			'https://api.example.com/v1/chat/completions'
		);
		expect(chatCompletionsUrl('  https://api.example.com/v1//  ')).toBe(
			'https://api.example.com/v1/chat/completions'
		);
	});
});

describe('buildProviderChatRequest', () => {
	it('ใส่ system เมื่อมี และไม่ใส่เมื่อว่าง', () => {
		const withSystem = buildProviderChatRequest({
			model: 'm',
			system: '  ตอบสั้น  ',
			prompt: 'ถาม',
			temperature: 0.2
		});
		expect(withSystem.messages).toEqual([
			{ role: 'system', content: 'ตอบสั้น' },
			{ role: 'user', content: 'ถาม' }
		]);
		expect(withSystem.temperature).toBe(0.2);

		const withoutSystem = buildProviderChatRequest({ model: 'm', system: '   ', prompt: 'ถาม' });
		expect(withoutSystem.messages).toEqual([{ role: 'user', content: 'ถาม' }]);
		expect(withoutSystem.temperature).toBe(0.7);
	});
});

describe('readProviderChatText', () => {
	it('อ่านรูปแบบ OpenAI (choices[0].message.content)', () => {
		expect(readProviderChatText({ choices: [{ message: { content: 'ตอบแล้ว' } }] })).toBe(
			'ตอบแล้ว'
		);
	});

	it('อ่านรูปแบบ responses (output_text) และ choices[0].text', () => {
		expect(readProviderChatText({ output_text: 'ก' })).toBe('ก');
		expect(readProviderChatText({ choices: [{ text: 'ข' }] })).toBe('ข');
	});

	it('ข้อความว่าง/รูปแบบไม่รู้จัก -> null (ไม่แต่งคำตอบขึ้นเอง)', () => {
		expect(readProviderChatText({ choices: [{ message: { content: '   ' } }] })).toBeNull();
		expect(readProviderChatText({ อะไรก็ไม่รู้: 1 })).toBeNull();
		expect(readProviderChatText(null)).toBeNull();
		expect(readProviderChatText('ข้อความดิบ')).toBeNull();
	});
});

describe('readProviderError', () => {
	it('หยิบข้อความ error ออกมา และบอกสถานะกำกับ', () => {
		expect(readProviderError({ error: { message: 'invalid api key' } }, 401)).toBe(
			'ผู้ให้บริการตอบ 401: invalid api key'
		);
		expect(readProviderError({ message: 'bad request' }, 400)).toBe(
			'ผู้ให้บริการตอบ 400: bad request'
		);
	});

	it('ไม่มีข้อความ -> บอกแค่สถานะ (ยังอ่านรู้เรื่อง)', () => {
		expect(readProviderError({}, 500)).toBe('ผู้ให้บริการตอบสถานะ 500');
		expect(readProviderError(null, 502)).toBe('ผู้ให้บริการตอบสถานะ 502');
	});
});
