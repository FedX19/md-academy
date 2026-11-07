-- Resolve an exact, verified UniteHQ coach email to a user ID without exposing the user directory.
create or replace function public.academy_lookup_user(p_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_id uuid;
  v_name text;
begin
  if (select auth.uid()) is null or not public.academy_can_publish() then
    raise exception 'Academy administrator required' using errcode='42501';
  end if;
  if length(v_email)>254 or v_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' then
    raise exception 'Invalid coach email' using errcode='22023';
  end if;
  select u.id,coalesce(nullif(p.full_name,''),u.email) into v_id,v_name
  from auth.users u left join public.profiles p on p.id=u.id
  where lower(u.email)=v_email and u.email_confirmed_at is not null
  limit 1;
  if v_id is null then return null; end if;
  return jsonb_build_object('id',v_id,'name',v_name);
end $$;
revoke all on function public.academy_lookup_user(text) from public,anon;
grant execute on function public.academy_lookup_user(text) to authenticated;
