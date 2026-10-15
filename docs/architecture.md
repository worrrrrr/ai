# สถาปัตยกรรม (ภาพรวมระบบ)

**ขอบเขตของไฟล์นี้**: องค์ประกอบ ขอบเขตความรับผิดชอบ **สัญญา (in/out)** และการไหลของข้อมูล
**ไม่ลงถึง UI/UX** (หน้าตา/สี/ระยะ/UX flow → `docs/components.md`) และไม่รวมกับดักเครื่อง (→ `docs/dev-notes.md`)
**มุมมอง**: ทุกอย่างคือ "ปลั๊กอิน" ที่ประกอบกันผ่านสัญญาชัดเจน — ภายในของปลั๊กอินหนึ่งไม่รั่วไปหาอีกอัน

อัปเดต: 2026-10-14

## 1. บริบท (ระบบคุยกับใคร)

```
ผู้ใช้ (เบราว์เซอร์)
   ↕ HTTP
Cloudflare Worker — SvelteKit (แอปเดียว)
   ├─ Supabase  → auth + ตาราง chats/messages (RLS)
   ├─ Ollama    → โมเดลแชท + decision model (Tev1)
   └─ ภายนอก    → Exa / Open-Meteo / Wikipedia / DuckDuckGo (ผ่าน tools)
```

## 2. ปลั๊กอิน (องค์ประกอบ) + สัญญา

| ปลั๊กอิน                 | ที่อยู่                                                                        | รับ                                | ให้                                             | พึ่ง                     |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------- | ------------------------ |
| **Auth/DB**              | `src/hooks.server.ts`, `src/lib/supabase.ts`, `src/lib/server/chats.ts`        | cookie/session                     | `locals.user`, `locals.supabase`; ฟังก์ชัน CRUD | Supabase                 |
| **ตั้งค่าผู้ใช้/หน้าตา** | `src/lib/server/settings.ts`, `src/lib/settings.ts`, `src/lib/stylePresets.ts` | ค่าจากฟอร์ม (`FormData`)           | แถวในตาราง + CSS var + ข้อความไทย               | Supabase                 |
| **Page data**            | `src/routes/**/+page.server.ts`, `+server.ts`                                  | request                            | data / JSON / stream                            | Auth/DB                  |
| **Route policy (Tev1)**  | `src/lib/server/router.ts`                                                     | `(choice, score, ชื่อ tool ที่มี)` | ชื่อ tool ที่จะส่งต่อ                           | — (pure)                 |
| **เครื่องมือ**           | `src/lib/server/tools/*.ts`, `src/lib/server/expression.ts`                    | input ของ tool                     | ผลลัพธ์ + `source`                              | Exa/Open-Meteo/Wikipedia |
| **โมเดลแชท**             | `src/routes/api/chat/+server.ts`                                               | `messages[]`                       | UI message stream                               | Ollama                   |
| **UI shell**             | `src/lib/components/*.svelte`, `src/routes/+layout.svelte`                     | data จาก page                      | DOM                                             | —                        |

**จุดสำคัญของดีไซน์:** route policy เลือก tool "ตามชื่อ" เท่านั้น — ไม่รู้จักข้างใน tool
→ **เพิ่ม tool = เพิ่มปลั๊กอิน + เพิ่มชื่อในตาราง mapping ไม่ต้องแก้ตัว router** (`selectTools()`)

## 3. การไหลของคำขอ (request lifecycle)

1. เปิดหน้า → `hooks.server.ts` สร้าง Supabase client + ตั้ง `locals.user`
2. `+page.server.ts` โหลดข้อมูลผ่าน `locals.supabase` (RLS กรองเจ้าของให้)
3. ผู้ใช้ส่งข้อความ → `Composer` → `Chat` (AI SDK) → `POST /api/chat`
4. `authGuard` ปล่อย `/api` ผ่าน → handler เช็ค session เอง (401 JSON ถ้าไม่มี)
5. `experimental_decide` (Tev1) → `selectTools()` → เลือก tool ที่จะส่งให้โมเดล
6. `streamText` + tools → ไหลกลับเป็น stream ไปหน้าเว็บ
7. `onEnd`: `saveMessages()` คำตอบ + `touchChat()` → Supabase (ประวัติคงอยู่หลัง refresh)

## 4. Data model + RLS

**ความจริงอยู่ที่ฐานข้อมูล ไม่ใช่ไฟล์ในเรโป** — โปรเจกต์ Supabase ที่แอปชี้อยู่ (ref `gozxohjfseacplnwgtbn`, ชื่อ `aaii`)
มีตารางเหล่านี้อยู่แล้ว: `profiles`, `chats`, `chat_messages`, `prompts`, `provider_credentials`,
`agents`, `projects`, `project_files`, `chat_participants`, `schedules`, `sessions`
type ที่ generate จากของจริงอยู่ที่ `src/lib/database.types.ts` (คำสั่ง `pnpm gen:types`)

