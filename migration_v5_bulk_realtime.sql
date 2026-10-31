-- elecyonsu v5: atomic bulk registration and live updates.
-- Run ONCE (can be run again safely) in Supabase SQL Editor.
-- Prerequisite: migration_20261030_no_code_templates.sql (v4) has run.
create or replace function public.add_participants_batch(
 p_training uuid, p_rows jsonb
) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;v_base integer;
begin
 if auth.uid() is null or not exists (
  select 1 from public.trainings t where t.id=p_training and t.owner_id=auth.uid()
 ) then raise exception '이 연수의 참석자를 등록할 권한이 없습니다'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then
  raise exception '명단은 배열이어야 합니다';end if;
 v_count=jsonb_array_length(p_rows);
 if v_count<1 or v_count>200 then raise exception '한 번에 1~200명만 등록 가능합니다';end if;
 if exists(
  select 1 from jsonb_array_elements(p_rows) r
  where jsonb_typeof(r)<>'object'
    or length(trim(coalesce(r->>'full_name','')))<1
    or length(trim(coalesce(r->>'full_name','')))>120
    or length(trim(coalesce(r->>'position','')))<1
    or length(trim(coalesce(r->>'position','')))>100
 ) then raise exception '명단에 빈 성명·직급 또는 너무 긴 값이 있습니다';end if;
 -- Prevent concurrent imports from reusing the same sort_order.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_training::text));
 select coalesce(max(p.sort_order),0) into v_base
 from public.participants p where p.training_id=p_training;
 insert into public.participants(training_id,position,full_name,sort_order)
 select p_training,trim(v.item->>'position'),trim(v.item->>'full_name'),v_base+v.idx::integer
 from pg_catalog.jsonb_array_elements(p_rows) with ordinality as v(item,idx);
 return v_count;
end $$;
revoke all on function public.add_participants_batch(uuid,jsonb) from public,anon;
grant execute on function public.add_participants_batch(uuid,jsonb) to authenticated;

create or replace function public.get_training_summaries()
returns table(training_id uuid, total_count bigint, signed_count bigint)
language sql security invoker set search_path='' as $$
 select t.id,count(p.id),count(p.signed_at)
 from public.trainings t left join public.participants p on p.training_id=t.id
 where t.owner_id=auth.uid()
 group by t.id;
$$;
revoke all on function public.get_training_summaries() from public,anon;
grant execute on function public.get_training_summaries() to authenticated;

-- Realtime: the client subscribes to participant inserts/updates/deletes scoped by training_id.
-- The realtime publication needs the table exactly once.
do $realtime$
begin
 if not exists(select 1 from pg_catalog.pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='participants') then
  alter publication supabase_realtime add table public.participants;
 end if;
end $realtime$;
