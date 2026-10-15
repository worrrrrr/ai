/**
 * ตั้งค่าของผู้ใช้ — อ่าน/เขียน "ตารางจริง" ของโปรเจกต์ Supabase (`aaii`)
 *
 *   prompts(title, body, icon, deleted_at)                        ← มีอยู่แล้วในฐานข้อมูล
 *   provider_credentials(label, base_url, models, key_hint, key_sealed)
 *   styles, user_settings                                         ← สร้างจาก supabase/migrations/0002_settings.sql
 *
 * หลักการ
 * - ใช้ type ที่ generate จากฐานข้อมูลจริง (`src/lib/database.types.ts`) → ผิดคอลัมน์จะถูกจับตอน `pnpm check`
 * - กรองเจ้าของด้วย `user_id` ในทุกคำสั่ง แม้ตารางจะมี RLS (นโยบายของตารางเดิมยังยืนยันจากเซสชันนี้ไม่ได้)
 * - กุญแจของผู้ให้บริการถูก "seal" ด้วย AES-GCM จาก Worker secret `PROVIDER_KEY_SECRET`
 *   เก็บเฉพาะ ciphertext (`key_sealed`) + 4 ตัวท้าย (`key_hint`) — ไม่มี secret แล้วถอดกลับไม่ได้
 * - ตารางจริงไม่มีคอลัมน์ `is_default` → "ที่เลือกใช้อยู่" เก็บเป็นคอลัมน์ `*_id` ใน `user_settings`
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
	isCssColor,
	isSidebarCollapsible,
	isSidebarSide,
	isSidebarVariant,
	isThemeChoice,
	lengthInRem,
	sanitizeUserSettings,
	type StylePreset,
	type UserSettings
} from '#lib/settings.ts';
import { defaultStyleValues } from '#lib/stylePresets.ts';
import type { Database } from '#lib/database.types.ts';

// ตรวจค่า CSS อยู่ที่ #lib/settings.ts (ใช้ร่วมกับฝั่ง client) — ส่งต่อให้ผู้เรียกเดิมไม่ต้องแก้ import
export { isCssColor, lengthInRem };

// ---------------------------------------------------------------------------
// 2 ตารางที่ยังไม่อยู่ใน type ที่ generate (ต้องรัน 0002_settings.sql แล้วสั่ง `pnpm gen:types`)
// หลัง regenerate แล้ว บล็อกนี้และ `settingsDb()` ลบออกได้ทันที
// ---------------------------------------------------------------------------

export type StyleRow = {
	id: string;
	user_id: string;
	name: string;
	brand_light: string;
	brand_dark: string;
	brand_strong_light: string;
	brand_strong_dark: string;
	brand_soft_light: string;
	brand_soft_dark: string;
	radius_panel: string;
	radius_control: string;
	created_at: string;
	updated_at: string;
};

export type UserSettingsRow = {
	user_id: string;
	theme: string;
	sidebar_width: string;
	density: number;
	column_max: string;
	sidebar_collapsed: boolean;
	sidebar_side: string;
	sidebar_variant: string;
	sidebar_collapsible: string;
	font_scale: number;
	style_id: string | null;
	prompt_id: string | null;
	provider_id: string | null;
	updated_at: string;
};

type PendingSettingsTables = {
	styles: {
		Row: StyleRow;
		Insert: Partial<StyleRow> & { user_id: string; name: string };
		Update: Partial<StyleRow>;
		Relationships: [];
	};
	user_settings: {
		Row: UserSettingsRow;
		Insert: Partial<UserSettingsRow> & { user_id: string };
		Update: Partial<UserSettingsRow>;
		Relationships: [];
	};
};

type DatabaseWithSettings = Omit<Database, 'public'> & {
	public: Omit<Database['public'], 'Tables'> & {
		Tables: Database['public']['Tables'] & PendingSettingsTables;
	};
};

export type SettingsDb = SupabaseClient<DatabaseWithSettings>;

/** แปลง client ปกติ -> client ที่รู้จักตารางใหม่ 2 ตัว (ลบทิ้งได้หลังรัน migration + `pnpm gen:types`) */
export function settingsDb(supabase: App.Locals['supabase']): SettingsDb {
	return supabase as unknown as SettingsDb;
}

