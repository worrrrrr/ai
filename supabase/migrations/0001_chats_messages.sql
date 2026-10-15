-- ⚠️ ห้ามรันไฟล์นี้ — เป็นแบบร่างรุ่นแรก (2026-10-14) ที่ไม่ตรงกับฐานข้อมูลจริง
--
-- ฐานข้อมูลจริงของโปรเจกต์ (`aaii`, ref gozxohjfseacplnwgtbn) ใช้
--   chats(id, owner_id -> profiles.id, title, icon, pinned, project_id, deleted_at, ...)
--   chat_messages(id, chat_id, user_id, role, content, reasoning, model, provider, tokens, duration_ms, ...)
-- คือเก็บข้อความเป็นข้อความแบน (content + reasoning) ไม่ใช่ `parts jsonb` และเจ้าของคือ `owner_id`
-- ไม่ใช่ `user_id`; ไม่มีตาราง `messages` ในฐานข้อมูล
--
-- เก็บไฟล์นี้ไว้เป็นประวัติการตัดสินใจเท่านั้น — source of truth คือ schema จริงในโปรเจกต์ Supabase
-- (ดู type ที่ generate ได้ที่ src/lib/database.types.ts)

-- ประวัติแชทของผู้ใช้แต่ละคน
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์ -> Run

create table if not exists public.chats (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'แชทใหม่',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  chat_id text not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_id_updated_at_idx
  on public.chats (user_id, updated_at desc);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);

alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- เจ้าของเท่านั้นที่อ่าน/เขียนได้ (auth.uid() มาจาก session ที่ hooks.server.ts สร้างให้)
drop policy if exists "chats are owned by their user" on public.chats;
create policy "chats are owned by their user" on public.chats
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "messages are owned by their user" on public.messages;
create policy "messages are owned by their user" on public.messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
