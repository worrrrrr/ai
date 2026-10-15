/**
 * เครื่องมือของเอเจนต์ในโหมด "ทีม" (orchestrator) — ใช้ helper ตัวเดียวกับ `/api/chat`
 * ไม่มีสำเนาตรรกะ: `evaluateExpression` · `searchWeb` · `getCurrentWeather`
 *
 * ทำไมต้องมี: เอเจนต์ในทีมควรตรวจข้อเท็จจริง/คำนวณได้เอง ไม่ใช่ตอบจากความจำอย่างเดียว
 * (งานที่เหลือ: ให้ `/api/chat` มาใช้โมดูลนี้ด้วย เพื่อไม่ให้มีนิยามเครื่องมือสองชุด)
 */
import { tool } from 'ai';
import { z } from 'zod';
import { evaluateExpression, ExpressionError } from './expression.ts';
import { searchWeb } from './tools/search.ts';
import { getCurrentWeather } from './tools/weather.ts';

export function agentTools(exaApiKey: string | undefined) {
	return {
		calculate: tool({
			description:
				'คำนวณนิพจน์คณิตศาสตร์ (บวก ลบ คูณ หาร วงเล็บ เปอร์เซ็นต์) ใช้เมื่อต้องได้ตัวเลขที่แม่น',
			inputSchema: z.object({ expression: z.string().min(1).max(500) }),
			execute: async ({ expression }) => {
				try {
					return { expression, result: evaluateExpression(expression) };
				} catch (error) {
					const message = error instanceof ExpressionError ? error.message : 'คำนวณนิพจน์นี้ไม่ได้';
					return { expression, error: message };
				}
			}
		}),

		search: tool({
			description:
				'ค้นข้อมูลจากเว็บจริง (คืนผลพร้อมแหล่งที่มา) ใช้เมื่อต้องการข้อมูลที่ใหม่กว่าความรู้ในโมเดล',
			inputSchema: z.object({ query: z.string().min(1).max(300) }),
			execute: async ({ query }) => {
				if (!exaApiKey) {
					return { query, error: 'ยังไม่ได้ตั้งค่า EXA_API_KEY จึงค้นเว็บไม่ได้' };
				}

				return await searchWeb(query, { apiKey: exaApiKey });
			}
		}),

		weather: tool({
			description: 'อากาศปัจจุบันของพื้นที่หนึ่ง (Open-Meteo)',
			inputSchema: z.object({ location: z.string().min(1).max(120) }),
			execute: async ({ location }) => getCurrentWeather(location)
		})
	};
}
