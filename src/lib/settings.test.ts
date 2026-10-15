import { describe, expect, it } from 'vitest';
import {
	isCssColor,
	lengthInRem,
	parseLayoutCookie,
	resolveUserSettings,
	serializeLayoutCookie,
	sanitizeUserSettings,
	settingsStyle,
	type UserSettings
} from './settings.ts';
import { styleTemplates, templateValues } from './stylePresets.ts';

const layoutCssDefaults = {
	brandLight: 'oklch(0.55 0.16 258)',
	brandDark: 'oklch(0.72 0.13 258)',
	brandStrongLight: 'oklch(0.48 0.17 258)',
	brandStrongDark: 'oklch(0.79 0.12 258)',
	brandSoftLight: 'oklch(0.95 0.03 258)',
	brandSoftDark: 'oklch(0.32 0.06 258)',
	radiusPanel: '0.75rem',
	radiusControl: '0.5rem'
};

const settings: UserSettings = {
	theme: 'dark',
	sidebarWidth: '20rem',
	density: 0.85,
	columnMax: '56rem',
	sidebarCollapsed: false,
	sidebarSide: 'left',
	sidebarVariant: 'sidebar',
	sidebarCollapsible: 'offcanvas',
	fontScale: 1
};

describe('resolveUserSettings', () => {
	it('cookie ชนะค่าที่เก็บไว้ (ค่าล่าสุดที่ผู้ใช้เพิ่งกด)', () => {
		expect(resolveUserSettings('light', { theme: 'dark' }).theme).toBe('light');
	});

	it('ใช้ค่าที่เก็บไว้เมื่อไม่มี cookie', () => {
		expect(resolveUserSettings(undefined, { theme: 'dark', density: 0.85 })).toMatchObject({
			theme: 'dark',
			density: 0.85
		});
	});

	it('cookie ที่ไม่ถูกต้องถูกมองข้าม', () => {
		expect(resolveUserSettings('rainbow', { theme: 'dark' }).theme).toBe('dark');
		expect(resolveUserSettings('rainbow').theme).toBe('auto');
	});
});

describe('การตรวจค่า CSS', () => {
	it('รับสีที่ใช้จริงในโปรเจกต์', () => {
		expect(isCssColor('oklch(0.55 0.16 258)')).toBe(true);
		expect(isCssColor('#2563eb')).toBe(true);
		expect(isCssColor('rgb(37 99 235 / 0.5)')).toBe(true);
	});

	it('ไม่รับค่าที่หลุดออกจาก inline style ได้', () => {
		expect(isCssColor('red; } body { display: none')).toBe(false);
		expect(isCssColor('oklch(0.55 0.16 258); --x: 1')).toBe(false);
		expect(isCssColor('url(https://example.com/x.png)')).toBe(false);
		expect(isCssColor('')).toBe(false);
	});

	it('แปลงความยาวเป็น rem เพื่อเทียบช่วงค่า', () => {
		expect(lengthInRem('16px')).toBe(1);
		expect(lengthInRem('1.15rem')).toBeCloseTo(1.15);
		expect(lengthInRem('999px')).toBeCloseTo(62.4375);
		expect(lengthInRem('2vw')).toBeNull();
		expect(lengthInRem('calc(1rem + 2px)')).toBeNull();
	});
});

describe('sanitizeUserSettings', () => {
	it('รับค่าที่ถูกต้องบางส่วน', () => {
		expect(
			sanitizeUserSettings({
				theme: 'light',
				sidebarWidth: '15rem',
				density: '1.15',
				columnMax: '40rem',
				sidebarCollapsed: true
			})
		).toEqual({
			theme: 'light',
			sidebarWidth: '15rem',
			columnMax: '40rem',
			density: 1.15,
			sidebarCollapsed: true
		});
	});

	it('ทิ้งค่าที่ไม่ถูกต้องและค่าที่ไม่รู้จัก', () => {
		expect(
			sanitizeUserSettings({
				theme: 'neon',
				sidebarWidth: '999rem',
				density: 42,
				columnMax: 'blue; }',
				sidebarCollapsed: 'yes',
				sidebarSide: 'top',
				fontScale: 5,
				something: 'else'
			})
		).toEqual({});
	});

	it('รับด้าน/รูปแบบ/วิธีย่อของแถบด้านข้าง และสเกลจอ พร้อมจำกัดค่าที่อนุญาต', () => {
		expect(
			sanitizeUserSettings({
				sidebarSide: 'right',
				sidebarVariant: 'floating',
				sidebarCollapsible: 'icon',
				fontScale: '1.15'
			})
		).toEqual({
			sidebarSide: 'right',
			sidebarVariant: 'floating',
			sidebarCollapsible: 'icon',
			fontScale: 1.15
		});

		// ค่าที่ไม่อยู่ในรายการที่อนุญาตต้องถูกทิ้ง (ไม่หลุดไปเป็น CSS/คลาส)
		expect(sanitizeUserSettings({ sidebarVariant: 'grid', sidebarCollapsible: 'slide' })).toEqual(
			{}
		);
		expect(sanitizeUserSettings({ fontScale: 1.31 })).toEqual({});
	});

	it('ทน input ที่ไม่ใช่วัตถุ', () => {
		expect(sanitizeUserSettings(null)).toEqual({});
		expect(sanitizeUserSettings('hello')).toEqual({});
	});
});

