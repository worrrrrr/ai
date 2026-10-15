# แผนดำเนินงาน — โปรเจกต์ `ai`

สถานะ: ตรวจสภาพโปรเจกต์แล้ว และเริ่มดำเนินงานเฟส 0 แล้ว (ดู §0)
วันที่ตรวจ: 2026-10-14 | พื้นที่ทำงาน: `C:\Users\worrr\Projects\ai`

---

## 0. สถานะความคืบหน้า

อัปเดตล่าสุด 2026-10-14 (รอบ 2: เพิ่มงานเฟส 3 — หน้า settings 4 หมวด)

เสร็จแล้ว

- T0.1 `tsconfig.json` เพิ่ม `"checkJs": false` พร้อมคอมเมนต์อธิบาย root cause
- T0.2 `.prettierignore` ยกเว้น `worker-configuration.d.ts` และ `.svelte-kit/` แล้วรัน `pnpm format` ทั้งโปรเจกต์
- T0.3 `package.json` แยก script เป็น `gen`, `gen:check`, `build` (regenerate ไม่ใช้ `--check`), `check`, `deploy`, `deploy:dry`
- T0.4 ยืนยันแล้วว่าเมื่อไม่มี dev server รันอยู่ `pnpm build` ผ่าน (adapter รายงาน `done`) และรันซ้ำได้ (idempotent)
- T0.5 เขียน `docs/dev-notes.md` เก็บกับดัก 3 ข้อของ environment นี้ไว้ให้ session ถัดไป
- T0.7 เพิ่ม CI workflow (`.github/workflows/ci.yml`: gen:check → check → lint → test → build)

ความคืบหน้าเฟส 1–2 (T1.1, T1.2, T1.4, T1.5, T2.2–T2.4, T2.7)

- T1.1/T1.2/T1.4/T1.5: ตรวจ redirect เป็น path ภายใน (`src/lib/server/redirects.ts`), หน้า `/auth/auth-code-error`, `/api/chat` ตอบ 401 JSON + จำกัดขนาด body + zod validate
- T2.2: `/chat` และ `/chat/[id]` โหลด/บันทึกประวัติผ่าน Supabase (RLS) + stream และ persist ตอนจบ
- T2.3: `calculate` ใช้ evaluator ปลอดภัย (`src/lib/server/expression.ts`) แทน `Function()`; `search`/`weather` ต่อ API จริง — `search` ใช้ Exa เมื่อมี `EXA_API_KEY` (ไม่งั้นถอยไป DuckDuckGo/Wikipedia) และ `weather` ใช้ Open-Meteo — ไม่มี mock ในระบบ
- T2.4: render message parts แบบ generic (text/reasoning/tool-*/fallback) + สถานะ/ปุ่มหยุด (markdown ยังไม่ทำ)
- T2.7: vitest + `pnpm test` ครอบ evaluator, redirect, router, tools และผูกเข้า CI

ความคืบหน้ารอบ 3 (2026-10-14) — ผูกกับฐานข้อมูลจริง + seal กุญแจ

- schema จริงของโปรเจกต์ (`aaii`, ref `gozxohjfseacplnwgtbn`) กลายเป็นแหล่งความจริง: ใส่คำเตือนห้ามรันใน 0001 และให้ 0002 สร้างเฉพาะ `styles` + `user_settings`
- ปรับโค้ดเดิมให้ตรงของจริง: `chats.owner_id`, `chat_messages(content/reasoning)` ไม่มี `parts`, `prompts.title`, ลบพรอมป์แบบ soft delete ด้วย `deleted_at`, สร้างแถว `profiles` ให้ก่อนถ้ายังไม่มี
- กุญแจผู้ให้บริการ: `provider_credentials.key_sealed` = AES-GCM จาก Worker secret `PROVIDER_KEY_SECRET` + `key_hint` (4 ตัวท้าย) — ยังไม่ได้ตั้ง secret ในเครื่อง
- client ผูก type จาก `src/lib/database.types.ts` (คำสั่ง `pnpm gen:types`) → ผิดตาราง/ผิดคอลัมน์ถูกจับตอน `pnpm check`
- หน้า `/settings/styles`: เลือก "สีหลัก" สีเดียวแล้วคำนวณอีก 5 สีให้ (`src/lib/colorPalette.ts`) + จานสีอิสระ + ค้นหาสีและแม่แบบ
- เทสต์รวม 102 ตัว (8 ไฟล์) รวม round-trip ของ AES-GCM และการเทียบสูตรสีกับแม่แบบ
- **ค้าง:** รัน `supabase/migrations/0002_settings.sql` แล้ว `pnpm gen:types` และลบ type ชั่วคราวใน `src/lib/server/settings.ts`; ยังไม่ผูก provider/prompt/style เข้ากับการตอบแชท (T2.6)

