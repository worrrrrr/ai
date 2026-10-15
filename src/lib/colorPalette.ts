/**
 * คำนวณชุดสีของสไตล์จาก "สีหลัก" สีเดียว
 *
 * แนวคิด: ผู้ใช้เลือกสีหลัก (จากจานสี หรือพิมพ์ hex/oklch) แล้วส่วนที่เหลือคำนวณให้
 * - ไล่ความสว่าง/ความสดด้วยสูตรเดียวกับแม่แบบใน `src/lib/stylePresets.ts`
 *   (มีเทสต์ `src/lib/colorPalette.test.ts` ยืนยันว่าสีน้ำเงินให้ผลตรงกับแม่แบบเป๊ะ)
 * - ไฟล์นี้เป็น pure module ใช้ได้ทั้ง server และ client ไม่พึ่ง DOM
 * - ค่าที่ได้เป็น `oklch(...)` ธรรมดา ซึ่งผ่านการตรวจ `isCssColor()` ของ `#lib/settings.ts`
 */

import type { StyleValues } from './stylePresets.ts';

/** hue ที่ใช้เมื่อสีที่เลือกไม่มีสี (เทา/ขาว/ดำ) */
const NEUTRAL_HUE = 255;

const CHROMA_RANGE = { min: 0.03, max: 0.18 };
const LIGHTNESS_RANGE = { min: 0.45, max: 0.62 };

