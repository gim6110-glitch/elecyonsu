-- v9: training/meeting registration types.
-- Applied to the linked elecyonsu Supabase database on 2026-11-04.
-- Non-destructive: existing records remain training registrations.
alter table public.trainings
  add column if not exists registration_type text not null default 'training';

alter table public.trainings
  drop constraint if exists trainings_registration_type_check;
alter table public.trainings
  add constraint trainings_registration_type_check
  check (registration_type in ('training','meeting'));

create or replace function public.public_registration(p_token uuid)
returns table(title text,when_text text,place text,enabled boolean,registration_type text)
language sql security definer set search_path='' as $$
  select t.title,t.when_text,t.place,t.enabled,t.registration_type
  from public.trainings t where t.token=p_token limit 1
$$;

revoke all on function public.public_registration(uuid) from public,anon,authenticated;
grant execute on function public.public_registration(uuid) to anon,authenticated;
notify pgrst, 'reload schema';