export type PromptRow = Database['public']['Tables']['prompts']['Row'];
export type ProviderRow = Database['public']['Tables']['provider_credentials']['Row'];
export type ProviderProtocol = 'ollama' | 'openai';

export type LayoutInput = {
	theme: string;
	sidebarWidth: string;
	density: number;
	columnMax: string;
	sidebarCollapsed: boolean;
	sidebarSide: string;
	sidebarVariant: string;
	sidebarCollapsible: string;
	fontScale: number;
};

export type ActiveChoices = {
	styleId: string | null;
	promptId: string | null;
	providerId: string | null;
};

export const MIGRATION_HINT =
	'ยังไม่มีตารางนี้ในฐานข้อมูล — รัน supabase/migrations/0002_settings.sql ใน Supabase SQL Editor ก่อน แล้วสั่ง `pnpm gen:types`';

// ---------------------------------------------------------------------------
// ตรวจค่าที่รับจากฟอร์ม
// ---------------------------------------------------------------------------

export const promptInputSchema = z.object({
	title: z.string().trim().min(1, 'ต้องมีชื่อพรอมป์').max(80, 'ชื่อยาวเกิน 80 ตัวอักษร'),
	body: z.string().trim().min(1, 'พรอมป์ต้องไม่ว่าง').max(8000, 'พรอมป์ยาวเกิน 8000 ตัวอักษร')
});

export const providerInputSchema = z.object({
	label: z.string().trim().min(1, 'ต้องมีชื่อผู้ให้บริการ').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
	baseUrl: z
		.string()
		.trim()
		.max(300, 'ที่อยู่ยาวเกิน 300 ตัวอักษร')
		.refine(
			(value) => value === '' || normalizeBaseUrl(value) !== null,
			'ที่อยู่ต้องเป็น http:// หรือ https://'
		),
	models: z.string().max(4000, 'รายการโมเดลยาวเกินไป'),
	apiKey: z.string().max(400, 'กุญแจยาวเกิน 400 ตัวอักษร')
});

const colorField = (label: string) =>
	z
		.string()
		.trim()
		.refine(isCssColor, `${label} ต้องเป็นค่า CSS สี เช่น oklch(0.55 0.16 258) หรือ #2563eb`);

const lengthField = (label: string, maxRem: number) =>
	z
		.string()
		.trim()
		.refine((value) => {
			const rem = lengthInRem(value);
			return rem !== null && rem <= maxRem;
		}, `${label} ต้องเป็นความยาว CSS (rem/px) ไม่เกิน ${maxRem}rem`);

export const styleInputSchema = z.object({
	name: z.string().trim().min(1, 'ต้องมีชื่อสไตล์').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
	brandLight: colorField('สีหลักโหมดสว่าง'),
	brandDark: colorField('สีหลักโหมดมืด'),
	brandStrongLight: colorField('สีเน้นโหมดสว่าง'),
	brandStrongDark: colorField('สีเน้นโหมดมืด'),
	brandSoftLight: colorField('สีพื้นอ่อนโหมดสว่าง'),
	brandSoftDark: colorField('สีพื้นอ่อนโหมดมืด'),
	radiusPanel: lengthField('มุมการ์ด', 64),
	radiusControl: lengthField('มุมคอนโทรล', 64)
});

export const layoutInputSchema = z.object({
	theme: z.string().trim().refine(isThemeChoice, 'ธีมต้องเป็น auto, light หรือ dark'),
	sidebarWidth: lengthField('ความกว้างแถบด้านข้าง', 30),
	density: z.coerce
		.number()
		.refine(
			(value) => Number.isFinite(value) && value >= 0.5 && value <= 2,
			'ความหนาแน่นต้องอยู่ระหว่าง 0.5-2'
		),
	columnMax: lengthField('ความกว้างคอลัมน์', 100),
	sidebarCollapsed: z.boolean(),
	sidebarSide: z
		.string()
		.trim()
		.refine(isSidebarSide, 'ด้านของแถบด้านข้างต้องเป็น left หรือ right'),
	sidebarVariant: z
		.string()
		.trim()
		.refine(isSidebarVariant, 'รูปแบบแถบด้านข้างต้องเป็น sidebar, floating หรือ inset'),
	sidebarCollapsible: z
		.string()
		.trim()
		.refine(isSidebarCollapsible, 'วิธีย่อต้องเป็น offcanvas, icon หรือ none'),
	fontScale: z.coerce
		.number()
		.refine(
			(value) => Number.isFinite(value) && value >= 0.8 && value <= 1.3,
			'สเกลจอต้องอยู่ระหว่าง 0.8-1.3'
		)
});

