/**
 * POST /api/chat/orchestrate — ยิงหลายเอเจนต์ช่วยกันตอบ (โหมด A: วางแผน → ยิงขนาน → หัวหน้ารวม)
 *
 * ตอบกลับเป็น **NDJSON** (หนึ่ง JSON ต่อบรรทัด) เพื่อให้ผู้ใช้เห็นความคืบหน้าแทนการรอเงียบ ๆ:
 *   {"type":"plan", ...} → {"type":"answer", ...} ต่อคน → {"type":"done", ...}
 * ถ้าขั้นต้นทางผิด (ไม่ล็อกอิน/body ผิด) จะตอบ JSON ปกติพร้อม status code ตามเดิม
 *
 * กติกาเดียวกับ /api/chat:
 * - hooks.server.ts ปล่อย /api ผ่าน จึงต้องเช็ค session เองและตอบ 401 เป็น JSON
 * - จำกัดขนาด body ก่อนอ่าน แล้ว zod ตรวจรูปร่าง
 * - ทุกอย่างที่บันทึกมาจากของจริง (ผู้ใช้เลือกเอเจนต์ใด ก็ยิงด้วยโมเดล/พรอมป์ของเอเจนต์นั้น)
 *
 * ข้อจำกัดของรอบนี้ (บันทึกใน docs/orchestrator.md): "แผน" สร้างจากโค้ด (ยังไม่เรียกโมเดลวางแผน)
 * และเอเจนต์ยังไม่ใช้เครื่องมือ — เครื่องมือยังผูกกับเส้นทางสตรีมของ /api/chat
 */
import { ollama } from 'ai-sdk-ollama';
import { generateText, isStepCount } from 'ai';
import type { UIMessage } from 'ai';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ensureChat, saveMessages, titleFromMessages, touchChat } from '#lib/server/chats.ts';
import {
	answerPrompt,
	mergePrompt,
	orchestrationStatus,
	planPrompt,
	selectOrchestratorMembers,
	summarizeOrchestration,
	type OrchestrationStep
} from '#lib/server/orchestrator.ts';
import {
	addOrchestrationStep,
	createOrchestration,
	finishOrchestration,
	orchestrationDb
} from '#lib/server/orchestrations.ts';
import { agentTools } from '#lib/server/agentTools.ts';
import { createLogger } from '#lib/server/log.ts';
import { envProviders } from '#lib/server/providerEnv.ts';
import { callAgent } from '#lib/server/agentCall.ts';
import type { CredentialLike } from '#lib/server/providerRouting.ts';
import { sealSecretFrom } from '#lib/server/settings.ts';

const MAX_BODY_BYTES = 200_000;
/** เพดานเวลาต่อเอเจนต์หนึ่งตัว — ตัวที่หมดเวลาถือว่า "ล้ม" แต่รอบยังจบได้ */
const AGENT_TIMEOUT_MS = 60_000;
/** เพดานเวลาของขั้นวางแผน (สั้นกว่า เพราะเป็นแค่แผน) */
const PLAN_TIMEOUT_MS = 20_000;

const orchestrateSchema = z.object({
	id: z.string().min(1).max(200).optional(),
	prompt: z.string().trim().min(1, 'ต้องมีคำถาม').max(8000, 'คำถามยาวเกิน 8000 ตัวอักษร'),
	agentIds: z.array(z.string().min(1).max(80)).min(1).max(4),
	leadAgentId: z.string().min(1).max(80).optional()
});

function timeoutSignal(ms: number, outer: AbortSignal): AbortSignal {
	const controller = new AbortController();
	setTimeout(() => controller.abort(new Error('เอเจนต์ใช้เวลาเกินกำหนด')), ms);
	outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
	return controller.signal;
}

