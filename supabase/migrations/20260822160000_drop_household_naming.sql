-- Drop Household naming: Nest defaults + rename RPC

update public.nests
set name = 'Nest'
where name = 'Household';

update public.locales
set name = 'Nest Locale'
where name = 'Household Locale'
   or name like 'Household %';

alter table public.nests
  alter column name set default 'Nest';

create or replace function public.create_nest(p_invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nest uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.nests (name, invite_token_hash)
  values ('Nest', p_invite_token_hash)
  returning id into nest;

  insert into public.nest_members (nest_id, user_id, role)
  values (nest, uid, 'owner');

  return nest;
end;
$$;

grant execute on function public.create_nest(text) to authenticated;

drop function if exists public.create_household_nest(text);
