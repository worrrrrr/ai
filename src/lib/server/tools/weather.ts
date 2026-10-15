/**
 * อากาศจริงจาก Open-Meteo (ไม่ต้องใช้ API key)
 * ขั้นแรกแปลงชื่อสถานที่เป็นพิกัด (geocoding) แล้วดึงค่าอากาศปัจจุบันของพิกัดนั้น
 */
import { z } from 'zod';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;

/** WMO weather code -> คำอธิบายภาษาไทย (https://open-meteo.com/en/docs) */
export const WEATHER_CODES: Record<number, string> = {
	0: 'ฟ้าใส',
	1: 'ฟ้าใสเป็นส่วนมาก',
	2: 'มีเมฆบางส่วน',
	3: 'มีเมฆมาก',
	45: 'หมอก',
	48: 'หมอกน้ำแข็ง',
	51: 'ฝนละอองเบา',
	53: 'ฝนละออง',
	55: 'ฝนละอองหนา',
	56: 'ฝนเยือกแข็งเบา',
	57: 'ฝนเยือกแข็ง',
	61: 'ฝนเบา',
	63: 'ฝน',
	65: 'ฝนหนัก',
	66: 'ฝนเยือกแข็งหนัก',
	67: 'ฝนเยือกแข็งหนักมาก',
	71: 'หิมะเบา',
	73: 'หิมะ',
	75: 'หิมะหนัก',
	77: 'เม็ดหิมะ',
	80: 'ฝนซู่เบา',
	81: 'ฝนซู่',
	82: 'ฝนซู่หนัก',
	85: 'หิมะซู่เบา',
	86: 'หิมะซู่หนัก',
	95: 'พายุฝนฟ้าคะนอง',
	96: 'พายุฝนฟ้าคะนองพร้อมลูกเห็บเบา',
	99: 'พายุฝนฟ้าคะนองพร้อมลูกเห็บหนัก'
};

export function describeWeatherCode(code: number | undefined): string | undefined {
	if (code === undefined) return undefined;
	return WEATHER_CODES[code] ?? `รหัสอากาศ WMO ${code}`;
}

const geocodeSchema = z.object({
	results: z
		.array(
			z.object({
				name: z.string(),
				latitude: z.number(),
				longitude: z.number(),
				country: z.string().optional(),
				admin1: z.string().optional()
			})
		)
		.optional()
});

const forecastSchema = z.object({
	current: z.object({
		time: z.string(),
		temperature_2m: z.number(),
		apparent_temperature: z.number().optional(),
		relative_humidity_2m: z.number().optional(),
		wind_speed_10m: z.number().optional(),
		weather_code: z.number().optional()
	})
});

export type WeatherObservation = {
	place: string;
	observedAt: string;
	condition?: string;
	temperatureC: number;
	feelsLikeC?: number;
	humidityPercent?: number;
	windSpeedKmh?: number;
	source: 'open-meteo';
};

export async function getCurrentWeather(location: string): Promise<WeatherObservation> {
	const query = location.trim();
	if (!query) throw new Error('ต้องระบุชื่อสถานที่');

	const geo = new URL(GEO_URL);
	geo.searchParams.set('name', query);
	geo.searchParams.set('count', '1');
	geo.searchParams.set('format', 'json');
	// ให้ชื่อสถานที่กลับมาตรงภาษาที่ผู้ใช้ถาม
	if (/[\u0E00-\u0E7F]/.test(query)) geo.searchParams.set('language', 'th');

	const geoRes = await fetch(geo, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!geoRes.ok) throw new Error(`ค้นหาสถานที่ไม่สำเร็จ (HTTP ${geoRes.status})`);

	const place = geocodeSchema.safeParse(await geoRes.json()).data?.results?.[0];
	if (!place) throw new Error(`ไม่พบสถานที่: ${query}`);

	const forecast = new URL(FORECAST_URL);
	forecast.searchParams.set('latitude', String(place.latitude));
	forecast.searchParams.set('longitude', String(place.longitude));
	forecast.searchParams.set(
		'current',
		'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code'
	);
	forecast.searchParams.set('timezone', 'auto');

	const res = await fetch(forecast, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!res.ok) throw new Error(`ดึงข้อมูลอากาศไม่สำเร็จ (HTTP ${res.status})`);

	const parsed = forecastSchema.safeParse(await res.json());
	if (!parsed.success) throw new Error('รูปแบบข้อมูลอากาศไม่เป็นไปตามที่คาด');

	const current = parsed.data.current;
	return {
		place: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
		observedAt: current.time,
		condition: describeWeatherCode(current.weather_code),
		temperatureC: current.temperature_2m,
		feelsLikeC: current.apparent_temperature,
		humidityPercent: current.relative_humidity_2m,
		windSpeedKmh: current.wind_speed_10m,
		source: 'open-meteo'
	};
}
