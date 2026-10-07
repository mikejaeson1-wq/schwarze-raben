-- Schwarze Raben: Gemeinschaft, öffentliches Dorfleben und Mitgliederbeiträge.
-- Additive Migration; bestehende Inhalte und Berechtigungen bleiben erhalten.
create table public.raben_records (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('gallery','place','chronicle','trade','event','character','task','project','knowledge','poll','journal')),
 title text not null check(char_length(btrim(title)) between 1 and 200),
 body text not null default '' check(char_length(body)<=30000),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=50000),
 visibility text not null default 'clan' check(visibility in ('draft','clan','review','public','archived')),
 created_by uuid not null default auth.uid() references public.raben_memberships(user_id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 search tsvector generated always as (to_tsvector('german'::regconfig,title || ' ' || body || ' ' || coalesce(details->>'tags',''))) stored,
 check(visibility<>'public' or kind in ('gallery','place','chronicle','trade','event','character'))
);
create index raben_records_kind_visibility_updated_idx on public.raben_records(kind,visibility,updated_at desc);
create index raben_records_creator_idx on public.raben_records(created_by);
create index raben_records_search_idx on public.raben_records using gin(search);
create index raben_records_media_idx on public.raben_records((details->>'imagePath')) where details ? 'imagePath';
create table public.raben_character_notes (
 record_id uuid primary key references public.raben_records(id) on delete cascade,
 body text not null default '' check(char_length(body)<=20000),
 updated_at timestamptz not null default now()
);
create table public.raben_event_responses (
 record_id uuid not null references public.raben_records(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id),
 choice text not null check(choice in ('yes','maybe','no')),
 updated_at timestamptz not null default now(),
 primary key(record_id,user_id)
);
create index raben_responses_user_idx on public.raben_event_responses(user_id);
create table public.raben_task_claims (
 record_id uuid primary key references public.raben_records(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id),
 state text not null default 'claimed' check(state in ('claimed','done')),
 updated_at timestamptz not null default now()
);
create index raben_claims_user_idx on public.raben_task_claims(user_id);
create table public.raben_poll_votes (
 record_id uuid not null references public.raben_records(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id),
 option_index integer not null check(option_index between 0 and 7),
 updated_at timestamptz not null default now(),
 primary key(record_id,user_id)
);
create index raben_votes_user_idx on public.raben_poll_votes(user_id);
create table public.raben_applications (
 user_id uuid primary key default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 character_name text not null check(char_length(btrim(character_name)) between 1 and 100),
 concept text not null check(char_length(btrim(concept)) between 10 and 10000),
 rp_preferences text not null default '' check(char_length(rp_preferences)<=4000),
 availability text not null default '' check(char_length(availability)<=1000),
 status text not null default 'waiting' check(status in ('waiting','approved','rejected')),
 feedback text not null default '' check(char_length(feedback)<=4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1
);
create index raben_applications_status_idx on public.raben_applications(status,created_at);

create function raben_private.record_visible(p_id uuid,p_kind text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(
  select 1 from public.raben_records r where r.id=p_id and (p_kind is null or r.kind=p_kind)
  and (r.visibility in ('clan','public') or r.created_by=auth.uid() or raben_private.is_admin())
 );
$$;
create function raben_private.record_owned(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(
  select 1 from public.raben_records r where r.id=p_id and r.kind='character'
  and (r.created_by=auth.uid() or raben_private.is_admin())
 );
$$;
revoke all on function raben_private.record_visible(uuid,text),raben_private.record_owned(uuid) from public,anon;
grant execute on function raben_private.record_visible(uuid,text),raben_private.record_owned(uuid) to authenticated;

create function raben_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare admin boolean:=raben_private.is_admin(); allowed text[]; date_key text; option_value jsonb;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.created_by<>auth.uid() then raise exception 'owner_required' using errcode='42501'; end if;
  new.created_at:=now(); new.revision:=1;
 else
  if new.kind<>old.kind or new.created_by<>old.created_by or new.id<>old.id then raise exception 'immutable_record' using errcode='42501'; end if;
  new.created_at:=old.created_at; new.revision:=old.revision+1;
 end if;
 if not admin then
  if new.created_by<>auth.uid() or new.kind not in ('character','task','journal','trade','knowledge') then raise exception 'owner_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.visibility='public' and new.visibility='public' then new.visibility:='review'; end if;
  if new.visibility not in ('draft','clan','review','archived') then raise exception 'admin_publication_required' using errcode='42501'; end if;
  new.details:=new.details-'publicImage';
  if new.details ? 'imagePath' and new.details->>'imagePath' not like auth.uid()::text || '/%' then raise exception 'image_owner_required' using errcode='42501'; end if;
 end if;
 allowed:=case new.kind
  when 'gallery' then array['imagePath','publicImage','date']
  when 'place' then array['x','y','category']
  when 'chronicle' then array['date','sourceId','imagePath','publicImage']
  when 'trade' then array['category','contact','expires','imagePath','publicImage']
  when 'event' then array['date','time','location','registrationOpen']
  when 'character' then array['profession','relationships','imagePath','publicImage']
  when 'task' then array['category','dueDate']
  when 'project' then array['responsible','materials','progress']
  when 'knowledge' then array['category','tags']
  when 'poll' then array['options','endDate','open']
  when 'journal' then array['date'] end;
 if exists(select 1 from jsonb_object_keys(new.details) k where not(k=any(allowed))) then raise exception 'invalid_details'; end if;
 if exists(select 1 from jsonb_each(new.details) e where e.key not in ('options','x','y','progress','open','registrationOpen') and jsonb_typeof(e.value)<>'string') then raise exception 'invalid_details'; end if;
 if new.details ? 'imagePath' and new.details->>'imagePath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_image_path'; end if;
 if new.details ? 'publicImage' and new.details->>'publicImage' !~ '^[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_public_image'; end if;
 foreach date_key in array array['date','dueDate','endDate','expires'] loop
  if new.details ? date_key then
   if new.details->>date_key !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
   perform (new.details->>date_key)::date;
  end if;
 end loop;
 if new.kind='event' then
  if not(new.details ? 'date') then raise exception 'event_date_required'; end if;
  if new.details ? 'time' and new.details->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_time'; end if;
  if new.details ? 'registrationOpen' and jsonb_typeof(new.details->'registrationOpen')<>'boolean' then raise exception 'invalid_details'; end if;
 elsif new.kind='place' then
  if not(new.details ? 'x' and new.details ? 'y') or jsonb_typeof(new.details->'x')<>'number' or jsonb_typeof(new.details->'y')<>'number' then raise exception 'map_coordinates_required'; end if;
  if (new.details->>'x')::numeric not between 0 and 100 or (new.details->>'y')::numeric not between 0 and 100 then raise exception 'invalid_map_coordinates'; end if;
 elsif new.kind='project' and new.details ? 'progress' then
  if jsonb_typeof(new.details->'progress')<>'number' or (new.details->>'progress')::numeric not between 0 and 100 or (new.details->>'progress')::numeric<>trunc((new.details->>'progress')::numeric) then raise exception 'invalid_progress'; end if;
 elsif new.kind='poll' then
  if jsonb_typeof(new.details->'options') is distinct from 'array' or jsonb_array_length(new.details->'options') not between 2 and 8 then raise exception 'poll_options_required'; end if;
  for option_value in select value from jsonb_array_elements(new.details->'options') loop
   if jsonb_typeof(option_value)<>'string' or char_length(btrim(option_value#>>'{}')) not between 1 and 100 then raise exception 'invalid_poll_option'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(new.details->'options'))<>jsonb_array_length(new.details->'options') then raise exception 'duplicate_poll_options'; end if;
  if new.details ? 'open' and jsonb_typeof(new.details->'open')<>'boolean' then raise exception 'invalid_details'; end if;
  if tg_op='UPDATE' and new.details->'options' is distinct from old.details->'options' and exists(select 1 from public.raben_poll_votes where record_id=old.id) then raise exception 'poll_has_votes'; end if;
 end if;
 if new.kind='gallery' and new.visibility='public' and not(new.details ? 'publicImage') then raise exception 'public_image_required'; end if;
 new.updated_at:=now(); return new;
end; $$;
revoke all on function raben_private.guard_record() from public,anon,authenticated;
create trigger guard_record before insert or update on public.raben_records for each row execute function raben_private.guard_record();

alter table public.raben_records enable row level security;
alter table public.raben_character_notes enable row level security;
alter table public.raben_event_responses enable row level security;
alter table public.raben_task_claims enable row level security;
alter table public.raben_poll_votes enable row level security;
alter table public.raben_applications enable row level security;
revoke all on public.raben_records,public.raben_character_notes,public.raben_event_responses,public.raben_task_claims,public.raben_poll_votes,public.raben_applications from public,anon,authenticated;
grant select(id,kind,title,body,details,visibility,created_at,updated_at,revision,search) on public.raben_records to anon;
grant select,insert,delete on public.raben_records to authenticated;
grant update(title,body,details,visibility) on public.raben_records to authenticated;
create policy raben_records_public_read on public.raben_records for select to anon,authenticated using(visibility='public');
create policy raben_records_clan_read on public.raben_records for select to authenticated using((select raben_private.is_member()) and (visibility='clan' or created_by=(select auth.uid()) or (select raben_private.is_admin())));
create policy raben_records_create on public.raben_records for insert to authenticated with check((select raben_private.is_member()) and created_by=(select auth.uid()) and ((select raben_private.is_admin()) or (kind in ('character','task','journal','trade','knowledge') and visibility in ('draft','clan','review','archived'))));
create policy raben_records_edit on public.raben_records for update to authenticated using((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge')))) with check((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and visibility in ('draft','clan','review','archived'))));
create policy raben_records_remove on public.raben_records for delete to authenticated using((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge'))));
grant select,insert,delete on public.raben_character_notes to authenticated;
grant update(body) on public.raben_character_notes to authenticated;
create policy raben_notes_read on public.raben_character_notes for select to authenticated using(raben_private.record_owned(record_id));
create policy raben_notes_create on public.raben_character_notes for insert to authenticated with check(raben_private.record_owned(record_id));
create policy raben_notes_edit on public.raben_character_notes for update to authenticated using(raben_private.record_owned(record_id)) with check(raben_private.record_owned(record_id));
create policy raben_notes_remove on public.raben_character_notes for delete to authenticated using(raben_private.record_owned(record_id));
create function raben_private.touch_hub_note() returns trigger language plpgsql set search_path='' as $$begin new.updated_at:=now();return new;end;$$;
revoke all on function raben_private.touch_hub_note() from public,anon,authenticated;
create trigger touch_hub_note before insert or update on public.raben_character_notes for each row execute function raben_private.touch_hub_note();

-- Interaction guards lock the parent row. This serializes votes/claims with closing an event or poll.
create function raben_private.guard_hub_interaction() returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.raben_records; expected_kind text;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 expected_kind:=case tg_table_name when 'raben_event_responses' then 'event' when 'raben_task_claims' then 'task' else 'poll' end;
 if tg_op='UPDATE' and (new.record_id<>old.record_id or new.user_id<>old.user_id) then raise exception 'immutable_interaction' using errcode='42501'; end if;
 if new.user_id<>auth.uid() and not raben_private.is_admin() then raise exception 'owner_required' using errcode='42501'; end if;
 select * into parent from public.raben_records where id=new.record_id for update;
 if not found or parent.kind<>expected_kind or parent.visibility not in ('clan','public') then raise exception 'record_not_open' using errcode='42501'; end if;
 if expected_kind='event' and ((parent.details->>'registrationOpen')::boolean=false or (parent.details->>'date')::date<(now() at time zone 'Europe/Berlin')::date) then raise exception 'registration_closed'; end if;
 if expected_kind='poll' then
  if (parent.details->>'open')::boolean=false or (parent.details ? 'endDate' and (parent.details->>'endDate')::date<(now() at time zone 'Europe/Berlin')::date) then raise exception 'poll_closed'; end if;
  if new.option_index>=jsonb_array_length(parent.details->'options') then raise exception 'invalid_poll_option'; end if;
 end if;
 new.updated_at:=now();return new;
end; $$;
revoke all on function raben_private.guard_hub_interaction() from public,anon,authenticated;
create trigger guard_event_response before insert or update on public.raben_event_responses for each row execute function raben_private.guard_hub_interaction();
create trigger guard_task_claim before insert or update on public.raben_task_claims for each row execute function raben_private.guard_hub_interaction();
create trigger guard_poll_vote before insert or update on public.raben_poll_votes for each row execute function raben_private.guard_hub_interaction();
grant select,insert,delete on public.raben_event_responses,public.raben_task_claims,public.raben_poll_votes to authenticated;
grant update(choice) on public.raben_event_responses to authenticated;
grant update(state) on public.raben_task_claims to authenticated;
grant update(option_index) on public.raben_poll_votes to authenticated;
create policy raben_responses_read on public.raben_event_responses for select to authenticated using(raben_private.record_visible(record_id,'event'));
create policy raben_responses_create on public.raben_event_responses for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
create policy raben_responses_edit on public.raben_event_responses for update to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy raben_responses_remove on public.raben_event_responses for delete to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy raben_claims_read on public.raben_task_claims for select to authenticated using(raben_private.record_visible(record_id,'task'));
create policy raben_claims_create on public.raben_task_claims for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and state='claimed' and raben_private.record_visible(record_id,'task'));
create policy raben_claims_edit on public.raben_task_claims for update to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin()))) with check((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy raben_claims_remove on public.raben_task_claims for delete to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy raben_votes_read on public.raben_poll_votes for select to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin())) and raben_private.record_visible(record_id,'poll'));
create policy raben_votes_create on public.raben_poll_votes for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and raben_private.record_visible(record_id,'poll'));
create policy raben_votes_edit on public.raben_poll_votes for update to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy raben_votes_remove on public.raben_poll_votes for delete to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
create function public.raben_event_respond(p_record uuid,p_choice text) returns void language sql security invoker set search_path='' as $$
 insert into public.raben_event_responses(record_id,user_id,choice) values(p_record,auth.uid(),p_choice)
 on conflict(record_id,user_id) do update set choice=excluded.choice;
$$;
create function public.raben_poll_vote(p_record uuid,p_option integer) returns void language sql security invoker set search_path='' as $$
 insert into public.raben_poll_votes(record_id,user_id,option_index) values(p_record,auth.uid(),p_option)
 on conflict(record_id,user_id) do update set option_index=excluded.option_index;
$$;
create function public.raben_save_character_notes(p_record uuid,p_body text,p_expected timestamptz default null) returns void language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_expected is null then
  insert into public.raben_character_notes(record_id,body) values(p_record,p_body) on conflict(record_id) do nothing;
 else
  update public.raben_character_notes set body=p_body where record_id=p_record and updated_at=p_expected;
 end if;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'notes_conflict'; end if;
end; $$;
revoke all on function public.raben_event_respond(uuid,text),public.raben_poll_vote(uuid,integer),public.raben_save_character_notes(uuid,text,timestamptz) from public,anon;
grant execute on function public.raben_event_respond(uuid,text),public.raben_poll_vote(uuid,integer),public.raben_save_character_notes(uuid,text,timestamptz) to authenticated;
create function raben_private.guard_vote_delete() returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.raben_records;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if raben_private.is_admin() then return old; end if;
 if old.user_id<>auth.uid() then raise exception 'owner_required' using errcode='42501'; end if;
 select * into parent from public.raben_records where id=old.record_id for update;
 if not found or parent.visibility not in ('clan','public') or (parent.details->>'open')::boolean=false or (parent.details ? 'endDate' and (parent.details->>'endDate')::date<(now() at time zone 'Europe/Berlin')::date) then raise exception 'poll_closed'; end if;
 return old;
end; $$;
revoke all on function raben_private.guard_vote_delete() from public,anon,authenticated;
create trigger guard_vote_delete before delete on public.raben_poll_votes for each row execute function raben_private.guard_vote_delete();
create function raben_private.poll_results(p_record uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.record_visible(p_record,'poll') then raise exception 'member_required' using errcode='42501'; end if;
 select jsonb_build_object('total',count(*),'counts',coalesce((select jsonb_object_agg(option_index,n) from (select option_index,count(*) n from public.raben_poll_votes where record_id=p_record group by option_index) s),'{}'::jsonb)) into result from public.raben_poll_votes where record_id=p_record;
 return result;
end; $$;
revoke all on function raben_private.poll_results(uuid) from public,anon;
grant execute on function raben_private.poll_results(uuid) to authenticated;
create function public.raben_poll_results(p_record uuid) returns jsonb language sql security invoker set search_path='' as $$ select raben_private.poll_results(p_record); $$;
revoke all on function public.raben_poll_results(uuid) from public,anon;
grant execute on function public.raben_poll_results(uuid) to authenticated;

create function raben_private.guard_application() returns trigger language plpgsql set search_path='' as $$
declare admin boolean:=raben_private.is_admin(); membership public.raben_memberships;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.user_id<>auth.uid() or new.status<>'waiting' then raise exception 'application_owner_required' using errcode='42501'; end if;
  new.created_at:=now();new.revision:=1;
 else
  if new.user_id<>old.user_id then raise exception 'immutable_application' using errcode='42501'; end if;
  new.created_at:=old.created_at;new.revision:=old.revision+1;
 end if;
 if not admin then
  select * into membership from public.raben_memberships where user_id=auth.uid();
  if not found or membership.status<>'pending' or new.user_id<>auth.uid() then raise exception 'pending_application_required' using errcode='42501'; end if;
  new.status:='waiting'; new.feedback:=case when tg_op='UPDATE' then old.feedback else '' end;
 end if;
 if admin and tg_op='UPDATE' and new.status='approved' and old.status<>'approved' then
  select * into membership from public.raben_memberships where user_id=new.user_id;
  if membership.status='blocked' then raise exception 'applicant_blocked' using errcode='42501'; end if;
  update public.raben_memberships set status='active' where user_id=new.user_id;
 end if;
 new.updated_at:=now();return new;
end; $$;
revoke all on function raben_private.guard_application() from public,anon,authenticated;
create trigger guard_application before insert or update on public.raben_applications for each row execute function raben_private.guard_application();
grant select,insert on public.raben_applications to authenticated;
grant update(character_name,concept,rp_preferences,availability,status,feedback) on public.raben_applications to authenticated;
create policy raben_applications_read on public.raben_applications for select to authenticated using(user_id=(select auth.uid()) or (select raben_private.is_admin()));
create policy raben_applications_create on public.raben_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='waiting' and exists(select 1 from public.raben_memberships m where m.user_id=(select auth.uid()) and m.status='pending'));
create policy raben_applications_edit on public.raben_applications for update to authenticated using((select raben_private.is_admin()) or (user_id=(select auth.uid()) and status in ('waiting','rejected') and exists(select 1 from public.raben_memberships m where m.user_id=(select auth.uid()) and m.status='pending'))) with check((select raben_private.is_admin()) or (user_id=(select auth.uid()) and status='waiting'));

create function raben_private.can_read_hub_media(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and (raben_private.is_admin() or split_part(p_name,'/',1)=auth.uid()::text or exists(select 1 from public.raben_records r where r.details->>'imagePath'=p_name and r.visibility in ('clan','public')));
$$;
revoke all on function raben_private.can_read_hub_media(text) from public,anon;
grant execute on function raben_private.can_read_hub_media(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('raben-media','raben-media',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy raben_media_read on storage.objects for select to authenticated using(bucket_id='raben-media' and raben_private.can_read_hub_media(name));
create policy raben_media_create on storage.objects for insert to authenticated with check(bucket_id='raben-media' and (select raben_private.is_member()) and (split_part(name,'/',1)=(select auth.uid())::text or (select raben_private.is_admin())));
create policy raben_media_delete on storage.objects for delete to authenticated using(bucket_id='raben-media' and (select raben_private.is_member()) and (split_part(name,'/',1)=(select auth.uid())::text or (select raben_private.is_admin())));
create policy raben_media_guard on storage.objects as restrictive for all to authenticated using(bucket_id<>'raben-media' or raben_private.can_read_hub_media(name)) with check(bucket_id<>'raben-media' or ((select raben_private.is_member()) and (split_part(name,'/',1)=(select auth.uid())::text or (select raben_private.is_admin()))));
-- The restrictive guard also blocks unrelated broad storage policies from crossing this boundary.
