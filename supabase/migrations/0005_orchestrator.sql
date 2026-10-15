-- ตารางสำหรับ AI Agent Orchestrator (โหมด A: วางแผน → ยิงขนาน → หัวหน้ารวม)
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
--
-- หมายเหตุสำคัญเรื่องชนิดคีย์ (บทเรียนจาก error 42804 ตอนรัน 0002):
-- ตารางในฐานข้อมูลนี้ใช้ชนิดคีย์ไม่เหมือนกัน (บางตาราง uuid บางตาราง text)
-- จึง **ไม่ประกาศ foreign key** ให้คอลัมน์ที่ชี้ไป `agents`/`chats` — เก็บเป็น text
-- แล้วให้ชั้นแอปตรวจการมีอยู่จริง (แชทถูกลบแบบ soft delete อยู่แล้วจึงไม่มีแถวกำพร้า)

create table if not exists public.orchestrations (
  id uuid primary key default gen_random_uuid(),
  -- แชทที่รอบนี้สังกัด (แชทลบแบบ soft delete จึงไม่ต้อง cascade)
  chat_id text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- คำถามตั้งต้นของรอบนี้
  prompt text not null,
  -- เอเจนต์หัวหน้าที่รวมคำตอบ (อ้าง agents.id เป็น text)
  lead_agent_id text,
  status text not null default 'planning'
    check (status in ('planning', 'running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orchestration_steps (
  id uuid primary key default gen_random_uuid(),
  orchestration_id uuid not null references public.orchestrations (id) on delete cascade,
  -- อ้าง agents.id เป็น text (ไม่ประกาศ FK ด้วยเหตุผลข้างบน)
  agent_id text,
  agent_name text not null default '',
  -- plan = แผนของหัวหน้า · answer = คำตอบของแต่ละเอเจนต์ · merge = คำตอบรวม
  kind text not null check (kind in ('plan', 'answer', 'merge')),
  content text not null default '',
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists orchestrations_user_id_idx
  on public.orchestrations (user_id, created_at desc);
create index if not exists orchestrations_chat_id_idx
  on public.orchestrations (chat_id, created_at desc);
create index if not exists orchestration_steps_orchestration_idx
  on public.orchestration_steps (orchestration_id, created_at);

alter table public.orchestrations enable row level security;
alter table public.orchestration_steps enable row level security;

drop policy if exists "orchestrations are owned by their user" on public.orchestrations;
create policy "orchestrations are owned by their user" on public.orchestrations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ขั้นต่าง ๆ ไม่มีคอลัมน์เจ้าของเอง → อ่านสิทธิ์จากรอบแม่
drop policy if exists "orchestration steps follow their orchestration" on public.orchestration_steps;
create policy "orchestration steps follow their orchestration" on public.orchestration_steps
  for all
  to authenticated
  using (
    exists (
      select 1 from public.orchestrations o
      where o.id = orchestration_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.orchestrations o
      where o.id = orchestration_id and o.user_id = auth.uid()
    )
  );
