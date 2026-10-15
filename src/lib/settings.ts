/**
 * ค่าที่ผู้ใช้ปรับได้ (ธีม, ความหนาแน่น, ความกว้าง sidebar, ความกว้างคอลัมน์, โทเค็นของสไตล์)
 *
 * ไฟล์นี้เป็น pure module ใช้ได้ทั้งฝั่ง server และ client — ไม่พึ่งฐานข้อมูลและไม่พึ่ง zod
 * - การอ่าน/เขียนตารางอยู่ที่ `#lib/server/settings.ts`
 * - ฟังก์ชันตรวจค่าในไฟล์นี้เป็น "ด่านสุดท้าย" ก่อนค่ากลายเป็น inline style
 *   (ค่าใดไม่ผ่านจะถูกทิ้ง ไม่ถูกนำไปใช้)
 *
 * ลำดับการทับค่าของหน้าตา (ต่ำ -> สูง)
 *   ค่าตั้งต้นใน layout.css -> ธีม light/dark -> ค่าของผู้ใช้ (cookie / ตาราง user_settings / ตาราง styles)
 */

import { parsePrimaryColor, surfaceTokensForHue } from './colorPalette.ts';

export type AppUser = {
	id: string;
	email: string | null;
};
export type ThemeChoice = 'light' | 'dark' | 'auto';

export type UserSettings = {
	/** ธีมที่ผู้ใช้เลือก — auto = ตามระบบ */
	theme: ThemeChoice;
	/** ความกว้าง sidebar ตอนขยาย (CSS length) */
	sidebarWidth: string;
	/** ตัวคูณระยะห่างแนวตั้ง (โหมดกะทัดรัด = 0.85) */
	density: number;
	/** ความกว้างสูงสุดของคอลัมน์เนื้อหา (CSS length) */
	columnMax: string;
	/** สถานะย่อ sidebar ครั้งล่าสุด */
	sidebarCollapsed: boolean;
	/** แถบด้านข้างอยู่ซ้ายหรือขวา */
	sidebarSide: 'left' | 'right';
	/** รูปแบบแถบด้านข้าง: ชิดขอบ / ลอย / อินเซ็ต (เนื้อหาเป็นก้อนโค้ง) */
	sidebarVariant: 'sidebar' | 'floating' | 'inset';
	/** วิธีย่อ: ซ่อนทั้งหมด / ย่อเหลือไอคอน / ย่อไม่ได้ */
	sidebarCollapsible: 'offcanvas' | 'icon' | 'none';
	/** สเกลทั้งจอ (ตัวอักษร+ระยะห่าง) — 1 = ปกติ */
	fontScale: number;
};

/** โทเค็นที่ตาราง `styles` เขียนทับได้ — ชื่อต้องตรงกับคอลัมน์ใน supabase/migrations/0002_settings.sql */
export type StylePreset = {
	id: string;
	name: string;
	/** สีหลักของแบรนด์ แยกโหมดสว่าง/มืด เพราะ layout.css ใช้ light-dark() */
	brandLight: string;
	brandDark: string;
	brandStrongLight: string;
	brandStrongDark: string;
	brandSoftLight: string;
	brandSoftDark: string;
	/** มุมโค้งของการ์ด/คอนโทรล */
	radiusPanel: string;
	radiusControl: string;
	/** สไตล์ที่ถูกเลือกใช้อยู่ (เก็บเป็น user_settings.style_id) */
	isActive: boolean;
};

export const defaultSettings: UserSettings = {
	theme: 'auto',
	sidebarWidth: '17rem',
	density: 1,
	columnMax: '46rem',
	sidebarCollapsed: false,
	sidebarSide: 'left',
	sidebarVariant: 'sidebar',
	sidebarCollapsible: 'offcanvas',
	fontScale: 1
};

/** ชื่อคุกกี้ — `theme` ถูกอ่านใน app.html ก่อน paint จึงต้องเป็นคุกกี้ที่ JS อ่านได้ */
export const THEME_COOKIE = 'theme';
export const LAYOUT_COOKIE = 'layout';

/** ตัวเลือกที่หน้า /settings/layout เสนอ พร้อมช่องให้พิมพ์ค่าเองได้ทุกช่อง */
export const themeChoices: { value: ThemeChoice; label: string }[] = [
	{ value: 'auto', label: 'ตามระบบ' },
	{ value: 'light', label: 'สว่าง' },
	{ value: 'dark', label: 'มืด' }
];

