# คู่มือ deploy (Cloudflare Workers + Supabase)

**ตรวจจากของจริง:** 2026-10-15 · ทุกคำสั่ง/ตัวแปรในหน้านี้คัดจาก `package.json`, `.env` และการรัน build จริงในเซสชันนี้
**ที่ยืนยันแล้ว:** `vite build` → exit 0 · ได้ `.svelte-kit/cloudflare/_worker.js` + `_headers` · client รวม 0.68 MB
**ที่ยังไม่ยืนยัน:** การ deploy จริง (ไม่มี credentials ของ Cloudflare ในเซสชันนี้) และการวัดบนโดเมนจริง

## 1. ก่อนเริ่ม (เครื่องที่ปล่อยงาน)

- Node 20+ และตัวจัดการแพ็กเกจของโปรเจกต์
- **wrangler CLI** — จำเป็น เพราะสคริปต์ `build` เรียก `wrangler types` ก่อน `vite build`
  (ถ้าไม่มี wrangler ให้ข้ามไปใช้ `vite build` ตรง ๆ แล้วค่อย `wrangler deploy` จากเครื่องที่มี)
- Supabase CLI — ใช้เฉพาะ `gen:types` (ตรวจแล้วว่า **ไม่ได้ติดตั้งใน `node_modules`** ของโปรเจกต์)

## 2. คำสั่ง (จาก package.json จริง)

```
pnpm build        # wrangler types --include-runtime=false && vite build
pnpm preview      # wrangler dev .svelte-kit/cloudflare/_worker.js --port 4173
pnpm deploy:dry   # wrangler deploy --dry-run   ← ตรวจก่อนปล่อยจริง
pnpm deploy       # wrangler deploy
```

**ข้อควรระวังที่เจอจริง:** ต้อง **ปิด dev server ก่อน `build`** ไม่งั้น adapter จะล้มด้วย `EPERM` (ไม่ใช่บั๊กโค้ด)

## 3. Environment ที่ต้องตั้งบน production

ตั้งค่าลับด้วย `wrangler secret put <NAME>` และค่าที่เปิดเผยได้ผ่าน `[vars]` ใน `wrangler.jsonc`

| ตัวแปร                                                    | จำเป็น      | ใช้ทำอะไร                                                                                            |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`                                     | ✅ (vars)   | ที่อยู่ Supabase (client เห็นได้)                                                                    |
| `PUBLIC_SUPABASE_ANON_KEY`                                | ✅ (vars)   | คีย์สาธารณะสำหรับ client (RLS คุมสิทธิ์)                                                             |
| `PROVIDER_KEY_SECRET`                                     | ✅ (secret) | เข้ารหัส/ถอดรหัสกุญแจผู้ให้บริการ (AES-GCM) — ถ้าไม่ตั้ง ฟีเจอร์คีย์จะใช้ไม่ได้                      |
| `EXA_API_KEY`                                             | ⭐ (secret) | ค้นเว็บ (ถ้าไม่ตั้ง เครื่องมือ search จะบอกว่าค้นไม่ได้ ไม่เงียบ)                                    |
| `OLLAMA_BASE_URL`                                         | ⭐          | ปลายทาง Ollama (เช่น `http://127.0.0.1:11434` สำหรับในเครื่อง)                                       |
| `OLLAMA_API_KEY`                                          | ⭐          | คีย์ Ollama (ถ้าใช้โมเดลคลาวด์)                                                                      |
| `OLLAMA_MODEL`                                            | ⭐          | โมเดลตอบหลัก (ค่าเริ่มต้นในโค้ด: `gpt-oss:120b-cloud`)                                               |
| `OLLAMA_FAST_MODEL`                                       | ⭐          | โมเดลตัดสินใจ/router                                                                                 |
| `GROQ_API_KEY` · `GROQ_MODEL`                             | ⭐          | ผู้ให้บริการจาก `.env` (ตรวจแล้ว HTTP 200: `openai/gpt-oss-20b`)                                     |
| `GEMINI_API_KEY` · `GEMINI_MODEL`                         | ⭐          | ผู้ให้บริการจาก `.env` (ตรวจแล้ว HTTP 200)                                                           |
| `DEEPSEEK_API_KEY` · `DEEPSEEK_MODEL`                     | ⭐          | ผู้ให้บริการจาก `.env` (ตรวจแล้ว HTTP 200)                                                           |
| `GROQ_BASE_URL` · `GEMINI_BASE_URL` · `DEEPSEEK_BASE_URL` | ไม่บังคับ   | ใช้เมื่อต้องชี้ไป proxy/เกตเวย์ของตัวเอง                                                             |
| `SERVICE_ROLE_KEY`                                        | ❓          | มีใน `.env` ท้องถิ่น แต่ **ยังไม่พบว่าถูกใช้ในโค้ด** — อย่าตั้งบน production จนกว่าจะยืนยันว่าจำเป็น |

