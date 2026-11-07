
-- Secure quiz grading and internal course-completion certificates.
alter table public.academy_courses add column if not exists passing_score_pct integer not null default 80 check (passing_score_pct between 1 and 100);

create table if not exists public.academy_quiz_questions (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
 prompt text not null check (char_length(prompt) between 1 and 800),
 choices jsonb not null check (jsonb_typeof(choices)='array'),
 correct_index integer not null check (correct_index between 0 and 5),
 explanation text not null default '',
 sort_order integer not null default 0 check (sort_order >= 0),
 unique(lesson_id,sort_order)
);
create table if not exists public.academy_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
 score_pct integer not null check (score_pct between 0 and 100),
 passed boolean not null,
 submitted_at timestamptz not null default now()
);
create index if not exists academy_quiz_attempts_lookup on public.academy_quiz_attempts(user_id,lesson_id,submitted_at desc);
create table if not exists public.academy_certificates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 verification_code text not null unique default upper(encode(gen_random_bytes(12),'hex')),
 issued_at timestamptz not null default now(),
 unique(user_id,course_id)
);
alter table public.academy_quiz_questions enable row level security;
alter table public.academy_quiz_attempts enable row level security;
alter table public.academy_certificates enable row level security;

-- Answers cannot be fetched by learners from PostgREST.
create policy academy_quiz_author_select on public.academy_quiz_questions
 for select to authenticated using (public.academy_can_author());
create policy academy_quiz_author_insert on public.academy_quiz_questions
 for insert to authenticated with check (
 public.academy_can_author() and jsonb_array_length(choices) between 2 and 6
 and correct_index < jsonb_array_length(choices)
 and exists (
  select 1 from public.academy_lessons l
  join public.academy_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and l.lesson_type='quiz'
  and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_quiz_author_update on public.academy_quiz_questions
 for update to authenticated using (
 public.academy_can_author() and exists (
  select 1 from public.academy_lessons l
  join public.academy_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and (c.status in ('draft','review') or public.academy_can_publish())
 )
) with check (
 public.academy_can_author() and jsonb_array_length(choices) between 2 and 6
 and correct_index < jsonb_array_length(choices)
 and exists (
  select 1 from public.academy_lessons l
  join public.academy_modules m on m.id=l.module_id
  join public.academy_courses c on c.id=m.course_id
  where l.id=lesson_id and l.lesson_type='quiz'
  and (c.status in ('draft','review') or public.academy_can_publish())
 )
);
create policy academy_quiz_attempts_self_read on public.academy_quiz_attempts
 for select to authenticated using (
 user_id=(select auth.uid()) or public.academy_can_publish()
);
create policy academy_certificates_self_read on public.academy_certificates
 for select to authenticated using (
 user_id=(select auth.uid()) or public.academy_can_publish()
);

-- Strictly enforced in database, not via a client-supplied quiz score.
create or replace function public.academy_get_quiz(p_lesson_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := (select auth.uid());
 v_course uuid;
 v_status text;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select c.id,c.status into v_course,v_status
 from public.academy_lessons l
 join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=p_lesson_id and l.lesson_type='quiz';
 if v_course is null or
    not (public.academy_can_author() or
       (v_status='published' and exists(
         select 1 from public.academy_enrollments e
         where e.user_id=v_user and e.course_id=v_course and e.status='active'
       ))) then raise exception 'Quiz unavailable' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(
    jsonb_build_object('id',q.id,'prompt',q.prompt,'choices',q.choices)
    order by q.sort_order,q.id
  ),'[]'::jsonb)
  from public.academy_quiz_questions q where q.lesson_id=p_lesson_id);
end $$;

create or replace function public.academy_grade_quiz(p_lesson_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := (select auth.uid());
 v_course uuid;
 v_pass_pct integer;
 v_count integer:=0;
 v_correct integer:=0;
 v_answer text;
 v_score integer;
 v_passed boolean;
 q record;
begin
 if v_user is null or jsonb_typeof(p_answers)<>'object' then
   raise exception 'Invalid quiz submission' using errcode='22023';
 end if;
 select c.id,c.passing_score_pct into v_course,v_pass_pct
 from public.academy_lessons l
 join public.academy_modules m on m.id=l.module_id
 join public.academy_courses c on c.id=m.course_id
 where l.id=p_lesson_id and l.lesson_type='quiz' and c.status='published';
 if v_course is null or not exists(
   select 1 from public.academy_enrollments e
   where e.user_id=v_user and e.course_id=v_course and e.status='active'
 ) then raise exception 'Active Academy enrollment required' using errcode='42501'; end if;
 if (select count(*) from public.academy_quiz_attempts
   where user_id=v_user and lesson_id=p_lesson_id and submitted_at>now()-interval '24 hours')>=10
 then raise exception 'Quiz attempt limit reached' using errcode='22023'; end if;
 for q in select id,choices,correct_index from public.academy_quiz_questions
   where lesson_id=p_lesson_id order by sort_order,id
 loop
   v_count:=v_count+1;
   v_answer:=p_answers->>(q.id::text);
   if v_answer is null or v_answer !~ '^[0-9]$'
      or (v_answer::integer)>=jsonb_array_length(q.choices)
   then raise exception 'Answer every question with a valid choice' using errcode='22023'; end if;
   if v_answer::integer=q.correct_index then v_correct:=v_correct+1; end if;
 end loop;
 if v_count=0 then raise exception 'Quiz contains no questions' using errcode='22023'; end if;
 v_score:=floor(100.0*v_correct/v_count)::integer;
 v_passed:=v_score>=v_pass_pct;
 insert into public.academy_quiz_attempts(user_id,lesson_id,score_pct,passed)
 values(v_user,p_lesson_id,v_score,v_passed);
 if v_passed then
   insert into public.academy_lesson_progress(user_id,lesson_id,position_seconds,completed_at,updated_at)
   values(v_user,p_lesson_id,0,now(),now())
   on conflict (user_id,lesson_id) do update
   set completed_at=coalesce(public.academy_lesson_progress.completed_at,excluded.completed_at),
       updated_at=now();
 end if;
 return jsonb_build_object('scorePct',v_score,'passed',v_passed,'requiredPct',v_pass_pct,'questionCount',v_count);
end $$;

create or replace function public.academy_issue_certificate(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := (select auth.uid());
 v_code text;
 v_issued timestamptz;
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
 insert into public.academy_certificates(user_id,course_id)
 values(v_user,p_course_id)
 on conflict (user_id,course_id) do nothing;
 select verification_code,issued_at into v_code,v_issued
 from public.academy_certificates where user_id=v_user and course_id=p_course_id;
 return jsonb_build_object('verificationCode',v_code,'issuedAt',v_issued);
end $$;

-- Preserve completion when concurrent background progress saves arrive after a completed event.
create or replace function public.academy_preserve_completion()
returns trigger language plpgsql as $$
begin
 if old.completed_at is not null then
   new.completed_at := old.completed_at;
 end if;
 return new;
end $$;
drop trigger if exists academy_keep_completion on public.academy_lesson_progress;
create trigger academy_keep_completion
before update on public.academy_lesson_progress
for each row execute function public.academy_preserve_completion();

revoke all on function public.academy_get_quiz(uuid) from public,anon;
revoke all on function public.academy_grade_quiz(uuid,jsonb) from public,anon;
revoke all on function public.academy_issue_certificate(uuid) from public,anon;
grant execute on function public.academy_get_quiz(uuid) to authenticated;
grant execute on function public.academy_grade_quiz(uuid,jsonb) to authenticated;
grant execute on function public.academy_issue_certificate(uuid) to authenticated;