export async function POST({
	request,
	locals,
	platform
}: {
	request: Request;
	locals: App.Locals;
	platform: App.Platform | undefined;
}): Promise<Response> {
	const user = locals.user;
	if (!user) return json({ error: 'unauthorized' }, { status: 401 });

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

	const parsed = orchestrateSchema.safeParse(payload);
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0]?.message ?? 'invalid request' }, { status: 400 });
	}
	const body = parsed.data;

	// โหลดเฉพาะเอเจนต์ของผู้ใช้รายนี้ (ยังไม่ถูกลบ) — การเลือกที่เหลือตรวจด้วยตรรกะบริสุทธิ์
	const { data: agents, error: agentsError } = await locals.supabase
		.from('agents')
		.select('id, name, model, system_prompt, provider_id')
		.eq('owner_id', user.id)
		.is('deleted_at', null);

	if (agentsError) return json({ error: agentsError.message }, { status: 500 });

	// โหลดผู้ให้บริการที่เอเจนต์ในรอบนี้อ้างถึง (เฉพาะที่มี) — ใช้เปิดคีย์และยิงจริง
	const providerIds = [
		...new Set(
			(agents ?? []).map((agent) => agent.provider_id).filter((id): id is string => Boolean(id))
		)
	];

	const { data: credentialRows, error: credentialsError } = providerIds.length
		? await locals.supabase
				.from('provider_credentials')
				.select('id, label, base_url, key_sealed')
				.eq('user_id', user.id)
				.in('id', providerIds)
		: { data: [], error: null };

	if (credentialsError) {
		return json(
			{ error: `อ่านข้อมูลผู้ให้บริการไม่สำเร็จ: ${credentialsError.message}` },
			{ status: 500 }
		);
	}

	const credentials = (credentialRows ?? []) as CredentialLike[];
	/** คีย์สำหรับถอดรหัสกุญแจที่เก็บไว้ (null = ยังไม่ได้ตั้งใน .env) */
	const keySecret = sealSecretFrom(platform);
	// ผู้ให้บริการจาก .env (Groq/Gemini/DeepSeek) — ให้ทุกจุดที่ยิงเอเจนต์เลือกใช้ได้เท่ากับ Ollama
	const envList = envProviders(platform?.env as Record<string, string | undefined> | undefined);

	const selection = selectOrchestratorMembers(
		agents ?? [],
		body.agentIds,
		body.leadAgentId ?? null
	);
	if (!selection.ok) return json({ error: selection.message }, { status: 400 });

	const db = orchestrationDb(locals.supabase);
	const created = await createOrchestration(db, {
		chatId: body.id ?? null,
		userId: user.id,
		prompt: body.prompt,
		leadAgentId: selection.lead.id
	});

	if (!created.id) {
		return json({ error: created.error ?? 'เปิดรอบไม่สำเร็จ' }, { status: 500 });
	}
	const orchestrationId = created.id;

	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: Record<string, unknown>) => {
				try {
					controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				} catch {
					// ผู้ใช้ปิดแท็บไปแล้ว — แจ้งไม่ได้ก็ปล่อยผ่าน ไม่ให้ทั้งรอบล้มเพราะเรื่องนี้
				}
			};

			try {
				// 1) แผน — ให้หัวหน้าวางแผนเอง (สั้น) ถ้าล้มก็ใช้แผนจากรายชื่อ
				const roster = selection.members
					.map((member) => `${member.name}${member.isLead ? ' (หัวหน้า)' : ''}`)
					.join(', ');
				const fallbackPlan = `จะถาม ${selection.members.length} ผู้เชี่ยวชาญ: ${roster}`;

				let planText = fallbackPlan;

				try {
					// ขั้นวางแผนก็ต้องยิงผู้ให้บริการจริงถ้าหัวหน้าผูกไว้ (ไม่งั้นแผนมาจาก Ollama เงียบ ๆ)
					const planCall = await callAgent({
						model: selection.lead.model,
						system: selection.lead.system_prompt,
						prompt: planPrompt(
							body.prompt,
							selection.members.map((member) => member.name)
						),
						temperature: 0.2,
						providerId:
							agents?.find((agent) => agent.id === selection.lead.id)?.provider_id ?? null,
						credentials,
						keySecret,
						signal: timeoutSignal(PLAN_TIMEOUT_MS, request.signal),
						runDefault: async () => {
							const { text } = await generateText({
								model: ollama.languageModel(selection.lead.model),
								prompt: planPrompt(
									body.prompt,
									selection.members.map((member) => member.name)
								),
								temperature: 0.2,
								abortSignal: timeoutSignal(PLAN_TIMEOUT_MS, request.signal)
							});

							return text;
						}
					});

					if (planCall.text?.trim()) {
						planText = planCall.text.trim();
					} else if (planCall.error) {
						createLogger().write('warn', 'วางแผนไม่สำเร็จ ใช้แผนสำรอง', {
							reason: String(planCall.error)
						});
					}
				} catch (error) {
					createLogger().write('warn', 'วางแผนไม่สำเร็จ ใช้แผนสำรอง', {
						reason: error instanceof Error ? error.message : String(error)
					});
				}

				await addOrchestrationStep(db, orchestrationId, {
					agentId: selection.lead.id,
					agentName: selection.lead.name,
					kind: 'plan',
					content: planText
				});

				send({ type: 'plan', plan: planText, orchestrationId, lead: selection.lead.name });

				// ทำเครื่องหมายว่ากำลังยิงขนานจริง — ให้สถานะตรงกับความจริง
				// (updated_at นี้คือค่าที่ตัวเยียวยารอบค้างใช้ตัดสิน)
				const { error: runningError } = await db
					.from('orchestrations')
					.update({ status: 'running', updated_at: new Date().toISOString() })
					.eq('id', orchestrationId);

				if (runningError) {
					createLogger().write('error', 'ตั้งสถานะ running ไม่สำเร็จ', {
						reason: runningError.message
					});
				}

				// ผูกแชท + บันทึกคำถามของผู้ใช้ (ถ้าส่ง chat id มา)
				if (body.id) {
					const ready = await ensureChat(
						locals.supabase,
						user,
						body.id,
						titleFromMessages([
							{
								id: 'tmp',
								role: 'user',
								parts: [{ type: 'text', text: body.prompt }]
							} as UIMessage
						])
					);

					if (ready) {
						// ผูกทุกคนในทีมไว้กับแชทนี้ (chat_participants) — เกณฑ์ผ่านข้อ 1 ใน docs/orchestrator.md §4
						for (const member of selection.members) {
							const { error: linkError } = await locals.supabase.from('chat_participants').insert({
								chat_id: body.id,
								participant_id: member.id,
								participant_type: 'agent'
							});

							// แถวซ้ำ (ถ้ามี unique) ไม่ถือเป็นปัญหา — รอบใหม่ของแชทเดิมเจอได้บ่อย
							if (linkError && linkError.code !== '23505') {
								createLogger().write('error', 'ผูกผู้ร่วมวงไม่สำเร็จ', {
									reason: linkError.message
								});
							}
						}

						await saveMessages(
							locals.supabase,
							user,
							body.id,
							[
								{
									id: crypto.randomUUID(),
									role: 'user',
									parts: [{ type: 'text', text: body.prompt }]
								} as UIMessage
							],
							{ model: selection.lead.model, provider: 'ollama', agentId: selection.lead.id }
						);
					}
				}

				// 2) ยิงขนาน — ส่งผลทันทีที่แต่ละคนจบ (ตัวใดล้มก็เก็บเป็นขั้นที่ล้ม)
				const answers: OrchestrationStep[] = await Promise.all(
					selection.members.map(async (member) => {
						const started = Date.now();
						let step: OrchestrationStep;

						try {
							// ยิงผ่าน callAgent: เอเจนต์ที่ผูกผู้ให้บริการไว้จะยิงที่นั่นจริง
							// ถ้าใช้ไม่ได้ (ไม่มีคีย์/หาผู้ให้บริการไม่เจอ) จะได้ error ของคนนี้ ไม่ถอยไป Ollama เงียบ ๆ
							const call = await callAgent({
								model: member.model,
								system: member.system_prompt,
								prompt: answerPrompt(body.prompt, member, selection.members.length, planText),
								temperature: 0.7,
								providerId: agents?.find((agent) => agent.id === member.id)?.provider_id ?? null,
								credentials,
								keySecret,
								envProviders: envList,
								signal: timeoutSignal(AGENT_TIMEOUT_MS, request.signal),
								runDefault: async () => {
									const { text } = await generateText({
										model: ollama.languageModel(member.model),
										system: member.system_prompt ?? undefined,
										prompt: answerPrompt(body.prompt, member, selection.members.length, planText),
										temperature: 0.7,
										tools: agentTools(platform?.env?.EXA_API_KEY),
										stopWhen: isStepCount(3),
										abortSignal: timeoutSignal(AGENT_TIMEOUT_MS, request.signal)
									});

									return text;
								}
							});

							if (call.error || !call.text) throw new Error(call.error ?? 'ไม่ได้คำตอบ');
							const text = call.text;

							step = {
								agentId: member.id,
								agentName: member.name,
								kind: 'answer',
								content: text,
								durationMs: Date.now() - started
							};
						} catch (error) {
							step = {
								agentId: member.id,
								agentName: member.name,
								kind: 'answer',
								content: '',
								error: error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ',
								durationMs: Date.now() - started
							};
						}

						await addOrchestrationStep(db, orchestrationId, step);
						send({ type: 'answer', ...step });
						return step;
					})
				);

				// 3) หัวหน้ารวมคำตอบ (ใช้พรอมป์/โมเดลของหัวหน้าเอง)
				const usable = answers
					.filter((step) => !step.error && step.content.trim().length > 0)
					.map((step) => ({ name: step.agentName, content: step.content }));

				let merged = '';
				let mergeError: string | null = null;

				if (usable.length === 0) {
					mergeError = 'ไม่มีเอเจนต์ตัวใดตอบสำเร็จ';
				} else {
					const started = Date.now();
					try {
						// หัวหน้าก็ต้องยิงผู้ให้บริการจริงถ้าผูกไว้ (ไม่งั้นคำตอบสุดท้ายยังมาจาก Ollama เงียบ ๆ)
						const call = await callAgent({
							model: selection.lead.model,
							system: selection.lead.system_prompt,
							prompt: mergePrompt(body.prompt, selection.lead.name, usable),
							temperature: 0.3,
							providerId:
								agents?.find((agent) => agent.id === selection.lead.id)?.provider_id ?? null,
							credentials,
							keySecret,
							envProviders: envList,
							signal: timeoutSignal(AGENT_TIMEOUT_MS, request.signal),
							runDefault: async () => {
								const { text } = await generateText({
									model: ollama.languageModel(selection.lead.model),
									system: selection.lead.system_prompt ?? undefined,
									prompt: mergePrompt(body.prompt, selection.lead.name, usable),
									temperature: 0.3,
									abortSignal: timeoutSignal(AGENT_TIMEOUT_MS, request.signal)
								});

								return text;
							}
						});

						if (call.error || !call.text) {
							throw new Error(call.error ?? 'รวมคำตอบไม่สำเร็จ');
						}

						merged = call.text;
						await addOrchestrationStep(db, orchestrationId, {
							agentId: selection.lead.id,
							agentName: selection.lead.name,
							kind: 'merge',
							content: merged,
							durationMs: Date.now() - started
						});
					} catch (error) {
						mergeError = error instanceof Error ? error.message : 'รวมคำตอบไม่สำเร็จ';
						await addOrchestrationStep(db, orchestrationId, {
							agentId: selection.lead.id,
							agentName: selection.lead.name,
							kind: 'merge',
							content: '',
							error: mergeError,
							durationMs: Date.now() - started
						});
					}
				}

				// บันทึกคำตอบรวมลงประวัติแชท (ให้เหมือนแชทปกติ: refresh แล้วยังอยู่)
				if (body.id && merged.trim()) {
					await saveMessages(
						locals.supabase,
						user,
						body.id,
						[
							{
								id: crypto.randomUUID(),
								role: 'assistant',
								parts: [{ type: 'text', text: merged }]
							} as UIMessage
						],
						{
							model: selection.lead.model,
							provider: 'ollama',
							temperature: 0.3,
							agentId: selection.lead.id
						}
					);
					await touchChat(locals.supabase, body.id);
				}

				const status = merged.trim() ? 'done' : orchestrationStatus(answers);
				await finishOrchestration(db, orchestrationId, status, mergeError);

				send({
					type: 'done',
					status,
					merged,
					error: mergeError,
					summary: summarizeOrchestration(answers)
				});
			} catch (error) {
				// ข้อผิดพลาดที่ไม่คาดคิด: ต้องปิดรอบให้จบเสมอ ไม่ปล่อยค้างสถานะ running
				const message = error instanceof Error ? error.message : 'รอบนี้ล้มกลางทาง';
				await finishOrchestration(db, orchestrationId, 'failed', message);
				send({ type: 'error', message });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store',
			// กัน proxy บางตัว buffer ทั้งก้อน (ความคืบหน้าจะได้มาทีละขั้นจริง)
			'x-accel-buffering': 'no'
		}
	});
}
