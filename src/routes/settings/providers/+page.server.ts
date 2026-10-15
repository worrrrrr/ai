import { fail } from '@sveltejs/kit';
import { ensureProfile } from '#lib/server/profiles.ts';
import {
	SEAL_SECRET_HINT,
	activeChoicesFromRow,
	clearProviderKey,
	createProvider,
	deleteProvider,
	discoverProviderModels,
	issueMessages,
	listProviders,
	loadUserSettings,
	openProviderKey,
	protocolForLabel,
	providerInputSchema,
	readProviderForm,
	saveProviderModels,
	sealProviderKey,
	sealSecretFrom,
	setActiveChoice,
	settingsDb,
	tableErrorHint,
	updateProvider
} from '#lib/server/settings.ts';

export const load = async ({ locals, platform }) => {
	const userId = locals.user?.id ?? '';
	const db = settingsDb(locals.supabase);

	const [providers, stored] = await Promise.all([
		listProviders(db, userId),
		loadUserSettings(db, userId)
	]);

	return {
		providers: providers.rows.map((row) => ({
			...row,
			// เดาโปรโตคอลจากชื่อ/ที่อยู่ เพื่อให้ UI บอกได้ว่าจะยิงเส้นทางไหน
			protocol: protocolForLabel(row.label, row.base_url)
		})),
		listError: providers.error,
		choices: activeChoicesFromRow(stored.row),
		// บอกใน UI ว่าตั้ง secret สำหรับ seal กุญแจไว้หรือยัง (ไม่เปิดเผยค่า)
		canSeal: sealSecretFrom(platform) !== null
	};
};

/** ตรวจ + seal กุญแจถ้าผู้ใช้กรอกมา (คืน error เป็นข้อความไทยเมื่อทำไม่ได้) */
async function prepareSealedKey(
	platform: App.Platform | undefined,
	apiKey: string
): Promise<{ sealed: { key_sealed: string; key_hint: string } | null; error: string | null }> {
	if (!apiKey) return { sealed: null, error: null };

	const secret = sealSecretFrom(platform);
	if (!secret) return { sealed: null, error: SEAL_SECRET_HINT };

	return { sealed: await sealProviderKey(secret, apiKey), error: null };
}