ความคืบหน้าเฟส 3 (T3.1–T3.4) — หน้า settings 4 หมวด

- T3.1: [0002_settings.sql](supabase/migrations/0002_settings.sql) — ตาราง `user_settings`, `styles`, `providers`, `prompts` + RLS ต่อผู้ใช้ + index บังคับ "ค่าเริ่มต้นมีได้แถวเดียว"
- T3.2: `/settings/providers` CRUD + "ทดสอบเชื่อมต่อ" ที่ยิงจริงไป `/api/tags` หรือ `/v1/models` แล้วโชว์แหล่งที่มา + รายชื่อโมเดล (กุญแจเก็บเป็นชื่อตัวแปร env ไม่ลงฐานข้อมูล)
- T3.3: `/settings/prompts` CRUD + ดู/แก้ข้อความเต็ม · `/settings/styles` แม่แบบ 12 ชุด + สร้างเอง + ตัวอย่างสว่าง/มืด
- T3.4: `/settings/layout` ธีม/ความกว้างแถบด้านข้าง/ความหนาแน่น/ความกว้างคอลัมน์/สถานะย่อ + ตัวอย่างทันที (ค่าเก็บทั้ง cookie และตาราง)
- ตรรกะบริสุทธิ์มีเทสต์: [src/lib/settings.test.ts](src/lib/settings.test.ts) (9) + [src/lib/server/settings.test.ts](src/lib/server/settings.test.ts) (32)
- **ยังไม่ผูกเข้าที่แชท**: โมเดลยังฝังใน `api/chat/+server.ts` (T2.6) และแชทที่ส่งยังไม่ใช้ provider/prompt/style ที่เลือกไว้

ผลตรวจหลังแก้ (รันรวมในคำสั่งเดียว)

- `pnpm format` = exit 0
- `pnpm check` = `svelte-check found 0 errors and 0 warnings`
- `pnpm lint` = `All matched files use Prettier code style!`
- `pnpm build` = `built in 450ms` + `done` และรันครั้งที่สองก็ผ่านเช่นกัน

ยังไม่ทำ

- T0.6 commit งานค้าง (รอเจ้าของตัดสินใจเรื่องการแบ่ง commit)
- T2.5 logging/tracing เป็นโครงสร้าง + เก็บผล decision ของ router ลง DB
- T2.6 ย้าย model/provider จากโค้ดไป settings — **ตารางพร้อมแล้ว** เหลือให้ `api/chat` อ่าน provider/prompt/style ที่เลือก
- T3.5 `/agent`, `/project` (ยังเป็นไฟล์ว่าง)
- รัน migration 0002 ใน Supabase จริง (ถ้ายังไม่รัน หน้าตั้งค่าจะขึ้นข้อความบอกให้รันเอง)

---

## 1. สรุปสภาพโปรเจกต์ (Snapshot)

แอปแชท AI บน Cloudflare Workers: SvelteKit 3 + Svelte 5 (runes) + Tailwind 4 + Supabase Auth + Ollama (ผ่าน `ai-sdk-ollama`) พร้อม router เลือก tool ด้วย decision model ("Tev1")

