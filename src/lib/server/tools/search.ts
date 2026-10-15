/**
 * ค้นหาข้อมูลจริงจากเว็บ
 * - ถ้ามี EXA_API_KEY ใช้ Exa (https://api.exa.ai/search) เป็นหลัก
 * - ถ้าไม่มี ใช้ทางสำรองที่ไม่ต้องมี key: DuckDuckGo Instant Answer + Wikipedia
 */
import { z } from 'zod';

const DDG_URL = 'https://api.duckduckgo.com/';
const EXA_URL = 'https://api.exa.ai/search';
const TIMEOUT_MS = 8000;
const EXA_TIMEOUT_MS = 15000;
const MAX_SNIPPET = 1200;

export type SearchHit = {
	title: string;
	url: string;
	snippet: string;
};

export type SearchOutcome = {
	source: 'exa' | 'duckduckgo' | 'wikipedia';
	answer?: string;
	answerUrl?: string;
	results: SearchHit[];
};

export type SearchOptions = {
	/** คีย์ของ Exa — ถ้าไม่ส่งจะใช้ทางสำรองที่ไม่ต้องมี key */
	apiKey?: string;
	numResults?: number;
};

/** แปลง numeric entity เป็นอักขระ — ถ้าค่าอยู่นอกช่วง Unicode ให้คืนข้อความเดิม (ไม่ throw) */
function codePointEntity(match: string, code: number): string {
	if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return match;
	return String.fromCodePoint(code);
}

/** ล้างแท็ก HTML และ decode entity ที่ API คืนมา */
export function stripHtml(value: string): string {
	return value
		.replace(/<[^>]*>/g, '')
		.replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => codePointEntity(match, parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (match, dec: string) => codePointEntity(match, Number(dec)))
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

const ddgSchema = z.object({
	AbstractText: z.string().optional(),
	AbstractURL: z.string().optional(),
	Answer: z.string().optional(),
	RelatedTopics: z.array(z.unknown()).optional()
});

const wikiSchema = z.object({
	query: z.object({
		search: z.array(
			z.object({
				title: z.string(),
				snippet: z.string(),
				pageid: z.number()
			})
		)
	})
});

const exaSchema = z.object({
	results: z.array(
		z.object({
			title: z.string().nullish(),
			url: z.string(),
			text: z.string().nullish(),
			publishedDate: z.string().nullish()
		})
	)
});

/** Wikipedia มีหลายภาษา — เลือกตามอักษรที่ปรากฏในคำค้น */
export function wikipediaLang(query: string): string {
	return /[\u0E00-\u0E7F]/.test(query) ? 'th' : 'en';
}

function collectTopics(topics: unknown, out: SearchHit[] = []): SearchHit[] {
	if (!Array.isArray(topics)) return out;
	for (const item of topics) {
		if (typeof item !== 'object' || item === null) continue;
		const record = item as { Text?: unknown; FirstURL?: unknown; Topics?: unknown };
		if (typeof record.Text === 'string' && typeof record.FirstURL === 'string') {
			out.push({ title: '', url: record.FirstURL, snippet: stripHtml(record.Text) });
		} else if (Array.isArray(record.Topics)) {
			collectTopics(record.Topics, out);
		}
	}
	return out;
}

async function duckduckgo(q: string): Promise<SearchOutcome | null> {
	const url = new URL(DDG_URL);
	url.searchParams.set('q', q);
	url.searchParams.set('format', 'json');
	url.searchParams.set('no_html', '1');
	url.searchParams.set('skip_disambig', '1');

	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!res.ok) return null;

		const parsed = ddgSchema.safeParse(await res.json());
		if (!parsed.success) return null;

		const data = parsed.data;
		const answer = data.Answer?.trim() || data.AbstractText?.trim();
		const results = collectTopics(data.RelatedTopics).slice(0, 5);
		if (!answer && results.length === 0) return null;

		return {
			source: 'duckduckgo',
			answer: answer || undefined,
			answerUrl: answer ? data.AbstractURL?.trim() || undefined : undefined,
			results
		};
	} catch {
		// เครือข่าย/timeout/รูปแบบผิด — ไม่ใช่เรื่องคอขวด ปล่อยให้ถอยไป Wikipedia
		return null;
	}
}

async function wikipedia(q: string): Promise<SearchHit[]> {
	const lang = wikipediaLang(q);
	const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
	url.searchParams.set('action', 'query');
	url.searchParams.set('list', 'search');
	url.searchParams.set('srsearch', q);
	url.searchParams.set('srlimit', '5');
	url.searchParams.set('format', 'json');
	url.searchParams.set('utf8', '1');

	const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!res.ok) throw new Error(`ค้นหาไม่สำเร็จ (HTTP ${res.status})`);

	const parsed = wikiSchema.safeParse(await res.json());
	if (!parsed.success) throw new Error('รูปแบบผลการค้นหาไม่เป็นไปตามที่คาด');

	return parsed.data.query.search.map((row) => ({
		title: row.title,
		url: `https://${lang}.wikipedia.org/?curid=${row.pageid}`,
		snippet: stripHtml(row.snippet)
	}));
}

async function exa(q: string, apiKey: string, numResults: number): Promise<SearchOutcome> {
	const res = await fetch(EXA_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
		body: JSON.stringify({
			query: q,
			type: 'auto',
			numResults,
			contents: { text: { maxCharacters: MAX_SNIPPET } }
		}),
		signal: AbortSignal.timeout(EXA_TIMEOUT_MS)
	});

	if (!res.ok) throw new Error(`ค้นหาผ่าน Exa ไม่สำเร็จ (HTTP ${res.status})`);

	const parsed = exaSchema.safeParse(await res.json());
	if (!parsed.success) throw new Error('รูปแบบผลการค้นหาจาก Exa ไม่เป็นไปตามที่คาด');

	return {
		source: 'exa',
		results: parsed.data.results.map((row) => ({
			title: row.title ?? '',
			url: row.url,
			snippet: (row.text ?? '').slice(0, MAX_SNIPPET)
		}))
	};
}

export async function searchWeb(
	query: string,
	options: SearchOptions = {}
): Promise<SearchOutcome> {
	const q = query.trim();
	if (!q) throw new Error('ต้องระบุคำค้นหา');

	// ทางหลัก: Exa เมื่อมีคีย์ (ผลจากเว็บจริงพร้อมเนื้อหา)
	// ถ้า Exa ล้มจะ throw ออกไปโดยตั้งใจ เพื่อให้เห็นว่า key/เครือข่ายมีปัญหา (ไม่กลบด้วยผลคุณภาพต่ำ)
	if (options.apiKey) return exa(q, options.apiKey, options.numResults ?? 5);

	// ทางสำรองที่ไม่ต้องมีคีย์
	const direct = await duckduckgo(q);
	if (direct) return direct;

	const results = await wikipedia(q);
	if (results.length === 0) throw new Error(`ไม่พบผลการค้นหาสำหรับ: ${q}`);
	return { source: 'wikipedia', results };
}
