import { ollama, streamText } from 'ai-sdk-ollama';
import {
	convertToModelMessages,
	createUIMessageStream,
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
import { evaluateExpression, ExpressionError } from '#lib/server/expression.ts';
import { COMMAND_TOOLS, selectTools } from '#lib/server/router.ts';
import { searchWeb } from '#lib/server/tools/search.ts';
import { getCurrentWeather } from '#lib/server/tools/weather.ts';
import { callProviderChat } from '#lib/server/providerClient.ts';
import { envProviders } from '#lib/server/providerEnv.ts';
import { createLogger } from '#lib/server/log.ts';
import { decideRoute } from '#lib/server/providerRouting.ts';
import { openProviderKey, sealSecretFrom } from '#lib/server/settings.ts';

const MAX_BODY_BYTES = 1_000_000;

// โมเดล/ผู้ให้บริการที่ใช้จริง — ตาราง providers (provider_credentials) เตรียมไว้แล้ว
// การย้ายค่าพวกนี้ไปอ่านตามที่ผู้ใช้เลือกคือ T2.6 (ดู PLAN.md)
const CHAT_MODEL = 'gpt-oss:120b-cloud';
const DECISION_MODEL = 'tev1:0.8b';
const PROVIDER_LABEL = 'ollama';
const CHAT_TEMPERATURE = 0.7;
/** เพดานเวลาต่อคำขอของแชทเดี่ยว — กันโมเดลค้างแล้วถือคำขอไว้ไม่จำกัด
 *  (ถ้าหมดเวลา สตรีมจะจบและบันทึกคำตอบบางส่วนผ่านเส้นทาง isAborted ที่มีอยู่แล้ว) */
const CHAT_TIMEOUT_MS = 120_000;

/** เอเจนต์ที่เลือกใช้ตอบแชทนี้ (อ่านจากตาราง agents ของเจ้าของเท่านั้น) */
type AgentConfig = {
	id: string;
	name: string;
	model: string;
	system_prompt: string | null;
	temperature: number | null;
	/** ผู้ให้บริการที่เอเจนต์นี้ผูกไว้ (null = ใช้ค่าเริ่มต้นของระบบ) */
	provider_id: string | null;
};

async function loadAgentForChat(
	supabase: App.Locals['supabase'],
	userId: string,
	agentId: string
): Promise<AgentConfig | null> {
	const { data, error } = await supabase
		.from('agents')
		.select('id, name, model, system_prompt, temperature, provider_id')
		.eq('id', agentId)
		.eq('owner_id', userId)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		createLogger().write('error', 'โหลดเอเจนต์ไม่สำเร็จ', { reason: error.message });
		return null;
	}

	return data;
}