- `profiles(id = auth.users.id, email, name, avatar_url)` — FK ปลายทางของเจ้าของข้อมูลทุกตาราง
- `chats(id, owner_id → profiles.id, title, icon, pinned, project_id, deleted_at, created_at, updated_at)`
- `chat_messages(id, chat_id → chats.id, user_id, role, content, reasoning, model, provider, agent_id, temperature, prompt_tokens, completion_tokens, duration_ms, created_at)`
  — เก็บข้อความเป็นข้อความแบน (ไม่ใช่ `parts` jsonb) และ **ไม่มีคอลัมน์เก็บ tool call**
- `prompts(id, user_id, title, body, icon, deleted_at, created_at, updated_at)` — ลบแบบ soft delete
- `provider_credentials(id, user_id, label, base_url, models[], key_hint, key_sealed, updated_at)`
  — `key_sealed` = กุญแจที่เข้ารหัส AES-GCM ด้วย Worker secret `PROVIDER_KEY_SECRET`, `key_hint` = 4 ตัวท้าย
- `user_settings(...)` และ `styles(...)` — **สร้างใหม่** ด้วย `supabase/migrations/0002_settings.sql`
  (ตารางจริงไม่มีคอลัมน์ `is_default` จึงเก็บ "ที่เลือกใช้อยู่" เป็น `*_id` ใน `user_settings`)

**หมายเหตุสำคัญ:** `supabase/migrations/0001_chats_messages.sql` เป็นแบบร่างรุ่นแรกที่ไม่ตรงกับของจริง
(ตาราง `messages`, คอลัมน์ `chats.user_id`) — **ห้ามรัน** เก็บไว้เป็นประวัติการตัดสินใจเท่านั้น

**นัยเชิงสถาปัตยกรรม:** RLS เป็นด่านหลัก แต่โค้ดยังกรองเจ้าของ (`owner_id`/`user_id`) ซ้ำอีกชั้นในทุกคำสั่ง
เพราะนโยบายของตารางที่มีอยู่เดิมยืนยันจากเซสชันนี้ไม่ได้ (`chat/[id]` ไม่เจอ = 404 อัตโนมัติ)
`id` ของข้อความมาจาก client แล้ว upsert (`onConflict: 'id'`) จึง idempotent
`chats.owner_id`, `provider_credentials.user_id`, `user_settings.user_id` อ้าง `profiles.id` → ถ้าผู้ใช้ยังไม่มีแถว
`profiles` โค้ดจะสร้างให้ก่อน (`#lib/server/profiles.ts`) ไม่ปล่อยให้ล้มด้วย FK 23503

**ลำดับการทับค่าที่ผู้ใช้ตั้ง:** cookie (ค่าล่าสุดที่เพิ่งกดในเบราว์เซอร์นั้น) → ตาราง → ค่าเริ่มต้นใน `layout.css`
คุกกี้จำเป็นเพราะ `app.html` ต้องตั้งธีมก่อน paint; ตารางคือสำเนาที่ติดไปทุกเครื่องที่ล็อกอิน
ค่าจากทั้งสองทางถูกตรวจรูปแบบซ้ำที่ `#lib/settings.ts` (`sanitizeUserSettings`) ก่อนกลายเป็น inline style

## 5. เส้นแบ่ง auth

- `publicPaths = ['/auth']` เท่านั้น; นอกนั้นต้องมี session
- **`/api/**` เป็นข้อยกเว้นพิเศษ**: ไม่ redirect แต่ให้ handler ตอบ `401 JSON` เอง (client fetch อยู่)
- ปลายทาง redirect ห้ามรับจาก query ตรง ๆ — ผ่าน `safeInternalPath()` (`src/lib/server/redirects.ts`)
- env สาธารณะ: `src/env.ts` → เข้าถึงด้วย `$app/env/public`; secret → `platform.env` (เช่น `EXA_API_KEY`)

## 6. ข้อตัดสินใจ (ทำไมเป็นแบบนี้)

| เรื่อง                           | ตัดสินใจ                                          | เหตุผล                                                |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| กรองเจ้าของข้อมูล                | ใช้ RLS ไม่กรองในโค้ด                             | จุดเดียว กันลืมทั้งโปรเจกต์                           |
| คำนวณ                            | parser เอง (`expression.ts`)                      | ห้าม `eval`/`Function()` กับ input ผู้ใช้             |
| tool ข้อมูลภายนอก                | ต่อของจริง + คืน `source`                         | ห้าม mock; คำตอบต้องอ้างแหล่งได้                      |
| persist                          | ฝั่ง server (`onEnd`)                             | client ปิดแท็บกลางทางก็ยังบันทึกส่วนที่ได้            |
| เลือก tool                       | policy แยกเป็น pure function                      | ทดสอบได้โดยไม่ต้องมี Ollama                           |
| ผู้ใช้สั่ง tool เอง (`/command`) | ข้าม Tev1 ใช้ tool ที่สั่ง (`strategy: 'forced'`) | ผู้ใช้ตัดสินใจเองได้ + ประหยัดการเรียก decision model |

## 7. นอกขอบเขตของไฟล์นี้

- หน้าตา/UX → `docs/components.md` · กับดักเครื่อง/บิลด์ → `docs/dev-notes.md`
- แหล่งข้อมูลภายนอก + วิธีดึงมาตรวจ → `docs/sources.md` · แผน/สถานะงาน → `PLAN.md`
