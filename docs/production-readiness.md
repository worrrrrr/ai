# Production Readiness (ตรวจจากของจริง)

**วันที่ตรวจ:** 2026-10-15 · **ขอบเขต:** แอป `ai` (SvelteKit + Supabase + Ollama/ผู้ให้บริการ OpenAI-compatible บน Cloudflare Workers)
**หลักการ:** ทุกข้อต้องมีวิธีเช็คและสถานะจริง — อะไรที่ยังไม่ยืนยันจะเขียนว่า ❓ ไม่เดา

## 1. ที่มีแล้ว (และหลักฐาน)

| เรื่อง                      | สถานะ | หลักฐาน                                                              |
| --------------------------- | ----- | -------------------------------------------------------------------- |
| ชนิดข้อมูล/ตรวจโค้ด         | ✅    | `svelte-check` 0 errors 0 warnings                                   |
| เทสต์ตรรกะ                  | ✅    | `vitest` 13 ไฟล์ / 153 เทสต์                                         |
| รูปแบบ/งบเอกสาร             | ✅    | `prettier --check` · `canon` ผ่าน                                    |
| สิทธิ์ข้อมูล                | ✅    | RLS + `.eq('owner_id'/'user_id')` ในทุกคำสั่งเขียน                   |
| คีย์ผู้ให้บริการ            | ✅    | เก็บเป็น ciphertext (`key_sealed`) ด้วย AES-GCM ไม่เก็บ plaintext    |
| Auth                        | ✅    | Supabase cookie session · guard 303 → `/auth` · `/api` ตอบ 401 JSON  |
| ตัวเลือกผู้ให้บริการ        | ✅    | ใช้จากตาราง + จาก `.env` (ตรวจคีย์จริงได้ 200: Groq/Gemini/DeepSeek) |
| แสดงขั้นของคำขอ             | ✅    | `data-route` (router/tools/model) + แดงเมื่อล้ม                      |
| ไม่มี dependency เกินจำเป็น | ✅    | เพิ่ม 0 ตัวในงานล่าสุด (ใช้ `fetch` + helper เดิม)                   |

## 2. ช่องว่างระดับ production (พร้อมขนาดงาน)

| #   | เรื่อง                            | สถานะตอนนี้                                           | ต้องทำ                                                                                          | ขนาด |
| --- | --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- |
| 1   | **ยังไม่เคย commit**              | ทุกอย่างอยู่ใน working tree                           | commit + tag (ต้องได้อนุญาตเจ้าของตามกฎข้อ 7)                                                   | S    |
| 2   | **ยังไม่เคยรัน production build** | รันแค่ dev                                            | ปิด dev server → `pnpm build` (adapter-cloudflare) → ตรวจขนาด/คำเตือน                           | S    |
| 3   | **ไม่มีหน้า error ระดับแอป**      | เจอ error = หน้าขาว/ข้อความดิบ                        | เพิ่ม `src/routes/+error.svelte` ภาษาไทย + ปุ่มกลับ                                             | S    |
| 4   | **ไม่มี endpoint สุขภาพ**         | ไม่มี                                                 | `/api/health` (เช็ค DB + ผู้ให้บริการ) ใช้กับ uptime monitor                                    | S    |
| 5   | **ไม่มีบันทึกเป็นระบบ**           | `console.log/error` กระจาย                            | โครง log + ระดับ + request id (ไม่เพิ่ม dep)                                                    | M    |
| 6   | **ไม่มีเพดานเวลา/ค่าใช้จ่าย**     | มีเพดานเวลาต่อเอเจนต์ใน orchestrator · แชทเดี่ยวไม่มี | เพดานต่อคำขอ + เพดาน token ต่อวัน (ผู้ใช้คนเดียว)                                               | M    |
| 7   | **ไม่มีคู่มือ deploy**            | ตั้ง env เองจากความจำ                                 | `docs/deploy.md` (SUPABASE__, OLLAMA__, PROVIDER_KEY_SECRET, EXA_API_KEY, GROQ/GEMINI/DEEPSEEK) | S    |
| 8   | **ไม่มีนโยบายข้อมูล/สำรอง**       | พึ่ง Supabase อย่างเดียว                              | ระบุ backup + retention (ลบแชทเก่า/ส่งออก)                                                      | M    |
| 9   | **a11y ยังไม่ตรวจ**               | มี `aria-*` หลายจุดแต่ไม่ครบ                          | ตรวจคีย์บอร์ด/โฟกัส/คอนทราสต์                                                                   | M    |
| 10  | **เทสต์ระดับเส้นทาง**             | เทสต์แค่ตรรกะบริสุทธิ์                                | เทสต์ loader/action (mock supabase)                                                             | M    |
| 11  | **CI**                            | มี `.github/workflows/ci.yml`                         | ❓ ยังไม่ยืนยันว่าเขียวบน GitHub (ตรวจได้เฉพาะในเครื่อง)                                        | S    |
| 12  | **`PROVIDER_KEY_SECRET`**         | ยังไม่ตั้งบนเครื่อง dev                               | ตั้งใน `.env` (หน้า providers เตือนอยู่)                                                        | S    |
| 13  | **Secret hygiene**                | ❓ ยังไม่ยืนยันว่า `.gitignore` กัน `.env*` ครบ       | ตรวจ + บันทึกไว้ในคู่มือ deploy                                                                 | S    |

