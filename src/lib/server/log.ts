/**
 * บันทึกเหตุการณ์แบบมีโครงสร้าง — ไม่เพิ่ม dependency
 *
 * - ระดับ: debug | info | warn | error (ค่าเริ่มต้น info)
 * - แนบ `requestId` เพื่อตามรอยเหตุการณ์ของคำขอหนึ่งได้
 * - ออกเป็น JSON บรรทัดเดียว → อ่าน/กรองด้วยเครื่องมือ log ได้
 * - **ไม่บันทึกค่าลับ**: ผู้เรียกต้องไม่ส่งคีย์ดิบเข้ามา ใช้ `redactSecret()` ช่วยปิดบังเมื่อจำเป็น
 *
 * ส่วนที่ "บริสุทธิ์" (ตัดสินระดับ · ปิดบังค่า · สร้างบรรทัด) แยกไว้ให้เทสต์ได้โดยไม่ต้องมี console
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function isLogLevel(value: unknown): value is LogLevel {
	return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

/** ระดับขั้นต่ำจาก env — ค่าที่ไม่รู้จัก/ว่าง ถอยเป็น `info` (ไม่ปิด log ทั้งหมดโดยไม่ตั้งใจ) */
export function minLevel(value: string | undefined): LogLevel {
	const normalized = value?.trim().toLowerCase();
	return isLogLevel(normalized) ? normalized : 'info';
}

export function shouldLog(level: LogLevel, min: LogLevel): boolean {
	return WEIGHT[level] >= WEIGHT[min];
}

/**
 * ปิดบังค่าลับให้พอรู้ว่าเป็นตัวไหน — เก็บ 4 ตัวแรก + 4 ตัวท้าย
 * ค่าที่สั้นเกิน 12 ตัวจะปิดทั้งหมด (กันการเดาจากความยาว)
 */
export function redactSecret(value: string | null | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) return '(ไม่มี)';

	if (trimmed.length <= 12) return '***';

	return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export type LogFields = Record<string, string | number | boolean | null | undefined>;

/** สร้างบรรทัด JSON หนึ่งบรรทัด — รับ `at` เข้ามาได้เพื่อให้เทสต์แน่นอน */
export function formatLine(
	level: LogLevel,
	message: string,
	fields: LogFields = {},
	options: { requestId?: string; at?: string } = {}
): string {
	const payload: Record<string, unknown> = {
		level,
		message,
		at: options.at ?? new Date().toISOString()
	};

	if (options.requestId) payload.requestId = options.requestId;

	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) payload[key] = value;
	}

	return JSON.stringify(payload);
}

export type Logger = {
	level: LogLevel;
	write: (level: LogLevel, message: string, fields?: LogFields, requestId?: string) => void;
};

/** ตัวบันทึกจริง — ใช้ console เดิมของ runtime (Cloudflare/Node) */
export function createLogger(options: { level?: string; sink?: typeof console } = {}): Logger {
	const level = minLevel(options.level);
	const sink = options.sink ?? console;

	const write = (entryLevel: LogLevel, message: string, fields?: LogFields, requestId?: string) => {
		if (!shouldLog(entryLevel, level)) return;

		const line = formatLine(entryLevel, message, fields, { requestId });
		if (entryLevel === 'error') sink.error(line);
		else if (entryLevel === 'warn') sink.warn(line);
		else sink.log(line);
	};

	return { level, write };
}
