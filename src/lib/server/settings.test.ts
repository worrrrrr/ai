import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	MIGRATION_HINT,
	activeChoicesFromRow,
	discoverProviderModels,
	fetchProviderModels,
	issueMessages,
	keyHint,
	layoutInputSchema,
	openProviderKey,
	parseModels,
	parseModelsInput,
	protocolForLabel,
	providerInputSchema,
	promptInputSchema,
	sealProviderKey,
	styleInputSchema,
	stylePresetFromRow,
	tableErrorHint,
	userSettingsFromRow,
	type StyleRow,
	type UserSettingsRow
} from './settings.ts';
import { defaultStyleValues, styleTemplates, templateValues } from '#lib/stylePresets.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('promptInputSchema', () => {
	it('ผ่านเมื่อมีชื่อและเนื้อหา', () => {
		expect(promptInputSchema.safeParse({ title: 'ผู้ช่วยไทย', body: 'ตอบสั้น' }).success).toBe(
			true
		);
	});

	it('ไม่ผ่านเมื่อชื่อว่าง และบอกชื่อฟิลด์เป็นภาษาไทย', () => {
		const parsed = promptInputSchema.safeParse({ title: '  ', body: 'x' });
		expect(parsed.success).toBe(false);
		expect(issueMessages(parsed.error!)[0]).toContain('ชื่อพรอมป์');
	});

	it('ไม่ผ่านเมื่อพรอมป์ว่าง', () => {
		expect(promptInputSchema.safeParse({ title: 'ก', body: '' }).success).toBe(false);
	});
});

describe('providerInputSchema', () => {
	it('ผ่านเมื่อมีแค่ชื่อ (ที่อยู่/กุญแจเว้นว่างได้)', () => {
		const parsed = providerInputSchema.safeParse({
			label: 'ollama ในเครื่อง',
			baseUrl: '',
			models: '',
			apiKey: ''
		});
		expect(parsed.success).toBe(true);
	});

	it('ไม่ผ่านเมื่อที่อยู่ไม่ใช่ http/https', () => {
		const parsed = providerInputSchema.safeParse({
			label: 'x',
			baseUrl: 'ftp://host',
			models: '',
			apiKey: ''
		});
		expect(parsed.success).toBe(false);
		expect(issueMessages(parsed.error!)[0]).toContain('ที่อยู่');
	});

	it('ไม่ผ่านเมื่อไม่มีชื่อ', () => {
		expect(
			providerInputSchema.safeParse({ label: '', baseUrl: '', models: '', apiKey: '' }).success
		).toBe(false);
	});
});

describe('styleInputSchema', () => {
	it('ผ่านทุกแม่แบบในโปรเจกต์', () => {
		for (const template of styleTemplates) {
			const parsed = styleInputSchema.safeParse({
				name: template.name,
				...templateValues(template)
			});
			expect(parsed.success, `แม่แบบ ${template.id} ต้องผ่านการตรวจ`).toBe(true);
		}
	});

	it('ปฏิเสธค่าที่พยายามหนีออกจาก inline style', () => {
		const parsed = styleInputSchema.safeParse({
			name: 'อันตราย',
			...templateValues(styleTemplates[0]),
			brandLight: 'red; } :root { --x: 1'
		});
		expect(parsed.success).toBe(false);
		expect(issueMessages(parsed.error!)[0]).toContain('สีหลัก (สว่าง)');
	});
});

describe('layoutInputSchema', () => {
	it('รับค่าจากฟอร์ม (ความหนาแน่น/สเกลเป็นข้อความ)', () => {
		const parsed = layoutInputSchema.safeParse({
			theme: 'auto',
			sidebarWidth: '17rem',
			density: '0.85',
			columnMax: '46rem',
			sidebarCollapsed: false,
			sidebarSide: 'right',
			sidebarVariant: 'floating',
			sidebarCollapsible: 'icon',
			fontScale: '1.15'
		});
		expect(parsed.success).toBe(true);
		expect(parsed.data?.density).toBe(0.85);
		expect(parsed.data?.fontScale).toBe(1.15);
		expect(parsed.data?.sidebarSide).toBe('right');
		expect(parsed.data?.sidebarVariant).toBe('floating');
		expect(parsed.data?.sidebarCollapsible).toBe('icon');
	});

	it('ปฏิเสธธีม/ความหนาแน่น/ด้าน/สเกล/รูปแบบ/การย่อที่นอกช่วง', () => {
		const base = {
			sidebarWidth: '17rem',
			columnMax: '46rem',
			sidebarCollapsed: false,
			sidebarSide: 'left',
			sidebarVariant: 'sidebar',
			sidebarCollapsible: 'offcanvas',
			fontScale: '1'
		};
		expect(layoutInputSchema.safeParse({ ...base, theme: 'rainbow', density: '1' }).success).toBe(
			false
		);
		expect(layoutInputSchema.safeParse({ ...base, theme: 'auto', density: '9' }).success).toBe(
			false
		);
		expect(
			layoutInputSchema.safeParse({ ...base, theme: 'auto', density: '1', sidebarSide: 'top' })
				.success
		).toBe(false);
		expect(
			layoutInputSchema.safeParse({ ...base, theme: 'auto', density: '1', fontScale: '2' }).success
		).toBe(false);
	});
});