const FIELD_LABELS: Record<string, string> = {
	title: 'ชื่อพรอมป์',
	label: 'ชื่อผู้ให้บริการ',
	baseUrl: 'ที่อยู่',
	models: 'รายการโมเดล',
	apiKey: 'กุญแจ',
	body: 'พรอมป์',
	name: 'ชื่อสไตล์',
	brandLight: 'สีหลัก (สว่าง)',
	brandDark: 'สีหลัก (มืด)',
	brandStrongLight: 'สีเน้น (สว่าง)',
	brandStrongDark: 'สีเน้น (มืด)',
	brandSoftLight: 'สีพื้นอ่อน (สว่าง)',
	brandSoftDark: 'สีพื้นอ่อน (มืด)',
	radiusPanel: 'มุมการ์ด',
	radiusControl: 'มุมคอนโทรล',
	theme: 'ธีม',
	sidebarWidth: 'ความกว้างแถบด้านข้าง',
	density: 'ความหนาแน่น',
	columnMax: 'ความกว้างคอลัมน์',
	sidebarSide: 'ด้านของแถบด้านข้าง',
	fontScale: 'สเกลจอ'
};

export function issueMessages(error: z.ZodError): string[] {
	return error.issues.map((issue) => {
		const field = String(issue.path[0] ?? '');
		const label = FIELD_LABELS[field];
		return label ? `${label}: ${issue.message}` : issue.message;
	});
}

export function readPromptForm(form: FormData) {
	return {
		title: String(form.get('title') ?? '').trim(),
		body: String(form.get('body') ?? '').trim()
	};
}

export function readProviderForm(form: FormData) {
	return {
		label: String(form.get('label') ?? '').trim(),
		baseUrl: String(form.get('base_url') ?? '').trim(),
		models: String(form.get('models') ?? '').trim(),
		apiKey: String(form.get('api_key') ?? '').trim()
	};
}

export function readStyleForm(form: FormData) {
	return {
		name: String(form.get('name') ?? '').trim(),
		brandLight: String(form.get('brand_light') ?? '').trim(),
		brandDark: String(form.get('brand_dark') ?? '').trim(),
		brandStrongLight: String(form.get('brand_strong_light') ?? '').trim(),
		brandStrongDark: String(form.get('brand_strong_dark') ?? '').trim(),
		brandSoftLight: String(form.get('brand_soft_light') ?? '').trim(),
		brandSoftDark: String(form.get('brand_soft_dark') ?? '').trim(),
		radiusPanel: String(form.get('radius_panel') ?? '').trim(),
		radiusControl: String(form.get('radius_control') ?? '').trim()
	};
}

export function readLayoutForm(form: FormData) {
	return {
		theme: String(form.get('theme') ?? '').trim(),
		sidebarWidth: String(form.get('sidebar_width') ?? '').trim(),
		density: String(form.get('density') ?? ''),
		columnMax: String(form.get('column_max') ?? '').trim(),
		sidebarCollapsed: form.get('sidebar_collapsed') === 'on',
		sidebarSide: String(form.get('sidebar_side') ?? '').trim(),
		sidebarVariant: String(form.get('sidebar_variant') ?? '').trim(),
		sidebarCollapsible: String(form.get('sidebar_collapsible') ?? '').trim(),
		fontScale: String(form.get('font_scale') ?? '')
	};
}

export type PromptInput = z.infer<typeof promptInputSchema>;
export type ProviderInput = z.infer<typeof providerInputSchema>;
export type StyleInput = z.infer<typeof styleInputSchema>;

/** แปลงข้อความหลายบรรทัด/คั่นด้วยจุลภาคเป็นรายชื่อโมเดล (ตัดบรรทัดว่าง/ซ้ำออก) */
export function parseModelsInput(value: string): string[] {
	return [
		...new Set(
			value
				.split(/[\n,]/)
				.map((item) => item.trim())
				.filter(Boolean)
		)
	];
}