export const sidebarWidthChoices: { value: string; label: string }[] = [
	{ value: '14rem', label: 'แคบมาก' },
	{ value: '17rem', label: 'ปกติ' },
	{ value: '20rem', label: 'กว้าง' },
	{ value: '23rem', label: 'กว้างมาก' },
	{ value: '26rem', label: 'กว้างที่สุด' }
];

export const sidebarSideChoices: { value: 'left' | 'right'; label: string }[] = [
	{ value: 'left', label: 'ซ้าย' },
	{ value: 'right', label: 'ขวา' }
];

/** รูปแบบแถบด้านข้าง (แบบเดียวกับ shadcn-svelte: sidebar/floating/inset แต่ทำเองด้วยโทเค็นของเรา) */
export const sidebarVariantChoices: {
	value: 'sidebar' | 'floating' | 'inset';
	label: string;
}[] = [
	{ value: 'sidebar', label: 'ชิดขอบ' },
	{ value: 'floating', label: 'ลอย' },
	{ value: 'inset', label: 'อินเซ็ต' }
];

/** วิธีย่อแถบด้านข้าง */
export const sidebarCollapsibleChoices: {
	value: 'offcanvas' | 'icon' | 'none';
	label: string;
}[] = [
	{ value: 'offcanvas', label: 'ซ่อนทั้งหมด' },
	{ value: 'icon', label: 'ย่อเหลือไอคอน' },
	{ value: 'none', label: 'ย่อไม่ได้' }
];

export const densityChoices: { value: number; label: string }[] = [
	{ value: 0.75, label: 'แน่นมาก' },
	{ value: 0.85, label: 'กะทัดรัด' },
	{ value: 1, label: 'ปกติ' },
	{ value: 1.15, label: 'โปร่ง' },
	{ value: 1.3, label: 'โปร่งมาก' }
];

export const columnMaxChoices: { value: string; label: string }[] = [
	{ value: '36rem', label: 'แคบมาก' },
	{ value: '40rem', label: 'แคบ' },
	{ value: '46rem', label: 'ปกติ' },
	{ value: '56rem', label: 'กว้าง' },
	{ value: '64rem', label: 'กว้างมาก' }
];

export const fontScaleChoices: { value: number; label: string }[] = [
	{ value: 0.9, label: 'เล็ก' },
	{ value: 1, label: 'ปกติ' },
	{ value: 1.15, label: 'ใหญ่' }
];

/** ชุดสำเร็จรูป "ทั้งโครง" — กดครั้งเดียวได้ครบทุกแกนสัดส่วน (ธีมแยกเป็นอีกแกน ไม่ถูกทับ) */
export type LayoutPreset = {
	id: string;
	name: string;
	description: string;
	values: Pick<
		UserSettings,
		'sidebarWidth' | 'density' | 'columnMax' | 'sidebarCollapsed' | 'sidebarSide' | 'fontScale'
	>;
};

export const layoutPresets: LayoutPreset[] = [
	{
		id: 'standard',
		name: 'มาตรฐาน',
		description: 'ค่าเริ่มต้นของโปรเจกต์',
		values: {
			sidebarWidth: '17rem',
			density: 1,
			columnMax: '46rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			fontScale: 1
		}
	},
	{
		id: 'compact',
		name: 'กระชับ',
		description: 'จอเล็ก — เห็นเนื้อหาเยอะขึ้น',
		values: {
			sidebarWidth: '14rem',
			density: 0.85,
			columnMax: '40rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			fontScale: 0.9
		}
	},
	{
		id: 'reading',
		name: 'อ่านสบาย',
		description: 'ตัวอักษรใหญ่ ระยะห่างโปร่ง',
		values: {
			sidebarWidth: '17rem',
			density: 1.15,
			columnMax: '40rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			fontScale: 1.15
		}
	},
	{
		id: 'wide',
		name: 'จอกว้าง',
		description: 'ใช้พื้นที่แนวนอนเต็มที่',
		values: {
			sidebarWidth: '23rem',
			density: 1,
			columnMax: '64rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			fontScale: 1
		}
	},
	{
		id: 'focus',
		name: 'โฟกัส',
		description: 'ย่อแถบด้านข้างไว้ เหลือแต่เนื้อหา',
		values: {
			sidebarWidth: '14rem',
			density: 1.15,
			columnMax: '36rem',
			sidebarCollapsed: true,
			sidebarSide: 'left',
			fontScale: 1.15
		}
	},
	{
		id: 'righty',
		name: 'ถนัดขวา',
		description: 'ย้ายแถบด้านข้างไปด้านขวา',
		values: {
			sidebarWidth: '20rem',
			density: 1,
			columnMax: '56rem',
			sidebarCollapsed: false,
			sidebarSide: 'right',
			fontScale: 1
		}
	}
];

