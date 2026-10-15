import { describe, expect, it } from 'vitest';
import { evaluateExpression, ExpressionError } from './expression.ts';

describe('evaluateExpression', () => {
	it('คิดตามลำดับความสำคัญของตัวดำเนินการ', () => {
		expect(evaluateExpression('2 + 2 * 3')).toBe(8);
		expect(evaluateExpression('10 - 4 / 2')).toBe(8);
		expect(evaluateExpression('7 % 4')).toBe(3);
	});

	it('รองรับวงเล็บและเครื่องหมายลบนำหน้า', () => {
		expect(evaluateExpression('(2 + 2) * 3')).toBe(12);
		expect(evaluateExpression('-3 + 5')).toBe(2);
		expect(evaluateExpression('-(2 * 3)')).toBe(-6);
	});

	it('ยกกำลังมัดขวา และลบเลขชี้กำลังได้', () => {
		expect(evaluateExpression('2^3^2')).toBe(512);
		expect(evaluateExpression('-2^2')).toBe(-4);
		expect(evaluateExpression('2^-1')).toBe(0.5);
	});

	it('รองรับทศนิยมและสัญกรณ์วิทยาศาสตร์', () => {
		expect(evaluateExpression('1.5e2 + 0.5')).toBe(150.5);
		expect(evaluateExpression('.5 + .25')).toBe(0.75);
	});

	it('รองรับค่าคงที่และฟังก์ชันใน allowlist', () => {
		expect(evaluateExpression('sqrt(16)')).toBe(4);
		expect(evaluateExpression('max(1, 5, 3)')).toBe(5);
		expect(evaluateExpression('abs(-7)')).toBe(7);
		expect(evaluateExpression('round(pi)')).toBe(3);
	});

	it('ปฏิเสธโค้ดที่พยายามหลุดออกนอกนิพจน์เลขคณิต', () => {
		expect(() => evaluateExpression('process.exit(1)')).toThrow(ExpressionError);
		expect(() => evaluateExpression('require("fs")')).toThrow(ExpressionError);
		expect(() => evaluateExpression('constructor')).toThrow(ExpressionError);
		expect(() => evaluateExpression('1; alert(1)')).toThrow(ExpressionError);
		expect(() => evaluateExpression('[].constructor')).toThrow(ExpressionError);
	});

	it('ปฏิเสธชื่อที่มาจาก prototype ของ Object', () => {
		expect(() => evaluateExpression('toString')).toThrow(ExpressionError);
		expect(() => evaluateExpression('valueOf')).toThrow(ExpressionError);
		expect(() => evaluateExpression('__proto__')).toThrow(ExpressionError);
		expect(() => evaluateExpression('hasOwnProperty')).toThrow(ExpressionError);
	});

	it('ปฏิเสธนิพจน์ที่ผิดรูป', () => {
		expect(() => evaluateExpression('')).toThrow(ExpressionError);
		expect(() => evaluateExpression('2 +')).toThrow(ExpressionError);
		expect(() => evaluateExpression('(1 + 2')).toThrow(ExpressionError);
		expect(() => evaluateExpression('1 / 0')).toThrow(/ศูนย์/);
		expect(() => evaluateExpression('sqrt(1, 2)')).toThrow(ExpressionError);
	});

	it('จำกัดความยาวของอินพุต', () => {
		expect(() => evaluateExpression('1+'.repeat(400) + '1')).toThrow(/ยาวเกินไป/);
	});
});