export function modelsToInput(models: string[]): string {
	return models.join('\n');
}

// ---------------------------------------------------------------------------
// ที่อยู่ผู้ให้บริการ + การค้นหาโมเดลจริง
// ---------------------------------------------------------------------------

/** ที่อยู่ฐานของ API — คืนรูปที่ตัด `/` ท้ายออกแล้ว หรือ null ถ้าใช้ไม่ได้ */
export function normalizeBaseUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return null;
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (!url.hostname) return null;

	const path = url.pathname.replace(/\/+$/, '');
	return `${url.origin}${path === '/' ? '' : path}`;
}

/**
 * เดาโปรโตคอลจากชื่อ/ที่อยู่ — ตารางจริงไม่มีคอลัมน์ชนิดผู้ให้บริการ
 * กติกา: ชื่อหรือที่อยู่มีคำว่า ollama / พอร์ต 11434 → Ollama, นอกนั้นถือว่า OpenAI-compatible
 */
export function protocolForLabel(
	label: string | null | undefined,
	baseUrl: string | null | undefined
): ProviderProtocol {
	const text = `${label ?? ''} ${baseUrl ?? ''}`.toLowerCase();
	return text.includes('ollama') || text.includes(':11434') ? 'ollama' : 'openai';
}

const ollamaTagsSchema = z.object({
	models: z.array(z.object({ name: z.string().optional(), model: z.string().optional() }))
});

const openAiModelsSchema = z.object({
	data: z.array(z.object({ id: z.string() }))
});

const PROVIDER_TIMEOUT_MS = 8000;

export type ModelsEndpoint = { url: string; source: string; headers: Record<string, string> };

export function modelsEndpoint(
	kind: ProviderProtocol,
	baseUrl: string,
	apiKey?: string | null
): ModelsEndpoint {
	const base = (normalizeBaseUrl(baseUrl) ?? baseUrl).replace(/\/+$/, '');
	const headers: Record<string, string> = {};
	if (apiKey) headers.authorization = `Bearer ${apiKey}`;

	if (kind === 'ollama') {
		return { url: `${base}/api/tags`, source: 'Ollama /api/tags', headers };
	}

	return { url: `${base}/v1/models`, source: 'OpenAI-compatible /v1/models', headers };
}

/** แปลง payload ของผู้ให้บริการ -> รายชื่อโมเดล (คืน [] ถ้ารูปแบบไม่ตรง) */
export function parseModels(kind: ProviderProtocol, payload: unknown): string[] {
	if (kind === 'ollama') {
		const parsed = ollamaTagsSchema.safeParse(payload);
		if (!parsed.success) return [];
		return parsed.data.models
			.map((row) => (row.name ?? row.model ?? '').trim())
			.filter((name) => name.length > 0);
	}

	const parsed = openAiModelsSchema.safeParse(payload);
	if (!parsed.success) return [];
	return parsed.data.data.map((row) => row.id.trim()).filter((id) => id.length > 0);
}

