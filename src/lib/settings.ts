/**
 * ค่าที่ผู้ใช้ปรับได้ (ธีม, ความหนาแน่น, ความกว้าง sidebar)
 *
 * ไฟล์นี้เป็น pure module ใช้ได้ทั้งฝั่ง server และ client
 * การอ่านจากฐานข้อมูล (ตาราง settings) จะอยู่ที่ `#lib/server/settings.ts` ในอนาคต
 * แล้วส่งค่าที่ได้เข้ามาที่ `resolveUserSettings` — component ไม่ต้องรู้เรื่องนี้
 */

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
	/** สถานะย่อ sidebar ครั้งล่าสุด */
	sidebarCollapsed: boolean;
};

export const defaultSettings: UserSettings = {
	theme: 'auto',
	sidebarWidth: '17rem',
	density: 1,
	sidebarCollapsed: false
};

export function isThemeChoice(value: string | undefined | null): value is ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * รวม settings จากทุกแหล่ง ลำดับความสำคัญ:
 * cookie (ค่าล่าสุดที่เพิ่งกด) -> ค่าที่เก็บไว้ (ตาราง settings) -> ค่าเริ่มต้น
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

/** ตัวแปร CSS ที่ layout.css ประกาศไว้ — ใช้เป็น inline style ของ shell */
export function settingsStyle(settings: UserSettings, collapsed = false): string {
	return [
		`--sidebar-width: ${collapsed ? '0rem' : settings.sidebarWidth}`,
		`--density: ${settings.density}`
	].join('; ');
}
