# โครง UI และรายการ component ที่ต้องใช้

สถานะ: ข้อสรุปจากการวิเคราะห์ เป็นแผนก่อนลงมือสร้าง (ยังไม่มีไฟล์ component ในโปรเจกต์)
อ้างอิง: [layout.css](../src/routes/layout.css), [PLAN.md](../PLAN.md)

## 0. หลักการ: ทุกอย่าง dynamic

ไม่มีค่าตายตัวใน component ทุกอย่างที่ผู้ใช้เห็นต้องมาจากข้อมูลหรือการตั้งค่า

| สิ่งที่เห็น | มาจากไหน | เปลี่ยนตอนรันได้อย่างไร |
| --- | --- | --- |
| สี/พื้นผิว/เส้น/มุม/เงา | ตัวแปร CSS บน `<html>` | `+layout.svelte` ใส่ `style` จากตาราง `styles` ของผู้ใช้ ทับค่าตั้งต้นใน `layout.css` |
| โหมดสว่าง/มืด | `data-theme` บน `<html>` (light / dark / auto ที่ resolve ก่อน paint) | ปุ่มใน Topbar หรือ `settings/layout` เขียนลง DB + อัปเดต attribute ทันที |
| ความกว้าง sidebar, ความหนาแน่น | `--sidebar-width`, `--density` | ตั้งค่าใน `settings/layout` (โหมดกะทัดรัด) |
| รายการ sidebar (แชท/โปรเจกต์/agent) | ตาราง `chats` / `projects` / `agents` ผ่าน `+layout.server.ts` (RLS ต่อผู้ใช้) | สร้าง/ลบแล้ว `invalidateAll()` |
| รายการ model | ตาราง `providers` ของผู้ใช้ | `settings/providers` เพิ่ม/ลบแล้ว picker อัปเดตทันที |
| tool ที่ส่งเข้า router | ตาราง/การตั้งค่า `tools` (ไม่ฝังใน `api/chat`) | สลับใน Composer แล้วส่งไปกับ request |
| ข้อความ/ส่วนประกอบของข้อความ | `parts` จาก AI SDK (เก็บเป็น jsonb) | render ตาม type จริง ไม่ hardcode ชื่อ tool |
| เมนู/ปุ่มจัดการ | ส่งเข้ามาเป็น prop/array | เพิ่มเมนูใหม่ = เพิ่มข้อมูล ไม่ต้องแก้ layout |

กติกาประกอบ: Svelte 5 runes เท่านั้น, สี/ขนาดใช้ utility จาก token (`bg-surface`, `text-ink-muted`, `rounded-panel`) ห้ามค่าดิบ, ห้าม emoji (กฎ owner) — ไอคอนใช้ `@lucide/svelte` ตามที่เจ้าของตัดสิน 2026-10-14 แต่ห่อที่ `Icon.svelte` จุดเดียวเพื่อสลับได้ทีหลัง

## 1. ชั้นของโค้ด

| ชั้น | ที่อยู่ | หน้าที่ |
| --- | --- | --- |
| Shell | `src/routes/+layout.svelte`, `+layout.server.ts`, `app.html` | ธีม, settings, AI context, โครง 2 คอลัมน์ |
| Component | `src/lib/components/**` | แสดงผล + โต้ตอบ (ไม่แตะ DB ตรง ๆ) |
| Server helper | `src/lib/server/**` | เข้าถึงข้อมูลเท่านั้น (`chats.ts` มีแล้ว) |
| ข้อมูลหน้า | `+page.server.ts` / remote functions | โหลด/บันทึก + validation |

## 2. Shell และ Sidebar (9 ตัว)