export type OklchColor = { l: number; c: number; h: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** ปัดทศนิยม 3 ตำแหน่ง เพื่อให้ค่าที่เก็บ/เทสต์คงที่ไม่เพี้ยนจาก floating point */
function num(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function srgbToLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** hex (#rgb / #rrggbb) -> oklch ตามสูตรมาตรฐาน OKLab ของ Björn Ottosson */
export function hexToOklch(hex: string): OklchColor | null {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) return null;

	let digits = match[1];
	if (digits.length === 3) {
		digits = digits
			.split('')
			.map((char) => char + char)
			.join('');
	}

	const r = srgbToLinear(parseInt(digits.slice(0, 2), 16) / 255);
	const g = srgbToLinear(parseInt(digits.slice(2, 4), 16) / 255);
	const b = srgbToLinear(parseInt(digits.slice(4, 6), 16) / 255);

	const lRoot = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const mRoot = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const sRoot = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

	const l = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
	const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
	const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

	const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;

	return {
		l: num(l),
		c: num(Math.hypot(a, bAxis)),
		h: num(hue < 0 ? hue + 360 : hue)
	};
}

/**
 * อ่านสีหลักที่ผู้ใช้กรอก -> oklch
 * รับ hex (#2563eb), oklch(0.55 0.16 258) และ rgb(37, 99, 235) — คืน null เมื่ออ่านไม่ได้
 */
export function parsePrimaryColor(value: string): OklchColor | null {
	const text = value.trim();

	const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(text);
	if (oklch) {
		return { l: Number(oklch[1]), c: Number(oklch[2]), h: Number(oklch[3]) };
	}

	const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
	if (rgb) {
		const toHex = (part: string) => Number(part).toString(16).padStart(2, '0');
		return hexToOklch(`#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`);
	}

	return hexToOklch(text);
}

/**
 * สีหลัก 1 สี -> โทเค็นทั้งชุด (สว่าง/มืด)
 * - hue คงเดิม, chroma ถูกจำกัดช่วงให้อยู่ใน gamut และอ่านออกทั้งสองโหมด
 * - สีที่ไม่มีสี (เทา/ขาว/ดำ) จัดเป็นโทนโมโน
 * - คืน null เมื่ออ่านสีไม่ได้ (ให้ UI ถอยไปใช้โหมดกำหนดเอง)
 */
export function mainColorsFromPrimary(
	value: string,
	options: { radiusPanel?: string; radiusControl?: string } = {}
): StyleValues | null {
	const parsed = parsePrimaryColor(value);
	if (!parsed) return null;

	const neutral = parsed.c < 0.02;
	const hue = num(neutral ? NEUTRAL_HUE : parsed.h);
	const chroma = num(clamp(neutral ? 0.03 : parsed.c, CHROMA_RANGE.min, CHROMA_RANGE.max));
	const lightness = num(clamp(parsed.l, LIGHTNESS_RANGE.min, LIGHTNESS_RANGE.max));

	const at = (l: number, c: number) => `oklch(${num(l)} ${num(Math.max(0, c))} ${hue})`;

	return {
		brandLight: at(lightness, chroma),
		brandDark: at(0.72, chroma - 0.03),
		brandStrongLight: at(lightness - 0.07, chroma + 0.01),
		brandStrongDark: at(0.79, chroma - 0.04),
		brandSoftLight: `oklch(0.95 0.03 ${hue})`,
		brandSoftDark: `oklch(0.32 0.06 ${hue})`,
		radiusPanel: options.radiusPanel ?? '0.75rem',
		radiusControl: options.radiusControl ?? '0.5rem'
	};
}

/** oklch -> hex (ใช้กับ <input type="color"> ที่รับได้แค่ hex) */
export function oklchToHex(color: OklchColor): string {
	const radians = (color.h * Math.PI) / 180;
	const a = color.c * Math.cos(radians);
	const b = color.c * Math.sin(radians);

	const lRoot = color.l + 0.3963377774 * a + 0.2158037573 * b;
	const mRoot = color.l - 0.1055613458 * a - 0.0638541728 * b;
	const sRoot = color.l - 0.0894841775 * a - 1.291485548 * b;

	const l3 = lRoot ** 3;
	const m3 = mRoot ** 3;
	const s3 = sRoot ** 3;

	const linear = {
		r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
		g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
		b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
	};

	const toSrgb = (channel: number) =>
		channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

	const byte = (channel: number) =>
		Math.round(clamp(toSrgb(channel), 0, 1) * 255)
			.toString(16)
			.padStart(2, '0');

	return `#${byte(linear.r)}${byte(linear.g)}${byte(linear.b)}`;
}

/** สี CSS ที่ผู้ใช้กรอก -> hex สำหรับจานสีของเบราว์เซอร์ (คืน null ถ้าแปลงไม่ได้) */
export function primaryToHex(value: string): string | null {
	const hex = /^#([0-9a-f]{6})$/i.test(value.trim()) ? value.trim().toLowerCase() : null;
	if (hex) return hex;

	const parsed = parsePrimaryColor(value);
	return parsed ? oklchToHex(parsed) : null;
}

/**
 * โทเค็นพื้นผิว/ตัวอักษร/เส้น ที่ "ไล่ hue เดียวกับสีหลัก"
 *
 * เหตุผล: หน้าจอส่วนใหญ่ใช้โทเค็นกลุ่มนี้ (มากกว่ากลุ่มแบรนด์หลายเท่า) ถ้าไม่ให้เปลี่ยนตาม
 * การสลับสไตล์จะดูเหมือน "ไม่เปลี่ยน" — chroma ต่ำมาก (0.003-0.018) เพื่อให้ยังอ่านสบาย
 * และที่ hue 255 ค่าเหล่านี้ใกล้เคียงค่าตั้งต้นใน layout.css
 */
export function surfaceTokensForHue(hue: number): Record<string, string> {
	const h = num(hue);
	const pair = (light: string, dark: string) =>
		`light-dark(oklch(${light} ${h}), oklch(${dark} ${h}))`;

	return {
		'--surface-canvas': pair('0.985 0.006', '0.19 0.014'),
		'--surface-raised': pair('1 0.003', '0.235 0.016'),
		'--surface-sunken': pair('0.965 0.008', '0.165 0.014'),
		'--surface-hover': pair('0.955 0.008', '0.275 0.018'),
		'--line-subtle': pair('0.925 0.008', '0.31 0.016'),
		'--line-strong': pair('0.86 0.01', '0.4 0.018'),
		'--ink-primary': pair('0.24 0.012', '0.95 0.004'),
		'--ink-secondary': pair('0.46 0.014', '0.78 0.01'),
		'--ink-muted': pair('0.62 0.012', '0.62 0.012')
	};
}
