-- ทีมถาวรของเอเจนต์ (แบบ Agent Teams ของ DSH): ตั้งชื่อทีม เลือกสมาชิก ติ๊กหัวหน้า แล้วเรียกซ้ำได้
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
--
-- เหตุผลเดียวกับ 0005: ตารางใน DB นี้ใช้ชนิดคีย์ไม่เหมือนกัน จึงไม่ประกาศ FK ให้ agent_id
-- (เก็บเป็น text แล้วให้ชั้นแอปตรวจการมีอยู่จริงของเอเจนต์ — กัน error 42804)

create table if not exists public.agent_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_teams_name_not_blank check (length(btrim(name)) between 1 and 60)
);

create table if not exists public.agent_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.agent_teams (id) on delete cascade,
  -- อ้าง agents.id เป็น text (ไม่ประกาศ FK ด้วยเหตุผลด้านบน)
  agent_id text not null,
  is_lead boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists agent_teams_user_idx on public.agent_teams (user_id, created_at desc);
create index if not exists agent_team_members_team_idx on public.agent_team_members (team_id, sort_order);

alter table public.agent_teams enable row level security;
alter table public.agent_team_members enable row level security;

drop policy if exists "agent teams are owned by their user" on public.agent_teams;
create policy "agent teams are owned by their user" on public.agent_teams
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- สมาชิกไม่มีคอลัมน์เจ้าของเอง → อ่านสิทธิ์จากทีมแม่
drop policy if exists "agent team members follow their team" on public.agent_team_members;
create policy "agent team members follow their team" on public.agent_team_members
  for all
  to authenticated
  using (
    exists (select 1 from public.agent_teams t where t.id = team_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.agent_teams t where t.id = team_id and t.user_id = auth.uid())
  );
