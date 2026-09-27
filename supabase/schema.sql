create table if not exists public.love_memories (
  kind text not null check (kind in ('firsts', 'plans', 'capsules', 'daily', 'wheel', 'cities')),
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

-- 已有项目重复执行本文件时，把旧的 kind 约束升级为包含 cities
alter table public.love_memories drop constraint if exists love_memories_kind_check;
alter table public.love_memories add constraint love_memories_kind_check
  check (kind in ('firsts', 'plans', 'capsules', 'daily', 'wheel', 'cities'));

alter table public.love_memories enable row level security;
revoke all on table public.love_memories from anon, authenticated;
grant select, insert, update, delete on table public.love_memories to service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'love-photos',
      'love-photos',
      false,
      2097152,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  else
    raise notice 'Storage 尚未初始化，请在 Supabase Storage 页面手动创建私有桶 love-photos';
  end if;
end $$;

-- 不创建 anon/authenticated 策略。所有访问均由持有 service_role 的
-- Netlify Function 完成，浏览器无法直接读取数据库或照片。