describe('คุกกี้ layout', () => {
	it('เก็บ/อ่านกลับได้ (ไม่รวมธีม เพราะธีมมีคุกกี้ของตัวเอง)', () => {
		const raw = serializeLayoutCookie(settings);
		expect(raw).not.toContain('theme');
		expect(parseLayoutCookie(raw)).toEqual({
			sidebarWidth: '20rem',
			density: 0.85,
			columnMax: '56rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			sidebarVariant: 'sidebar',
			sidebarCollapsible: 'offcanvas',
			fontScale: 1
		});
	});

	it('คุกกี้เสียหาย/ว่าง คืน null (ไม่ทำให้หน้าโหลดพัง)', () => {
		expect(parseLayoutCookie('not json')).toBeNull();
		expect(parseLayoutCookie(undefined)).toBeNull();
		expect(parseLayoutCookie('{"theme":"rainbow"}')).toBeNull();
	});
});

describe('settingsStyle', () => {
	it('ส่งเฉพาะโทเค็นของเลย์เอาต์เมื่อยังไม่มีสไตล์', () => {
		const style = settingsStyle(settings);
		expect(style).toContain('--sidebar-width: 20rem');
		expect(style).toContain('--density: 0.85');
		expect(style).toContain('--column-max: 56rem');
		expect(style).toContain('--font-scale: 1');
		expect(style).toContain('--shell-columns: 20rem minmax(0, 1fr)');
		expect(style).not.toContain('--brand');
	});

	it('แถบด้านข้างอยู่ขวา = สลับคอลัมน์และลำดับ', () => {
		const style = settingsStyle({ ...settings, sidebarSide: 'right' });
		expect(style).toContain('--shell-columns: minmax(0, 1fr) 20rem');
		expect(style).toContain('--sidebar-order: 2');
		expect(style).toContain('--content-order: 1');
	});

	it('sidebar ที่ย่ออยู่กว้าง 0 (เนื้อหาต้องกินทั้งแถว)', () => {
		expect(settingsStyle(settings, true)).toContain('--sidebar-width: 0rem');
	});

	it('เขียนทับโทเค็นสีโดยคงคู่สว่าง/มืดไว้ (light-dark)', () => {
		const style = settingsStyle(settings, false, {
			id: 'x',
			name: 'ทดสอบ',
			...layoutCssDefaults,
			isActive: true
		});
		expect(style).toContain('--brand: light-dark(oklch(0.55 0.16 258), oklch(0.72 0.13 258))');
		expect(style).toContain('--panel-radius: 0.75rem');
	});

	it('สไตล์ทำให้พื้นผิว/ตัวอักษร/เส้นเปลี่ยนตามสีหลักด้วย (ไม่ใช่แค่ปุ่ม)', () => {
		// brandLight ของชุดทดสอบคือ oklch(0.55 0.16 258) → hue 258
		const style = settingsStyle(settings, false, {
			id: 'x',
			name: 'ทดสอบ',
			...layoutCssDefaults,
			isActive: true
		});

		expect(style).toContain('--surface-canvas: light-dark(oklch(0.985 0.006 258)');
		expect(style).toContain('--surface-raised: light-dark(');
		expect(style).toContain('--ink-primary: light-dark(oklch(0.24 0.012 258)');
		expect(style).toContain('--line-subtle: light-dark(');
	});
});

describe('แม่แบบสไตล์', () => {
	it('แม่แบบค่าเริ่มต้นตรงกับ layout.css เป๊ะ', () => {
		const blue = styleTemplates.find((template) => template.id === 'blue');
		expect(blue).toBeDefined();
		expect(templateValues(blue!)).toEqual(layoutCssDefaults);
	});

	it('ทุกแม่แบบมี id/ชื่อ/คำอธิบาย ไม่ซ้ำกัน และไม่น้อยกว่า 8 ชุด', () => {
		const ids = styleTemplates.map((template) => template.id);
		expect(new Set(ids).size).toBe(styleTemplates.length);
		expect(styleTemplates.length).toBeGreaterThanOrEqual(8);
		for (const template of styleTemplates) {
			expect(template.name.length).toBeGreaterThan(0);
			expect(template.description.length).toBeGreaterThan(0);
		}
	});

	it('ทุกแม่แบบให้ผลต่างกันจริง (สี+มุม ไม่ซ้ำกันเลย)', () => {
		const looks = new Set(
			styleTemplates.map((template) => JSON.stringify(templateValues(template)))
		);
		expect(looks.size).toBe(styleTemplates.length);
	});
});