const chatRequestSchema = z.object({
	id: z.string().min(1).max(200).optional(),
	messageId: z.string().min(1).max(200).optional(),
	// เอเจนต์ที่ผู้ใช้เลือกตอนเริ่มแชท (client แนบมากับ body ของ sendMessage)
	agentId: z.string().min(1).max(80).optional(),
	// คำสั่งที่ผู้ใช้เลือกเองผ่าน `/command` (client แนบมากับ body ของ sendMessage)
	commands: z.array(z.enum(COMMAND_TOOLS)).max(COMMAND_TOOLS.length).optional(),
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

export async function POST({
	request,
	locals,
	platform
}: {
	request: Request;
	locals: App.Locals;
	platform: App.Platform | undefined;
}) {
	// hooks.server.ts ปล่อย /api ผ่านมาแล้ว จึงต้องเช็ค session เองและตอบเป็น JSON
	const user = locals.user;
	if (!user) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	// Exa เป็น secret ที่ตั้งใน .env (dev) / wrangler secret (prod) — ไม่มีก็ใช้ทางสำรองที่ไม่ต้องมี key
	const exaApiKey = platform?.env?.EXA_API_KEY;

	// กัน body ใหญ่ก่อนอ่าน (Content-Length) แล้วเช็คจำนวนไบต์จริงหลังอ่าน (length เป็น UTF-16 ไม่ใช่ไบต์)
	const declared = Number(request.headers.get('content-length') ?? '');
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
		return json({ error: 'payload too large' }, { status: 413 });
	}

	const raw = await request.text();
	if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
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

	// เอเจนต์ (ถ้าเลือกตอนเริ่มแชท) — ใช้โมเดล/พรอมป์ระบบ/อุณหภูมิของเอเจนต์นั้นจริง
	const agent =
		user && body.agentId ? await loadAgentForChat(locals.supabase, user.id, body.agentId) : null;

	// ผู้ให้บริการจาก ".env" (id ขึ้นต้น env: เช่น env:groq) → ใช้คีย์ที่เจ้าของตั้งใน .env โดยตรง
	// แยกเส้นทางไว้ก่อนบล็อกฐานข้อมูล เพื่อไม่แตะของเดิมที่ทำงานอยู่ · ถ้าไม่มีคีย์ต้องบอกตรง ๆ (ไม่ถอยไป Ollama เงียบ ๆ)
	if (agent?.provider_id?.startsWith('env:') && user) {
		const pick = envProviders(platform?.env as Record<string, string | undefined> | undefined).find(
			(item) => item.id === agent.provider_id
		);

		if (!pick) {
			return json(
				{ error: `ผู้ให้บริการ ${agent.provider_id} ยังไม่มีคีย์ใน .env — ใส่คีย์ก่อนจึงจะใช้ได้` },
				{ status: 400 }
			);
		}

		const model = agent.model || pick.model;
		const startedAt = Date.now();
		const answer = await callProviderChat(
			{ label: pick.label, baseUrl: pick.baseUrl, apiKey: pick.apiKey },
			{
				model,
				system: agent.system_prompt,
				prompt: lastUserText,
				temperature: agent.temperature ?? CHAT_TEMPERATURE
			}
		);
		const durationMs = Date.now() - startedAt;

		if (answer.error || !answer.text) {
			return json({ error: answer.error ?? 'ผู้ให้บริการไม่ตอบ' }, { status: 502 });
		}

		const answerText = answer.text;
		const envMeta = {
			model,
			provider: pick.label,
			temperature: agent.temperature ?? CHAT_TEMPERATURE,
			agentId: agent.id,
			durationMs
		};

		if (chatId) {
			const ready = await ensureChat(locals.supabase, user, chatId, titleFromMessages(messages));

			if (ready) {
				const incoming = body.messageId
					? messages.filter((m) => m.id === body.messageId)
					: messages.slice(-1);

				await saveMessages(locals.supabase, user, chatId, incoming, envMeta);
				await saveMessages(
					locals.supabase,
					user,
					chatId,
					[
						{
							id: crypto.randomUUID(),
							role: 'assistant',
							parts: [{ type: 'text', text: answerText }]
						} as UIMessage
					],
					envMeta
				);
				await touchChat(locals.supabase, chatId);
			}
		}

		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				execute: ({ writer }) => {
					const partId = crypto.randomUUID();
					writer.write({ type: 'text-start', id: partId });
					writer.write({ type: 'text-delta', id: partId, delta: answerText });
					writer.write({ type: 'text-end', id: partId });
				}
			})
		});
	}

	// เอเจนต์ที่ผูก "ผู้ให้บริการจริง" → ยิงผู้ให้บริการนั้นจริง (ไม่สตรีมทีละคำ) แล้วส่งกลับเป็น UI message stream
	// ก้อนนี้จัดการบันทึกแชท/ข้อความเอง เพราะต้อง return ก่อนถึงขั้นบันทึกด้านล่าง
	if (agent?.provider_id && user) {
		const { data: credential } = await locals.supabase
			.from('provider_credentials')
			.select('id, label, base_url, key_sealed')
			.eq('id', agent.provider_id)
			.eq('user_id', user.id)
			.maybeSingle();

		const decision = decideRoute(agent.provider_id, credential ? [credential] : []);
		if (decision.kind === 'error') return json({ error: decision.message }, { status: 400 });

		if (decision.kind === 'provider') {
			const secret = sealSecretFrom(platform);
			if (!secret) {
				return json(
					{ error: 'ยังไม่ได้ตั้ง PROVIDER_KEY_SECRET จึงเปิดคีย์ของผู้ให้บริการไม่ได้' },
					{ status: 500 }
				);
			}

			let apiKey: string;
			try {
				apiKey = await openProviderKey(secret, decision.sealed);
			} catch {
				return json({ error: `เปิดคีย์ของ “${decision.label}” ไม่ได้` }, { status: 500 });
			}

			const answer = await callProviderChat(
				{ label: decision.label, baseUrl: decision.baseUrl, apiKey },
				{
					model: agent.model,
					system: agent.system_prompt,
					prompt: lastUserText,
					temperature: agent.temperature ?? CHAT_TEMPERATURE
				}
			);

			if (answer.error || !answer.text) {
				return json({ error: answer.error ?? 'ผู้ให้บริการไม่ตอบ' }, { status: 502 });
			}

			const answerText = answer.text;
			const providerMeta = {
				model: agent.model,
				provider: decision.label,
				temperature: agent.temperature ?? CHAT_TEMPERATURE,
				agentId: agent.id
			};

			if (chatId) {
				const ready = await ensureChat(locals.supabase, user, chatId, titleFromMessages(messages));

				if (ready) {
					const incoming = body.messageId
						? messages.filter((m) => m.id === body.messageId)
						: messages.slice(-1);

					await saveMessages(locals.supabase, user, chatId, incoming, providerMeta);
					await saveMessages(
						locals.supabase,
						user,
						chatId,
						[
							{
								id: crypto.randomUUID(),
								role: 'assistant',
								parts: [{ type: 'text', text: answerText }]
							} as UIMessage
						],
						providerMeta
					);
					await touchChat(locals.supabase, chatId);
				}
			}

			return createUIMessageStreamResponse({
				stream: createUIMessageStream({
					execute: ({ writer }) => {
						const partId = crypto.randomUUID();
						writer.write({ type: 'text-start', id: partId });
						writer.write({ type: 'text-delta', id: partId, delta: answerText });
						writer.write({ type: 'text-end', id: partId });
					}
				})
			});
		}
	}
	// โมเดลอ่านจาก environment ของผู้ใช้ก่อน (OLLAMA_MODEL / OLLAMA_FAST_MODEL ใน .env)
	// — ไม่ฮาร์ดโค้ดทับค่าที่คุณตั้งไว้ · ไม่มีค่าก็ใช้ค่าตั้งต้นเดิม
	// (app.d.ts ยังไม่ประกาศคีย์ชุดนี้ จึงอ่านผ่าน Record เพื่อไม่ให้ชนิดบล็อก)
	const env = platform?.env as Record<string, string | undefined> | undefined;
	// ตามรอยเหตุการณ์ของคำขอหนึ่ง ๆ (รับ header จากผู้เรียก ถ้าไม่มีก็สร้างใหม่)
	const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
	const log = createLogger({ level: env?.LOG_LEVEL });
	const chatModel = env?.OLLAMA_MODEL ?? CHAT_MODEL;
	const decisionModel = env?.OLLAMA_FAST_MODEL ?? DECISION_MODEL;

	const model = agent?.model ?? chatModel;
	const temperature = agent?.temperature ?? CHAT_TEMPERATURE;
	const meta = {
		model,
		provider: PROVIDER_LABEL,
		temperature,
		agentId: agent?.id ?? null
	};

	// 0. บันทึกข้อความของผู้ใช้ลง Supabase ก่อนเริ่ม stream
	// (Chat ฝั่ง client ส่ง id ของ chat มาด้วย เพราะเราสร้าง new Chat({ id }) ในหน้า /chat/[id])
	let persist = false;
	if (chatId && user) {
		persist = await ensureChat(locals.supabase, user, chatId, titleFromMessages(messages));
		if (persist) {
			const incoming = body.messageId
				? messages.filter((m) => m.id === body.messageId)
				: messages.slice(-1);
			await saveMessages(locals.supabase, user, chatId, incoming, meta);

			// ผูกเอเจนต์เข้ากับแชท (ตาราง chat_participants) เพื่อดูย้อนหลังได้ว่าแชทนี้คุยกับใคร
			if (agent) {
				const { error: linkError } = await locals.supabase.from('chat_participants').insert({
					chat_id: chatId,
					participant_id: agent.id,
					participant_type: 'agent'
				});
				if (linkError && linkError.code !== '23505') {
					log.write(
						'warn',
						'ผูกเอเจนต์เข้ากับแชทไม่สำเร็จ',
						{ reason: linkError.message },
						requestId
					);
				}
			}
		}
	}

	// 1. เลือก tool: ถ้าผู้ใช้สั่งเองผ่าน /command ไม่ต้องเรียก Tev1 (ประหยัดเวลาและโมเดล)
	const commands = body.commands ?? [];
	// ตัวแปรของ router — เริ่มที่ "ยังไม่มีค่า" (null) ไม่ใส่ค่าเดาล่วงหน้า
	// ค่าจริงจะมาจาก router เท่านั้น; ถ้า router ล้ม จะเห็นว่า choice ยังเป็น null
	let choice: string | null = null;
	let score = 0;
	/** router (โมเดลตัดสินใจ) ล้ม → ปล่อยให้โมเดลแชทเลือกเครื่องมือเอง */
	let routeFailed = false;

	if (commands.length === 0) {
		// โมเดลตัดสินใจ (Tev1) ล้มได้ — เช่น 'was downloaded in a format that is no longer supported'
		// ต้องไม่ทำให้ทั้งคำขอ 500: ถอยไปใช้ 'reason' แล้วตอบต่อ (ผู้ใช้ยังได้คำตอบ)
		try {
			const decision = await experimental_decide({
				model: ollama.decisionModel(decisionModel),
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

			// รับค่าจริงจาก router (เห็นได้ใน log ทุกครั้งว่าเลือกอะไร ด้วยคะแนนเท่าไร)
			choice = decision.answers.route.choice;
			const probabilities = (decision.answers.route.probabilities ?? {}) as Record<string, number>;
			score = probabilities[choice] ?? 0;

			// เก็บที่ระดับ info เพื่อให้ยังเห็น "หลักฐาน" ใน log ปกติ (ตามที่เจ้าของต้องการ) — ตารางคะแนนเต็มเป็น debug
			log.write(
				'info',
				'router เลือกกลุ่ม',
				{ group: choice, score: Number(score.toFixed(3)) },
				requestId
			);
			log.write(
				'debug',
				'คะแนนทุกกลุ่ม',
				{ probabilities: JSON.stringify(probabilities) },
				requestId
			);
		} catch (error) {
			routeFailed = true;
			log.write(
				'warn',
				'router ตัดสินใจไม่สำเร็จ → ส่งเครื่องมือทั้งหมดให้โมเดลแชทเลือกเอง',
				{
					reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown'
				},
				requestId
			);
		}
	} else {
		log.write('debug', 'ผู้ใช้สั่งด้วยคำสั่งเอง', { commands: commands.join(', ') }, requestId);
	}

	// 2. สร้าง tools
	const allTools = {
		calculate: tool({
			description:
				'Perform arithmetic calculations. Use this when the user asks to compute, add, subtract, multiply, or divide numbers.',
			inputSchema: z.object({
				expression: z.string().describe('Math expression, e.g. "2 + 2 * 3"')
			}),
			execute: async ({ expression }) => {
				log.write('debug', 'เรียกเครื่องมือ calculate', { expression }, requestId);
				try {
					return { expression, result: evaluateExpression(expression) };
				} catch (err) {
					const message = err instanceof ExpressionError ? err.message : 'Invalid expression';
					return { expression, error: message };
				}
			}
		}),

		search: tool({
			description:
				'Search the web for current information (real web results with page content). Use this when the user asks about facts, news, or anything that requires up-to-date data.',
			inputSchema: z.object({
				query: z.string().describe('The search query')
			}),
			execute: async ({ query }) => {
				log.write('debug', 'เรียกเครื่องมือ search', { query }, requestId);
				try {
					return await searchWeb(query, { apiKey: exaApiKey });
				} catch (err) {
					return { query, error: err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ' };
				}
			}
		}),

		weather: tool({
			description:
				'Get the current real weather in a location (temperature, condition, humidity, wind) from Open-Meteo. Use this when the user asks about weather, temperature, or forecast.',
			inputSchema: z.object({
				location: z.string().describe('The location to get the weather for')
			}),
			execute: async ({ location }) => {
				log.write('debug', 'เรียกเครื่องมือ weather', { location }, requestId);
				try {
					return await getCurrentWeather(location);
				} catch (err) {
					return {
						location,
						error: err instanceof Error ? err.message : 'ดึงข้อมูลอากาศไม่สำเร็จ'
					};
				}
			}
		})
	};

	// 3. เลือก tools (ตรรกะใน selectTools เพื่อให้ทดสอบได้โดยไม่ต้องมี Ollama)
	//    - ผู้ใช้สั่งเองด้วย `/คำสั่ง` → ส่งเฉพาะที่สั่ง (เคารพคำสั่งผู้ใช้)
	//    - ปกติ → ส่ง "ทั้งหมด" ให้โมเดลแชทเลือกเอง (เชื่อถือได้กว่า router ตัวเล็กที่ตัดสินใจผิด/ล้ม)
	const { names: toolNames, strategy } =
		commands.length > 0
			? selectTools(choice ?? 'reason', score, Object.keys(allTools), commands)
			: {
					names: Object.keys(allTools),
					strategy: routeFailed ? 'router-failed-all-tools' : 'all-tools'
				};
	const tools = Object.fromEntries(
		toolNames.map((name) => [name, allTools[name as keyof typeof allTools]])
	) as Partial<typeof allTools>;

	log.write('info', 'เลือกเครื่องมือแล้ว', { strategy, toolCount: toolNames.length }, requestId);
	log.write('debug', 'เครื่องมือที่ส่งให้โมเดล', { tools: toolNames.join(', ') }, requestId);

	// 4. Stream
	const result = await streamText({
		model: ollama.languageModel(model),
		temperature,
		system: [
			...(agent?.system_prompt ? [agent.system_prompt] : []),
			// UI แสดงข้อความดิบ — โมเดลไม่ควรส่งสัญลักษณ์ LaTeX ออกมา (ผู้ใช้เห็น \[ ... \] แล้วอ่านไม่ออก)
			'ห้ามใช้สัญลักษณ์ LaTeX หรือตัวคั่นสูตร (เช่น \\[ \\], \\( \\), $$) — เขียนสมการและตัวแปรเป็นข้อความธรรมดา หรือใช้ markdown-code span สั้น ๆ',
			// กระตุ้นให้ใช้เครื่องมือจริง (มี calculator/search/weather ให้ใช้): ถ้าคำถามต้องใช้ข้อมูลภายนอกหรือคิดเลข ให้เรียกเครื่องมือก่อนตอบ
			'คุณมีเครื่องมือให้ใช้ (คิดเลข · ค้นเว็บ · อากาศ) — ถ้าคำถามต้องใช้ข้อมูลล่าสุดจากเว็บ ต้องคิดเลขให้แม่น หรือถามอากาศ ให้เรียกเครื่องมือก่อนตอบ แล้วจึงสรุปคำตอบ',
			'You are a helpful assistant.',
			'When a tool is available and relevant to the user request, you MUST call the tool instead of answering from memory.',
			'Do not skip tools when they are provided.',
			'Always state which source the data came from (e.g. Exa, Wikipedia, Open-Meteo) and include the link when one is available.'
		].join(' '),
		messages: await convertToModelMessages(messages),
		stopWhen: isStepCount(5),
		abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
		tools,
		onStepFinish: (step) => {
			// รายละเอียดระดับ debug — ไม่รบกวน log ของ production (ตั้ง LOG_LEVEL=debug เมื่อต้องไล่ปัญหา)
			if (step.toolCalls?.length) {
				log.write(
					'debug',
					'ใช้เครื่องมือในขั้นนี้',
					{ tools: step.toolCalls.map((t) => t.toolName).join(', ') },
					requestId
				);
			} else {
				log.write('debug', 'จบขั้นโดยไม่เรียกเครื่องมือ', {}, requestId);
			}
		}
	});

	result.steps.then((steps) => {
		const allCalls = steps.flatMap((s) => s.toolCalls ?? []);
		log.write(
			'info',
			'จบคำตอบ',
			{
				steps: steps.length,
				toolCalls: allCalls.length,
				tools: allCalls.map((t) => t.toolName).join(', ')
			},
			requestId
		);
	});

	return createUIMessageStreamResponse({
		stream: createUIMessageStream({
			execute: ({ writer }) => {
				// ขั้นของคำขอ — โชว์สดบนหน้าจอ (transient = ไม่เก็บลง DB): router เลือกอะไร/คะแนนเท่าไร · เครื่องมือที่ส่ง · โมเดล/ผู้ให้บริการ
				writer.write({
					type: 'data-route',
					transient: true,
					data: {
						group: choice,
						score,
						routeFailed,
						model,
						provider: meta.provider,
						tools: toolNames
					}
				});

				writer.merge(
					toUIMessageStream({
						stream: result.stream,
						// ส่ง messages เดิมเข้าไปเพื่อเปิด "persistence mode" ของ AI SDK
						// (ทำให้ข้อความตอบกลับได้ id ที่คงที่ และ onEnd คืนรายการ message ที่อัปเดตแล้ว)
						originalMessages: messages,
						onEnd: async ({ messages: updated, isAborted }) => {
							if (!persist || !chatId || !user) return;
							const last = updated[updated.length - 1];
							if (last && last.role === 'assistant') {
								await saveMessages(locals.supabase, user, chatId, [last], meta);
							}
							await touchChat(locals.supabase, chatId);
							if (isAborted)
								log.write('warn', 'บันทึกคำตอบบางส่วน (คำขอถูกยกเลิก/หมดเวลา)', {}, requestId);
						}
					})
				);
			}
		})
	});
}
