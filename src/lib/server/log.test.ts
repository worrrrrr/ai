import { describe, expect, it } from 'vitest';
import {
	createLogger,
	formatLine,
	isLogLevel,
	minLevel,
	redactSecret,
	shouldLog,
	type LogFields
} from './log.ts';

describe('minLevel / isLogLevel', () => {
	it('ค่าเริ่มต้นคือ info และค่าที่ไม่รู้จักก็ถอยเป็น info', () => {
		expect(minLevel(undefined)).toBe('info');
		expect(minLevel('   ')).toBe('info');
		expect(minLevel('verbose')).toBe('info');
		expect(isLogLevel('verbose')).toBe(false);
	});

	it('รับค่าที่ถูกต้อง (ไม่สนตัวพิมพ์/ช่องว่าง)', () => {
		expect(minLevel(' DEBUG ')).toBe('debug');
		expect(minLevel('error')).toBe('error');
		expect(isLogLevel('warn')).toBe(true);
	});
});

describe('shouldLog', () => {
	it('เทียบตามลำดับระดับ (ไม่ใช่ตัวอักษร)', () => {
		expect(shouldLog('error', 'info')).toBe(true);
		expect(shouldLog('info', 'info')).toBe(true);
		expect(shouldLog('debug', 'info')).toBe(false);
		expect(shouldLog('warn', 'error')).toBe(false);
		expect(shouldLog('debug', 'debug')).toBe(true);
	});
});

describe('redactSecret', () => {
	it('เก็บหัว-ท้ายไว้พอรู้ว่าเป็นตัวไหน', () => {
		expect(redactSecret('gsk_ABCDEFGHIJKLMNOPWXYZ')).toBe('gsk_…WXYZ');
	});

	it('ค่าว่างและค่าสั้นเกินไป ต้องไม่รั่ว', () => {
		expect(redactSecret(null)).toBe('(ไม่มี)');
		expect(redactSecret('   ')).toBe('(ไม่มี)');
		expect(redactSecret('short')).toBe('***');
		expect(redactSecret('123456789012')).toBe('***');
	});
});

describe('formatLine', () => {
	it('ได้ JSON บรรทัดเดียว มีระดับ/ข้อความ/เวลา และ field ที่ส่งมา', () => {
		const line = formatLine(
			'warn',
			'ผู้ให้บริการตอบช้า',
			{ ms: 1234, provider: 'Groq (.env)' },
			{ at: '2026-10-15T00:00:00.000Z' }
		);

		expect(JSON.parse(line)).toEqual({
			level: 'warn',
			message: 'ผู้ให้บริการตอบช้า',
			at: '2026-10-15T00:00:00.000Z',
			ms: 1234,
			provider: 'Groq (.env)'
		});
	});

	it('แนบ requestId เมื่อมี และตัด field ที่เป็น undefined ออก', () => {
		const fields: LogFields = { route: 'weather', score: undefined, failed: false };
		const parsed = JSON.parse(
			formatLine('info', 'เลือกเส้นทาง', fields, { at: 'now', requestId: 'req-1' })
		);

		expect(parsed.requestId).toBe('req-1');
		expect(parsed).not.toHaveProperty('score');
		expect(parsed.failed).toBe(false);
	});
});

describe('createLogger', () => {
	function fakeSink() {
		const lines: { kind: string; line: string }[] = [];
		return {
			lines,
			log: (line: string) => lines.push({ kind: 'log', line }),
			warn: (line: string) => lines.push({ kind: 'warn', line }),
			error: (line: string) => lines.push({ kind: 'error', line })
		};
	}

	it('เขียนเฉพาะระดับที่ถึงขั้นต่ำ และเลือกช่องทางให้ตรงระดับ', () => {
		const sink = fakeSink();
		const logger = createLogger({ level: 'warn', sink: sink as unknown as typeof console });

		logger.write('info', 'ไม่ควรออก');
		logger.write('warn', 'ควรออก (เตือน)');
		logger.write('error', 'ควรออก (ผิดพลาด)');

		expect(sink.lines.map((entry) => entry.kind)).toEqual(['warn', 'error']);
	});

	it('ค่าที่เขียนเป็น JSON ที่อ่านกลับได้ และไม่บันทึก field ที่เป็น undefined', () => {
		const sink = fakeSink();
		const logger = createLogger({ level: 'debug', sink: sink as unknown as typeof console });

		logger.write('info', 'ทดสอบ', { a: 1, b: undefined }, 'req-9');

		const parsed = JSON.parse(sink.lines[0].line);
		expect(parsed.message).toBe('ทดสอบ');
		expect(parsed.a).toBe(1);
		expect(parsed.requestId).toBe('req-9');
		expect(parsed).not.toHaveProperty('b');
	});
});
