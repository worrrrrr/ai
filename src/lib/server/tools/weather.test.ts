import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeWeatherCode, getCurrentWeather } from './weather.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

function json(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('describeWeatherCode', () => {
	it('แปลงรหัส WMO ที่รู้จักเป็นภาษาไทย', () => {
		expect(describeWeatherCode(0)).toBe('ฟ้าใส');
		expect(describeWeatherCode(3)).toBe('มีเมฆมาก');
	});

	it('รหัสที่ไม่รู้จักยังบอกได้ว่าคือรหัสอะไร', () => {
		expect(describeWeatherCode(1234)).toContain('WMO 1234');
		expect(describeWeatherCode(undefined)).toBeUndefined();
	});
});

describe('getCurrentWeather', () => {
	it('ดึงอากาศจริงจากพิกัดที่ geocode ได้', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input).includes('geocoding-api')) {
					return json({
						results: [
							{
								name: 'กรุงเทพมหานคร',
								latitude: 13.75,
								longitude: 100.5,
								country: 'ไทย',
								admin1: 'กรุงเทพฯ'
							}
						]
					});
				}
				return json({
					current: {
						time: '2026-10-14T20:15',
						temperature_2m: 26.9,
						apparent_temperature: 29.4,
						relative_humidity_2m: 90,
						wind_speed_10m: 3.1,
						weather_code: 3
					}
				});
			})
		);

		const result = await getCurrentWeather('กรุงเทพ');

		expect(result.place).toContain('กรุงเทพมหานคร');
		expect(result.temperatureC).toBe(26.9);
		expect(result.condition).toBe('มีเมฆมาก');
		expect(result.source).toBe('open-meteo');
	});

	it('แจ้ง error เมื่อหาสถานที่ไม่เจอ', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => json({ results: [] }))
		);

		await expect(getCurrentWeather('ไม่มีที่นี้')).rejects.toThrow(/ไม่พบสถานที่/);
	});
});