| Component | หน้าที่ | หมายเหตุ |
| --- | --- | --- |
| `AppShell.svelte` | grid 2 คอลัมน์ + จัดการย่อ/ขยาย sidebar | ใช้ `app-shell` / `sidebar-hidden` จาก layout.css |
| `Sidebar.svelte` | คอลัมน์ซ้ายทั้งใบ (header + เลื่อน + footer) | `scroll-slim`, จอเล็กเป็น drawer |
| `SidebarHeader.svelte` | ปุ่ม "แชทใหม่" + ช่องค้นหา | ค้นหาเป็น filter ฝั่ง client ก่อน แล้วค่อยยกไป server |
| `SidebarNav.svelte` | เมนูหลัก (แชท / โปรเจกต์ / agent / ตั้งค่า) | รับรายการเป็น array |
| `SidebarSection.svelte` | กลุ่มที่ย่อได้ + ปุ่มเพิ่ม | สถานะย่อ/ขยายจำใน settings |
| `SidebarItem.svelte` | แถวเดียว: ไอคอน + ชื่อ + เมนู `...` | ใช้ซ้ำทั้งแชท/โปรเจกต์/agent |
| `SidebarFooter.svelte` | ผู้ใช้ปัจจุบัน + ทางไปตั้งค่า/ออกจากระบบ | ข้อมูลจาก `+layout.server.ts` |
| `Topbar.svelte` | ชื่อหน้า + ปุ่มจัดการของหน้านั้น | rename/delete ของแชทอยู่ที่นี่ |
| `ThemeToggle.svelte` | light / dark / auto | เขียน DB + ตั้ง `data-theme` ทันที |

## 3. Messages (11 ตัว)

| Component | หน้าที่ | หมายเหตุ |
| --- | --- | --- |
| `MessageList.svelte` | เลื่อน, auto-scroll ขณะ stream, ปุ่ม "ไปล่างสุด" | ใช้ `scroll-slim` |
| `Message.svelte` | หนึ่งข้อความ (role, เวลา, ปุ่มคัดลอก/ลองใหม่) | ปุ่มแก้ไขเฉพาะ role user |
| `MessageParts.svelte` | วน `parts` แล้วเลือก renderer ตาม `type` | จุดสำคัญ: ห้ามฝังชื่อ tool |
| `TextPart.svelte` | ข้อความธรรมดา + caret ขณะ stream | |
| `Markdown.svelte` | render markdown + sanitize | ใช้ `message-prose` จาก layout.css |
| `ToolCallPart.svelte` | ชื่อ tool / argument / ผลลัพธ์ / สถานะ running-done-error | ยุบ-ขยายได้, แสดง JSON ด้วย `font-mono` |
| `ReasoningPart.svelte` | ส่วนคิด (ถ้าเปิด `sendReasoning`) | ยุบไว้เป็นค่าเริ่มต้น |
| `SourcePart.svelte` | ลิงก์อ้างอิง (ถ้าเปิด `sendSources`) | |
| `FallbackPart.svelte` | part ชนิดที่ยังไม่รองรับ | แสดง JSON ดิบ ไม่ให้ข้อมูลหายเงียบ |
| `MessageError.svelte` | แสดง error ของรอบนั้น + ปุ่มลองใหม่ | ใช้ `onError` ของ `Chat` |
| `EmptyChat.svelte` | หน้าแชทว่าง + ตัวอย่างคำถาม | ตัวอย่างดึงจาก prompts ได้ |

## 4. Composer (6 ตัว)

| Component | หน้าที่ | หมายเหตุ |
| --- | --- | --- |
| `Composer.svelte` | รวม textarea + ปุ่ม + error, จัดการ submit/abort | ต่อกับ `/api/chat` เดิม |
| `AutoGrowTextarea.svelte` | ยืดตามเนื้อหา, Enter ส่ง, Shift+Enter ขึ้นบรรทัด | ต้อง IME-safe สำหรับภาษาไทย (compositionstart/end) |
| `SendButton.svelte` | เปลี่ยนเป็นปุ่มหยุดตาม `chat.status` | disabled เมื่อว่าง |
| `ModelPicker.svelte` | เลือก provider + model | ข้อมูลจากตาราง `providers` |
| `ToolPicker.svelte` | เปิด/ปิด tool และบอกว่า router เลือกอะไร | รับผล decision กลับมาแสดง (ต้องเก็บ metadata) |
| `ComposerNote.svelte` | ข้อความช่วยเหลือ/คำเตือน (เช่น ยังไม่ตั้งค่า provider) | |

## 5. Settings / Agent / Project (10 ตัว)

