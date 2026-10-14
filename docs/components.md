# โครง UI และรายการ component

สถานะ: แผนก่อนลงมือ (ยังไม่มีไฟล์ component ในโปรเจกต์)
อ้างอิง: [layout.css](../src/routes/layout.css), [PLAN.md](../PLAN.md)

> ตัวเลข 48 ตัวที่เคยสรุปไว้คือ **ภาพสุดท้ายของทั้งผลิตภัณฑ์** (รวม settings / agent / project
> ที่ยังไม่มีอยู่) ไม่ใช่สิ่งที่ต้องทำตอนนี้ — เอกสารนี้แยก "ทำเดี๋ยวนี้" ออกจาก "เพิ่มเมื่อถึงเวลา"

## 0. หลักการ: ทุกอย่าง dynamic

ไม่มีค่าตายตัวใน component ทุกอย่างที่ผู้ใช้เห็นมาจากข้อมูลหรือการตั้งค่า

| สิ่งที่เห็น | มาจากไหน | เปลี่ยนตอนรันได้อย่างไร |
| --- | --- | --- |
| สี/พื้นผิว/เส้น/มุม/เงา | ตัวแปร CSS บน `<html>` | `+layout.svelte` ใส่ `style` จาก settings ของผู้ใช้ ทับค่าตั้งต้นใน `layout.css` |
| โหมดสว่าง/มืด | `data-theme` บน `<html>` (auto resolve ก่อน paint) | ปุ่มในแถบหัวเรื่อง หรือ `settings/layout` เขียนลง DB + อัปเดต attribute ทันที |
| ความกว้าง sidebar, ความหนาแน่น | `--sidebar-width`, `--density` | ตั้งค่าใน `settings/layout` |
| รายการ sidebar | ตาราง `chats` / `projects` / `agents` ผ่าน `+layout.server.ts` (RLS) | สร้าง/ลบแล้ว `invalidateAll()` |
| รายการ model | ตาราง `providers` ของผู้ใช้ | ไม่ hardcode ชื่อ model ในโค้ดอีก |
| tool ที่ส่งเข้า router | การตั้งค่า/ตาราง `tools` ส่งไปกับ request | สลับได้โดยไม่แก้ `api/chat` |
| ส่วนประกอบของข้อความ | `parts` จริงจาก AI SDK (jsonb) | render ตาม type ห้ามฝังชื่อ tool ใน UI |
| เมนู/ปุ่มจัดการ | ส่งเข้ามาเป็น prop/array | เพิ่มเมนู = เพิ่มข้อมูล ไม่ต้องแก้ layout |

กติกา: Svelte 5 runes เท่านั้น, สี/ขนาดใช้ utility จาก token (`bg-surface`, `text-ink-muted`, `rounded-panel`) ห้ามค่าดิบ, ห้าม emoji (กฎ owner) — ไอคอนใช้ `@lucide/svelte` ตามที่เจ้าของตัดสิน 2026-10-14

## 1. ชั้นของโค้ด

| ชั้น | ที่อยู่ | หน้าที่ |
| --- | --- | --- |
| Shell | `src/routes/+layout.svelte`, `+layout.server.ts`, `app.html` | ธีม, settings, AI context, โครง 2 คอลัมน์ |
| Component | `src/lib/components/**` | แสดงผล + โต้ตอบ (ไม่แตะ DB ตรง ๆ) |
| Server helper | `src/lib/server/**` | เข้าถึงข้อมูลเท่านั้น (`chats.ts` มีแล้ว) |
| ข้อมูลหน้า | `+page.server.ts` / remote functions | โหลด/บันทึก + validation |

## 2. ทำเดี๋ยวนี้: 6 ตัว

เกณฑ์ที่ component จะได้เกิด: (ก) ถูกใช้ตั้งแต่ 2 ที่ขึ้นไป หรือ (ข) มี state/logic ของตัวเอง หรือ (ค) ต้องแยกเพื่อเทสต์

| Component | ทำไมต้องแยก | ใช้ที่ไหน |
| --- | --- | --- |
| `AppShell.svelte` | โครง 2 คอลัมน์ + สถานะย่อ/ขยาย sidebar ต้องใช้ร่วมทุกหน้า | `/chat`, `/chat/[id]`, `/agent`, `/project`, `/settings` |
| `Sidebar.svelte` | รวมปุ่มแชทใหม่ + รายการแชท + ส่วนผู้ใช้/ออกจากระบบ (ย่อยในตัว ไม่แยก 5 ไฟล์) | ทุกหน้าใน shell |
| `MessageList.svelte` | มี state: auto-scroll ขณะ stream, ปุ่มไปล่างสุด | `/chat/[id]` |
| `Message.svelte` | หนึ่งข้อความ: role, เวลา, ปุ่มคัดลอก/ลองใหม่ | ในลิสต์ |
| `MessageParts.svelte` | ตัวแยกตาม `part.type` (text / tool-* / fallback) — หัวใจของการไม่ hardcode tool | ในข้อความ |
| `Composer.svelte` | textarea ยืดตามเนื้อหา, Enter ส่ง, Shift+Enter ขึ้นบรรทัด, IME-safe, ปุ่มส่ง/หยุด | `/chat/[id]` |

