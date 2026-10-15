import { describe, expect, it } from 'vitest';
import {
	hexToOklch,
	mainColorsFromPrimary,
	oklchToHex,
	parsePrimaryColor,
	primaryToHex,
	surfaceTokensForHue
} from './colorPalette.ts';
import { isCssColor } from './settings.ts';
import { styleTemplates, templateValues } from './stylePresets.ts';

describe('hexToOklch', () => {
	it('ขาว/ดำ ได้ค่า L ตรงตามนิยาม', () => {
		expect(hexToOklch('#ffffff')).toMatchObject({ l: 1 });
		expect(hexToOklch('#000000')).toMatchObject({ l: 0, c: 0 });
	});

	it('แดง #ff0000 ตรงกับค่าอ้างอิงของ OKLCH', () => {
		const red = hexToOklch('#ff0000')!;
		expect(red.l).toBeCloseTo(0.628, 2);
		expect(red.c).toBeCloseTo(0.258, 2);
		expect(red.h).toBeCloseTo(29.23, 1);
	});

	it('รับรูปย่อ #rgb และคืน null เมื่อรูปแบบผิด', () => {
		expect(hexToOklch('#fff')).toMatchObject({ l: 1 });
		expect(hexToOklch('ไม่ใช่สี')).toBeNull();
		expect(hexToOklch('#12345')).toBeNull();
	});
});

describe('parsePrimaryColor', () => {
	it('อ่าน oklch ที่โปรเจกต์เก็บอยู่ได้ตรง ๆ', () => {
		expect(parsePrimaryColor('oklch(0.55 0.16 258)')).toEqual({ l: 0.55, c: 0.16, h: 258 });
	});

	it('อ่าน rgb ได้ (จานสีของเบราว์เซอร์ให้ hex แต่ผู้ใช้อาจพิมพ์ rgb)', () => {
		const parsed = parsePrimaryColor('rgb(255, 0, 0)')!;
		expect(parsed.h).toBeCloseTo(29.23, 1);
	});

	it('คืน null เมื่ออ่านไม่ได้', () => {
		expect(parsePrimaryColor('แดง')).toBeNull();
		expect(parsePrimaryColor('')).toBeNull();
	});
});

describe('mainColorsFromPrimary', () => {
	it('สีน้ำเงินของโปรเจกต์ให้ผลตรงกับแม่แบบ "น้ำเงิน" เป๊ะ (สูตรเดียวกัน)', () => {
		const blue = styleTemplates.find((template) => template.id === 'blue')!;
		expect(mainColorsFromPrimary('oklch(0.55 0.16 258)')).toEqual(templateValues(blue));
	});

	it('สีจากจานสี (hex) ให้โทเค็นที่ใช้งานได้จริงทั้งชุด', () => {
		const values = mainColorsFromPrimary('#2563eb')!;
		const colors = [
			values.brandLight,
			values.brandDark,
			values.brandStrongLight,
			values.brandStrongDark,
			values.brandSoftLight,
			values.brandSoftDark
		];
		for (const color of colors) {
			expect(isCssColor(color), `${color} ต้องเป็นค่า CSS สีที่ผ่านการตรวจ`).toBe(true);
		}
		// hue ของสีหลักต้องเท่ากับ hue ที่อ่านจาก hex (ไม่ถูกบิด)
		const parsed = parsePrimaryColor('#2563eb')!;
		expect(values.brandLight).toContain(String(Math.round(parsed.h * 1000) / 1000));
	});

	it('โทนเทา/ขาว/ดำ จัดเป็นโทนโมโน ไม่ได้ hue มั่ว', () => {
		const grey = mainColorsFromPrimary('#808080')!;
		expect(grey.brandLight).toBe('oklch(0.6 0.03 255)');
		expect(grey.brandSoftDark).toBe('oklch(0.32 0.06 255)');
	});

	it('สีที่สว่าง/เข้มเกินไปถูกจำกัดช่วงให้ยังอ่านออก', () => {
		const light = mainColorsFromPrimary('#ffffff')!;
		expect(light.brandLight).toBe('oklch(0.62 0.03 255)');

		const dark = mainColorsFromPrimary('#000000')!;
		expect(dark.brandLight).toBe('oklch(0.45 0.03 255)');
	});

	it('chroma ไม่ติดลบ (ค่า CSS ต้องไม่เสีย)', () => {
		const mono = mainColorsFromPrimary('#808080')!;
		for (const value of Object.values(mono)) {
			expect(value).not.toMatch(/-\d/);
		}
	});

	it('คงมุมโค้งที่ส่งเข้ามา และคืน null เมื่อสีอ่านไม่ได้', () => {
		const values = mainColorsFromPrimary('#2563eb', {
			radiusPanel: '1.25rem',
			radiusControl: '999px'
		})!;
		expect(values.radiusPanel).toBe('1.25rem');
		expect(values.radiusControl).toBe('999px');
		expect(mainColorsFromPrimary('ม่วง')).toBeNull();
	});
});

describe('surfaceTokensForHue', () => {
	it('คืนโทเค็นพื้นผิว/ตัวอักษร/เส้น เป็นคู่ light-dark ครบ 9 ตัว', () => {
		const tokens = surfaceTokensForHue(258);

		expect(Object.keys(tokens)).toHaveLength(9);
		expect(tokens['--surface-canvas']).toBe(
			'light-dark(oklch(0.985 0.006 258), oklch(0.19 0.014 258))'
		);

		for (const value of Object.values(tokens)) {
			expect(value.startsWith('light-dark(')).toBe(true);
			expect(value).not.toContain('NaN');
			expect(value).toContain('258');
		}
	});

	it('hue ต่างกันให้ค่าต่างกัน (สลับสไตล์แล้วหน้าจอเปลี่ยนจริง)', () => {
		expect(surfaceTokensForHue(158)['--surface-canvas']).not.toBe(
			surfaceTokensForHue(258)['--surface-canvas']
		);
	});
});
