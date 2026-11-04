-- elecyonsu v6: mobile completion and secure same-device re-signing
-- Existing trainings, participants and signatures remain unchanged.
-- This migration was applied to project jivkcfaidpgozouxvwhq on 2026-11-04.
create schema if not exists elecyonsu_private;
revoke all on schema elecyonsu_private from public, anon, authenticated;

create table if not exists elecyonsu_private.signature_edit_proofs (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  edit_hash text not null,
  issued_at timestamptz not null default now()
);
alter table elecyonsu_private.signature_edit_proofs enable row level security;
revoke all on elecyonsu_private.signature_edit_proofs from public, anon, authenticated;

create or replace function public.submit_signature_with_edit_token(
  p_token uuid,
  p_name text,
  p_position text,
  p_signature text,
  p_edit_token text,
  p_replace boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_training uuid;
  v_owner uuid;
  v_enabled boolean;
  v_id uuid;
  v_signed_at timestamptz;
  v_count integer;
  v_hash text;
  v_old_hash text;
begin
  if p_signature is null
     or length(p_signature) > 180000
     or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$'
  then return 'INVALID_IMAGE'; end if;

  if length(trim(coalesce(p_name,''))) not between 1 and 120
     or length(trim(coalesce(p_position,''))) not between 1 and 100
  then return 'NO_MATCH'; end if;

  if p_edit_token is null or p_edit_token !~ '^[0-9a-f]{64}$'
  then return 'INVALID_TOKEN'; end if;

  select t.id, t.owner_id, t.enabled
    into v_training, v_owner, v_enabled
  from public.trainings t
  where t.token = p_token;

  if v_training is null or not v_enabled
  then return 'CLOSED'; end if;

  select count(*) into v_count
  from public.participants p
  where p.training_id = v_training
    and p.full_name = trim(p_name)
    and p.position = trim(p_position);

  if v_count = 0 then return 'NO_MATCH'; end if;
  if v_count > 1 then return 'AMBIGUOUS'; end if;

  select p.id, p.signed_at
    into v_id, v_signed_at
  from public.participants p
  where p.training_id = v_training
    and p.full_name = trim(p_name)
    and p.position = trim(p_position)
  for update;

  if v_id is null then return 'NO_MATCH'; end if;
  v_hash := pg_catalog.encode(extensions.digest(p_edit_token,'sha256'),'hex');

  if v_signed_at is not null then
    if not coalesce(p_replace, false) then return 'ALREADY'; end if;

    select edit_hash into v_old_hash
    from elecyonsu_private.signature_edit_proofs
    where participant_id = v_id;

    if v_old_hash is null then return 'EDIT_PROOF_REQUIRED'; end if;
    if v_old_hash <> v_hash then return 'EDIT_DENIED'; end if;

    update public.participants
      set signed_at = now(), signature_data = p_signature
    where id = v_id;

    insert into public.audit_logs(owner_id,training_id,event)
    values(v_owner,v_training,'공개 QR 서명 수정(동일 기기 권한 확인)');
    return 'UPDATED';
  end if;

  if coalesce(p_replace, false) then return 'NOT_SIGNED'; end if;

  update public.participants
    set signed_at = now(), signature_data = p_signature
  where id = v_id and signed_at is null;

  insert into elecyonsu_private.signature_edit_proofs(participant_id,edit_hash)
  values(v_id,v_hash)
  on conflict (participant_id) do update
    set edit_hash=excluded.edit_hash, issued_at=now();

  insert into public.audit_logs(owner_id,training_id,event)
  values(v_owner,v_training,'공개 QR 서명 제출(재수정 권한 발급)');

  return 'OK';
end;
$fn$;

revoke all on function public.submit_signature_with_edit_token(uuid,text,text,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.submit_signature_with_edit_token(uuid,text,text,text,text,boolean)
  to anon, authenticated;
notify pgrst, 'reload schema';