describe('parseModelsInput', () => {
	it('แยกบรรทัด/จุลภาค ตัดช่องว่างและตัวซ้ำ', () => {
		expect(parseModelsInput(' a \n b \n\n a , c ')).toEqual(['a', 'b', 'c']);
		expect(parseModelsInput('')).toEqual([]);
	});
});

describe('protocolForLabel', () => {
	it('ชื่อหรือพอร์ต 11434 -> ollama', () => {
		expect(protocolForLabel('ollama ในเครื่อง', 'http://127.0.0.1:11434')).toBe('ollama');
		expect(protocolForLabel('local', 'http://127.0.0.1:11434')).toBe('ollama');
	});

	it('ชื่ออื่น -> openai-compatible', () => {
		expect(protocolForLabel('groq', 'https://api.groq.com/openai/v1')).toBe('openai');
		expect(protocolForLabel(null, null)).toBe('openai');
	});
});

describe('parseModels', () => {
	it('อ่าน /api/tags ของ Ollama', () => {
		const payload = { models: [{ name: 'tev1:0.8b' }, { model: 'gpt-oss:120b-cloud' }] };
		expect(parseModels('ollama', payload)).toEqual(['tev1:0.8b', 'gpt-oss:120b-cloud']);
	});

	it('อ่าน /v1/models ของ OpenAI-compatible', () => {
		expect(parseModels('openai', { data: [{ id: 'gpt-4o' }] })).toEqual(['gpt-4o']);
	});

	it('คืน [] เมื่อรูปแบบไม่ตรง (ไม่ throw)', () => {
		expect(parseModels('ollama', { data: [] })).toEqual([]);
		expect(parseModels('openai', null)).toEqual([]);
	});
});

describe('fetchProviderModels', () => {
	it('ยิงไป /api/tags ของ Ollama และคืนชื่อแหล่งที่มา', async () => {
		const stub = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			json({ models: [{ name: 'tev1:0.8b' }] })
		);
		vi.stubGlobal('fetch', stub);

		const result = await fetchProviderModels({
			kind: 'ollama',
			baseUrl: 'http://127.0.0.1:11434'
		});

		expect(String(stub.mock.calls[0][0])).toBe('http://127.0.0.1:11434/api/tags');
		expect(result.source).toBe('Ollama /api/tags');
		expect(result.models).toEqual(['tev1:0.8b']);
	});

	it('ใส่ Bearer ให้เมื่อมีกุญแจ', async () => {
		const stub = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			json({ data: [{ id: 'gpt-4o' }] })
		);
		vi.stubGlobal('fetch', stub);

		await fetchProviderModels({
			kind: 'openai',
			baseUrl: 'https://api.example.com',
			apiKey: 'secret'
		});

		const init = stub.mock.calls[0][1] as RequestInit;
		expect(String(stub.mock.calls[0][0])).toBe('https://api.example.com/v1/models');
		expect(init.headers).toMatchObject({ authorization: 'Bearer secret' });
	});

	it('โยน error ภาษาไทยพร้อมสถานะเมื่อปลายทางตอบไม่สำเร็จ', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ error: 'nope' }, 500))
		);

		await expect(
			fetchProviderModels({ kind: 'ollama', baseUrl: 'http://127.0.0.1:11434' })
		).rejects.toThrow(/HTTP 500/);
	});

	it('โยน error เมื่อเชื่อมต่อไม่ได้เลย', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('connect ECONNREFUSED');
			})
		);

		await expect(
			fetchProviderModels({ kind: 'openai', baseUrl: 'http://127.0.0.1:1' })
		).rejects.toThrow(/ECONNREFUSED/);
	});

	it('โยน error เมื่อไม่พบรายชื่อโมเดล', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ models: [] }))
		);

		await expect(
			fetchProviderModels({ kind: 'ollama', baseUrl: 'http://127.0.0.1:11434' })
		).rejects.toThrow(/ไม่พบรายชื่อโมเดล/);
	});
});

