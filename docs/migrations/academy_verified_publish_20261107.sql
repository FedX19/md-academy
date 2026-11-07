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
  update public.academy_courses
  set status='published',published_at=now(),updated_at=now()
  where id=p_course_id;
  return found;
end;
$$;
revoke all on function public.academy_publish_course(uuid) from public,anon;
grant execute on function public.academy_publish_course(uuid) to authenticated;