| ส่วน                   | ค่าที่ติดตั้งจริง                                                                 |
| ---------------------- | --------------------------------------------------------------------------------- |
| SvelteKit              | 3.0.1 (`experimental.remoteFunctions`, runes บังคับทั้งโปรเจกต์)                  |
| Svelte                 | 5.57.2 (`experimental.async`)                                                     |
| Vite / TS / Tailwind   | 8.3.4 / 6.0.3 / 4.3.3                                                             |
| adapter                | `@sveltejs/adapter-cloudflare` 8                                                  |
| wrangler / pnpm / Node | 4.149.0 / 10.34.5 / 24.17.0                                                       |
| AI                     | `ai` 7.0.138, `@ai-sdk/svelte` 5.0.138, `ai-sdk-ollama` 4.5.0, `zod` 4.6.7        |
| Auth/DB                | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.3                           |
| Worker                 | ชื่อ `ai`, compat date `2026-10-14`, flags `nodejs_als`, bindings: `ASSETS`, `AI` |

### Route ที่มีเนื้อหาจริง (4)

- `/` — แชทเดี่ยวในหน้าเดียว (`new Chat({})` → `/api/chat`)
- `/auth` — ปุ่ม Google OAuth
- `/auth/callback` — แลก code เป็น session
- `/api/chat` — router (Tev1) + 3 tools (`calculate`, `search`, `weather`) + stream

### Route ที่เป็นไฟล์ว่าง 0 ไบต์ (12)

`/chat`, `/chat/[id]`, `/agent`, `/agent/[id]`, `/project`, `/project/[id]`,
`/settings/layout`, `/settings/prompts`, `/settings/providers`, `/settings/styles`

### Git

5 commits ล่าสุด `0c8abf8 Sad` — working tree มี 21 รายการที่ยังไม่ commit (งานทั้งชุด auth + router + scaffold ยังไม่เคยเข้า history) และไม่มี `.github/`, ไม่มี test, ไม่มี migration

### ของที่ประกาศไว้แต่ไม่ถูกใช้เลย

`AI` binding (wrangler.jsonc), `@lucide/svelte`, `@sveltejs/enhanced-img`, `src/lib/index.ts`, `PUBLIC_SUPABASE_ANON_KEY`

---

## 2. หลักฐานการตรวจ (รันจริงในเซสชันนี้)

| คำสั่ง                                  | ผลลัพธ์                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                            | ล้มเหลว — `svelte-check found 542 errors and 0 warnings in 21 files`                                                  |
| แยกดูว่า error อยู่ไฟล์ไหน              | **ไม่มี error ใน `src/` แม้แต่ตัวเดียว** ทั้ง 542 อยู่ใน `.svelte-kit/**` (โค้ดที่ generate)                          |
| `tsc --listFilesOnly`                   | type program มี 516 ไฟล์ เพราะถูกดึงเข้าไปทั้งชุดจาก `.svelte-kit/output/**`                                          |
| probe tsconfig เพิ่ม `"checkJs": false` | `svelte-check found 0 errors and 0 warnings` (ยืนยันวิธีแก้แล้ว)                                                      |
| `pnpm exec vite build`                  | compile ผ่านทั้ง SSR (180 modules) และ client (382 modules) แต่ **adapter ล้ม**: `EPERM ... .svelte-kit\cloudflare`   |
| `pnpm lint` (prettier --check)          | ล้มเหลว 10 ไฟล์                                                                                                       |
| `wrangler` ทุกคำสั่ง                    | `Unknown argument: ...wrangler-dist\cli.js`                                                                           |
| `wrangler` + workaround shim            | `4.149.0` และ `wrangler types --include-runtime=false --check` = "Types at worker-configuration.d.ts are up to date." |
| ยิง HTTP ไป dev server                  | ทำไม่ได้จากเซสชันนี้ (loopback ถูกบล็อก) — ยังไม่ยืนยันผลรันไทม์                                                      |

### 2.1 Root cause ของ 542 errors (ไล่ครบแล้ว)

