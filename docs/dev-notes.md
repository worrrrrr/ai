# dev-notes — ข้อจำกัดของเครื่อง/เซสชันนี้ และกับดักของ build

บันทึกนี้มีไว้ให้ session ถัดไป (คนหรือ agent) ไม่ต้องไล่ปัญหาเดิมซ้ำ
อัปเดต: 2026-10-14

## 1. wrangler ใช้ไม่ได้เมื่อรันด้วย node ของ DSH Desktop

อาการ: ทุกคำสั่งของ wrangler ล้มด้วยข้อความ

```
X [ERROR] Unknown argument: C:\...\node_modules\wrangler\wrangler-dist\cli.js
```

สาเหตุ: ในเซสชัน DSH ตัว `node` คือ Electron ที่รันโหมด `ELECTRON_RUN_AS_NODE=1`
ทำให้ `process.versions.electron` มีค่า -> yargs ที่ wrangler ใช้คำนวณ `getProcessArgvBinIndex()`
เป็น 0 -> `hideBin()` ตัด argv ผิดตำแหน่ง จึงมองเห็น path ของ `cli.js` เองเป็น argument
(ไม่ใช่บั๊กของโปรเจกต์ และไม่เกิดเมื่อรันจาก terminal ที่ใช้ Node.js ปกติ)

ทางแก้ชั่วคราวที่ทดสอบแล้วได้ผล — สร้างไฟล์ shim (เก็บนอก repo ก็ได้) แล้วชี้ผ่าน `NODE_OPTIONS`:

```powershell
# shim: ล้าง process.versions.electron เพื่อให้ argv กลับสู่พฤติกรรมปกติ
$shim = "$env:TEMP\dsh-wrangler-shim.cjs"
@'
try { delete process.versions.electron } catch {}
process.defaultApp = true;
'@ | Set-Content $shim
$env:NODE_OPTIONS = "--require=$shim"
pnpm exec wrangler --version   # ต้องได้ 4.149.0
```

## 2. ต้องหยุด dev server ก่อน build

`pnpm build` จะล้มด้วย `EPERM, Permission denied: .svelte-kit\cloudflare`
ถ้ามี dev server (vite dev / wrangler dev) รันอยู่ เพราะ workerd ถือโฟลเดอร์นั้นไว้
และ adapter-cloudflare ต้องลบโฟลเดอร์ก่อนสร้างใหม่

- อาการข้างเคียง: `Move-Item .svelte-kit ...` ก็ถูกปฏิเสธด้วยเหตุเดียวกัน
- ถ้าการลบล้มกลางทาง โฟลเดอร์ `.svelte-kit\cloudflare` จะว่างเปล่า และ `_worker.js` หายไป
- ตรวจก่อน build: `Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 5173`

## 3. `wrangler types` กับ build แย่งกัน (build ไม่ idempotent)

`wrangler types` จะใส่บล็อกนี้ **เฉพาะเมื่อมีไฟล์ worker ที่ build แล้ว**

```ts
interface GlobalProps {
	mainModule: typeof import('./.svelte-kit/cloudflare/_worker');
}
```

ผลที่ตามมา:

1. บนต้นไม้สะอาด (ยังไม่เคย build) ไฟล์ `worker-configuration.d.ts` จะไม่มีบล็อกนี้
2. `pnpm build` ครั้งแรกผ่าน -> เกิด `.svelte-kit/cloudflare/_worker.js`
3. รัน `pnpm build` ครั้งที่สอง -> `wrangler types --check` เห็น hash ไม่ตรง -> ล้มด้วย
   `Types at worker-configuration.d.ts are out of date`
4. และถ้าสั่ง `wrangler types` (ไม่ใช้ `--check`) ไฟล์จะได้บล็อก GlobalProps กลับมา
   ซึ่งลาก `.svelte-kit/output/**` ทั้งต้นไม้เข้าสู่ type program -> `svelte-check` แดงหลายร้อยตัว

วิธีจัดการที่ใช้อยู่ในโปรเจกต์นี้:

- `tsconfig.json` ตั้ง `"checkJs": false` เพื่อให้ type gate ไม่ผูกกับไฟล์ที่ generate (ไม่ว่าไฟล์จะอ้างอะไร)
- `pnpm build` ใช้ `wrangler types --include-runtime=false` (regenerate) ไม่ใช้ `--check` -> build ซ้ำได้เรื่อย ๆ
- `pnpm gen:check` แยกไว้สำหรับตรวจ drift ของไฟล์ generate และควรเรียกเฉพาะบนต้นไม้สะอาด (เช่นใน CI ก่อน build)

## 4. คำสั่งที่ใช้ตรวจสอบ

**เรียก CLI ตรง ๆ ไม่ใช้ `pnpm <script>`** — pnpm บนเครื่องนี้เป็นโปรเซส GUI จึงทำให้ `cmd.exe`
ที่มัน spawn ได้หน้าต่าง console ใหม่ทุกครั้ง (กฎ owner ข้อ 4.1); การเรียก `node <bin>` ไม่เกิดหน้าต่างเลย

```powershell
node node_modules\@sveltejs\kit\svelte-kit.js sync        # ต้องมาก่อน svelte-check
node node_modules\svelte-check\bin\svelte-check --tsconfig ./tsconfig.json   # ต้องได้ 0 errors 0 warnings
node node_modules\prettier\bin\prettier.cjs --check .
node node_modules\vitest\vitest.mjs run
node scripts\canon-outline.mjs                            # งบ core ≤ 6000 ตัวอักษร

# build เฉพาะรอบปล่อยงาน (ต้องไม่มี dev server รันอยู่) — wrangler ต้องมี shim ตามข้อ 1
$env:NODE_OPTIONS = "--require=$env:TEMP\dsh-wrangler-shim.cjs"
node node_modules\wrangler\bin\wrangler.js types --include-runtime=false
node node_modules\vite\bin\vite.js build
```

`pnpm <script>` ยังใช้ได้ (ให้ผลเหมือนกัน) แต่จะเห็นหน้าต่าง console เด้งมาทุกคำสั่ง

## 7. ฐานข้อมูลจริง + การ generate type

- โปรเจกต์ Supabase ที่แอปชี้: ref `gozxohjfseacplnwgtbn` (ชื่อ `aaii`, สิงคโปร์) — หาได้จากตัวแปร `PUBLIC_SUPABASE_URL`
  โดยไม่ต้องเปิดเผยค่า: เทียบว่า ref ตัวไหนอยู่ใน URL นั้น
- **schema จริงเป็นแหล่งความจริง ไม่ใช่ไฟล์ในเรโป**: `profiles`, `chats(owner_id)`, `chat_messages(content/reasoning)`,
  `prompts(title/body/deleted_at)`, `provider_credentials(label/base_url/models/key_hint/key_sealed)`,
  `agents`, `projects`, `project_files`, `chat_participants`, `schedules`, `sessions`
- `supabase/migrations/0001_chats_messages.sql` **ห้ามรัน** (แบบร่างที่ไม่ตรงของจริง) — ใช้ `0002_settings.sql`
  สร้างเฉพาะ `styles` + `user_settings` ที่ยังไม่มี
- **ชนิดคีย์ไม่เหมือนกันทุกตาราง** (type ที่ generate บอกได้แค่ `string` จึงแยกไม่ออก):
  `profiles.id`, `prompts.id`, `chats.id`, `styles.id` เป็น **uuid** แต่ `provider_credentials.id` เป็น **text**
  → FK ใน `user_settings` ต้องเป็น `provider_id text` (ถ้าเขียน `uuid` จะได้ error 42804
  "foreign key constraint cannot be implemented") · โค้ดสร้าง id ผู้ให้บริการด้วย `crypto.randomUUID()`
  ซึ่งเก็บลงคอลัมน์ text ได้ปกติ
- regenerate type (CLI ล็อกอินค้างอยู่แล้ว):

  ```powershell
  pnpm gen:types   # supabase gen types typescript --project-id gozxohjfseacplnwgtbn > src/lib/database.types.ts
  ```

  ไฟล์นี้เป็น generated -> อยู่ใน `.prettierignore`; CLI จะสร้าง `supabase/.temp/` ซึ่ง gitignore ไว้แล้ว

