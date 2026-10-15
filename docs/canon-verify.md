# บันทึกการตรวจคัมภีร์ (canon verification log)

แยกออกจาก `AGENTS.md` เพื่อไม่ให้ไฟล์ที่โหลดทุก session ยาวโดยใช่เหตุ
ต้องรันใหม่ทุกครั้งที่อัปเดตคัมภีร์ — ผลล่าสุด **2026-10-14** (รอบที่ 4: แกนเลย์เอาต์แบบไอคอนเต็มชุด)

| ข้อความในคัมภีร์                       | วิธีตรวจ (tool)                                                               | ผล                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| วันที่อัปเดต                           | `Get-Date -Format yyyy-MM-dd`                                                 | `2026-10-14` ตรงกัน                                                   |
| `pnpm check` = 0 errors                | `pnpm check`                                                                  | `svelte-check found 0 errors and 0 warnings` (client ผูก type จริง)   |
| `pnpm lint` ผ่าน                       | `pnpm lint`                                                                   | `All matched files use Prettier code style!`                          |
| `pnpm test` ผ่าน                       | `pnpm test`                                                                   | `Test Files 8 passed (8)`, `Tests 104 passed (104)`                   |
| งบ core ≤ 6000 ตัวอักษร                | `pnpm canon`                                                                  | `AGENTS.md ... chars=3967 งบ 6000 OK`                                 |
| token อยู่ใน `layout.css`              | `grep --color-surface src/routes/layout.css`                                  | เจอที่ `src/routes/layout.css:95`                                     |
| ห้าม mock: ไม่มีข้อมูลปลอม             | `grep -rn 'Math\.random' src/lib/server`                                      | ไม่พบ                                                                 |
| ห้าม `eval`/`Function()`               | `grep -rnE 'eval[(]' src` + `grep -rn 'new Function' src`                     | ไม่พบ                                                                 |
| ค่าที่กลายเป็น CSS ถูกตรวจก่อนใช้      | `pnpm test` (describe 'การตรวจค่า CSS')                                       | ปฏิเสธ `red; } body { ...` และ `oklch(...); --x: 1`                   |
| แม่แบบสไตล์ตรงกับค่าตั้งต้น layout.css | `pnpm test` (`แม่แบบค่าเริ่มต้นตรงกับ layout.css เป๊ะ`)                       | ผ่าน — เทียบ 8 ค่า (`oklch(0.55 0.16 258)` ฯลฯ)                       |
| คำนวณสีจากสีหลักได้สูตรเดียวกับแม่แบบ  | `pnpm test` (`สีน้ำเงินของโปรเจกต์ให้ผลตรงกับแม่แบบ "น้ำเงิน" เป๊ะ`)          | ผ่าน — `mainColorsFromPrimary('oklch(0.55 0.16 258)')` = แม่แบบ blue  |
| แปลง hex -> oklch ถูกต้องตามอ้างอิง    | `pnpm test` (describe 'hexToOklch')                                           | `#ff0000` = L 0.628 C 0.258 H 29.23 (ตามสเปก OKLCH)                   |
| กุญแจถูก seal จริง (AES-GCM)           | `pnpm test` (describe 'seal/เปิดกุญแจ')                                       | round-trip ได้, secret ผิด/ค่าถูกแก้ถอดไม่ได้, `key_hint` = 4 ตัวท้าย |
| ทดสอบผู้ให้บริการยิงของจริง            | `pnpm test` (describe 'fetchProviderModels' / 'discoverProviderModels')       | `/api/tags`, `/v1/models`, Bearer, HTTP 500, ถอยโปรโตคอล              |
| ตารางใหม่ใน migration ตรงกับของจริง    | `grep -c 'create table' supabase/migrations/0002_settings.sql`                | `2` (`styles`, `user_settings`) — ตารางอื่นมีอยู่แล้วใน DB            |
| 0001 ไม่ถูกใช้เป็น schema จริง         | `head -3 supabase/migrations/0001_chats_messages.sql`                         | มีคำเตือน "ห้ามรัน" + อธิบาย schema จริง                              |
| schema จริง = type ที่ผูกกับ client    | `pnpm gen:types` แล้ว `pnpm check`                                            | 0 errors — โค้ดตรงกับตาราง/คอลัมน์จริง                                |
| แกนเลย์เอาต์ใหม่ทำงานจริง              | `pnpm test` (`แถบด้านข้างอยู่ขวา = สลับคอลัมน์และลำดับ`)                      | `--shell-columns` สลับด้าน + order ถูกต้อง; ด้าน/สเกลถูกตรวจช่วงค่า   |
| รัน dev server ได้ในเซสชัน agent       | ดูวิธีใน `docs/dev-notes.md` §5 แล้วยิง `curl.exe http://127.0.0.1:5173/auth` | `200` (ต้องชี้ TMP เข้าโปรเจกต์ก่อน)                                  |
| หน้าต้องล็อกอินถูกกันจริง              | `curl.exe -s -o NUL -w "%{http_code}" .../settings/styles`                    | `303` → `/auth?redirectTo=%2Fsettings%2Fstyles`                       |

## เกณฑ์ผ่านของตัวตรวจ

- ทุกข้อในตารางต้องมี `ผ่าน` — ถ้ามีข้อตกต้องแก้แล้วรันใหม่ (หรือตัดข้อนั้นออกจากคัมภีร์)
- ถ้ายืนยันไม่ได้ ให้กำกับ `(ยังไม่ยืนยัน)` แทนการเดา
- งบขนาด: วัดด้วย `pnpm canon` เป็นแหล่งเดียว (ไม่ใช้ `wc -l` คู่กัน — เดิมให้ค่าต่างกัน 1)
- **ยังไม่ยืนยัน:** การเรนเดอร์จริงของหน้า `/settings/*` (ต้องมี session ของผู้ใช้) และการรัน
  `supabase/migrations/0002_settings.sql` ในโปรเจกต์จริง — ยืนยันได้แค่เส้นทางถูกกันด้วย guard,
  ผ่าน `svelte-check`/unit test และหน้าจะขึ้นข้อความบอกเองถ้าตารางยังไม่มี