1. `tsconfig.json` ตั้ง `"types": ["$app/types", "./worker-configuration.d.ts"]`
2. `worker-configuration.d.ts` (ไฟล์ที่ `wrangler types` generate) มีบรรทัด
   `mainModule: typeof import("./.svelte-kit/cloudflare/_worker")`
3. `.svelte-kit/cloudflare/_worker.js` → `../cloudflare-tmp/server.js` → `../output/server/index.js`
   → ลากโค้ด server ที่ build แล้วทั้งต้นไม้เข้าสู่ type program
4. `$app/tsconfig` เปิด `allowJs` + `checkJs` ไว้ ทำให้ TS ไปตรวจ JS ที่ generate ทั้งหมด
5. ผลคือ type gate ของโปรเจกต์ใช้ไม่ได้เลย (แดงตลอด) ทั้งที่โค้ดตัวเองสะอาด
6. กับดักลูกโซ่ที่สอง: พอ `pnpm build` ผ่านสักครั้ง `.svelte-kit/cloudflare/_worker.js` จะเกิดขึ้น ทำให้ `wrangler types` ใส่ `mainModule` กลับมา → `pnpm build` ครั้งถัดไปล้มด้วย "Types at worker-configuration.d.ts are out of date" (build ไม่ idempotent) จึงต้องให้ `build` regenerate types แทนการ `--check` และเก็บ `gen:check` ไว้ใช้บนต้นไม้สะอาดเท่านั้น (รายละเอียดใน `docs/dev-notes.md`)

เลือกใช้แล้ว: `"checkJs": false` (พิสูจน์แล้วว่า 0 errors) — ทางเลือกที่เข้มกว่าคือแยก `tsconfig.worker.json` ให้ตรวจ worker แยกจาก svelte-check

### 2.2 ทำไม `pnpm build` ล้ม

มี **dev server รันค้างอยู่**: node pid `17280` ฟังที่พอร์ต `5173` พร้อมลูก `workerd` 2 ตัว (เริ่ม 18:53) ทำให้ adapter-cloudflare ลบโฟลเดอร์ `.svelte-kit\cloudflare` ไม่ได้ (EPERM) ไม่ใช่บั๊กโค้ด — หยุด dev server แล้ว build จะผ่าน (`also: Move-Item .svelte-kit` ก็ถูกปฏิเสธด้วยเหตุเดียวกัน)

### 2.3 ทำไม `wrangler` ใช้ไม่ได้ในเซสชันนี้

ในเซสชัน DSH นี้ `node` คือ Electron ที่รันโหมด `ELECTRON_RUN_AS_NODE=1` ทำให้ `process.versions.electron` มีค่า → yargs ของ wrangler คำนวณ `getProcessArgvBinIndex()` เป็น 0 → `hideBin()` ตัด argv ผิด → มองเห็น `cli.js` เป็น argument แปลกปลอม

ทางแก้ที่ทดสอบแล้วได้ผล: ตั้ง `NODE_OPTIONS=--require=<ไฟล์ shim ที่ลบ process.versions.electron>` (หรือสั่ง wrangler จาก terminal ที่ใช้ Node ปกติ) — **ไม่ใช่ปัญหาของโปรเจกต์** แต่ต้องบันทึกไว้ ไม่งั้น session ถัดไปจะเสียเวลาไล่ซ้ำ

### 2.4 สิ่งที่ `pnpm lint` ไม่ผ่าน

`package.json`, `src/env.ts`, `src/hooks.server.ts`, `src/lib/supabase.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/api/chat/+server.ts`, `src/routes/auth/+page.svelte`, `src/routes/auth/callback/+server.ts`, `worker-configuration.d.ts`

สาเหตุ: ไฟล์ที่เขียนมือใช้ย่อหน้า 2 เคาะ แต่ `prettier.config.js` ตั้ง `useTabs: true`; และ `worker-configuration.d.ts` เป็นไฟล์ generate ที่ไม่ควรถูกบังคับ format

---

## 3. ปัญหาที่พบ แบ่งตามกลุ่ม

### A. เครื่องมือและคุณภาพ (บล็อกทุกอย่าง)