/** ยิงไปถามรายชื่อโมเดลจริงจากผู้ให้บริการ (ไม่ mock) — error ภาษาไทยพร้อมชื่อแหล่งที่ยิงไป */
export async function fetchProviderModels(
	input: { kind: ProviderProtocol; baseUrl: string; apiKey?: string | null },
	fetchImpl: typeof fetch = fetch
): Promise<{ source: string; models: string[] }> {
	const endpoint = modelsEndpoint(input.kind, input.baseUrl, input.apiKey);

	let response: Response;
	try {
		response = await fetchImpl(endpoint.url, {
			headers: endpoint.headers,
			signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'เชื่อมต่อไม่ได้';
		throw new Error(`เรียก ${endpoint.source} ไม่สำเร็จ (${endpoint.url}): ${reason}`);
	}

	if (!response.ok) {
		throw new Error(`${endpoint.source} ตอบกลับ HTTP ${response.status} (${endpoint.url})`);
	}

	const models = parseModels(input.kind, await response.json());
	if (models.length === 0) {
		throw new Error(`${endpoint.source} ตอบสำเร็จแต่ไม่พบรายชื่อโมเดล (${endpoint.url})`);
	}

	return { source: endpoint.source, models };
}

/**
 * ลองโปรโตคอลที่เดาได้ก่อน ถ้าไม่ได้ลองอีกอัน — เพื่อให้ตั้งชื่อผู้ให้บริการอะไรก็ใช้ได้
 * (ตารางจริงไม่มีคอลัมน์ kind จึงต้องถามของจริงแทนการเชื่อ config)
 */
export async function discoverProviderModels(
	input: { label: string | null; baseUrl: string | null; apiKey?: string | null },
	fetchImpl: typeof fetch = fetch
): Promise<{ source: string; models: string[]; protocol: ProviderProtocol }> {
	if (!input.baseUrl) throw new Error('ยังไม่ได้ตั้งที่อยู่ (base URL) ของผู้ให้บริการนี้');

	const first = protocolForLabel(input.label, input.baseUrl);
	const order: ProviderProtocol[] =
		first === 'ollama' ? ['ollama', 'openai'] : ['openai', 'ollama'];
	const failures: string[] = [];

	for (const kind of order) {
		try {
			const result = await fetchProviderModels(
				{ kind, baseUrl: input.baseUrl, apiKey: input.apiKey },
				fetchImpl
			);
			return { ...result, protocol: kind };
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}

	throw new Error(failures.join(' | '));
}

// ---------------------------------------------------------------------------
// Seal/เปิดกุญแจผู้ให้บริการ (AES-GCM จาก Worker secret)
// ---------------------------------------------------------------------------

const SEAL_SECRET_NAME = 'PROVIDER_KEY_SECRET';

export const SEAL_SECRET_HINT = `ยังไม่ได้ตั้ง ${SEAL_SECRET_NAME} — ใส่ใน .env ตอน dev หรือ \`wrangler secret put ${SEAL_SECRET_NAME}\` ตอน production`;

/** อ่าน secret สำหรับ seal จาก env ของ Worker (คืน null เมื่อยังไม่ตั้ง) */
export function sealSecretFrom(platform: App.Platform | undefined): string | null {
	const value = platform?.env?.[SEAL_SECRET_NAME];
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** ต้องเป็น Uint8Array ที่หนุนด้วย ArrayBuffer ตรง ๆ เพื่อให้ผ่าน type BufferSource ของ WebCrypto */
function bytesOf(value: string): Uint8Array<ArrayBuffer> {
	const encoded = new TextEncoder().encode(value);
	const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
	bytes.set(encoded);
	return bytes;
}

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function aesKey(secret: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest('SHA-256', bytesOf(secret));
	return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** เข้ารหัสกุญแจ -> `iv.ciphertext` (base64 ทั้งคู่) พร้อม 4 ตัวท้ายไว้แสดงผล */
export async function sealProviderKey(
	secret: string,
	plaintext: string
): Promise<{ key_sealed: string; key_hint: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await aesKey(secret),
		bytesOf(plaintext)
	);

	return {
		key_sealed: `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`,
		key_hint: keyHint(plaintext)
	};
}

/** ถอดกุญแจกลับ (ต้องมี secret เดียวกับตอน seal) */
export async function openProviderKey(secret: string, sealed: string): Promise<string> {
	const [ivPart, cipherPart] = sealed.split('.');
	if (!ivPart || !cipherPart) throw new Error('รูปแบบกุญแจที่เก็บไว้ไม่ถูกต้อง');

	try {
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64(ivPart) },
			await aesKey(secret),
			fromBase64(cipherPart)
		);
		return new TextDecoder().decode(plain);
	} catch {
		throw new Error(
			'ถอดกุญแจไม่ได้ — secret ที่ใช้อาจเปลี่ยนไปแล้ว ให้กรอกกุญแจของผู้ให้บริการนี้ใหม่'
		);
	}
}

/** เก็บแค่ 4 ตัวท้ายไว้ให้ผู้ใช้ดูว่ากรอกกุญแจตัวไหน — ไม่เปิดเผยกุญแจ */
export function keyHint(key: string): string {
	const trimmed = key.trim();
	if (trimmed.length <= 4) return '****';
	return `****${trimmed.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// เข้าถึงตาราง
// ---------------------------------------------------------------------------

type TableError = { code?: string | null; message?: string | null } | null | undefined;

/** แปลง error ของ PostgREST เป็นคำแนะนำภาษาไทย (คืน null เมื่อไม่มีคำแนะนำเฉพาะ) */
export function tableErrorHint(error: TableError): string | null {
	if (!error) return null;
	const code = error.code ?? '';
	const message = error.message ?? '';

	if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(message)) {
		return MIGRATION_HINT;
	}
	if (code === '23505') return 'ชื่อนี้ซ้ำกับที่มีอยู่แล้ว';
	if (code === '23503') return 'ยังไม่มีแถวในตาราง profiles ของผู้ใช้นี้ (FK ไม่ผ่าน)';
	if (code === '42703' || /column .* does not exist/i.test(message)) {
		return 'ตารางยังไม่มีคอลัมน์นี้ — รัน supabase/migrations/0002_settings.sql ใหม่อีกครั้ง';
	}
	return null;
}

function describe(error: TableError): string | null {
	if (!error) return null;
	return tableErrorHint(error) ?? error.message ?? 'บันทึกไม่สำเร็จ';
}

function now(): string {
	return new Date().toISOString();
}

// ---- prompts ----

export async function listPrompts(
	db: SettingsDb,
	userId: string
): Promise<{ rows: PromptRow[]; error: string | null }> {
	const { data, error } = await db
		.from('prompts')
		.select('*')
		.eq('user_id', userId)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (error) return { rows: [], error: describe(error) };
	return { rows: data ?? [], error: null };
}

export async function createPrompt(
	db: SettingsDb,
	userId: string,
	input: PromptInput
): Promise<{ id: string | null; error: string | null }> {
	const { data, error } = await db
		.from('prompts')
		.insert({ user_id: userId, title: input.title, body: input.body })
		.select('id')
		.maybeSingle();

	if (error) return { id: null, error: describe(error) };
	return { id: data?.id ?? null, error: null };
}

export async function updatePrompt(
	db: SettingsDb,
	userId: string,
	id: string,
	input: PromptInput
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('prompts')
		.update({ title: input.title, body: input.body, updated_at: now() })
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

/** ลบแบบเก็บประวัติ (ตารางจริงมีคอลัมน์ deleted_at) */
export async function softDeletePrompt(
	db: SettingsDb,
	userId: string,
	id: string
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('prompts')
		.update({ deleted_at: now() })
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

// ---- provider_credentials ----

export async function listProviders(
	db: SettingsDb,
	userId: string
): Promise<{ rows: ProviderRow[]; error: string | null }> {
	const { data, error } = await db
		.from('provider_credentials')
		.select('*')
		.eq('user_id', userId)
		.order('updated_at', { ascending: false });

	if (error) return { rows: [], error: describe(error) };
	return { rows: data ?? [], error: null };
}

export async function createProvider(
	db: SettingsDb,
	userId: string,
	input: ProviderInput,
	sealed: { key_sealed: string; key_hint: string } | null
): Promise<{ id: string | null; error: string | null }> {
	// ตารางจริงไม่มี default ของ id -> ต้องสร้างเอง
	const id = crypto.randomUUID();
	const { error } = await db.from('provider_credentials').insert({
		id,
		user_id: userId,
		label: input.label,
		base_url: input.baseUrl || null,
		models: parseModelsInput(input.models),
		key_sealed: sealed?.key_sealed ?? null,
		key_hint: sealed?.key_hint ?? null
	});

	if (error) return { id: null, error: describe(error) };
	return { id, error: null };
}

export async function updateProvider(
	db: SettingsDb,
	userId: string,
	id: string,
	input: ProviderInput,
	sealed: { key_sealed: string; key_hint: string } | null
): Promise<{ error: string | null }> {
	const columns: Partial<ProviderRow> = {
		label: input.label,
		base_url: input.baseUrl || null,
		models: parseModelsInput(input.models),
		updated_at: now()
	};

	// กุญแจว่าง = คงของเดิมไว้ — การลบกุญแจเป็นอีก action
	if (sealed) {
		columns.key_sealed = sealed.key_sealed;
		columns.key_hint = sealed.key_hint;
	}

	const { error } = await db
		.from('provider_credentials')
		.update(columns)
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

export async function deleteProvider(
	db: SettingsDb,
	userId: string,
	id: string
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('provider_credentials')
		.delete()
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

export async function clearProviderKey(
	db: SettingsDb,
	userId: string,
	id: string
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('provider_credentials')
		.update({ key_sealed: null, key_hint: null, updated_at: now() })
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

/** บันทึกรายชื่อโมเดลที่ค้นพบจริงกลับลงแถว (ใช้หลังกดทดสอบเชื่อมต่อ) */
export async function saveProviderModels(
	db: SettingsDb,
	userId: string,
	id: string,
	models: string[]
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('provider_credentials')
		.update({ models, updated_at: now() })
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

// ---- styles ----

export async function listStyles(
	db: SettingsDb,
	userId: string
): Promise<{ rows: StyleRow[]; error: string | null }> {
	const { data, error } = await db
		.from('styles')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: true });

	if (error) return { rows: [], error: describe(error) };
	return { rows: data ?? [], error: null };
}

export async function loadStyle(
	db: SettingsDb,
	userId: string,
	id: string
): Promise<{ row: StyleRow | null; error: string | null }> {
	const { data, error } = await db
		.from('styles')
		.select('*')
		.eq('id', id)
		.eq('user_id', userId)
		.maybeSingle();

	if (error) return { row: null, error: describe(error) };
	return { row: data ?? null, error: null };
}

function styleColumns(input: StyleInput): Partial<StyleRow> {
	return {
		name: input.name,
		brand_light: input.brandLight,
		brand_dark: input.brandDark,
		brand_strong_light: input.brandStrongLight,
		brand_strong_dark: input.brandStrongDark,
		brand_soft_light: input.brandSoftLight,
		brand_soft_dark: input.brandSoftDark,
		radius_panel: input.radiusPanel,
		radius_control: input.radiusControl,
		updated_at: now()
	};
}

export async function createStyle(
	db: SettingsDb,
	userId: string,
	input: StyleInput
): Promise<{ id: string | null; error: string | null }> {
	const { data, error } = await db
		.from('styles')
		.insert({ user_id: userId, ...styleColumns(input), name: input.name })
		.select('id')
		.maybeSingle();

	if (error) return { id: null, error: describe(error) };
	return { id: data?.id ?? null, error: null };
}

export async function updateStyle(
	db: SettingsDb,
	userId: string,
	id: string,
	input: StyleInput
): Promise<{ error: string | null }> {
	const { error } = await db
		.from('styles')
		.update(styleColumns(input))
		.eq('id', id)
		.eq('user_id', userId);

	return { error: describe(error) };
}

export async function deleteStyle(
	db: SettingsDb,
	userId: string,
	id: string
): Promise<{ error: string | null }> {
	const { error } = await db.from('styles').delete().eq('id', id).eq('user_id', userId);
	return { error: describe(error) };
}

/**
 * ใช้แม่แบบ: upsert ตาม (user_id, name) แล้วคืน id เพื่อตั้งเป็นสไตล์ที่ใช้อยู่
 * ทำซ้ำได้ (idempotent) — กดใช้แม่แบบเดิมสองครั้งไม่สร้างแถวซ้ำ
 */
export async function applyStyleTemplate(
	db: SettingsDb,
	userId: string,
	name: string,
	values: Omit<StylePreset, 'id' | 'name' | 'isActive'>
): Promise<{ id: string | null; error: string | null }> {
	const { data, error } = await db
		.from('styles')
		.upsert(
			{
				user_id: userId,
				name,
				brand_light: values.brandLight,
				brand_dark: values.brandDark,
				brand_strong_light: values.brandStrongLight,
				brand_strong_dark: values.brandStrongDark,
				brand_soft_light: values.brandSoftLight,
				brand_soft_dark: values.brandSoftDark,
				radius_panel: values.radiusPanel,
				radius_control: values.radiusControl,
				updated_at: now()
			},
			{ onConflict: 'user_id,name' }
		)
		.select('id')
		.maybeSingle();

	if (error) return { id: null, error: describe(error) };
	return { id: data?.id ?? null, error: null };
}

function pickColor(value: string, fallback: string): string {
	return isCssColor(value) ? value : fallback;
}

function pickLength(value: string, fallback: string, maxRem: number): string {
	const rem = lengthInRem(value);
	return rem !== null && rem <= maxRem ? value : fallback;
}

/** แปลงแถว -> ค่าที่ใช้จริง โดยแทนค่าที่ไม่ผ่านการตรวจด้วยค่าตั้งต้นใน layout.css */
export function stylePresetFromRow(row: StyleRow, isActive = false): StylePreset {
	return {
		id: row.id,
		name: row.name,
		brandLight: pickColor(row.brand_light, defaultStyleValues.brandLight),
		brandDark: pickColor(row.brand_dark, defaultStyleValues.brandDark),
		brandStrongLight: pickColor(row.brand_strong_light, defaultStyleValues.brandStrongLight),
		brandStrongDark: pickColor(row.brand_strong_dark, defaultStyleValues.brandStrongDark),
		brandSoftLight: pickColor(row.brand_soft_light, defaultStyleValues.brandSoftLight),
		brandSoftDark: pickColor(row.brand_soft_dark, defaultStyleValues.brandSoftDark),
		radiusPanel: pickLength(row.radius_panel, defaultStyleValues.radiusPanel, 64),
		radiusControl: pickLength(row.radius_control, defaultStyleValues.radiusControl, 64),
		isActive
	};
}

// ---- user_settings (แถวเดียวต่อผู้ใช้) ----

export async function loadUserSettings(
	db: SettingsDb,
	userId: string
): Promise<{ row: UserSettingsRow | null; error: string | null }> {
	const { data, error } = await db
		.from('user_settings')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) return { row: null, error: describe(error) };
	return { row: data ?? null, error: null };
}

export async function saveUserSettings(
	db: SettingsDb,
	userId: string,
	values: LayoutInput
): Promise<{ error: string | null }> {
	const { error } = await db.from('user_settings').upsert(
		{
			user_id: userId,
			theme: values.theme,
			sidebar_width: values.sidebarWidth,
			density: values.density,
			column_max: values.columnMax,
			sidebar_collapsed: values.sidebarCollapsed,
			sidebar_side: values.sidebarSide,
			sidebar_variant: values.sidebarVariant,
			sidebar_collapsible: values.sidebarCollapsible,
			font_scale: values.fontScale,
			updated_at: now()
		},
		{ onConflict: 'user_id' }
	);

	return { error: describe(error) };
}

/** ตั้ง "ที่เลือกใช้อยู่" (สไตล์/พรอมป์/ผู้ให้บริการ) — สร้างแถวถ้ายังไม่มี */
export async function setActiveChoice(
	db: SettingsDb,
	userId: string,
	field: 'style_id' | 'prompt_id' | 'provider_id',
	value: string | null
): Promise<{ error: string | null }> {
	// เขียนแยกกรณีไป (ไม่ใช้ computed key) เพื่อให้ type ของ upsert ตรวจได้จริง
	const columns: Partial<UserSettingsRow> =
		field === 'style_id'
			? { style_id: value }
			: field === 'prompt_id'
				? { prompt_id: value }
				: { provider_id: value };

	const { error } = await db
		.from('user_settings')
		.upsert({ user_id: userId, ...columns, updated_at: now() }, { onConflict: 'user_id' });

	return { error: describe(error) };
}

export async function clearUserSettings(
	db: SettingsDb,
	userId: string
): Promise<{ error: string | null }> {
	const { error } = await db.from('user_settings').delete().eq('user_id', userId);
	return { error: describe(error) };
}

/** แปลงแถว -> ค่าที่ใช้จริง โดยทิ้งค่าที่ไม่ผ่านการตรวจ (กัน CSS ที่ไม่ถูกต้อง) */
export function userSettingsFromRow(
	row: UserSettingsRow | null | undefined
): Partial<UserSettings> | null {
	if (!row) return null;

	return {
		...sanitizeUserSettings({
			theme: row.theme,
			sidebarWidth: row.sidebar_width,
			density: row.density,
			columnMax: row.column_max,
			sidebarSide: row.sidebar_side,
			sidebarVariant: row.sidebar_variant,
			sidebarCollapsible: row.sidebar_collapsible,
			fontScale: row.font_scale
		}),
		sidebarCollapsed: row.sidebar_collapsed === true
	};
}

export function activeChoicesFromRow(row: UserSettingsRow | null | undefined): ActiveChoices {
	return {
		styleId: row?.style_id ?? null,
		promptId: row?.prompt_id ?? null,
		providerId: row?.provider_id ?? null
	};
}