describe('discoverProviderModels', () => {
	it('ต้องมี base URL ก่อน', async () => {
		await expect(discoverProviderModels({ label: 'x', baseUrl: null })).rejects.toThrow(
			/ยังไม่ได้ตั้งที่อยู่/
		);
	});

	it('ใช้โปรโตคอลที่เดาจากชื่อก่อน (ollama) เมื่อสำเร็จ', async () => {
		const stub = vi.fn(async (_input: RequestInfo | URL) =>
			json({ models: [{ name: 'tev1:0.8b' }] })
		);
		vi.stubGlobal('fetch', stub);

		const result = await discoverProviderModels({
			label: 'ollama',
			baseUrl: 'http://127.0.0.1:11434'
		});

		expect(result.protocol).toBe('ollama');
		expect(String(stub.mock.calls[0][0])).toContain('/api/tags');
	});

	it('ถอยไปอีกโปรโตคอลเมื่ออันแรกไม่สำเร็จ', async () => {
		const stub = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/v1/models')) return json({ error: 'not found' }, 404);
			return json({ models: [{ name: 'llama3' }] });
		});
		vi.stubGlobal('fetch', stub);

		// ชื่อเป็น groq -> เดาว่า openai ก่อน แต่ล้ม จึงถอยไป ollama
		const result = await discoverProviderModels({ label: 'groq', baseUrl: 'https://api.groq.com' });

		expect(result.protocol).toBe('ollama');
		expect(result.models).toEqual(['llama3']);
		expect(stub).toHaveBeenCalledTimes(2);
	});

	it('ล้มทั้งสองทาง -> error รวมเหตุผลของทั้งคู่', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);

		await expect(
			discoverProviderModels({ label: 'groq', baseUrl: 'https://api.groq.com' })
		).rejects.toThrow(/network down.*network down/s);
	});
});

describe('seal/เปิดกุญแจ', () => {
	const secret = 'test-secret-value';

	it('เข้ารหัสแล้วถอดกลับได้ค่าเดิม และ hint โชว์ 4 ตัวท้าย', async () => {
		const sealed = await sealProviderKey(secret, 'gsk_abcdef1234');
		expect(sealed.key_hint).toBe('****1234');
		expect(sealed.key_sealed).not.toContain('gsk_');
		expect(await openProviderKey(secret, sealed.key_sealed)).toBe('gsk_abcdef1234');
	});

	it('secret คนละตัวถอดไม่ได้', async () => {
		const sealed = await sealProviderKey(secret, 'gsk_abcdef1234');
		await expect(openProviderKey('other-secret', sealed.key_sealed)).rejects.toThrow(
			/ถอดกุญแจไม่ได้/
		);
	});

	it('ค่าที่ถูกแก้ระหว่างทางถอดไม่ได้ (AES-GCM ตรวจ integrity)', async () => {
		const sealed = await sealProviderKey(secret, 'gsk_abcdef1234');
		const [iv, cipher] = sealed.key_sealed.split('.');
		const tampered = `${iv}.${cipher.slice(0, -4)}AAAA`;

		await expect(openProviderKey(secret, tampered)).rejects.toThrow(/ถอดกุญแจไม่ได้/);
	});

	it('รูปแบบผิด -> error ภาษาไทย', async () => {
		await expect(openProviderKey(secret, 'no-dot')).rejects.toThrow(/รูปแบบกุญแจ/);
	});

	it('keyHint ของกุญแจสั้นมากไม่เปิดเผยอะไร', () => {
		expect(keyHint('abc')).toBe('****');
		expect(keyHint('abcd1234')).toBe('****1234');
	});
});

