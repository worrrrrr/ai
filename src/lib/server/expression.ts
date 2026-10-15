/**
 * ประเมินนิพจน์เลขคณิตอย่างปลอดภัย — ไม่ใช้ eval/Function จึงรันโค้ดตามอำเภอใจจาก input ไม่ได้
 *
 * รองรับ: ตัวเลข (รวมทศนิยม/สัญกรณ์วิทยาศาสตร์), + - * / % ^, วงเล็บ,
 *         เครื่องหมายลบนำหน้า, ค่าคงที่ pi/e และฟังก์ชันใน allowlist ด้านล่าง
 * อย่างอื่นถือว่า error (ไม่ใช่การเดาความหมาย)
 */

export class ExpressionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ExpressionError';
	}
}

const MAX_LENGTH = 500;

const constants: Record<string, number> = {
	pi: Math.PI,
	e: Math.E
};

type Arity = number | [min: number, max: number];

const functions: Record<string, { arity: Arity; fn: (...args: number[]) => number }> = {
	sqrt: { arity: 1, fn: Math.sqrt },
	abs: { arity: 1, fn: Math.abs },
	round: { arity: 1, fn: Math.round },
	floor: { arity: 1, fn: Math.floor },
	ceil: { arity: 1, fn: Math.ceil },
	min: { arity: [1, 8], fn: Math.min },
	max: { arity: [1, 8], fn: Math.max }
};

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'identifier'; value: string }
	| { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | '^' }
	| { kind: 'lparen' }
	| { kind: 'rparen' }
	| { kind: 'comma' };

function isDigit(ch: string): boolean {
	return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < input.length) {
		const ch = input[i];

		if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
			i++;
			continue;
		}

		if (ch === '(') {
			tokens.push({ kind: 'lparen' });
			i++;
			continue;
		}

		if (ch === ')') {
			tokens.push({ kind: 'rparen' });
			i++;
			continue;
		}

		if (ch === ',') {
			tokens.push({ kind: 'comma' });
			i++;
			continue;
		}

		if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
			tokens.push({ kind: 'op', value: ch });
			i++;
			continue;
		}

		if (isDigit(ch) || ch === '.') {
			const start = i;
			while (i < input.length && (isDigit(input[i]) || input[i] === '.')) i++;

			// สัญกรณ์วิทยาศาสตร์: 1e3, 2.5E-2 — ยอมรับเฉพาะเมื่อตามด้วยเลขจริง
			if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
				const save = i;
				i++;
				if (i < input.length && (input[i] === '+' || input[i] === '-')) i++;
				if (i < input.length && isDigit(input[i])) {
					while (i < input.length && isDigit(input[i])) i++;
				} else {
					i = save;
				}
			}

			const raw = input.slice(start, i);
			const value = Number(raw);
			if (!Number.isFinite(value)) throw new ExpressionError(`ตัวเลขไม่ถูกต้อง: ${raw}`);
			tokens.push({ kind: 'number', value });
			continue;
		}

		if (isAlpha(ch)) {
			const start = i;
			while (i < input.length && (isAlpha(input[i]) || isDigit(input[i]))) i++;
			tokens.push({ kind: 'identifier', value: input.slice(start, i).toLowerCase() });
			continue;
		}

		throw new ExpressionError(`อักขระที่ไม่อนุญาต: ${ch}`);
	}

	return tokens;
}

class Parser {
	private pos = 0;

	constructor(private readonly tokens: Token[]) {}

	parse(): number {
		if (this.tokens.length === 0) throw new ExpressionError('นิพจน์ว่าง');
		const value = this.parseExpression();
		if (this.pos !== this.tokens.length) throw new ExpressionError('มีอักขระเกินมาท้ายนิพจน์');
		return value;
	}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	private next(): Token | undefined {
		return this.tokens[this.pos++];
	}

	private parseExpression(): number {
		let value = this.parseTerm();
		for (;;) {
			const token = this.peek();
			if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
				this.pos++;
				const rhs = this.parseTerm();
				value = token.value === '+' ? value + rhs : value - rhs;
			} else {
				return value;
			}
		}
	}

	private parseTerm(): number {
		let value = this.parseUnary();
		for (;;) {
			const token = this.peek();
			if (
				token?.kind === 'op' &&
				(token.value === '*' || token.value === '/' || token.value === '%')
			) {
				this.pos++;
				const rhs = this.parseUnary();
				if ((token.value === '/' || token.value === '%') && rhs === 0) {
					throw new ExpressionError('หารด้วยศูนย์');
				}
				if (token.value === '*') value *= rhs;
				else if (token.value === '/') value /= rhs;
				else value %= rhs;
			} else {
				return value;
			}
		}
	}

	private parseUnary(): number {
		const token = this.peek();
		if (token?.kind === 'op' && (token.value === '+' || token.value === '-')) {
			this.pos++;
			const value = this.parseUnary();
			return token.value === '-' ? -value : value;
		}
		return this.parsePower();
	}

	private parsePower(): number {
		const base = this.parsePrimary();
		const token = this.peek();
		if (token?.kind === 'op' && token.value === '^') {
			this.pos++;
			// มัดขวา: 2^3^2 = 2^(3^2) และรองรับ 2^-1
			return base ** this.parseUnary();
		}
		return base;
	}

	private parsePrimary(): number {
		const token = this.next();
		if (!token) throw new ExpressionError('นิพจน์ไม่ครบ');

		if (token.kind === 'number') return token.value;

		if (token.kind === 'lparen') {
			const value = this.parseExpression();
			if (this.next()?.kind !== 'rparen') throw new ExpressionError('วงเล็บไม่ปิด');
			return value;
		}

		if (token.kind === 'identifier') {
			// Object.hasOwn เพื่อไม่ให้ชื่อจาก prototype (constructor, toString, ...) ผ่านเข้ามาได้
			if (Object.hasOwn(constants, token.value)) return constants[token.value];

			const entry = Object.hasOwn(functions, token.value) ? functions[token.value] : undefined;
			if (!entry) throw new ExpressionError(`ไม่รู้จักชื่อ: ${token.value}`);
			if (this.next()?.kind !== 'lparen') {
				throw new ExpressionError(`ต้องมีวงเล็บเปิดหลัง ${token.value}`);
			}

			const args: number[] = [];
			if (this.peek()?.kind !== 'rparen') {
				args.push(this.parseExpression());
				while (this.peek()?.kind === 'comma') {
					this.pos++;
					args.push(this.parseExpression());
				}
			}
			if (this.next()?.kind !== 'rparen') throw new ExpressionError('วงเล็บไม่ปิด');

			const [min, max] = Array.isArray(entry.arity) ? entry.arity : [entry.arity, entry.arity];
			if (args.length < min || args.length > max) {
				throw new ExpressionError(`จำนวนอาร์กิวเมนต์ของ ${token.value} ไม่ถูกต้อง`);
			}
			return entry.fn(...args);
		}

		throw new ExpressionError('ไวยากรณ์ไม่ถูกต้อง');
	}
}

export function evaluateExpression(input: string): number {
	if (typeof input !== 'string') throw new ExpressionError('นิพจน์ต้องเป็นข้อความ');

	const trimmed = input.trim();
	if (!trimmed) throw new ExpressionError('นิพจน์ว่าง');
	if (trimmed.length > MAX_LENGTH) throw new ExpressionError('นิพจน์ยาวเกินไป');

	const tokens = tokenize(trimmed);

	const value = new Parser(tokens).parse();
	if (!Number.isFinite(value)) throw new ExpressionError('ผลลัพธ์ไม่ใช่จำนวนจำกัด');
	return value;
}
