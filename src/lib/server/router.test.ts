import { describe, expect, it } from 'vitest';
import { MIN_ROUTER_SCORE, selectTools } from './router.ts';

const available = ['calculate', 'search', 'weather'];

describe('selectTools', () => {
	it('งานหาเหตุผลไม่ต้องใช้ tool เลย', () => {
		expect(selectTools('reason', 0.99, available)).toEqual({ names: [], strategy: 'no-tools' });
	});

	it('เลือก tool เดียวเมื่อมั่นใจพอ', () => {
		expect(selectTools('math', MIN_ROUTER_SCORE, available)).toEqual({
			names: ['calculate'],
			strategy: 'filtered'
		});
	});

	it('ต่ำกว่าเกณฑ์ = ส่งทุก tool ให้โมเดลเลือกเอง', () => {
		expect(selectTools('weather', 0.2, available)).toEqual({
			names: available,
			strategy: 'fallback'
		});
	});

	it('choice ที่ไม่รู้จัก = fallback', () => {
		expect(selectTools('other', 0.9, available)).toEqual({
			names: available,
			strategy: 'fallback'
		});
	});

	it('choice ที่ชื่อชนกับ prototype = fallback', () => {
		expect(selectTools('toString', 0.9, available)).toEqual({
			names: available,
			strategy: 'fallback'
		});
	});

	it('tool ที่ถูกเลือกไม่มีอยู่จริง = fallback', () => {
		expect(selectTools('math', 0.9, ['search'])).toEqual({
			names: ['search'],
			strategy: 'fallback'
		});
	});

	it('ผู้ใช้สั่งเองผ่าน /command = ใช้ตามนั้น (forced) ไม่สนใจคะแนน/choice', () => {
		expect(selectTools('reason', 0, available, ['search'])).toEqual({
			names: ['search'],
			strategy: 'forced'
		});
	});

	it('forced กรองเหลือเฉพาะ tool ที่มีจริง', () => {
		expect(selectTools('reason', 0, ['search'], ['calculate', 'search'])).toEqual({
			names: ['search'],
			strategy: 'forced'
		});
	});

	it('forced ที่ไม่มี tool จริงเลย = ตกไปใช้ตรรกะปกติ', () => {
		expect(selectTools('math', 0.9, available, ['nope'])).toEqual({
			names: ['calculate'],
			strategy: 'filtered'
		});
	});
});