> `⚠️` คีย์ทั้งหมดต้องอยู่ใน **secret** เท่านั้น (ห้ามอยู่ใน `[vars]`) · `.gitignore` ของโปรเจกต์กัน `.env` และ `.env.*` ไว้แล้ว (ตรวจแล้ว)

## 4. ฐานข้อมูล (Supabase) ก่อนเปิดใช้

รัน migration ตามลำดับในโปรเจกต์ production:

| ไฟล์                      | สถานะ                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `0002_settings.sql`       | ต้องรัน (ตาราง `styles`, `user_settings`)                    |
| `0004_sidebar_modes.sql`  | ต้องรัน (คอลัมน์ sidebar variant/collapsible)                |
| `0005_orchestrator.sql`   | ต้องรัน (ตาราง orchestrator)                                 |
| `0006_agent_teams.sql`    | ต้องรัน (ตารางทีมถาวร)                                       |
| `0001_chats_messages.sql` | **ห้ามรัน** — เป็นร่างประวัติศาสตร์ (ไม่ตรงกับฐานข้อมูลจริง) |

`pnpm gen:types` ใช้สร้างชนิดข้อมูลจากโปรเจกต์จริง (ต้องมี Supabase CLI + สิทธิ์)

## 5. ตรวจหลังปล่อย (ทำได้จริงทุกข้อ)

1. `GET https://<โดเมน>/api/health` → ต้องได้ **200** และ `{"ok":true,"db":"ปกติ"}` (ถ้าได้ 503 = ต่อฐานข้อมูลไม่ได้)
   — ทดสอบในเครื่องแล้วได้ `{"ok":true,"db":"ปกติ","ms":227}` ✓
2. เข้าหน้าแรกไม่ล็อกอิน → ถูกพาไป `/auth` (303) ✓
3. ล็อกอิน → ส่งข้อความหนึ่งครั้ง → เห็นคำตอบ + **บรรทัดขั้นของคำขอ** (กลุ่ม/เครื่องมือ/โมเดล) ใต้คำตอบ
4. `/settings/providers` → กด **"ทดสอบเชื่อมต่อ"** → ต้องบอกผลจริง (401/403 = คีย์ผิด, อื่น ๆ = สำเร็จพร้อมหมายเหตุ)
5. เปิดหน้าทั้งหมดแล้ว **ไม่เห็น scrollbar ของหน้า** (เลื่อนเฉพาะในกรอบ)

## 6. เรื่องที่ยังไม่ยืนยัน (บันทึกไว้ตรง ๆ)

- ยังไม่เคย deploy จริง และไม่มีการวัดบนโดเมนจริง (เวลาโหลด/Core Web Vitals)
- ยังไม่มี commit ในโปรเจกต์ (ทุกอย่างอยู่ใน working tree) — ควร commit + tag **ก่อน** deploy
- ยังไม่มี CI ที่ยืนยันว่าเขียวบน GitHub (ตรวจได้แค่รันซ้ำในเครื่อง)
