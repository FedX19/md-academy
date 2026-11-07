-- Snapshot certificate display at issuance; existing completions remain immutable.
alter table public.academy_certificates
  add column if not exists course_title text not null default '',
  add column if not exists learner_name text not null default '';
create or replace function public.academy_issue_certificate(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := (select auth.uid());
 v_code text;
 v_issued timestamptz;
 v_course_title text;
 v_learner_name text;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not exists (
   select 1 from public.academy_courses c
   join public.academy_enrollments e on e.course_id=c.id
   where c.id=p_course_id and c.status='published'
    and e.user_id=v_user and e.status='active'
 ) then raise exception 'Enrollment required' using errcode='42501'; end if;
 if not exists (
   select 1 from public.academy_lessons l
   join public.academy_modules m on m.id=l.module_id
   where m.course_id=p_course_id
 ) then raise exception 'Course is empty' using errcode='22023'; end if;
 if exists (
   select 1 from public.academy_lessons l
   join public.academy_modules m on m.id=l.module_id
   left join public.academy_lesson_progress p on p.lesson_id=l.id and p.user_id=v_user
   where m.course_id=p_course_id and p.completed_at is null
 ) then raise exception 'Course lessons are incomplete' using errcode='22023'; end if;
 if exists (
   select 1 from public.academy_lessons l
   join public.academy_modules m on m.id=l.module_id
   where m.course_id=p_course_id and l.lesson_type='quiz'
   and not exists(
     select 1 from public.academy_quiz_attempts a
     where a.user_id=v_user and a.lesson_id=l.id and a.passed
   )
 ) then raise exception 'Required assessments not passed' using errcode='22023'; end if;
 select c.title,coalesce(nullif(p.full_name,''),'MDC Coach') into v_course_title,v_learner_name
 from public.academy_courses c
 left join public.profiles p on p.id=v_user
 where c.id=p_course_id;
 insert into public.academy_certificates(user_id,course_id,course_title,learner_name)
 values(v_user,p_course_id,v_course_title,v_learner_name)
 on conflict (user_id,course_id) do nothing;
 select verification_code,issued_at into v_code,v_issued
 from public.academy_certificates where user_id=v_user and course_id=p_course_id;
 return jsonb_build_object('verificationCode',v_code,'issuedAt',v_issued,'courseTitle',v_course_title,'learnerName',v_learner_name);
end $$;


