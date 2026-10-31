-- 전자 연수등록부. 새 Supabase 프로젝트 SQL Editor에서 1회 실행
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.trainings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null, when_text text not null default '', place text not null default '',
 page_size int not null default 30 check(page_size between 1 and 200),
 token uuid not null default gen_random_uuid() unique, enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.participants (
 id uuid primary key default gen_random_uuid(), training_id uuid not null references public.trainings(id) on delete cascade,
 position text not null default '교사', full_name text not null, sort_order int not null default 0,
 access_hash text not null, signed_at timestamptz, signature_data text,
 created_at timestamptz not null default now()
);
create index if not exists participants_training_idx on public.participants(training_id,sort_order);
create table if not exists public.templates (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null, kind text not null check(kind in ('pdf','xlsx')),
 file_data text not null, mapping jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id bigint generated always as identity primary key, owner_id uuid references auth.users(id),
 training_id uuid references public.trainings(id) on delete set null,
 event text not null, created_at timestamptz not null default now()
);
alter table public.trainings enable row level security;
alter table public.participants enable row level security;
alter table public.templates enable row level security;
alter table public.audit_logs enable row level security;
drop policy if exists own_training on public.trainings;
create policy own_training on public.trainings for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists own_participant on public.participants;
create policy own_participant on public.participants for all to authenticated
 using(exists(select 1 from public.trainings t where t.id=training_id and t.owner_id=auth.uid()))
 with check(exists(select 1 from public.trainings t where t.id=training_id and t.owner_id=auth.uid()));
drop policy if exists own_template on public.templates;
create policy own_template on public.templates for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists read_audit on public.audit_logs;
create policy read_audit on public.audit_logs for select to authenticated using(owner_id=auth.uid());
-- code is generated client side; crypt hashed server-side on create via RPC
create or replace function public.add_participant(p_training uuid,p_position text,p_name text,p_code text,p_order int)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.trainings where id=p_training and owner_id=auth.uid()) then raise exception '권한이 없습니다'; end if;
 if length(trim(p_name))<1 or length(p_name)>120 or length(p_code)<8 or length(p_code)>80 then raise exception '이름 또는 확인코드가 올바르지 않습니다'; end if;
 insert into public.participants(training_id,position,full_name,access_hash,sort_order)
 values(p_training,left(p_position,100),left(p_name,120),extensions.crypt(p_code,extensions.gen_salt('bf')),p_order) returning id into v_id;
 return v_id;
end $$;
create or replace function public.public_training(p_token uuid)
returns table(title text,when_text text,place text,enabled boolean)
language sql security definer set search_path='' as $$
 select t.title,t.when_text,t.place,t.enabled from public.trainings t where t.token=p_token limit 1
$$;
create or replace function public.submit_signature(p_token uuid,p_name text,p_code text,p_signature text)
returns text language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_training uuid;v_owner uuid;v_enabled bool;
begin
 if char_length(p_signature)>180000 or p_signature not like 'data:image/png;base64,%' then return 'INVALID_IMAGE'; end if;
 select id,owner_id,enabled into v_training,v_owner,v_enabled from public.trainings where token=p_token;
 if v_training is null or not v_enabled then return 'CLOSED';end if;
 select id into v_id from public.participants
 where training_id=v_training and full_name=trim(p_name) and access_hash=extensions.crypt(p_code,access_hash) limit 1;
 if v_id is null then return 'NO_MATCH'; end if;
 update public.participants set signed_at=now(),signature_data=p_signature where id=v_id and signed_at is null;
 if not found then return 'ALREADY'; end if;
 insert into public.audit_logs(owner_id,training_id,event) values(v_owner,v_training,'서명 제출');
 return 'OK';