## 2.1 ความคืบหน้า (อัปเดต 2026-10-15 — ตรวจจากของจริง)

| #   | เรื่อง                          | สถานะ        | หลักฐาน                                                                                                                                                             |
| --- | ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | build production                | ✅           | `vite build` exit 0 · ได้ `.svelte-kit/cloudflare/_worker.js` · client รวม 0.68 MB                                                                                  |
| 3   | หน้า error ไทย                  | ✅           | `src/routes/+error.svelte` (ไม่โชว์ stack/ข้อความดิบ)                                                                                                               |
| 4   | จุดตรวจสุขภาพ                   | ✅           | `GET /api/health` → `{"ok":true,"db":"ปกติ","ms":227}` HTTP 200 (ยิงจริง)                                                                                           |
| 5   | log มีโครงสร้าง                 | ✅           | `src/lib/server/log.ts` + เทสต์ 9 ตัว · ใช้ใน `chats.ts`, `/api/chat`, orchestrator, loader/action ครบ — เหลือ 1 จุดฝั่ง client (`auth/+page.svelte`) ที่จงใจไม่แตะ |
| 6   | เพดานเวลาคำขอ                   | ✅           | `CHAT_TIMEOUT_MS = 120_000` + `abortSignal` (ใช้เส้นทางบันทึกคำตอบบางส่วนเดิม)                                                                                      |
| 7   | คู่มือ deploy                   | ✅           | `docs/deploy.md` (env จาก `.env` จริง + คำสั่งจาก `package.json` + migration)                                                                                       |
| 11  | CI                              | 🟡           | เติม gate `canon` แล้ว · **ยังไม่เคยรันบน GitHub** (ไม่มี remote/credentials ในเซสชันนี้)                                                                           |
| 13  | Secret hygiene                  | ✅           | `.gitignore` มี `.env` และ `.env.*`                                                                                                                                 |
| –   | validation = โมดูลเดียว + เทสต์ | ✅           | `chatTitle` · `teamSchema` · `agentSchema` · `projectSchema` (22 เทสต์) — ปิดสาเหตุ "หน้าแก้ไขขึ้น error อังกฤษ" ที่เกิดซ้ำ 2 ครั้ง                                 |
| –   | a11y                            | 🟡           | กรอบโฟกัสกลับมา 19 จุด · `aria-label`/`title` ของเมนูในโหมดย่อ · **ยังไม่ได้ทดสอบด้วยคีย์บอร์ด/โปรแกรมอ่านหน้าจอจริง**                                              |
| –   | ไฟล์ที่ไม่มีใครใช้              | ⏳ รออนุมัติ | `src/lib/components/Card.svelte` (ตัวอย่าง + ค่าดิบขัดกฎข้อ 3) · `src/lib/index.ts` (ไฟล์ตั้งต้น SvelteKit มีแต่คอมเมนต์)                                           |

**ยังค้างและต้องเป็นการตัดสินใจของเจ้าของ:** นโยบายข้อมูล/สำรอง (retention) · `commit` + `tag` (กฎข้อ 7)

## 3. ลำดับที่แนะนำ (เล็กก่อน ได้ผลจริงก่อน)

1. **+error.svelte (ไทย) + `/api/health`** — ผู้ใช้ไม่เจอหน้าขาว และมีจุดให้ monitor (S+S)
2. **คู่มือ deploy + ตรวจ `.gitignore` + รัน production build หนึ่งครั้ง** (S)
3. **log เป็นระบบ + เพดานเวลา/ค่าใช้จ่ายของแชทเดี่ยว** (M)
4. **นโยบายข้อมูล/สำรอง + a11y** (M)
5. **เทสต์ระดับเส้นทาง** (M)

## 4. วิธีตรวจว่าผ่าน (ทำได้จริง)

- `node node_modules/svelte-check/bin/svelte-check --tsconfig ./tsconfig.json` → 0 errors 0 warnings
- `node node_modules/vitest/vitest.mjs run` · `node node_modules/prettier/bin/prettier.cjs --check .` · `node scripts/canon-outline.mjs`
- ปิด dev server แล้ว `node node_modules/vite/bin/vite.js build` → ต้องไม่มี error (งานรอบปล่อย)
- ยิงจริง: `POST /api/chat` ไม่มี session → 401 JSON · `/api/health` → 200 + สถานะ DB

## 5. ข้อจำกัดของเอกสารนี้ (พูดตรง ๆ)

- **ยังไม่เคยวัดบนเบราว์เซอร์หลังล็อกอิน** (ไม่มี session) — ข้อที่เกี่ยวกับ UI จึงยืนยันได้แค่ระดับโค้ด
- ตัวเลขประสิทธิภาพ (เวลาโหลด, Core Web Vitals) **ยังไม่ได้วัด** — ถ้าต้องการ ต้องเปิดหน้าแล้ววัดจริง
- ไม่มีการประเมินค่าใช้จ่ายจริงต่อเดือน (ต้องใช้ข้อมูลการใช้งานจริง)