- A1 `pnpm check` แดง 542 errors → ไม่มี type gate ที่เชื่อถือได้ (§2.1)
- A2 `pnpm lint` แดง 10 ไฟล์ (§2.4)
- A3 ไม่มี test, ไม่มี CI, ไม่มี `test` script
- A4 `pnpm build` พังเมื่อ dev server รันอยู่ (§2.2) และ `deploy` script เป็น `"wrangler deploy "` เฉย ๆ (มีช่องว่างเกิน, ไม่มี `--dry-run`/precheck)
- A5 งานทั้งชุดยังไม่ commit (เสี่ยงหาย / ยาก rollback)
- A6 ข้อจำกัดของ environment ไม่ถูกบันทึกไว้ที่ไหน (§2.2, §2.3)

### B. Auth และความปลอดภัย

- B1 **Open redirect**: `/auth/callback` เอา `next` จาก query ไป `redirect(303, next)` ตรง ๆ (และ `/auth` ส่ง `redirectTo` ต่อ) — ไม่มีการตรวจว่าเป็น path ภายใน
- B2 route `/auth/auth-code-error` ที่โค้ด redirect ไป **ไม่มีอยู่จริง** → error ของ auth จบเป็น 404
- B3 `publicPaths` มี `'/login'` แต่ไม่มี route `/login`
- B4 `/api/chat` ถูกกันด้วย authGuard แต่ตอบ **303 redirect เป็น HTML** แทน `401 JSON` — client ที่ fetch อยู่จะได้ผลลัพธ์ที่ตีความยาก; ยังไม่มี limit ขนาด body/timeout/ตรวจ schema ของ `messages`
- B5 tool `calculate` ใช้ `Function(expression)` = รันโค้ดอะไรก็ได้บน server (ควรเป็น evaluator ที่ปลอดภัย)
- B6 ไม่มี logout, ไม่มี UI แสดงผู้ใช้, ไม่มี migration/RLS ในเรโป (Supabase ตั้งมือ)

### C. ตรรกะแชทและ agent

- C1 `search` คืน `Result 1 for ${query}` และ `weather` คืนอุณหภูมิสุ่ม `32-90` — **ข้อมูลปลอมที่หน้าตาเหมือนของจริง**
- C2 UI ฝังชื่อ tool ตายตัว (`tool-weather`, `tool-convertFahrenheitToCelsius` ที่ไม่มีอยู่จริง) → tool part อื่นหายเงียบ
- C3 router: `score >= 0.4` กับ fallback เป็นค่าที่ตั้งลอย ๆ, ไม่มีการเก็บผลตัดสินใจไว้วัดความแม่นยำ, ใช้ `console.log` เป็น logging
- C4 ไม่มีการเก็บประวัติแชทเลย (ไม่มี DB/ตาราง/persist) ไม่มี error state, loading state, ปุ่ม abort
- C5 ชื่อ model ฝังตาย: `tev1:0.8b`, `gpt-oss:120b-cloud` (ต้องมี Ollama local/cloud พร้อม) → ต้องย้ายไป settings
- C6 ไม่มีระบบ prompt/style ที่จัดการได้ (route settings ว่าง)

### D. ฟีเจอร์ที่ scaffold ไว้แต่ยังไม่มีข้อมูลรองรับ

- D1 12 route ว่าง — ยังไม่มี data model (projects / agents / chats / messages / providers / prompts / styles) และไม่มี RLS
- D2 `settings/*` ทั้ง 4 หน้าไม่มี schema, form, หรือการบันทึก
- D3 agent/project ยังไม่มีความสัมพันธ์กับ chat

### E. Deploy และความสะอาด

