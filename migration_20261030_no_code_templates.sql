-- Required one-time migration for an existing elecyonsu Supabase project.
-- Run in Supabase SQL Editor before deploying the new no-code registration UI.
-- Keeps existing participants/signatures and templates intact.
alter table public.participants alter column access_hash drop not null;
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
 insert into public.participants(training_id, position, full_name,sort_order,access_hash)
 values(p_training,trim(p_position),trim(p_name),greatest(1,p_order),null)
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
 select count(*), min(p.id) into v_count,v_id from public.participants p
 where p.training_id=v_training
   and p.full_name=trim(p_name) and p.position=trim(p_position);
 if v_count=0 then return 'NO_MATCH';end if;
 if v_count>1 then return 'AMBIGUOUS';end if;
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
