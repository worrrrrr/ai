-- เพิ่ม 2 คอลัมน์สำหรับ "รูปแบบ" และ "วิธีย่อ" ของแถบด้านข้าง (ต่อจาก 0002_settings.sql)
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้)
--
-- ก่อนหน้านี้สองค่านี้เก็บอยู่แค่ในคุกกี้ (ซึ่งเป็นแหล่งหลักอยู่แล้ว) ตอนนี้เก็บลงตารางด้วย
-- เพื่อให้ค่าติดไปทุกเครื่องที่ล็อกอิน — ลำดับการทับยังเป็น cookie → ตาราง → ค่าเริ่มต้น

alter table public.user_settings
  add column if not exists sidebar_variant text not null default 'sidebar'
    check (sidebar_variant in ('sidebar', 'floating', 'inset')),
  add column if not exists sidebar_collapsible text not null default 'offcanvas'
    check (sidebar_collapsible in ('offcanvas', 'icon', 'none'));