รวม 6 ไฟล์ + `app.html` (script resolve ธีมก่อน paint) + `+layout.server.ts` (ผู้ใช้ + settings)

## 3. เพิ่มเมื่อมีเหตุจริง (ไม่ทำล่วงหน้า)

| Component | จะเพิ่มเมื่อ |
| --- | --- |
| `Button.svelte` | รูปแบบปุ่มเดียวกันปรากฏตั้งแต่ 3 ที่ขึ้นไป (ก่อนนั้นใช้คลาส Tailwind ตรง ๆ) |
| `Icon.svelte` | ต้องใช้ไอคอนซ้ำหลายที่และต้องคุมขนาด/สีจากที่เดียว |
| `Dialog.svelte` | มีการกระทำที่ต้องยืนยัน (ลบแชท/โปรเจกต์) — ถึงตอนนั้นค่อยเลือก shadcn-svelte หรือเขียนเอง |
| `Dropdown.svelte` | SidebarItem ต้องมีเมนู `...` |
| `ThemeToggle.svelte` | มีหน้า `settings/layout` แล้ว |
| `Markdown.svelte` | เริ่ม render markdown จริง (ตอนนี้แสดงข้อความล้วน) + sanitize |
| `ModelPicker.svelte` / `ToolPicker.svelte` | ตาราง `providers` / `tools` พร้อม (หลังรัน migration ชุดถัดไป) |
| `SettingsSection.svelte`, `ProviderForm.svelte`, `PromptEditor.svelte`, `StyleEditor.svelte` | สร้างหน้า `settings/*` นั้น ๆ |
| `AgentCard.svelte`, `AgentForm.svelte`, `ProjectCard.svelte`, `ProjectForm.svelte` | สร้าง `/agent` และ `/project` |
| `ChatListItem.svelte` | รายการแบบเดียวกันถูกใช้ทั้ง sidebar และหน้า `/chat` เต็มรูปแบบ |
| `Toast.svelte`, `Spinner.svelte`, `Skeleton.svelte`, `EmptyState.svelte` | มีงานที่ต้องมี feedback/สถานะโหลด และ inline ไม่พอแล้ว |
| `SidebarSection.svelte`, `SidebarNav.svelte`, `SidebarFooter.svelte` | sidebar โตจนเนื้อหาในตัวยาวเกิน ~200 บรรทัด |
| `AutoGrowTextarea.svelte` | ตรรกะยืดกล่องถูกใช้ที่อื่นนอกจาก Composer |
| `ReasoningPart.svelte`, `SourcePart.svelte` | เปิด `sendReasoning` / `sendSources` แล้ว |

## 4. ยังไม่ทำ (YAGNI)

virtualization ของ message list (รอเกิน ~500 ข้อความ), แนบไฟล์/รูป, เสียง, แชร์ลิงก์สาธารณะ, drag-drop เรียง, ตัวแก้ธีมเต็มรูปแบบ (แค่ light/dark + token ไม่กี่ตัว), multi-agent orchestration UI

## 5. ลำดับการสร้าง

1. `app.html` — resolve `data-theme` ก่อน paint
2. `+layout.server.ts` — ผู้ใช้ + settings (ธีม/ความหนาแน่น/sidebar)
3. `AppShell.svelte` + `Sidebar.svelte` (ใช้ `chats` ที่มีอยู่แล้ว)
4. `MessageList.svelte` + `Message.svelte` + `MessageParts.svelte`
5. `Composer.svelte` (ต่อกับ `/api/chat` เดิม)
6. ย้าย `/chat`, `/chat/[id]` และ `/` มาใช้ shell เดียวกัน แล้วลบ markup เก่าในหน้า

## 6. ฝั่ง server ที่ต้องมีตอนนี้

| ไฟล์ | หน้าที่ |
| --- | --- |
| `+layout.server.ts` | ผู้ใช้ + settings (ธีม, ความหนาแน่น, สถานะ sidebar) + รายการแชทสำหรับ sidebar |
| `app.html` | inline script ตั้ง `data-theme` ก่อน paint |
| `src/lib/server/settings.ts` | อ่าน/เขียน settings ของผู้ใช้ (ยังไม่มีตาราง: ใช้ค่าเริ่มต้นไปก่อน แล้วอ่านจากตารางเมื่อมี) |

ตาราง `settings` / `providers` / `prompts` / `agents` / `projects` จะตามมาหลัง migration ชุดถัดไป