- E1 `wrangler.jsonc` ไม่มี `vars`/secrets; `.env` และ `.env.local` ถูก gitignore → บน production จะไม่มี `PUBLIC_SUPABASE_*` ให้ `$app/env/public` → login พังทันที
- E2 `worker-configuration.d.ts` ยังประกาศ `PUBLIC_SUPABASE_ANON_KEY` ที่ไม่ถูกใช้
- E3 `AI` binding, `@lucide/svelte`, `enhanced-img` ไม่ถูกใช้
  - **ตัดสินใจแล้ว (เจ้าของ, 2026-10-14): คง `@lucide/svelte` ไว้ใช้ต่อ** เพราะไอคอนที่เขียนเองยังไม่สวย กฎ owner ข้อ "No emoji" ยังคงอยู่ (lucide เป็น SVG จึงไม่ผิดกฎ) ส่วนข้อ "prefer plain paths and shapes over an icon dependency" เป็นข้อเสนอแนะที่เจ้าของ override ได้ในโปรเจกต์นี้
  - ส่วน `AI` binding กับ `enhanced-img` ยังต้องตัดสินใจ (ดูข้อ 4 ใน §6)
- E4 `README.md` ยังเป็น template ของ `sv`; ไม่มี `+error.svelte`; `app.html` ตั้ง `lang="en"` แต่ข้อความในระบบเป็นไทย
- E5 `src/app.d.ts` ประกาศฟิลด์ `Platform` ซ้ำ (env/ctx/caches/cf สองรอบ)

---

## 4. แผนดำเนินงาน

### เฟส 0 — ทำให้ gate ใช้งานได้ (ครึ่งวัน, ทำก่อนทุกอย่าง)

| #    | งาน                                                                                                                              | ไฟล์/คำสั่ง                                        | เกณฑ์ผ่าน                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| T0.1 | เพิ่ม `"checkJs": false` พร้อมคอมเมนต์อธิบาย root cause (หรือแยก `tsconfig.worker.json`)                                         | `tsconfig.json`                                    | `pnpm check` = 0 errors                          |
| T0.2 | ใส่ `worker-configuration.d.ts` ใน `.prettierignore` แล้วรัน `pnpm format` แก้ 9 ไฟล์ที่เหลือ                                    | `.prettierignore`                                  | `pnpm lint` ผ่าน                                 |
| T0.3 | แยก script: `check:ci`, `build` (ไม่พึ่ง `wrangler types --check` อย่างเดียว), `deploy:dry` = `wrangler deploy --dry-run`        | `package.json`                                     | ทุก script เรียกแล้วจบด้วย exit 0                |
| T0.4 | หยุด dev server (pid 17280 บน :5173) แล้วยืนยันว่า `pnpm build` ผ่าน + บันทึกว่า build ในโฟลเดอร์นี้ต้องไม่มี dev server รันอยู่ | `wrangler dev`/`vite dev`                          | `.svelte-kit/cloudflare/_worker.js` ถูกสร้างใหม่ |
| T0.5 | เขียนบันทึกสำหรับ session ถัดไป: ข้อจำกัด wrangler+Electron (พร้อม shim), EPERM ตอน build, ลำดับคำสั่งที่ใช้ตรวจ                 | `docs/dev-notes.md` (หรือ `AGENTS.md` ของโปรเจกต์) | มีบันทึกครบ 3 เรื่อง                             |
| T0.6 | commit งานค้าง 21 รายการเป็นชุดย่อยที่มีความหมาย (scaffold / auth / chat router / config)                                        | `git`                                              | history อ่านรู้เรื่อง, `git status` สะอาด        |
| T0.7 | เพิ่ม CI (svelte-kit sync → check → lint → build)                                                                                | `.github/workflows/ci.yml`                         | workflow เขียวบน commit สะอาด                    |

### เฟส 1 — Auth ปลอดภัย + สัญญาของ API (1 วัน)

