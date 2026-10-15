/**
 * แม่แบบสไตล์หน้าตา — "มีหลายแบบให้เลือก" ไม่ต้องพิมพ์ค่าดิบเอง
 *
 * ค่าทุกตัวเป็นโทเค็นที่ `src/routes/layout.css` ประกาศไว้ -> ส่งเข้า inline style
 * ของเปลือกแอปผ่าน `settingsStyle()` (ดู `src/lib/settings.ts`)
 *
 * กติกาของไฟล์นี้
 * - เก็บคู่ สว่าง/มืด เพราะ layout.css ใช้ `light-dark()` (โหมดมาจาก data-theme ที่ <html>)
 * - แม่แบบเป็น "ต้นแบบ" เท่านั้น: กดใช้แล้วค่าจะถูกคัดลอกลงตาราง `styles` ของผู้ใช้
 *   แหล่งความจริงของค่าที่ใช้จริงจึงมีที่เดียวคือตาราง (แก้ต่อได้โดยไม่กระทบแม่แบบ)
 * - แม่แบบสีน้ำเงินต้องเท่ากับค่าตั้งต้นใน layout.css เป๊ะ มีเทสต์ยืนยัน
 *   (`src/lib/server/settings.test.ts` -> 'แม่แบบค่าเริ่มต้นตรงกับ layout.css')
 */

import type { StylePreset } from './settings.ts';

export type StyleValues = Omit<StylePreset, 'id' | 'name' | 'isActive'>;

export type StyleTemplate = StyleValues & {
	/** ตัวระบุคงที่ของแม่แบบ (ใช้ตอนกดใช้ + กันซ้ำ) */
	id: string;
	name: string;
	description: string;
};

type PaletteOptions = {
	/** ความสว่างของสีหลักโหมดสว่าง (ค่าตั้งต้น 0.55 ตรงกับ layout.css) */
	lightL?: number;
	darkL?: number;
	softChroma?: number;
	radiusPanel?: string;
	radiusControl?: string;
};

/**
 * สูตรสีของแม่แบบ: hue เดียวกัน ไล่ความสว่าง/ความสดให้อ่านออกทั้งสองโหมด
 * ค่าตั้งต้นของโปรเจกต์คือ `palette(258, 0.16)` ซึ่งให้ผลตรงกับ layout.css ทุกตัว
 */
function palette(hue: number, chroma: number, options: PaletteOptions = {}): StyleValues {
	const {
		lightL = 0.55,
		darkL = 0.72,
		softChroma = 0.03,
		radiusPanel = '0.75rem',
		radiusControl = '0.5rem'
	} = options;

	return {
		brandLight: `oklch(${lightL} ${chroma} ${hue})`,
		brandDark: `oklch(${darkL} ${positive(chroma - 0.03)} ${hue})`,
		brandStrongLight: `oklch(${round(lightL - 0.07)} ${positive(chroma + 0.01)} ${hue})`,
		brandStrongDark: `oklch(${round(darkL + 0.07)} ${positive(chroma - 0.04)} ${hue})`,
		brandSoftLight: `oklch(0.95 ${softChroma} ${hue})`,
		brandSoftDark: `oklch(0.32 ${positive(softChroma * 2)} ${hue})`,
		radiusPanel,
		radiusControl
	};
}

/** chroma ติดลบทำให้ CSS ไม่ถูกต้อง (เบราว์เซอร์ทิ้งค่าทั้งตัว) จึงกันที่ 0 */
function positive(value: number): number {
	return round(Math.max(0, value));
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

/** สีและมุมของโปรเจกต์ก่อนผู้ใช้เลือกแบบอื่น (ตรงกับ layout.css) */
export const defaultStyleValues: StyleValues = palette(258, 0.16);

export const styleTemplates: StyleTemplate[] = [
	{
		id: 'blue',
		name: 'น้ำเงิน',
		description: 'ค่าเริ่มต้นของโปรเจกต์',
		...palette(258, 0.16)
	},
	{
		id: 'emerald',
		name: 'มรกต',
		description: 'เขียวเข้ม สงบ อ่านนานไม่ล้า',
		...palette(158, 0.14)
	},
	{
		id: 'teal',
		name: 'เขียวน้ำทะเล',
		description: 'ฟ้าเขียว เย็นตา',
		...palette(195, 0.13)
	},
	{
		id: 'violet',
		name: 'ม่วง',
		description: 'ม่วงสด ชัดเจน',
		...palette(300, 0.16)
	},
	{
		id: 'plum',
		name: 'ม่วงแดง',
		description: 'ม่วงอมแดง นุ่ม',
		...palette(330, 0.15)
	},
	{
		id: 'rose',
		name: 'ชมพู',
		description: 'ชมพูอ่อน อบอุ่น',
		...palette(355, 0.15)
	},
	{
		id: 'amber',
		name: 'อำพัน',
		description: 'เหลืองทอง สว่าง',
		...palette(75, 0.13)
	},
	{
		id: 'terracotta',
		name: 'ดินเผา',
		description: 'ส้มอิฐ หม่น',
		...palette(45, 0.11)
	},
	{
		id: 'mono',
		name: 'เทาโมโน',
		description: 'ไม่มีสี เน้นเนื้อหา',
		...palette(255, 0.02)
	},
	{
		id: 'contrast',
		name: 'คอนทราสต์สูง',
		description: 'สีเข้ม มุมคม อ่านง่ายบนจอสว่าง',
		...palette(258, 0.16, {
			lightL: 0.42,
			darkL: 0.85,
			softChroma: 0.04,
			radiusPanel: '0.25rem',
			radiusControl: '0.25rem'
		})
	},
	{
		id: 'round',
		name: 'โค้งมน',
		description: 'มุมโค้งมาก ปุ่มเป็นแคปซูล',
		...palette(258, 0.16, { radiusPanel: '1.25rem', radiusControl: '999px' })
	},
	{
		id: 'square',
		name: 'เหลี่ยมเรียบ',
		description: 'ไม่มีมุมโค้ง ดูเป็นเครื่องมือ',
		...palette(200, 0.1, { radiusPanel: '0rem', radiusControl: '0rem' })
	}
];

/** ตัดข้อมูลเฉพาะที่เก็บลงตาราง (ไม่มี id/name/description ของแม่แบบ) */
export function templateValues(template: StyleTemplate): StyleValues {
	return {
		brandLight: template.brandLight,
		brandDark: template.brandDark,
		brandStrongLight: template.brandStrongLight,
		brandStrongDark: template.brandStrongDark,
		brandSoftLight: template.brandSoftLight,
		brandSoftDark: template.brandSoftDark,
		radiusPanel: template.radiusPanel,
		radiusControl: template.radiusControl
	};
}
