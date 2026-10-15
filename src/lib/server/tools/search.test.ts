import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchWeb, stripHtml, wikipediaLang } from './search.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('stripHtml', () => {
	it('ล้างแท็กและ decode entity', () => {
		expect(stripHtml('<span class="searchmatch">ประเทศไทย</span> &amp; เพื่อน')).toBe(
			'ประเทศไทย & เพื่อน'
		);
	});

	it('decode numeric entity ได้ทั้งแบบ decimal และ hex', () => {
		expect(stripHtml('A&#x27;n&#160;B')).toBe("A'n B");
	});

	it('numeric entity นอกช่วง Unicode ไม่ทำให้พัง', () => {
		expect(stripHtml('a&#x110000;b')).toBe('a&#x110000;b');
	});
});

describe('wikipediaLang', () => {
	it('เลือกวิกิตามอักษรในคำค้น', () => {
		expect(wikipediaLang('ประเทศไทย')).toBe('th');
		expect(wikipediaLang('Bangkok')).toBe('en');
	});
});

describe('searchWeb', () => {
	it('ใช้คำตอบตรงจาก DuckDuckGo เมื่อมี', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				json({ Answer: 'ปารีส', AbstractURL: 'https://example.com/paris', RelatedTopics: [] })
			)
		);

		const outcome = await searchWeb('เมืองหลวงของฝรั่งเศส');

		expect(outcome.source).toBe('duckduckgo');
		expect(outcome.answer).toBe('ปารีส');
	});

	it('ถอยไปใช้ Wikipedia เมื่อ DuckDuckGo ไม่มีคำตอบ', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input).includes('duckduckgo')) {
					return json({ Answer: '', AbstractText: '', RelatedTopics: [] });
				}
				return json({
					query: {
						search: [
							{
								title: 'ประเทศไทย',
								snippet: '<span class="searchmatch">ประเทศไทย</span>',
								pageid: 936
							}
						]
					}
				});
			})
		);

		const outcome = await searchWeb('ประเทศไทย');

		expect(outcome.source).toBe('wikipedia');
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toEqual({
			title: 'ประเทศไทย',
			url: 'https://th.wikipedia.org/?curid=936',
			snippet: 'ประเทศไทย'
		});
	});

	it('ถอยไป Wikipedia แม้ DuckDuckGo ยิงไม่สำเร็จ (network error)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input).includes('duckduckgo')) throw new Error('network down');
				return json({ query: { search: [{ title: 'ไทย', snippet: 'x', pageid: 1 }] } });
			})
		);

		const outcome = await searchWeb('ไทย');

		expect(outcome.source).toBe('wikipedia');
		expect(outcome.results[0].title).toBe('ไทย');
	});

	it('โยน error เมื่อไม่พบผลการค้นหาเลย', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input).includes('duckduckgo')) {
					return json({ Answer: '', AbstractText: '', RelatedTopics: [] });
				}
				return json({ query: { search: [] } });
			})
		);

		await expect(searchWeb('zzz')).rejects.toThrow(/ไม่พบผลการค้นหา/);
	});

	it('ใช้ Exa เป็นทางหลักเมื่อมีคีย์', async () => {
		const mock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			json({
				results: [
					{
						title: 'Example',
						url: 'https://example.com',
						text: 'เนื้อหาจริงจากหน้าเว็บ',
						publishedDate: '2026-01-01'
					}
				]
			})
		);
		vi.stubGlobal('fetch', mock);

		const outcome = await searchWeb('ข่าวล่าสุด', { apiKey: 'test-key' });

		expect(String(mock.mock.calls[0][0])).toBe('https://api.exa.ai/search');
		expect(mock.mock.calls[0][1]?.headers).toMatchObject({ 'x-api-key': 'test-key' });
		expect(outcome.source).toBe('exa');
		expect(outcome.results[0]).toEqual({
			title: 'Example',
			url: 'https://example.com',
			snippet: 'เนื้อหาจริงจากหน้าเว็บ'
		});
	});
});