end $$;
revoke all on function public.add_participant(uuid,text,text,text,int) from public,anon;
grant execute on function public.add_participant(uuid,text,text,text,int) to authenticated;
revoke all on function public.public_training(uuid) from public;
grant execute on function public.public_training(uuid) to anon,authenticated;
revoke all on function public.submit_signature(uuid,text,text,text) from public;
grant execute on function public.submit_signature(uuid,text,text,text) to anon,authenticated;
-- Explicit Data API grants: required when "Automatically expose new tables" is OFF.
-- Do not grant any table access to anon. Public signing uses only narrow RPCs.
revoke all on table public.trainings from anon, authenticated;
grant select, insert, update, delete on table public.trainings to authenticated;
revoke all on table public.templates from anon, authenticated;
grant select, insert, update, delete on table public.templates to authenticated;
revoke all on table public.participants from anon, authenticated;
grant select(id, training_id, position, full_name, sort_order, signed_at, signature_data, created_at)
  on table public.participants to authenticated;
grant update(position, full_name, sort_order, signed_at, signature_data)
  on table public.participants to authenticated;
grant delete on table public.participants to authenticated;
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;
create or replace view public.participant_admin with (security_invoker=true) as
select id, training_id, position, full_name, sort_order, signed_at, signature_data, created_at from public.participants;
grant select on table public.participant_admin to authenticated;

-- Server RPC permissions are granted above. Do NOT grant SELECT on access_hash.


-- Included no-code v4 migration (fresh install, safe to rerun)
-- Required one-time migration for an existing elecyonsu Supabase project.
-- Run in Supabase SQL Editor before deploying the new no-code registration UI.
-- Keeps existing participants/signatures and templates intact.
alter table public.trainings
  add column if not exists selected_template_id uuid references public.templates(id) on delete set null;

create or replace function public.add_participant_simple(
 p_training uuid,p_position text,p_name text,p_order integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(
    select 1 from public.trainings t where t.id=p_training and t.owner_id=auth.uid()
 ) then raise exception '접근 권한이 없습니다'; end if;
 if length(trim(coalesce(p_name,'')))<1 or length(trim(p_name))>120
    or length(trim(coalesce(p_position,'')))<1 or length(trim(p_position))>100
 then raise exception '직급 또는 성명이 올바르지 않습니다'; end if;
 insert into public.participants(training_id, position, full_name,sort_order)
 values(p_training,trim(p_position),trim(p_name),greatest(1,p_order))
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.submit_signature_simple(
 p_token uuid,p_name text,p_position text,p_signature text
) returns text language plpgsql security definer set search_path='' as $$
declare v_training uuid;v_owner uuid;v_enabled bool;v_id uuid;v_count int;
begin
 if p_signature is null or length(p_signature)>180000
    or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
 then return 'INVALID_IMAGE'; end if;
 if length(trim(coalesce(p_name,'')))<1 or length(trim(coalesce(p_position,'')))<1
 then return 'NO_MATCH'; end if;
 select t.id,t.owner_id,t.enabled into v_training,v_owner,v_enabled
 from public.trainings t where t.token=p_token;
 if v_training is null or not v_enabled then return 'CLOSED';end if;
 select count(*) into v_count from public.participants p
 where p.training_id=v_training
   and p.full_name=trim(p_name) and p.position=trim(p_position);
 if v_count=0 then return 'NO_MATCH';end if;
 if v_count>1 then return 'AMBIGUOUS';end if;
 select p.id into v_id from public.participants p
 where p.training_id=v_training
   and p.full_name=trim(p_name) and p.position=trim(p_position)
 limit 1;
 update public.participants set signed_at=now(),signature_data=p_signature
 where id=v_id and signed_at is null;
 if not found then return 'ALREADY';end if;
 insert into public.audit_logs(owner_id,training_id,event)
 values(v_owner,v_training,'공개 QR 서명 제출(별도 본인인증 없음)');
 return 'OK';
end $$;

revoke all on function public.add_participant_simple(uuid,text,text,integer) from public,anon;
grant execute on function public.add_participant_simple(uuid,text,text,integer) to authenticated;
revoke all on function public.submit_signature_simple(uuid,text,text,text) from public;
grant execute on function public.submit_signature_simple(uuid,text,text,text) to anon,authenticated;
-- Remove unused code-based RPC endpoints so the code-based path cannot be used.
drop function if exists public.add_participant(uuid,text,text,text,integer);
drop function if exists public.submit_signature(uuid,text,text,text);

-- The legacy confirmation-code hash is no longer used: erase it completely.
alter table public.participants drop column if exists access_hash;


-- v5: atomic batch import, training counts and realtime subscription support
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
