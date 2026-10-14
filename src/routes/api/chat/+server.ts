import { ollama, streamText } from 'ai-sdk-ollama';
import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	experimental_decide,
	isStepCount,
	tool,
	toUIMessageStream
} from 'ai';
import type { UIMessage } from 'ai';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ensureChat, saveMessages, titleFromMessages, touchChat } from '#lib/server/chats.ts';

const MAX_BODY_BYTES = 1_000_000;

const chatRequestSchema = z.object({
	id: z.string().min(1).max(200).optional(),
	messageId: z.string().min(1).max(200).optional(),
	messages: z
		.array(
			z.object({
				id: z.string().min(1),
				role: z.enum(['system', 'user', 'assistant']),
				parts: z.array(z.unknown())
			})
		)
		.min(1)
		.max(200)
});

function getTextFromMessage(message: UIMessage): string {
	return message.parts
		.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
		.map((p) => p.text)
		.join('');
}

function getLastUserText(messages: UIMessage[]): string {
	const last = [...messages].reverse().find((m) => m.role === 'user');
	return last ? getTextFromMessage(last) : '';
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	// hooks.server.ts ปล่อย /api ผ่านมาแล้ว จึงต้องเช็ค session เองและตอบเป็น JSON
	const user = locals.user;
	if (!user) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return json({ error: 'payload too large' }, { status: 413 });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(raw);
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const parsed = chatRequestSchema.safeParse(payload);
	if (!parsed.success) {
		return json({ error: 'invalid request', issues: parsed.error.issues }, { status: 400 });
	}

	const body = parsed.data;
	const messages = body.messages as UIMessage[];
	const chatId = body.id;
	const lastUserText = getLastUserText(messages);

	// 0. บันทึกข้อความของผู้ใช้ลง Supabase ก่อนเริ่ม stream
	// (Chat ฝั่ง client ส่ง id ของ chat มาด้วย เพราะเราสร้าง new Chat({ id }) ในหน้า /chat/[id])
	let persist = false;
	if (chatId && user) {
		persist = await ensureChat(locals.supabase, user, chatId, titleFromMessages(messages));
		if (persist) {
			const incoming = body.messageId
				? messages.filter((m) => m.id === body.messageId)
				: messages.slice(-1);
			await saveMessages(locals.supabase, user, chatId, incoming);
		}
	}

	// 1. Tev1 ตัดสินใจ
	const decision = await experimental_decide({
		model: ollama.decisionModel('tev1:0.8b'),
		state: lastUserText,
		questions: {
			route: {
				type: 'choice',
				instructions: 'จัดอยู่กลุ่มไหน ใช้เครื่องมือไหน?',
				criteria: {
					math: 'คำนวณ คิดเลข',
					search: 'ค้นหาข้อมูล',
					weather: 'ถามเรื่องอากาศ',
					reason: 'วิเคราะห์ หาเหตุผล'
				}
			}
		}
	});

	const choice = decision.answers.route.choice;
	const probabilities = decision.answers.route.probabilities as Record<string, number>;
	const score = probabilities[choice] ?? 0;

	console.log('[Tev1] chose:', choice, '| score:', score.toFixed(3));
	console.log('[Tev1] all scores:', probabilities);

	// 2. สร้าง tools
	const allTools = {
		calculate: tool({
			description:
				'Perform arithmetic calculations. Use this when the user asks to compute, add, subtract, multiply, or divide numbers.',
			inputSchema: z.object({
				expression: z.string().describe('Math expression, e.g. "2 + 2 * 3"')
			}),
			execute: async ({ expression }) => {
				console.log('[TOOL CALLED] calculate:', expression);
				try {
					const result = Function(`"use strict"; return (${expression})`)();
					return { expression, result };
				} catch {
					return { expression, error: 'Invalid expression' };
				}
			}
		}),

		search: tool({
			description:
				'Search the web for current information. Use this when the user asks about facts, news, or anything that requires up-to-date data.',
			inputSchema: z.object({
				query: z.string().describe('The search query')
			}),
			execute: async ({ query }) => {
				console.log('[TOOL CALLED] search:', query);
				return { query, results: [`Result 1 for ${query}`] };
			}
		}),

		weather: tool({
			description:
				'Get the current weather in a location. Use this when the user asks about weather, temperature, or forecast.',
			inputSchema: z.object({
				location: z.string().describe('The location to get the weather for')
			}),
			execute: async ({ location }) => {
				console.log('[TOOL CALLED] weather:', location);
				const temperature = Math.round(Math.random() * (90 - 32) + 32);
				return { location, temperature };
			}
		})
	};

	// 3. เลือก tools ตาม decision
	const choiceToTool: Record<string, keyof typeof allTools> = {
		math: 'calculate',
		search: 'search',
		weather: 'weather'
	};

	let tools: Partial<typeof allTools> = {};
	let strategy = '';

	if (choice === 'reason') {
		tools = {};
		strategy = 'no tools (reason)';
	} else if (choiceToTool[choice] && score >= 0.4) {
		const name = choiceToTool[choice];
		tools = { [name]: allTools[name] };
		strategy = `filtered -> ${name}`;
	} else {
		tools = allTools;
		strategy = 'fallback -> all tools';
	}

	console.log('[Router]', strategy, '| tool count:', Object.keys(tools).length);
	console.log('[Router] tools passed:', Object.keys(tools));

	// 4. Stream
	const result = await streamText({
		model: ollama.languageModel('gpt-oss:120b-cloud'),
		system: [
			'You are a helpful assistant.',
			'When a tool is available and relevant to the user request, you MUST call the tool instead of answering from memory.',
			'Do not skip tools when they are provided.'
		].join(' '),
		messages: await convertToModelMessages(messages),
		stopWhen: isStepCount(5),
		tools,
		onStepFinish: (step) => {
			if (step.toolCalls?.length) {
				console.log(
					'[Step] tool calls:',
					step.toolCalls.map((t) => t.toolName)
				);
			} else {
				console.log('[Step] finished without tool call');
			}
		}
	});

	result.steps.then((steps) => {
		const allCalls = steps.flatMap((s) => s.toolCalls ?? []);
		console.log(
			'[Stream] done. Total tool calls:',
			allCalls.length,
			allCalls.map((t) => t.toolName)
		);
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({
			stream: result.stream,
			// ส่ง messages เดิมเข้าไปเพื่อเปิด "persistence mode" ของ AI SDK
			// (ทำให้ข้อความตอบกลับได้ id ที่คงที่ และ onEnd คืนรายการ message ที่อัปเดตแล้ว)
			originalMessages: messages,
			onEnd: async ({ messages: updated, isAborted }) => {
				if (!persist || !chatId || !user) return;
				const last = updated[updated.length - 1];
				if (last && last.role === 'assistant') {
					await saveMessages(locals.supabase, user, chatId, [last]);
				}
				await touchChat(locals.supabase, chatId);
				if (isAborted) console.log('[chats] saved partial answer (aborted)');
			}
		})
	});
}