describe('tableErrorHint', () => {
	it('บอกให้รัน migration เมื่อยังไม่มีตาราง', () => {
		expect(tableErrorHint({ code: '42P01', message: 'relation does not exist' })).toBe(
			MIGRATION_HINT
		);
		expect(tableErrorHint({ code: 'PGRST205', message: 'schema cache' })).toBe(MIGRATION_HINT);
	});

	it('บอกเมื่อชื่อซ้ำ และเมื่อ FK ไม่ผ่าน', () => {
		expect(tableErrorHint({ code: '23505', message: 'duplicate' })).toContain('ซ้ำ');
		expect(tableErrorHint({ code: '23503', message: 'fk' })).toContain('profiles');
	});

	it('คืน null เมื่อไม่มีคำแนะนำเฉพาะ', () => {
		expect(tableErrorHint(null)).toBeNull();
		expect(tableErrorHint({ code: '42501', message: 'permission denied' })).toBeNull();
	});
});

describe('userSettingsFromRow', () => {
	it('คืนเฉพาะค่าที่ผ่านการตรวจ', () => {
		const row: UserSettingsRow = {
			user_id: 'u',
			theme: 'dark',
			sidebar_width: '20rem',
			density: 0.85,
			column_max: '56rem',
			sidebar_collapsed: true,
			sidebar_side: 'right',
			sidebar_variant: 'floating',
			sidebar_collapsible: 'icon',
			font_scale: 1.15,
			style_id: 's1',
			prompt_id: null,
			provider_id: null,
			updated_at: '2026-01-01T00:00:00.000Z'
		};

		expect(userSettingsFromRow(row)).toEqual({
			theme: 'dark',
			sidebarWidth: '20rem',
			columnMax: '56rem',
			density: 0.85,
			sidebarCollapsed: true,
			sidebarSide: 'right',
			sidebarVariant: 'floating',
			sidebarCollapsible: 'icon',
			fontScale: 1.15
		});
		expect(activeChoicesFromRow(row)).toEqual({
			styleId: 's1',
			promptId: null,
			providerId: null
		});
	});

	it('ทิ้งค่าที่ไม่ถูกต้อง (ค่าที่หลุดเข้ามาใน DB จะไม่กลายเป็น CSS)', () => {
		const row = {
			user_id: 'u',
			theme: 'rainbow',
			sidebar_width: '999rem',
			density: 99,
			column_max: 'red; }',
			sidebar_collapsed: false,
			sidebar_side: 'top',
			sidebar_variant: 'grid',
			sidebar_collapsible: 'slide',
			font_scale: 9,
			style_id: null,
			prompt_id: null,
			provider_id: null,
			updated_at: '2026-01-01T00:00:00.000Z'
		} as UserSettingsRow;

		expect(userSettingsFromRow(row)).toEqual({ sidebarCollapsed: false });
	});

	it('คืน null/ว่างเมื่อไม่มีแถว', () => {
		expect(userSettingsFromRow(null)).toBeNull();
		expect(activeChoicesFromRow(null)).toEqual({
			styleId: null,
			promptId: null,
			providerId: null
		});
	});
});

describe('stylePresetFromRow', () => {
	const row: StyleRow = {
		id: 's1',
		user_id: 'u',
		name: 'ของฉัน',
		brand_light: 'oklch(0.55 0.16 258)',
		brand_dark: 'oklch(0.72 0.13 258)',
		brand_strong_light: 'oklch(0.48 0.17 258)',
		brand_strong_dark: 'oklch(0.79 0.12 258)',
		brand_soft_light: 'oklch(0.95 0.03 258)',
		brand_soft_dark: 'oklch(0.32 0.06 258)',
		radius_panel: '1rem',
		radius_control: '0.5rem',
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z'
	};

	it('แปลงแถวเป็นค่าที่ใช้กับ inline style', () => {
		expect(stylePresetFromRow(row, true)).toEqual({
			id: 's1',
			name: 'ของฉัน',
			...defaultStyleValues,
			radiusPanel: '1rem',
			isActive: true
		});
	});

	it('แทนค่าที่ไม่ถูกต้องด้วยค่าตั้งต้นของ layout.css', () => {
		const broken = stylePresetFromRow({
			...row,
			brand_light: 'red; } :root { --x: 1',
			radius_panel: 'calc(1rem + 2px)'
		});

		expect(broken.brandLight).toBe(defaultStyleValues.brandLight);
		expect(broken.radiusPanel).toBe(defaultStyleValues.radiusPanel);
		expect(broken.isActive).toBe(false);
	});
});
