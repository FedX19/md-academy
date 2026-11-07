-- Additive MD Academy authoring permissions and role checks, restricted to verified admins/editors.
-- No public writes; regular coach enrollments remain explicitly assigned.
create or replace function public.academy_can_author()
returns boolean language sql stable security invoker set search_path=public
as $$
  select (select auth.uid()) is not null and
  (exists (
     select 1 from public.profiles p
     where p.id=(select auth.uid()) and
      (p.org_role='platform_admin' or p.is_platform_admin is true)
  ) or exists (
     select 1 from public.academy_admin_roles a
     where a.user_id=(select auth.uid()) and a.role in ('admin','editor')
  ));
$$;
create or replace function public.academy_can_publish()
returns boolean language sql stable security invoker set search_path=public
as $$
  select (select auth.uid()) is not null and
  (exists (
     select 1 from public.profiles p
     where p.id=(select auth.uid()) and
      (p.org_role='platform_admin' or p.is_platform_admin is true)
  ) or exists (
     select 1 from public.academy_admin_roles a
     where a.user_id=(select auth.uid()) and a.role='admin'
  ));
$$;
revoke all on function public.academy_can_author() from public,anon;
revoke all on function public.academy_can_publish() from public,anon;
grant execute on function public.academy_can_author() to authenticated;
grant execute on function public.academy_can_publish() to authenticated;

create policy academy_course_author_insert on public.academy_courses
for insert to authenticated with check (public.academy_can_author() and status='draft');
create policy academy_course_author_update on public.academy_courses
for update to authenticated using (
 public.academy_can_publish() or (public.academy_can_author() and status in ('draft','review'))
) with check (
 public.academy_can_publish() or (public.academy_can_author() and status in ('draft','review'))
);

create policy academy_module_author_insert on public.academy_modules
for insert to authenticated with check (
 public.academy_can_author() and exists (
   select 1 from public.academy_courses c where c.id=course_id
   and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_module_author_update on public.academy_modules
for update to authenticated using (
 public.academy_can_author() and exists (
   select 1 from public.academy_courses c where c.id=course_id
   and (c.status in ('draft','review') or public.academy_can_publish())
 )
) with check (
 public.academy_can_author() and exists (
   select 1 from public.academy_courses c where c.id=course_id
   and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_lesson_author_insert on public.academy_lessons
for insert to authenticated with check (
 public.academy_can_author() and exists (
   select 1 from public.academy_modules m
   join public.academy_courses c on c.id=m.course_id
   where m.id=module_id and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_lesson_author_update on public.academy_lessons
for update to authenticated using (
 public.academy_can_author() and exists (
   select 1 from public.academy_modules m
   join public.academy_courses c on c.id=m.course_id
   where m.id=module_id and (c.status in ('draft','review') or public.academy_can_publish())
 )
) with check (
 public.academy_can_author() and exists (
   select 1 from public.academy_modules m
   join public.academy_courses c on c.id=m.course_id
   where m.id=module_id and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_asset_author_insert on public.academy_media_assets
for insert to authenticated with check (
 public.academy_can_author()
 and storage_path ~ '^courses/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm)$'
);
create policy academy_media_upload on storage.objects
for insert to authenticated with check (
 bucket_id='md-academy-private'
 and public.academy_can_author()
 and exists (
   select 1 from public.academy_media_assets a
   where a.storage_path=name
 )
);

create policy academy_enrollment_admin_insert on public.academy_enrollments
for insert to authenticated with check (public.academy_can_publish());
create policy academy_enrollment_admin_update on public.academy_enrollments
for update to authenticated using (public.academy_can_publish())
with check (public.academy_can_publish());
