-- ตารางเพิ่มสำหรับงาน settings (2026-10-14)
--
-- บริบทสำคัญ: schema จริงของโปรเจกต์ Supabase `aaii` (ref gozxohjfseacplnwgtbn) มีอยู่แล้ว
--   profiles(id = auth.users.id), chats(owner_id -> profiles.id), chat_messages(content/reasoning/...),
--   prompts(title/body/icon/deleted_at), provider_credentials(label/base_url/models/key_hint/key_sealed)
-- ไฟล์นี้จึงสร้าง "เฉพาะที่ยังไม่มี" 2 ตาราง: styles และ user_settings
-- (ตารางจริงไม่มีคอลัมน์ is_default → "ที่เลือกใช้อยู่" เก็บเป็นคอลัมน์ *_id ใน user_settings)
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
-- หลังรันแล้วให้สั่ง `pnpm gen:types` เพื่อให้ type ของ 2 ตารางนี้เข้ามาใน src/lib/database.types.ts

create table if not exists public.styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  brand_light text not null,
  brand_dark text not null,
  brand_strong_light text not null,
  brand_strong_dark text not null,
  brand_soft_light text not null,
  brand_soft_dark text not null,
  radius_panel text not null default '0.75rem',
  radius_control text not null default '0.5rem',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  sidebar_width text not null default '17rem',
  density numeric(3, 2) not null default 1 check (density >= 0.5 and density <= 2),
  column_max text not null default '46rem',
  sidebar_collapsed boolean not null default false,
  -- แกนเพิ่มเติมที่หน้า /settings/layout ใช้ (แสดงเป็นแผ่นไอคอน)
  sidebar_side text not null default 'left' check (sidebar_side in ('left', 'right')),
  font_scale numeric(3, 2) not null default 1 check (font_scale >= 0.8 and font_scale <= 1.3),
  style_id uuid references public.styles (id) on delete set null,
  prompt_id uuid references public.prompts (id) on delete set null,
  -- provider_credentials.id เป็น text (ไม่ใช่ uuid) — ดู docs/dev-notes.md §7
  provider_id text references public.provider_credentials (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists styles_user_id_idx on public.styles (user_id, created_at desc);
create index if not exists prompts_user_id_idx on public.prompts (user_id, created_at desc) where deleted_at is null;
create index if not exists provider_credentials_user_id_idx on public.provider_credentials (user_id, updated_at desc);

alter table public.styles enable row level security;
alter table public.user_settings enable row level security;

-- เจ้าของเท่านั้นที่อ่าน/เขียนได้ (auth.uid() มาจาก session ที่ hooks.server.ts สร้างให้)
drop policy if exists "styles are owned by their user" on public.styles;
create policy "styles are owned by their user" on public.styles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user settings are owned by their user" on public.user_settings;
create policy "user settings are owned by their user" on public.user_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
