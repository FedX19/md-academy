-- Publish is always a privileged, atomic operation, never a client-set status.
-- Checks course structure and actual private Storage objects.
create or replace function public.academy_publish_course(p_course_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  course_status text;
begin
  if (select auth.uid()) is null or not public.academy_can_publish() then
    raise exception 'Academy publishing requires an administrator' using errcode='42501';
  end if;
  select status into course_status from public.academy_courses where id=p_course_id for update;
  if course_status is null or course_status not in ('draft','review') then
    raise exception 'Only a draft or review course can be published' using errcode='22023';
  end if;
  if not exists (
     select 1 from public.academy_modules m
     join public.academy_lessons l on l.module_id=m.id
     where m.course_id=p_course_id
  ) then
    raise exception 'Course must include at least one lesson' using errcode='22023';
  end if;
  if exists (
    select 1 from public.academy_lessons l
    join public.academy_modules m on m.id=l.module_id
    left join public.academy_media_assets a on a.id=l.media_asset_id
    left join storage.objects o on o.bucket_id='md-academy-private' and o.name=a.storage_path
    where m.course_id=p_course_id and l.lesson_type='video'
    and (a.id is null or o.id is null)
  ) then
    raise exception 'Video lessons must have uploaded private media' using errcode='22023';
  end if;
  if exists (
    select 1 from public.academy_lessons l
    join public.academy_modules m on m.id=l.module_id
    where m.course_id=p_course_id and l.lesson_type='quiz'
    and not exists (select 1 from public.academy_quiz_questions q where q.lesson_id=l.id)
  ) then
    raise exception 'Every quiz lesson must include questions' using errcode='22023';
  end if;
  update public.academy_courses
  set status='published',published_at=now(),updated_at=now()
  where id=p_course_id;
  return found;
end;
$$;
revoke all on function public.academy_publish_course(uuid) from public,anon;
grant execute on function public.academy_publish_course(uuid) to authenticated;

-- Freeze published course content, including administrator edits, until a versioned edit flow exists.
drop policy if exists academy_course_author_update on public.academy_courses;
create policy academy_course_author_update on public.academy_courses for update to authenticated
using (public.academy_can_author() and status in ('draft','review'))
with check (public.academy_can_author() and status in ('draft','review'));
drop policy if exists academy_module_author_insert on public.academy_modules;
create policy academy_module_author_insert on public.academy_modules for insert to authenticated
with check (public.academy_can_author() and exists (
 select 1 from public.academy_courses c where c.id=course_id and c.status in ('draft','review')
));
drop policy if exists academy_module_author_update on public.academy_modules;
create policy academy_module_author_update on public.academy_modules for update to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_courses c where c.id=course_id and c.status in ('draft','review')
))
with check (public.academy_can_author() and exists (
 select 1 from public.academy_courses c where c.id=course_id and c.status in ('draft','review')
));
create policy academy_module_author_delete on public.academy_modules for delete to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_courses c where c.id=course_id and c.status in ('draft','review')
));
drop policy if exists academy_lesson_author_insert on public.academy_lessons;
create policy academy_lesson_author_insert on public.academy_lessons for insert to authenticated
with check (public.academy_can_author() and exists (
 select 1 from public.academy_modules m join public.academy_courses c on c.id=m.course_id
 where m.id=module_id and c.status in ('draft','review')
));
drop policy if exists academy_lesson_author_update on public.academy_lessons;
create policy academy_lesson_author_update on public.academy_lessons for update to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_modules m join public.academy_courses c on c.id=m.course_id
 where m.id=module_id and c.status in ('draft','review')
))
with check (public.academy_can_author() and exists (
 select 1 from public.academy_modules m join public.academy_courses c on c.id=m.course_id
 where m.id=module_id and c.status in ('draft','review')
));
create policy academy_lesson_author_delete on public.academy_lessons for delete to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_modules m join public.academy_courses c on c.id=m.course_id
 where m.id=module_id and c.status in ('draft','review')
));
drop policy if exists academy_quiz_author_insert on public.academy_quiz_questions;
create policy academy_quiz_author_insert on public.academy_quiz_questions for insert to authenticated
with check (public.academy_can_author() and jsonb_array_length(choices) between 2 and 6
 and correct_index < jsonb_array_length(choices) and exists (
 select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=lesson_id and l.lesson_type='quiz' and c.status in ('draft','review')
));
drop policy if exists academy_quiz_author_update on public.academy_quiz_questions;
create policy academy_quiz_author_update on public.academy_quiz_questions for update to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=lesson_id and c.status in ('draft','review')
))
with check (public.academy_can_author() and jsonb_array_length(choices) between 2 and 6
 and correct_index < jsonb_array_length(choices) and exists (
 select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=lesson_id and l.lesson_type='quiz' and c.status in ('draft','review')
));
create policy academy_quiz_author_delete on public.academy_quiz_questions for delete to authenticated
using (public.academy_can_author() and exists (
 select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=lesson_id and c.status in ('draft','review')
));