export const actions = {
	create: async ({ request, locals, platform }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const parsed = providerInputSchema.safeParse(readProviderForm(await request.formData()));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const key = await prepareSealedKey(platform, parsed.data.apiKey);
		if (key.error) return fail(500, { message: key.error });

		const db = settingsDb(locals.supabase);
		const profileError = await ensureProfile(locals.supabase, user);
		if (profileError) return fail(500, { message: profileError });

		const created = await createProvider(db, user.id, parsed.data, key.sealed);
		if (created.error) return fail(500, { message: created.error });

		if (created.id) {
			const active = await setActiveChoice(db, user.id, 'provider_id', created.id);
			if (active.error) return fail(500, { message: active.error });
		}

		return {
			ok: `เพิ่มผู้ให้บริการ “${parsed.data.label}” แล้ว — กด “ทดสอบเชื่อมต่อ” เพื่อดึงรายชื่อโมเดลจริง`
		};
	},

	update: async ({ request, locals, platform }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบผู้ให้บริการที่ต้องการแก้' });

		const parsed = providerInputSchema.safeParse(readProviderForm(form));
		if (!parsed.success) return fail(400, { message: issueMessages(parsed.error)[0] });

		const key = await prepareSealedKey(platform, parsed.data.apiKey);
		if (key.error) return fail(500, { message: key.error });

		const { error } = await updateProvider(
			settingsDb(locals.supabase),
			user.id,
			id,
			parsed.data,
			key.sealed
		);
		if (error) return fail(500, { message: error });

		return {
			ok: key.sealed
				? `บันทึก “${parsed.data.label}” แล้ว — เปลี่ยนกุญแจใหม่เรียบร้อย`
				: `บันทึก “${parsed.data.label}” แล้ว`
		};
	},

	/** ทดสอบเชื่อมต่อจริง: อ่านแถวจากฐานข้อมูล -> ถอดกุญแจ -> ถามรายชื่อโมเดล -> บันทึกกลับ */
	test: async ({ request, locals, platform }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบผู้ให้บริการที่ต้องการทดสอบ' });

		const db = settingsDb(locals.supabase);
		const { data, error } = await db
			.from('provider_credentials')
			.select('*')
			.eq('id', id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (error) return fail(500, { message: tableErrorHint(error) ?? error.message });
		if (!data) return fail(404, { message: 'ไม่พบผู้ให้บริการนี้ (อาจถูกลบไปแล้ว)' });

		let apiKey: string | undefined;
		if (data.key_sealed) {
			const secret = sealSecretFrom(platform);
			if (!secret) return fail(500, { message: SEAL_SECRET_HINT });
			try {
				apiKey = await openProviderKey(secret, data.key_sealed);
			} catch (err) {
				return fail(500, { message: err instanceof Error ? err.message : 'ถอดกุญแจไม่สำเร็จ' });
			}
		}

		try {
			const result = await discoverProviderModels({
				label: data.label,
				baseUrl: data.base_url,
				apiKey
			});

			const saved = await saveProviderModels(db, user.id, id, result.models);
			if (saved.error) return fail(500, { message: saved.error });

			// ยิงจริงอีกหนึ่งครั้งเพื่อพิสูจน์ว่า "คีย์ใช้ยิงโมเดลได้จริง" ไม่ใช่แค่ดึงรายการได้
			// กติกา: ไม่มีคีย์/ไม่มีโมเดลที่แชทได้ -> ข้าม (ไม่เดา) · 401/403 = คีย์ผิด (ล้ม) · error อื่น = สำเร็จแต่มีหมายเหตุ
			const { callProviderChat, pickChatModel } = await import('#lib/server/providerClient.ts');
			const probeModel = pickChatModel(result.models ?? [], null);
			let warning: string | null = null;

			if (!apiKey) {
				warning = 'ยังไม่มีคีย์ จึงยังไม่ได้ทดสอบยิงโมเดล (ดึงรายการโมเดลได้แล้ว)';
			} else if (!probeModel) {
				warning = 'ไม่พบโมเดลที่รองรับการแชทในรายการ จึงข้ามการทดสอบยิงโมเดล';
			} else {
				const chat = await callProviderChat(
					{ label: data.label ?? id, baseUrl: data.base_url ?? '', apiKey },
					{ model: probeModel, system: null, prompt: 'ตอบคำว่า ok เท่านั้น', temperature: 0 },
					AbortSignal.timeout(20_000)
				);

				if (chat.error) {
					// 401/403 = คีย์ใช้ไม่ได้จริง (ล้ม) · ที่เหลือเป็นหมายเหตุ (เช่น โมเดลนั้นไม่รองรับแชท/โควตา)
					if (/ตอบ 401|ตอบ 403/.test(chat.error)) {
						return fail(401, { message: `คีย์ใช้ไม่ได้: ${chat.error}` });
					}

					warning = `ดึงรายการโมเดลได้ แต่ยิงโมเดล “${probeModel}” ไม่สำเร็จ: ${chat.error}`;
				}
			}

			return {
				ok: `${data.label ?? 'ผู้ให้บริการ'}: ${result.source} ตอบกลับ ${result.models.length} โมเดล (บันทึกรายการแล้ว)`,
				warning,
				tested: data.label ?? 'ผู้ให้บริการ',
				source: result.source,
				protocol: result.protocol,
				models: result.models
			};
		} catch (err) {
			return fail(502, {
				message: err instanceof Error ? err.message : 'ทดสอบการเชื่อมต่อไม่สำเร็จ'
			});
		}
	},

	use: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบผู้ให้บริการที่เลือก' });

		const { error } = await setActiveChoice(
			settingsDb(locals.supabase),
			user.id,
			'provider_id',
			id
		);
		if (error) return fail(500, { message: error });

		return { ok: 'ตั้งเป็นผู้ให้บริการที่ใช้อยู่แล้ว' };
	},

	clear_key: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบผู้ให้บริการ' });

		const { error } = await clearProviderKey(settingsDb(locals.supabase), user.id, id);
		if (error) return fail(500, { message: error });

		return { ok: 'ลบกุญแจที่เก็บไว้แล้ว' };
	},

	delete: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { message: 'ต้องเข้าสู่ระบบก่อน' });

		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { message: 'ไม่พบผู้ให้บริการที่ต้องการลบ' });

		const db = settingsDb(locals.supabase);
		const stored = await loadUserSettings(db, user.id);

		const { error } = await deleteProvider(db, user.id, id);
		if (error) return fail(500, { message: error });

		if (stored.row?.provider_id === id) {
			const cleared = await setActiveChoice(db, user.id, 'provider_id', null);
			if (cleared.error) return fail(500, { message: cleared.error });
		}

		return { ok: 'ลบผู้ให้บริการแล้ว' };
	}
};
