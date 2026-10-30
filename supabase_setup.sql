-- 전자 연수등록부. 새 Supabase 프로젝트 SQL Editor에서 1회 실행
create extension if not exists pgcrypto;
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
 values(p_training,left(p_position,100),left(p_name,120),crypt(p_code,gen_salt('bf')),p_order) returning id into v_id;
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
 where training_id=v_training and full_name=trim(p_name) and access_hash=crypt(p_code,access_hash) limit 1;
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
-- RLS table privileges; prevent client reading password hashes by removing select privileges to authenticated? 
-- participants accessed by admin through view without access_hash, never return hash to browser:
create or replace view public.participant_admin with (security_invoker=true) as
 select id,training_id,position,full_name,sort_order,signed_at,signature_data,created_at from public.participants;
grant select on public.participant_admin to authenticated;
-- Restrict direct exposure of access_hash, allow ownership scoped updates via RPC
revoke select on public.participants from anon,authenticated;
grant select(id,training_id,position,full_name,sort_order,signed_at,signature_data,created_at) on public.participants to authenticated;
grant insert,update,delete on public.participants to authenticated;
-- ensure random access codes are not overwritten directly by client
revoke update(access_hash) on public.participants from authenticated;
-- logging server only
revoke all on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
-- Expose read status via polling (realtime optional)