| Component | หน้าที่ |
| --- | --- |
| `SettingsSection.svelte` | กรอบมาตรฐาน: หัวข้อ + คำอธิบาย + เนื้อหา |
| `ProviderCard.svelte` / `ProviderForm.svelte` | เพิ่ม/แก้ endpoint+key+model, ปุ่มทดสอบเชื่อมต่อ |
| `PromptEditor.svelte` | แก้ system prompt + ตัวแปรที่แทนได้ |
| `StyleEditor.svelte` | ปรับ token (สีแบรนด์, มุม, ความกว้าง sidebar, ความหนาแน่น) พร้อม preview สด |
| `LayoutSettings.svelte` | โหมดกะทัดรัด, เปิด/ปิด sidebar, ตำแหน่ง composer |
| `AgentCard.svelte` / `AgentForm.svelte` | กำหนด agent (model, tools, prompt, style) |
| `ProjectCard.svelte` / `ProjectForm.svelte` | จัดกลุ่มแชท/agent |
| `ChatList.svelte` / `ChatListItem.svelte` | รายการแชทแบบเต็ม (ใช้ทั้ง sidebar และหน้า `/chat`) |

## 6. Primitives ที่ต้องมี (12 ตัว)

| Component | ใช้ทำอะไร |
| --- | --- |
| `Icon.svelte` | ห่อ lucide + ขนาด/สีจาก surface |
| `Button.svelte` | variant primary / ghost / danger, size, loading |
| `IconButton.svelte` | ปุ่มไอคอน (บังคับ `aria-label`) |
| `Input.svelte`, `Textarea.svelte`, `Select.svelte`, `Switch.svelte` | ฟอร์มทั้งหมด |
| `Dialog.svelte` | ยืนยันการลบ ฯลฯ (ต้องมี focus trap) |
| `Dropdown.svelte` | เมนู `...` ของ SidebarItem |
| `Tabs.svelte` | หน้า settings ที่มีหลายหมวด |
| `Badge.svelte`, `Spinner.svelte`, `Skeleton.svelte` | สถานะโหลด/ป้ายกำกับ |
| `EmptyState.svelte`, `ErrorNote.svelte`, `Toast.svelte` + store | แจ้งผลการทำงาน |

ทางเลือกที่ต้องตัดสิน: `Dialog` / `Dropdown` / `Tabs` เขียนเอง (ต้องทำ focus trap, aria, คีย์บอร์ดเอง) หรือใช้ **shadcn-svelte (bits-ui)** ซึ่งโปรเจกต์เป็น Svelte 5 + Tailwind 4 อยู่แล้วจึงเข้าคู่กันได้ทันที — ประหยัดงาน a11y และคุมหน้าตาผ่าน token เดิมได้เหมือนกัน

## 7. ฝั่ง server ที่ต้องเพิ่ม

| ไฟล์ | หน้าที่ |
| --- | --- |
| `+layout.server.ts` | ผู้ใช้ + settings (ธีม, ความหนาแน่น, sidebar) + รายการ sidebar |
| `app.html` | inline script resolve `data-theme` ก่อน paint (กันจอวาบ) |
| `$lib/server/settings.ts` | อ่าน/เขียน settings ของผู้ใช้ |
| `$lib/server/providers.ts`, `prompts.ts`, `agents.ts`, `projects.ts` | CRUD + ทดสอบการเชื่อมต่อ provider |
| migration ชุดถัดไป | `settings`, `styles`, `providers`, `prompts`, `agents`, `projects` + RLS |
| remote functions | งานที่ต้องอัปเดต UI ทันที (rename, สลับ tool, บันทึก style) |

## 8. ลำดับการสร้างที่แนะนำ

1. primitives ชุดแรก: `Icon`, `Button`, `IconButton`, `Input`, `AutoGrowTextarea`
2. `+layout.server.ts` + `app.html` (ธีม) + `AppShell` + `Sidebar`
3. `MessageList` → `Message` → `MessageParts` → `TextPart` + `ToolCallPart`
4. `Composer` + `ModelPicker` + `SendButton`
5. ย้ายหน้าปัจจุบัน `/chat`, `/chat/[id]`, `/` มาใช้ shell เดียวกัน
6. `settings/*`, `/agent`, `/project` (ต้องมีตารางก่อน)

## 9. ยังไม่ต้องทำตอนนี้ (YAGNI)

virtualization ของ message list (รอจนเกิน ~500 ข้อความ), แนบไฟล์/รูป, เสียง, แชร์ลิงก์สาธารณะ, drag-drop เรียงรายการ, editor ธีมเต็มรูปแบบ (แค่ light/dark + token ไม่กี่ตัวที่ผู้ใช้ปรับได้)

รวมทั้งหมดประมาณ **48 component** แบ่งเป็น shell/sidebar 9, messages 11, composer 6, settings/agent/project 10, primitives 12