/** ค่าปัจจุบันตรงกับชุดสำเร็จรูปนี้ครบทุกแกนหรือไม่ (ใช้ทำป้าย "ใช้อยู่") */
export function matchesLayoutPreset(
	settings: Pick<UserSettings, keyof LayoutPreset['values']>,
	preset: LayoutPreset
): boolean {
	return (Object.keys(preset.values) as (keyof LayoutPreset['values'])[]).every(
		(key) => settings[key] === preset.values[key]
	);
}

/** ช่วงค่าที่ยอมรับ — ตรงกับที่ migration 0002 ประกาศไว้ */
export const settingsBounds = {
	sidebarWidth: { min: 12, max: 30 },
	columnMax: { min: 24, max: 100 },
	density: { min: 0.5, max: 2 },
	fontScale: { min: 0.8, max: 1.3 }
} as const;

export function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'auto';
}

export function isSidebarSide(value: unknown): value is 'left' | 'right' {
	return value === 'left' || value === 'right';
}

export function isSidebarVariant(value: unknown): value is 'sidebar' | 'floating' | 'inset' {
	return value === 'sidebar' || value === 'floating' || value === 'inset';
}

export function isSidebarCollapsible(value: unknown): value is 'offcanvas' | 'icon' | 'none' {
	return value === 'offcanvas' || value === 'icon' || value === 'none';
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
// อนุญาตเฉพาะฟังก์ชันสีวงเล็บชั้นเดียว และไม่มี ; { } อยู่ในค่า -> หลุดออกจาก inline style ไม่ได้
const FUNCTION_COLOR =
	/^(?:oklch|oklab|lch|lab|rgb|rgba|hsl|hsla|hwb|color)\([0-9a-zA-Z.,%\s/+*-]*\)$/;

export function isCssColor(value: string): boolean {
	return HEX_COLOR.test(value) || FUNCTION_COLOR.test(value);
}

/** ความยาว CSS -> หน่วย rem (null = รูปแบบไม่รับ) ใช้เทียบช่วงค่าให้เป็นหน่วยเดียวกัน */
export function lengthInRem(value: string): number | null {
	const match = /^(\d+(?:\.\d+)?)(rem|px|em)$/.exec(value.trim());
	if (!match) return null;
	const amount = Number(match[1]);
	if (match[2] === 'rem') return amount;
	if (match[2] === 'px') return amount / 16;
	return amount;
}

function within(value: number | null, range: { min: number; max: number }): boolean {
	return value !== null && value >= range.min && value <= range.max;
}

/** ตรวจค่าที่ไม่รู้ที่มา (แถวฐานข้อมูล / คุกกี้) แล้วคืนเฉพาะค่าที่ใช้ได้ */
export function sanitizeUserSettings(input: unknown): Partial<UserSettings> {
	if (!input || typeof input !== 'object') return {};
	const record = input as Record<string, unknown>;
	const settings: Partial<UserSettings> = {};

	if (isThemeChoice(typeof record.theme === 'string' ? record.theme : null)) {
		settings.theme = record.theme as ThemeChoice;
	}

	const sidebarWidth = typeof record.sidebarWidth === 'string' ? record.sidebarWidth : '';
	if (within(lengthInRem(sidebarWidth), settingsBounds.sidebarWidth)) {
		settings.sidebarWidth = sidebarWidth;
	}

	const columnMax = typeof record.columnMax === 'string' ? record.columnMax : '';
	if (within(lengthInRem(columnMax), settingsBounds.columnMax)) {
		settings.columnMax = columnMax;
	}

	const density = Number(record.density);
	if (Number.isFinite(density) && within(density, settingsBounds.density)) {
		settings.density = density;
	}

	if (typeof record.sidebarCollapsed === 'boolean') {
		settings.sidebarCollapsed = record.sidebarCollapsed;
	}

	if (isSidebarSide(record.sidebarSide)) {
		settings.sidebarSide = record.sidebarSide;
	}

	if (isSidebarVariant(record.sidebarVariant)) {
		settings.sidebarVariant = record.sidebarVariant;
	}

	if (isSidebarCollapsible(record.sidebarCollapsible)) {
		settings.sidebarCollapsible = record.sidebarCollapsible;
	}

	const fontScale = Number(record.fontScale);
	if (Number.isFinite(fontScale) && within(fontScale, settingsBounds.fontScale)) {
		settings.fontScale = fontScale;
	}

	return settings;
}

/** อ่านค่าจากคุกกี้ layout (JSON) — คืน null เมื่ออ่านไม่ได้ */
export function parseLayoutCookie(raw: string | null | undefined): Partial<UserSettings> | null {
	if (!raw) return null;

	try {
		const settings = sanitizeUserSettings(JSON.parse(raw));
		return Object.keys(settings).length > 0 ? settings : null;
	} catch {
		return null;
	}
}

/** เก็บเฉพาะค่าที่ไม่เกี่ยวกับธีม (ธีมมีคุกกี้ของตัวเองให้ app.html อ่านก่อน paint) */
export function serializeLayoutCookie(
	settings: Pick<
		UserSettings,
		| 'sidebarWidth'
		| 'density'
		| 'columnMax'
		| 'sidebarCollapsed'
		| 'sidebarSide'
		| 'sidebarVariant'
		| 'sidebarCollapsible'
		| 'fontScale'
	>
): string {
	return JSON.stringify({
		sidebarWidth: settings.sidebarWidth,
		density: settings.density,
		columnMax: settings.columnMax,
		sidebarCollapsed: settings.sidebarCollapsed,
		sidebarSide: settings.sidebarSide,
		sidebarVariant: settings.sidebarVariant,
		sidebarCollapsible: settings.sidebarCollapsible,
		fontScale: settings.fontScale
	});
}

/**
 * รวม settings จากทุกแหล่ง ลำดับความสำคัญ:
 * cookie (ค่าล่าสุดที่เพิ่งกดในเครื่องนี้) -> ค่าที่เก็บไว้ (ตาราง user_settings) -> ค่าเริ่มต้น
 */
export function resolveUserSettings(
	cookieTheme: string | undefined,
	stored?: Partial<UserSettings> | null
): UserSettings {
	return {
		...defaultSettings,
		...stored,
		theme: isThemeChoice(cookieTheme) ? cookieTheme : (stored?.theme ?? defaultSettings.theme)
	};
}

/**
 * ตัวแปร CSS ที่ layout.css ประกาศไว้ — ใช้เป็น inline style ของเปลือกแอป
 * ทุกค่าผ่านการตรวจรูปแบบมาแล้ว (ไม่มี `;`/`}` หลุดเข้ามาได้)
 */
export function settingsStyle(
	settings: UserSettings,
	collapsed = false,
	style?: StylePreset | null
): string {
	const sidebarWidth = collapsed ? '0rem' : settings.sidebarWidth;

	// แถบด้านข้างซ้าย/ขวา = สลับทั้งลำดับ (order) และรูปคอลัมน์ของ grid
	const onRight = settings.sidebarSide === 'right';
	const vars = [
		`--sidebar-width: ${sidebarWidth}`,
		`--density: ${settings.density}`,
		`--column-max: ${settings.columnMax}`,
		`--font-scale: ${settings.fontScale}`,
		`--shell-columns: ${
			onRight ? `minmax(0, 1fr) ${sidebarWidth}` : `${sidebarWidth} minmax(0, 1fr)`
		}`,
		`--sidebar-order: ${onRight ? 2 : 1}`,
		`--content-order: ${onRight ? 1 : 2}`
	];

	if (style) {
		vars.push(
			`--brand: light-dark(${style.brandLight}, ${style.brandDark})`,
			`--brand-strong: light-dark(${style.brandStrongLight}, ${style.brandStrongDark})`,
			`--brand-soft: light-dark(${style.brandSoftLight}, ${style.brandSoftDark})`,
			`--panel-radius: ${style.radiusPanel}`,
			`--control-radius: ${style.radiusControl}`
		);

		// พื้นผิว/ตัวอักษร/เส้น: ไล่ hue เดียวกับสีหลัก
		// จำเป็นเพราะหน้าจอส่วนใหญ่ใช้โทเค็นกลุ่มนี้ — ถ้าไม่ให้เปลี่ยนตาม จะดูเหมือน "สลับสไตล์แล้วไม่เปลี่ยน"
		const hue = parsePrimaryColor(style.brandLight)?.h;
		if (hue !== undefined) {
			for (const [token, value] of Object.entries(surfaceTokensForHue(hue))) {
				vars.push(`${token}: ${value}`);
			}
		}
	}

	return vars.join('; ');
}