| #    | งาน                                                                                                            | เกณฑ์ผ่าน                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| T1.1 | ตรวจ `next`/`redirectTo` ให้เป็น path ภายในเท่านั้น (ขึ้นต้น `/`, ไม่ใช่ `//`, ไม่มี scheme) แล้ว fallback `/` | มี unit test: `//evil.com`, `https://evil.com`, `/chat/1` |
| T1.2 | เพิ่มหน้า `/auth/auth-code-error` แสดงเหตุผล + ปุ่มลองใหม่                                                     | login ล้มแล้วไม่เจอ 404                                   |
| T1.3 | ลบ `'/login'` ออกจาก `publicPaths` หรือทำ route `/login` เป็น alias จริง                                       | ไม่มี path ที่อ้างถึงแล้วไม่มีอยู่                        |
| T1.4 | `/api/chat`: คืน `401 JSON` เมื่อไม่มี session, จำกัดขนาด body, timeout, validate `messages` ด้วย zod          | ยิงด้วย curl ไม่มี cookie ได้ 401 JSON                    |
| T1.5 | เพิ่ม logout (form action) + แสดงผู้ใช้ปัจจุบัน                                                                | ออกจากระบบแล้วกลับไป `/auth`                              |
| T1.6 | migration แรก + RLS policy ตัวอย่าง (`supabase/migrations/`)                                                   | migration apply ได้ และ policy ถูกบังคับใช้               |

### เฟส 2 — Chat core ที่ใช้งานได้จริง (2-4 วัน)

| #    | งาน                                                                                                             | เกณฑ์ผ่าน                           |
| ---- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| T2.1 | data model: `chats`, `messages` + RLS                                                                           | ตาราง/นโยบายตรงกับที่ใช้จริง        |
| T2.2 | `/chat` (รายการ) และ `/chat/[id]` (โหลดประวัติ + stream + persist ตอนจบ)                                        | refresh แล้วประวัติยังอยู่          |
| T2.3 | แทน `Function()` ด้วย evaluator ปลอดภัย; เปลี่ยน search/weather ให้เป็น API จริง หรือติดป้าย "mock" ให้ชัดใน UI | ไม่มีทางรันโค้ดตามอำเภอใจจาก input  |
| T2.4 | render message parts แบบ generic (text / tool-* / reasoning / data) + error, loading, ปุ่มหยุด + markdown       | ไม่มีชื่อ tool ฝังใน UI อีก         |
| T2.5 | logging/tracing เป็นโครงสร้าง + เก็บผล decision (choice, score, tool ที่ถูกเรียก) ลง DB                         | วัดความแม่นยำของ router ย้อนหลังได้ |
| T2.6 | ย้าย model/provider จากโค้ดไปอ่านจาก settings (เริ่มจากตาราง providers)                                         | เปลี่ยน model ได้โดยไม่แก้โค้ด      |
| T2.7 | test: vitest ครอบ router logic, evaluator, ตัว validate redirect                                                | `pnpm test` ผ่าน                    |

### เฟส 3 — Agent / Project / Settings (3-6 วัน)

**สถานะ: T3.1–T3.4 เสร็จแล้ว** (2026-10-14) เหลือ T3.5 — หลักฐานการตรวจอยู่ใน §0

| #    | งาน                                                                            | เกณฑ์ผ่าน                          |
| ---- | ------------------------------------------------------------------------------ | ---------------------------------- |
| T3.1 | schema: `projects`, `agents`, `providers`, `prompts`, `styles` + RLS ต่อผู้ใช้ | ผู้ใช้เห็นเฉพาะข้อมูลตัวเอง        |
| T3.2 | `settings/providers`: CRUD + ปุ่มทดสอบเชื่อมต่อ (list models)                  | ตั้ง Ollama endpoint/model ได้จริง |
| T3.3 | `settings/prompts` + `settings/styles`: CRUD + preview                         | เลือก prompt/style แล้วมีผลกับแชท  |
| T3.4 | `settings/layout`: ธีม/สัดส่วน UI ด้วย design token ใน `layout.css`            | เปลี่ยนค่าแล้ว layout ตอบสนอง      |
| T3.5 | `/agent` CRUD + เลือก agent ตอนเริ่มแชท; `/project` จัดกลุ่ม chat/agent        | ทุกหน้า scaffold เดิมทำงานจริง     |

### เฟส 4 — Deploy hardening (1 วัน)

