-- MD Academy: isolated learning tables and private media. Additive only.
create extension if not exists pgcrypto;
create table if not exists public.academy_admin_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','editor')),
 created_at timestamptz not null default now()
);
create table if not exists public.academy_courses (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,71}$'),
 title text not null,
 summary text not null default '',
 audience text not null default 'mdc-coach' check (audience in ('mdc-coach','league-coach','parent','public')),
 status text not null default 'draft' check (status in ('draft','review','published','archived')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.academy_modules (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 title text not null,
 sort_order integer not null default 0 check (sort_order >= 0),
 unique(course_id,sort_order)
);
create table if not exists public.academy_media_assets (
 id uuid primary key default gen_random_uuid(),
 storage_path text not null unique,
 mime_type text not null check (mime_type in ('video/mp4','video/webm')),
 created_at timestamptz not null default now()
);
create table if not exists public.academy_lessons (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.academy_modules(id) on delete cascade,
 title text not null,
 summary text not null default '',
 lesson_type text not null default 'video' check (lesson_type in ('video','article','quiz')),
 body text not null default '',
 duration_seconds integer not null default 0 check (duration_seconds >= 0),
 media_asset_id uuid references public.academy_media_assets(id) on delete set null,
 sort_order integer not null default 0 check (sort_order >= 0),
 unique(module_id,sort_order)
);
create table if not exists public.academy_enrollments (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check (status in ('active','revoked','completed')),
 created_at timestamptz not null default now(),
 unique(course_id,user_id)
);
create table if not exists public.academy_lesson_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
 position_seconds integer not null default 0 check (position_seconds between 0 and 86400),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,lesson_id)
);
create index if not exists academy_modules_course_idx on public.academy_modules(course_id,sort_order);
create index if not exists academy_lessons_module_idx on public.academy_lessons(module_id,sort_order);
create index if not exists academy_enrollments_user_idx on public.academy_enrollments(user_id,status);
create index if not exists academy_lessons_asset_idx on public.academy_lessons(media_asset_id);
alter table public.academy_admin_roles enable row level security;
alter table public.academy_courses enable row level security;
alter table public.academy_modules enable row level security;
alter table public.academy_media_assets enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_lesson_progress enable row level security;
create policy academy_role_self_read on public.academy_admin_roles for select to authenticated using (user_id = (select auth.uid()));
create policy academy_enrollment_read on public.academy_enrollments for select to authenticated using (
 user_id = (select auth.uid())
 or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and (p.org_role='platform_admin' or p.is_platform_admin = true))
 or exists (select 1 from public.academy_admin_roles a where a.user_id=(select auth.uid()) and a.role='admin')
);
create policy academy_course_read on public.academy_courses for select to authenticated using (
 exists (select 1 from public.profiles p where p.id=(select auth.uid()) and (p.org_role='platform_admin' or p.is_platform_admin = true))
 or exists (select 1 from public.academy_admin_roles a where a.user_id=(select auth.uid()) and a.role in ('admin','editor'))
 or (status='published' and exists (
   select 1 from public.academy_enrollments e where e.course_id=id and e.user_id=(select auth.uid()) and e.status='active'
 ))
);
create policy academy_module_read on public.academy_modules for select to authenticated using (
 exists (select 1 from public.academy_courses c where c.id=course_id)
);
create policy academy_lesson_read on public.academy_lessons for select to authenticated using (
 exists (select 1 from public.academy_modules m where m.id=module_id)
);
create policy academy_media_read on public.academy_media_assets for select to authenticated using (
 exists (select 1 from public.academy_lessons l where l.media_asset_id=id)
);
create policy academy_progress_read on public.academy_lesson_progress for select to authenticated using (
 user_id=(select auth.uid())
 or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and (p.org_role='platform_admin' or p.is_platform_admin = true))
 or exists (select 1 from public.academy_admin_roles a where a.user_id=(select auth.uid()) and a.role='admin')
);
create policy academy_progress_insert on public.academy_lesson_progress for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (select 1 from public.academy_lessons l where l.id=lesson_id)
);
create policy academy_progress_update on public.academy_lesson_progress for update to authenticated using (
 user_id=(select auth.uid()) and exists (select 1 from public.academy_lessons l where l.id=lesson_id)
) with check (
 user_id=(select auth.uid()) and exists (select 1 from public.academy_lessons l where l.id=lesson_id)
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('md-academy-private','md-academy-private',false,314572800,array['video/mp4','video/webm'])
on conflict (id) do nothing;
create policy academy_private_media_read on storage.objects for select to authenticated using (
 bucket_id='md-academy-private' and exists (
  select 1 from public.academy_media_assets a where a.storage_path=name
 )
);
