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

```powershell
$env:NODE_OPTIONS = "--require=$env:TEMP\dsh-wrangler-shim.cjs"

pnpm exec svelte-kit sync
pnpm check          # svelte-check (ต้องได้ 0 errors)
pnpm lint           # prettier --check
pnpm build          # wrangler types + vite build (ต้องจบที่ "done" ของ adapter-cloudflare)
pnpm build          # รันซ้ำเพื่อยืนยันว่า idempotent
```

## 5. ข้อจำกัดอื่นของเซสชันนี้

- HTTP ไป loopback (เช่นยิง `http://127.0.0.1:5173/`) ถูกบล็อกจาก shell ของเซสชัน
  จึงยืนยันผลรันไทม์ผ่าน HTTP ไม่ได้ ต้องเปิดเบราว์เซอร์เอง
- shell ที่ tool ใช้คือ `powershell.exe` (Windows PowerShell 5.1) ไม่ใช่ `pwsh` 7
  คำสั่งที่ใช้พารามิเตอร์ของ PS7 เช่น `-SkipHttpErrorCheck` จะใช้ไม่ได้
- การรันคำสั่งผ่าน tool ทำให้เกิดหน้าต่าง console ขึ้นมาทีละหน้าต่าง
  ควรใช้เครื่องมืออ่าน/เขียนไฟล์ (read/glob/grep/edit) แทนคำสั่ง shell ให้มากที่สุด
  และรวมคำสั่งที่ต้องรันจริงให้เหลือครั้งเดียวนำ