- หลังรัน `0002_settings.sql` แล้วให้ `pnpm gen:types` อีกครั้ง แล้วลบ type ชั่วคราวของสองตารางนั้นใน
  `src/lib/server/settings.ts` (`PendingSettingsTables` + `settingsDb()`) ได้เลย

## 8. `PROVIDER_KEY_SECRET` (seal กุญแจผู้ให้บริการ)

- กุญแจของผู้ให้บริการเก็บใน `provider_credentials.key_sealed` แบบ AES-GCM (คีย์อนุพัทธ์จาก secret ด้วย SHA-256)
  และเก็บ 4 ตัวท้ายไว้ที่ `key_hint` — **ไม่มี secret แล้วถอดกลับไม่ได้**
- dev: ใส่ `PROVIDER_KEY_SECRET=...` ใน `.env` · prod: `wrangler secret put PROVIDER_KEY_SECRET`
- ถ้าไม่ตั้ง: หน้าผู้ให้บริการจะขึ้นแถบเตือน และการบันทึก/ทดสอบที่ต้องใช้กุญแจจะตอบ error ภาษาไทย (ไม่พังเงียบ)
- เปลี่ยน secret ภายหลัง = กุญแจเดิมถอดไม่ได้ ต้องกรอกใหม่ (ข้อความ error บอกไว้แล้ว)

## 5. ข้อจำกัดอื่นของเซสชันนี้

- **รัน `pnpm dev` ในเซสชัน agent ต้องชี้ TMP เข้าโฟลเดอร์ในโปรเจกต์**: ถ้าปล่อยค่าเริ่มต้น
  (`%LOCALAPPDATA%\Temp`) workerd/miniflare จะล้มด้วย
  `kj::Exception: failed: CreateDirectory: #5 Access is denied.; path = miniflare-email-store`
  (วัดซ้ำ 2026-10-14: `node node_modules/vite/bin/vite.js dev --port 5174` ล้มแบบเดิมทุกรอบ
  ส่วน pwsh เขียนโฟลเดอร์ใน `%TEMP%` ได้ปกติ → เป็นเรื่องของ process workerd ไม่ใช่สิทธิ์ผู้ใช้)
  ทางที่ใช้ได้จริง (ยืนยันแล้วว่าเสิร์ฟได้):

  ```powershell
  $tmp = Join-Path $PWD '.svelte-kit\dev-tmp'
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $env:TEMP = $tmp; $env:TMP = $tmp; $env:TMPDIR = $tmp
  node node_modules/vite/bin/vite.js dev --port 5173 --host 127.0.0.1
  ```

  - เรียก CLI ตรง (ไม่ผ่าน `pnpm <script>`) เพื่อไม่ให้เกิดหน้าต่าง console ใหม่ ตามกฎ owner ข้อ 4.1
  - ตรวจว่าเสิร์ฟจริง: `curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:5173/auth` → `200`
  - หน้าที่ต้องล็อกอิน (`/settings/*`) ตรวจได้แค่ว่า `303` ไป `/auth?redirectTo=...`
    **การเรนเดอร์จริงยังต้องให้เจ้าของล็อกอินดูเอง**

- HTTP ไป loopback (เช่นยิง `http://127.0.0.1:5173/`) ใช้ได้ ไม่ถูกบล็อก (แก้ข้อมูลเดิม 2026-10-14)
  ตรวจ SSR ของหน้าสาธารณะได้จริง (เช่น `/auth` → `200`); หน้าที่ต้องล็อกอินจะได้ `303` → `/auth` จึงตรวจตรง ๆ ไม่ได้
- shell ที่ tool ใช้คือ `powershell.exe` (Windows PowerShell 5.1) ไม่ใช่ `pwsh` 7
  คำสั่งที่ใช้พารามิเตอร์ของ PS7 เช่น `-SkipHttpErrorCheck` จะใช้ไม่ได้
- การรันคำสั่งผ่าน tool ทำให้เกิดหน้าต่าง console ขึ้นมาทีละหน้าต่าง
  ควรใช้เครื่องมืออ่าน/เขียนไฟล์ (read/glob/grep/edit) แทนคำสั่ง shell ให้มากที่สุด
  และรวมคำสั่งที่ต้องรันจริงให้เหลือครั้งเดียวนำ