| #    | งาน                                                                                                                   | เกณฑ์ผ่าน                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| T4.1 | ตั้งค่า `PUBLIC_SUPABASE_*` และ `EXA_API_KEY` ให้ Worker จริง (vars/secret ของ Cloudflare) และลบ `ANON_KEY` ที่ไม่ใช้ | `wrangler deploy` แล้ว login ได้บน production                          |
| T4.2 | จัดการของไม่ใช้: คง `@lucide/svelte` (เจ้าของตัดสินใจแล้ว) แต่ตัดหรือใช้งาน `AI` binding และ `enhanced-img` ให้ชัดเจน | ไม่มี binding/dependency ที่ไม่ถูกอ้างถึง ยกเว้นที่บันทึกว่าเก็บไว้ใช้ |
| T4.3 | ขั้นตอน deploy: `check` → `build` → `deploy --dry-run` → `deploy` + observability/custom domain                       | dry-run ผ่านก่อน deploy จริงเสมอ                                       |
| T4.4 | แก้ `app.d.ts` ซ้ำ, เพิ่ม `+error.svelte`, ปรับ `lang`/meta, เขียน README ให้ตรงกับของจริง                            | ไม่มีหน้ากาก template เหลืออยู่                                        |

### เฟส 5 — คุณภาพต่อเนื่อง

vitest + Playwright, CI เขียวทุก PR, a11y/Lighthouse, และใช้อัตราความแม่นยำของ router ที่เก็บใน T2.5 เป็นตัวชี้วัดการปรับปรุง

---

## 5. ความเสี่ยง

1. **เวอร์ชันล้ำหน้า**: SvelteKit 3.0.1, Vite 8, TS 6, Svelte 5.57 เป็นของใหม่มาก API ขยับได้ — ควรตรึงเวอร์ชันและอัปเดตเป็นรอบ
2. **router พึ่ง Ollama**: `experimental_decide` ต้องมี provider ที่รองรับ decision model; ถ้า Ollama ไม่พร้อม แชททั้งเส้นตาย (ควรมี fallback ที่ไม่ใช้ decision model)
3. **ข้อมูลปลอมถูกใช้จริง**: ถ้าไม่รีบแก้ C1 ผู้ใช้อาจเข้าใจว่าผลลัพธ์มาจากของจริง
4. **ข้อจำกัดของ environment** (§2.2, §2.3) ทำให้คำสั่ง build/deploy ในเซสชันนี้ต้องมีขั้นตอนเสริม มิฉะนั้นจะ debug ซ้ำฟรี
5. **งานค้างยังไม่ commit** — ถ้าแก้ทับก่อน commit จะตามรอยการเปลี่ยนแปลงยากมาก

---

## 6. เรื่องที่ต้องให้เจ้าของตัดสินใจ

1. เริ่มที่เฟสไหน (แนะนำ เฟส 0 แล้วต่อเฟส 1 ทันที)
2. Type gate: ใช้ `checkJs: false` (เร็ว, พิสูจน์แล้ว) หรือแยก `tsconfig.worker.json` (เข้มกว่า)
3. Provider เป้าหมาย: Ollama local/cloud อย่างเดียว หรือจะเพิ่ม Workers AI / AI Gateway
4. ~~Icon: ตัด `@lucide/svelte` หรือคงไว้~~ — **ปิดแล้ว: คง `@lucide/svelte` ไว้ใช้ต่อ** (เจ้าของ, 2026-10-14) กฎที่อ้างถึงคือ `AGENTS.md` ของ owner (`$DSH_HOME/AGENTS.md`) ข้อ 1 บรรทัด "Prefer plain paths and shapes over an icon font or an icon dependency" ซึ่งเป็นข้อเสนอแนะ ไม่ใช่ข้อบังคับ ส่วนข้อบังคับคือห้ามใช้ emoji
5. ให้ commit งานค้างทั้งหมดให้หรือไม่ (และจะแยกกี่ commit)
6. dev server บนพอร์ต 5173 ที่รันอยู่ หยุดได้หรือไม่ ตอนที่ต้อง build
