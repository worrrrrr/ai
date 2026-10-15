// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			// secret ที่ไม่ประกาศใน wrangler.jsonc (ตั้งใน `.env` ตอน dev / `wrangler secret put` ตอน prod)
			// EXA_API_KEY = เครื่องมือค้นหา, PROVIDER_KEY_SECRET = กุญแจสำหรับ seal API key ของผู้ให้บริการ
			env: Env & { EXA_API_KEY?: string; PROVIDER_KEY_SECRET?: string };
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';

declare global {
	namespace App {
		interface Locals {
			// อ้าง type ที่ generate จากฐานข้อมูลจริง (src/lib/database.types.ts -> `pnpm gen:types`)
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{
				session: Session | null;
				user: User | null;
			}>;
			session: Session | null;
			user: User | null;
		}
	}
}

export {};