## 6. `EXA_API_KEY` (เครื่องมือค้นหา)

- tool `search` อ่านคีย์จาก `platform.env.EXA_API_KEY` (ไม่ประกาศใน `wrangler.jsonc` เพราะเป็น secret)
- **dev:** ใส่ใน `.env` (ไฟล์นี้ถูก gitignore) — ตอน `pnpm dev` adapter-cloudflare เรียก `getPlatformProxy`
  ทำให้ `platform.env` มีค่านั้นจริง
- **prod:** `wrangler secret put EXA_API_KEY` (ยังไม่ทำ — ดู PLAN T4.1)
- ถ้าไม่มีคีย์ โค้ดยังทำงาน: `search` ถอยไปใช้ DuckDuckGo Instant Answer + Wikipedia (ไม่ต้องมีคีย์)
- ผลข้างเคียง: `wrangler types` อ่าน `.env` ด้วย บางครั้งไฟล์ `worker-configuration.d.ts` ที่ generate
  ในเครื่องจะเพิ่ม `EXA_API_KEY: string` ต่างจากไฟล์ที่ commit — กลไกเดียวกับ §3 ถ้าไม่ต้องการ diff ให้
  `git checkout -- worker-configuration.d.ts` หลัง build

## โมดูลระดับ production ที่เพิ่ม (2026-10-15)

ตรวจจากของจริงในเซสชันนี้ · สถานะ/ช่องว่างที่เหลือดู `docs/production-readiness.md`

| ไฟล์                               | หน้าที่                                                                          | เทสต์ |
| ---------------------------------- | -------------------------------------------------------------------------------- | ----- |
| `src/lib/server/log.ts`            | log มีโครงสร้าง (ระดับ · `requestId` · `redactSecret`) — ไม่เพิ่ม dependency     | 9     |
| `src/lib/server/chatTitle.ts`      | ตรวจ/ทำชื่อแชทให้สะอาด                                                           | 5     |
| `src/lib/server/teamSchema.ts`     | สคีมาบันทึกทีม                                                                   | 6     |
| `src/lib/server/agentSchema.ts`    | สคีมาช่องกรอกเอเจนต์ (รวมจาก 2 ที่)                                              | 6     |
| `src/lib/server/projectSchema.ts`  | สคีมาช่องกรอกโปรเจกต์ (รวมจาก 2 ที่)                                             | 5     |
| `src/lib/server/providerEnv.ts`    | อ่านผู้ให้บริการจาก `.env` (Groq/Gemini/DeepSeek)                                | 4     |
| `src/routes/+error.svelte`         | หน้า error ภาษาไทย (ไม่โชว์ stack/ข้อความดิบ)                                    | –     |
| `src/routes/api/health/+server.ts` | `GET /api/health` สำหรับ uptime monitor (ไม่ต้องล็อกอิน · ไม่เปิดเผยข้อมูลภายใน) | –     |

**กับดักที่เจอจริง (อย่าทำซ้ำ):**

- `[regex]::Replace($text, $pat, $rep, 1)` — `1` ถูกตีความเป็น `RegexOptions` ไม่ใช่จำนวนครั้ง
  จึงแทนที่ **ทุกที่** (เคยทำให้ไฟล์ route พัง) · ถ้าต้องแทนที่ให้ใช้ `.Replace()` แบบ literal
- ไฟล์ที่ watcher ของ vite ถืออยู่จะเขียนไม่ผ่าน (`ReplaceFileW EIO`) → ปิด dev server ชั่วคราวแล้วเปิดกลับ
- `Select-String -Path` กับพาธที่มี `[id]` มอง `[id]` เป็น wildcard → ใช้ `-LiteralPath`
- `rail-hide` ใน `layout.css` ใช้ `display: none` → ป้ายชื่อเมนูหายจาก accessibility tree ในโหมดย่อ
  ลิงก์/ปุ่มที่ข้อความถูกซ่อนด้วยคลาสนี้ **ต้องมี `aria-label` + `title` เสมอ**
