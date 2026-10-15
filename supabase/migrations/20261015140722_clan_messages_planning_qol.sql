-- Second clan update. All private conversation access remains participant-only.
alter table public.raben_direct_messages add column edited_at timestamptz,add column withdrawn_at timestamptz,add column revision bigint not null default 1;
grant update(body,withdrawn_at) on public.raben_direct_messages to authenticated;
create policy direct_edit_own on public.raben_direct_messages for update to authenticated using((select raben_private.is_member()) and sender_id=(select auth.uid())) with check((select raben_private.is_member()) and sender_id=(select auth.uid()));
create or replace function raben_private.guard_direct_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if tg_op='UPDATE' then
  new.id:=old.id;new.sender_id:=old.sender_id;new.recipient_id:=old.recipient_id;new.client_id:=old.client_id;new.created_at:=old.created_at;new.edited_at:=old.edited_at;new.revision:=old.revision;
  if old.recipient_id=auth.uid() then
   if new.body is distinct from old.body or new.withdrawn_at is distinct from old.withdrawn_at then raise exception 'chat_denied' using errcode='42501';end if;
   new.read_at:=coalesce(old.read_at,now());return new;
  end if;
  if old.sender_id<>auth.uid() or new.read_at is distinct from old.read_at or old.withdrawn_at is not null then raise exception 'chat_denied' using errcode='42501';end if;
  if exists(select 1 from public.raben_chat_blocks where (user_id=old.sender_id and blocked_id=old.recipient_id) or (user_id=old.recipient_id and blocked_id=old.sender_id)) then raise exception 'chat_unavailable' using errcode='42501';end if;
  if new.withdrawn_at is not null then
   if old.created_at<now()-interval '15 minutes' then raise exception 'chat_retract_expired' using errcode='23514';end if;
   new.withdrawn_at:=now();new.body:='Nachricht zurückgezogen';
  elsif btrim(new.body) is not distinct from old.body then return old;
  else new.body:=btrim(new.body);new.edited_at:=now();end if;
  new.revision:=old.revision+1;return new;
 end if;
 if new.sender_id<>auth.uid() or not exists(select 1 from public.raben_memberships where user_id=new.recipient_id and status='active') then raise exception 'chat_denied' using errcode='42501';end if;
 perform 1 from public.raben_memberships where user_id=auth.uid() for update;
 if exists(select 1 from public.raben_chat_blocks where (user_id=new.sender_id and blocked_id=new.recipient_id) or (user_id=new.recipient_id and blocked_id=new.sender_id)) then raise exception 'chat_unavailable' using errcode='42501';end if;
 if (select count(*) from public.raben_direct_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'chat_rate_limit' using errcode='23514';end if;
 new.body:=btrim(new.body);new.created_at:=now();new.read_at:=null;new.edited_at:=null;new.withdrawn_at:=null;new.revision:=1;return new;
end;$$;
create function public.raben_change_chat(p_id uuid,p_body text,p_retract boolean,p_expected bigint) returns public.raben_direct_messages language plpgsql security invoker set search_path='' as $$
declare result public.raben_direct_messages;
begin
 update public.raben_direct_messages set body=case when p_retract then body else p_body end,withdrawn_at=case when p_retract then now() else null end where id=p_id and sender_id=auth.uid() and revision=p_expected returning * into result;
 if not found then raise exception 'chat_conflict' using errcode='40001';end if;return result;
end;$$;
revoke all on function public.raben_change_chat(uuid,text,boolean,bigint) from public,anon;grant execute on function public.raben_change_chat(uuid,text,boolean,bigint) to authenticated;
create function public.raben_chat_search(p_peer uuid,p_term text default '',p_from timestamptz default null,p_until timestamptz default null,p_before_time timestamptz default null,p_before_id uuid default null) returns setof public.raben_direct_messages language sql stable security invoker set search_path='' as $$
 select m.* from public.raben_direct_messages m where ((m.sender_id=auth.uid() and m.recipient_id=p_peer) or (m.recipient_id=auth.uid() and m.sender_id=p_peer))
 and length(coalesce(p_term,''))<=100 and (coalesce(p_term,'')='' or (m.withdrawn_at is null and position(lower(p_term) in lower(m.body))>0)) and (p_from is null or m.created_at>=p_from) and (p_until is null or m.created_at<p_until)
 and (p_before_time is null or (m.created_at,m.id)<(p_before_time,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) order by m.created_at desc,m.id desc limit 50;
$$;
revoke all on function public.raben_chat_search(uuid,text,timestamptz,timestamptz,timestamptz,uuid) from public,anon;grant execute on function public.raben_chat_search(uuid,text,timestamptz,timestamptz,timestamptz,uuid) to authenticated;

create table public.raben_chat_reactions(message_id uuid not null references public.raben_direct_messages(id) on delete cascade,user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,emoji text not null check(emoji in ('👍','❤️','😂','😮','😢','🎉','✅','👀')),created_at timestamptz not null default now(),primary key(message_id,user_id,emoji));
create index chat_reactions_user_idx on public.raben_chat_reactions(user_id);
alter table public.raben_chat_reactions enable row level security;revoke all on public.raben_chat_reactions from public,anon,authenticated;grant select,insert,delete on public.raben_chat_reactions to authenticated;
create policy chat_reactions_read on public.raben_chat_reactions for select to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_direct_messages m where m.id=message_id and m.withdrawn_at is null));
create policy chat_reactions_add on public.raben_chat_reactions for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and exists(select 1 from public.raben_direct_messages m where m.id=message_id and m.withdrawn_at is null) and not exists(select 1 from public.raben_chat_blocks b where b.user_id=(select auth.uid()) and b.blocked_id in (select m.sender_id from public.raben_direct_messages m where m.id=message_id union select m.recipient_id from public.raben_direct_messages m where m.id=message_id)));
create policy chat_reactions_remove on public.raben_chat_reactions for delete to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
create table public.raben_chat_preferences(user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,peer_id uuid not null references public.raben_memberships(user_id) on delete cascade,archived boolean not null default false,muted boolean not null default false,primary key(user_id,peer_id),check(user_id<>peer_id));
create index chat_preferences_peer_idx on public.raben_chat_preferences(peer_id);
alter table public.raben_chat_preferences enable row level security;revoke all on public.raben_chat_preferences from public,anon,authenticated;grant select,insert,delete on public.raben_chat_preferences to authenticated;grant update(archived,muted) on public.raben_chat_preferences to authenticated;
create policy chat_preferences_own on public.raben_chat_preferences for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));

-- A reserved file is private to its uploader until an atomic message send links it.
create table public.raben_chat_attachments(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,peer_id uuid not null references public.raben_memberships(user_id),message_id uuid references public.raben_direct_messages(id) on delete cascade,path text not null unique,name text not null check(length(name) between 1 and 180),bytes bigint not null check(bytes between 1 and 10485760),mime text not null check(mime in ('image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip')),created_at timestamptz not null default now(),check(owner_id<>peer_id));
create index chat_attachments_message_idx on public.raben_chat_attachments(message_id);create index chat_attachments_owner_idx on public.raben_chat_attachments(owner_id,created_at);create index chat_attachments_peer_idx on public.raben_chat_attachments(peer_id);
alter table public.raben_chat_attachments enable row level security;revoke all on public.raben_chat_attachments from public,anon,authenticated;grant select on public.raben_chat_attachments to authenticated;grant insert(id,owner_id,peer_id,path,name,bytes,mime) on public.raben_chat_attachments to authenticated;grant update(message_id) on public.raben_chat_attachments to authenticated;grant delete on public.raben_chat_attachments to authenticated;
create policy chat_attachments_read on public.raben_chat_attachments for select to authenticated using((select raben_private.is_member()) and ((owner_id=(select auth.uid()) and message_id is null) or exists(select 1 from public.raben_direct_messages m where m.id=message_id and m.withdrawn_at is null)));
create policy chat_attachments_create on public.raben_chat_attachments for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and message_id is null and exists(select 1 from public.raben_memberships where user_id=peer_id and status='active'));
create policy chat_attachments_link on public.raben_chat_attachments for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()) and message_id is null) with check(owner_id=(select auth.uid()) and exists(select 1 from public.raben_direct_messages m where m.id=message_id and m.sender_id=owner_id and m.recipient_id=peer_id and m.withdrawn_at is null));
create policy chat_attachments_delete on public.raben_chat_attachments for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()) and message_id is null);
create function raben_private.guard_chat_attachment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() or new.owner_id<>auth.uid() then raise exception 'chat_denied' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.path is distinct from (auth.uid()::text||'/'||new.id::text||'.'||case new.mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/gif' then 'gif' when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' when 'application/zip' then 'zip' else '' end) or new.message_id is not null then raise exception 'invalid_attachment';end if;
  perform 1 from public.raben_memberships where user_id=auth.uid() for update;
  if (select count(*) from public.raben_chat_attachments where owner_id=auth.uid() and message_id is null)>=40 then raise exception 'attachment_limit';end if;
  new.created_at:=now();
 else
  if old.message_id is not null or (to_jsonb(new)-'message_id') is distinct from (to_jsonb(old)-'message_id') or new.message_id is null then raise exception 'chat_denied' using errcode='42501';end if;
  if not exists(select 1 from public.raben_direct_messages m where m.id=new.message_id and m.sender_id=auth.uid() and m.recipient_id=new.peer_id and m.withdrawn_at is null) or not exists(select 1 from storage.objects o where o.bucket_id='raben-chat-media' and o.name=new.path and (o.metadata->>'size')::bigint=new.bytes and o.metadata->>'mimetype'=new.mime) then raise exception 'invalid_attachment';end if;
  if (select count(*) from public.raben_chat_attachments where message_id=new.message_id)>=4 then raise exception 'attachment_limit';end if;
 end if;return new;
end;$$;
revoke all on function raben_private.guard_chat_attachment() from public,anon,authenticated;create trigger guard_chat_attachment before insert or update on public.raben_chat_attachments for each row execute function raben_private.guard_chat_attachment();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('raben-chat-media','raben-chat-media',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip']);
create function raben_private.chat_file_access(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(select 1 from public.raben_chat_attachments a where a.path=p_path and ((a.owner_id=auth.uid() and a.message_id is null) or (not p_upload and exists(select 1 from public.raben_direct_messages m where m.id=a.message_id and m.withdrawn_at is null and auth.uid() in (m.sender_id,m.recipient_id)))));
$$;
revoke all on function raben_private.chat_file_access(text,boolean) from public,anon;grant execute on function raben_private.chat_file_access(text,boolean) to authenticated;
create policy chat_files_read on storage.objects for select to authenticated using(bucket_id='raben-chat-media' and raben_private.chat_file_access(name,false));
create policy chat_files_create on storage.objects for insert to authenticated with check(bucket_id='raben-chat-media' and raben_private.chat_file_access(name,true));
create policy chat_files_remove on storage.objects for delete to authenticated using(bucket_id='raben-chat-media' and raben_private.chat_file_access(name,true));
create policy chat_files_read_boundary on storage.objects as restrictive for select to authenticated using(bucket_id<>'raben-chat-media' or raben_private.chat_file_access(name,false));
create policy chat_files_create_boundary on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'raben-chat-media' or raben_private.chat_file_access(name,true));
create policy chat_files_remove_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'raben-chat-media' or raben_private.chat_file_access(name,true));
create policy chat_files_no_replace on storage.objects as restrictive for update to authenticated using(bucket_id<>'raben-chat-media') with check(bucket_id<>'raben-chat-media');
create function public.raben_send_chat(p_peer uuid,p_body text,p_client uuid,p_files uuid[] default '{}') returns public.raben_direct_messages language plpgsql security invoker set search_path='' as $$
declare result public.raben_direct_messages;n integer;
begin
 if p_files is null or cardinality(p_files)>4 or array_position(p_files,null) is not null or (select count(distinct x) from unnest(p_files)x)<>cardinality(p_files) then raise exception 'invalid_attachment';end if;
 select * into result from public.raben_direct_messages where sender_id=auth.uid() and client_id=p_client;
 if found then if result.recipient_id<>p_peer or result.body<>btrim(p_body) then raise exception 'chat_conflict' using errcode='40001';end if;return result;end if;
 if (select count(*) from public.raben_chat_attachments where id=any(p_files) and owner_id=auth.uid() and peer_id=p_peer and message_id is null)<>cardinality(p_files) then raise exception 'chat_denied' using errcode='42501';end if;
 insert into public.raben_direct_messages(sender_id,recipient_id,body,client_id) values(auth.uid(),p_peer,p_body,p_client) returning * into result;
 update public.raben_chat_attachments set message_id=result.id where id=any(p_files) and owner_id=auth.uid() and peer_id=p_peer and message_id is null;get diagnostics n=row_count;
 if n<>cardinality(p_files) then raise exception 'chat_conflict' using errcode='40001';end if;return result;
end;$$;
revoke all on function public.raben_send_chat(uuid,text,uuid,uuid[]) from public,anon;grant execute on function public.raben_send_chat(uuid,text,uuid,uuid[]) to authenticated;

create table public.raben_notice_settings(user_id uuid primary key default auth.uid() references public.raben_memberships(user_id) on delete cascade,topics text[] not null default array['mentions','chat','calendar','project'] check(topics<@array['mentions','chat','calendar','project'] and array_position(topics,null) is null),quiet_start time,quiet_end time,time_zone text not null default 'Europe/Berlin',desktop boolean not null default false,check((quiet_start is null)=(quiet_end is null)));
alter table public.raben_notice_settings enable row level security;revoke all on public.raben_notice_settings from public,anon,authenticated;grant select,insert on public.raben_notice_settings to authenticated;grant update(topics,quiet_start,quiet_end,time_zone,desktop) on public.raben_notice_settings to authenticated;
create policy own_notice_settings on public.raben_notice_settings for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_notice_settings() returns trigger language plpgsql security invoker set search_path='' as $$begin if not exists(select 1 from pg_timezone_names where name=new.time_zone) then raise exception 'invalid_time_zone';end if;return new;end;$$;
revoke all on function raben_private.guard_notice_settings() from public,anon,authenticated;create trigger guard_notice_settings before insert or update on public.raben_notice_settings for each row execute function raben_private.guard_notice_settings();
create function raben_private.notice_allowed(p_user uuid,p_topic text,p_desktop boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.raben_memberships where user_id=p_user and status='active') and coalesce((select p_topic=any(topics) and (not p_desktop or p_topic<>'chat' or desktop) and (not p_desktop or quiet_start is null or quiet_start=quiet_end or case when quiet_start<quiet_end then (now() at time zone time_zone)::time not between quiet_start and quiet_end else (now() at time zone time_zone)::time<quiet_start and (now() at time zone time_zone)::time>quiet_end end) from public.raben_notice_settings where user_id=p_user),not p_desktop);
$$;
revoke all on function raben_private.notice_allowed(uuid,text,boolean) from public,anon,authenticated;
-- All calls are server-side triggers or workers; members cannot enumerate other preferences.
alter table public.raben_notifications drop constraint raben_notifications_parent_type_check;
alter table public.raben_notifications add constraint raben_notifications_parent_type_check check(parent_type in ('record','post','request','plot','calendarFeed','chat','stock'));
create function raben_private.notice_parent(p_type text,p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select raben_private.is_member() and (raben_private.can_view_parent(p_type,p_id) or (p_type='calendarFeed' and exists(select 1 from public.raben_calendar_feeds f where f.id=p_id and f.user_id=auth.uid())) or (p_type='chat' and exists(select 1 from public.raben_direct_messages m where m.id=p_id)) or (p_type='stock' and exists(select 1 from public.raben_stock_items s where s.id=p_id)));
$$;
revoke all on function raben_private.notice_parent(text,uuid) from public,anon;grant execute on function raben_private.notice_parent(text,uuid) to authenticated;
drop policy raben_notifications_read on public.raben_notifications;drop policy raben_notifications_edit on public.raben_notifications;
create policy raben_notifications_read on public.raben_notifications for select to authenticated using(user_id=(select auth.uid()) and raben_private.notice_parent(parent_type,parent_id));
create policy raben_notifications_edit on public.raben_notifications for update to authenticated using(user_id=(select auth.uid()) and raben_private.notice_parent(parent_type,parent_id)) with check(user_id=(select auth.uid()) and raben_private.notice_parent(parent_type,parent_id));
create function raben_private.filter_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare topic text;
begin
 topic:=case when new.parent_type='chat' then 'chat' when new.scope in ('event','calendar') then 'calendar' when new.scope='mention' then 'mentions' else 'project' end;
 if not raben_private.notice_allowed(new.user_id,topic,false) then return null;end if;return new;
end;$$;
revoke all on function raben_private.filter_notice() from public,anon,authenticated;create trigger filter_notice before insert on public.raben_notifications for each row execute function raben_private.filter_notice();
-- Separate chat push jobs reuse the existing authenticated dispatch worker and device keys.
alter table raben_private.push_jobs add column chat_id uuid references public.raben_direct_messages(id) on delete cascade;
create index push_jobs_chat_idx on raben_private.push_jobs(chat_id);
create function raben_private.queue_chat_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.raben_chat_preferences where user_id=new.recipient_id and peer_id=new.sender_id and muted) then return null;end if;
 if raben_private.notice_allowed(new.recipient_id,'chat',false) then insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(new.recipient_id,'chat','Neue private Nachricht','chat',new.id);end if;
 if raben_private.notice_allowed(new.recipient_id,'chat',true) then insert into raben_private.push_jobs(device_id,chat_id,record_id,occurrence_date) select id,new.id,null,null from public.raben_push_devices where user_id=new.recipient_id;end if;return null;
end;$$;
revoke all on function raben_private.queue_chat_notice() from public,anon,authenticated;create trigger queue_chat_notice after insert on public.raben_direct_messages for each row execute function raben_private.queue_chat_notice();

create or replace function public.raben_claim_push_jobs(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.reminder_config;key text;result jsonb;
begin
 select * into c from raben_private.reminder_config where id=1;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.dispatch_secret_id;
 if key is null or p_secret is distinct from key then raise exception 'dispatch_denied' using errcode='42501';end if;
 update raben_private.push_jobs set status=case when attempts<5 then 'pending' else 'failed' end where status='sending' and lease_until<now();
 update raben_private.push_jobs j set status='failed' where status='pending' and not j.is_test and j.chat_id is null and not exists(select 1 from public.raben_records e join public.raben_push_devices d on d.id=j.device_id join public.raben_memberships m on m.user_id=d.user_id and m.status='active' where e.id=j.record_id and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,j.occurrence_date) and exists(select 1 from public.raben_event_reminders r where r.record_id=j.record_id and r.user_id=d.user_id and r.occurrence_date=j.occurrence_date and r.push_enabled) and raben_private.event_start(e.details,j.occurrence_date)>now() and raben_private.notice_allowed(d.user_id,'calendar',true));
 update raben_private.push_jobs j set status='failed' where j.is_test and j.status='pending' and not exists(select 1 from public.raben_push_devices d join public.raben_memberships m on m.user_id=d.user_id and m.status='active' where d.id=j.device_id);
 update raben_private.push_jobs j set status='failed' where status='pending' and chat_id is not null and not exists(select 1 from public.raben_direct_messages m join public.raben_push_devices d on d.id=j.device_id where m.id=j.chat_id and m.recipient_id=d.user_id and m.read_at is null and m.withdrawn_at is null and m.created_at>now()-interval '1 day' and raben_private.notice_allowed(d.user_id,'chat',true) and not exists(select 1 from public.raben_chat_preferences p where p.user_id=d.user_id and p.peer_id=m.sender_id and p.muted));
 with chosen as(select id from raben_private.push_jobs where status='pending' and next_attempt<=now() order by created_at limit 20 for update skip locked),claimed as(update raben_private.push_jobs j set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' from chosen where j.id=chosen.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'recordId',j.record_id,'test',j.is_test,'chatId',j.chat_id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth_key)),'[]') into result from claimed j join public.raben_push_devices d on d.id=j.device_id;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.vapid_secret_id;
 return jsonb_build_object('publicKey',c.vapid_public,'privateKey',key,'jobs',result);
end;$$;

-- Existing collaborators remain accepted; new invitations require an explicit recipient action.
alter table public.raben_entry_editors add column accepted_at timestamptz;
update public.raben_entry_editors set accepted_at=created_at;
create function raben_private.guard_editor_acceptance() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_op='INSERT' then new.accepted_at:=null;
 elsif auth.uid()<>old.owner_id and new.accepted_at is not distinct from old.accepted_at then raise exception 'entry_access_denied' using errcode='42501';
 elsif new.accepted_at is distinct from old.accepted_at then
  if auth.uid()<>old.editor_id or old.accepted_at is not null or new.accepted_at is null or (to_jsonb(new)-'accepted_at') is distinct from (to_jsonb(old)-'accepted_at') or (old.expires_at is not null and old.expires_at<=now()) then raise exception 'entry_access_denied' using errcode='42501';end if;new.accepted_at:=now();
 end if;return new;end;$$;
revoke all on function raben_private.guard_editor_acceptance() from public,anon,authenticated;create trigger guard_editor_acceptance before insert or update on public.raben_entry_editors for each row execute function raben_private.guard_editor_acceptance();
grant update(accepted_at) on public.raben_entry_editors to authenticated;
create policy editor_accept on public.raben_entry_editors for update to authenticated using((select raben_private.is_member()) and editor_id=(select auth.uid()) and accepted_at is null) with check(editor_id=(select auth.uid()));
create policy editor_decline on public.raben_entry_editors for delete to authenticated using((select raben_private.is_member()) and editor_id=(select auth.uid()));
create function public.raben_respond_invitation(p_type text,p_id uuid,p_accept boolean) returns void language plpgsql security invoker set search_path='' as $$begin
 if p_accept then update public.raben_entry_editors set accepted_at=now() where parent_type=p_type and parent_id=p_id and editor_id=auth.uid() and accepted_at is null;
 else delete from public.raben_entry_editors where parent_type=p_type and parent_id=p_id and editor_id=auth.uid();end if;
 if not found then raise exception 'invitation_unavailable' using errcode='40001';end if;end;$$;
revoke all on function public.raben_respond_invitation(text,uuid,boolean) from public,anon;grant execute on function public.raben_respond_invitation(text,uuid,boolean) to authenticated;

create table public.raben_gallery_selections(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,item_id uuid not null references public.raben_profile_items(id) on delete cascade,title text not null check(length(btrim(title)) between 1 and 100),image_ids uuid[] not null check(cardinality(image_ids) between 1 and 12),created_at timestamptz not null default now());
create index gallery_selections_user_idx on public.raben_gallery_selections(user_id,item_id);create index gallery_selections_item_idx on public.raben_gallery_selections(item_id);
alter table public.raben_gallery_selections enable row level security;revoke all on public.raben_gallery_selections from public,anon,authenticated;grant select,insert,delete on public.raben_gallery_selections to authenticated;
create policy own_gallery_selections on public.raben_gallery_selections for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items where id=item_id and owner_id=(select auth.uid()))) with check((select raben_private.is_member()) and user_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items where id=item_id and owner_id=(select auth.uid())) and (select count(*) from public.raben_profile_gallery where id=any(image_ids) and raben_profile_gallery.item_id=raben_gallery_selections.item_id and owner_id=(select auth.uid()))=cardinality(image_ids));
alter table public.raben_profile_albums add column cover_id uuid references public.raben_profile_gallery(id) on delete set null;
create index profile_albums_cover_idx on public.raben_profile_albums(cover_id) where cover_id is not null;
grant update(cover_id) on public.raben_profile_albums to authenticated;
create function raben_private.guard_album_cover() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.cover_id is not null and not exists(select 1 from public.raben_profile_gallery where id=new.cover_id and item_id=new.item_id and owner_id=new.owner_id and album_id=new.id) then raise exception 'invalid_album_cover';end if;return new;end;$$;
revoke all on function raben_private.guard_album_cover() from public,anon,authenticated;create trigger guard_album_cover before insert or update on public.raben_profile_albums for each row execute function raben_private.guard_album_cover();
create function raben_private.clear_moved_cover() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.album_id is distinct from new.album_id then update public.raben_profile_albums set cover_id=null where cover_id=new.id;end if;return null;end;$$;
revoke all on function raben_private.clear_moved_cover() from public,anon,authenticated;create trigger clear_moved_cover after update of album_id on public.raben_profile_gallery for each row execute function raben_private.clear_moved_cover();

-- Upload groups survive a failed save without storing file bytes or recipient selections in a draft.
create table public.raben_upload_drafts(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,bucket text not null check(bucket in ('raben-profile-media','raben-media','raben-clan-info-media')),paths jsonb not null check(jsonb_typeof(paths)='object' and octet_length(paths::text)<2000),name text not null check(length(name)<=180),bytes bigint not null check(bytes between 1 and 52428800),draft_key text check(length(draft_key)<=200),created_at timestamptz not null default now());
create unique index upload_drafts_origin_idx on public.raben_upload_drafts(user_id,bucket,(paths->>'imagePath'));
create index upload_drafts_user_idx on public.raben_upload_drafts(user_id,created_at);
alter table public.raben_upload_drafts enable row level security;revoke all on public.raben_upload_drafts from public,anon,authenticated;grant select,insert,delete on public.raben_upload_drafts to authenticated;
create policy own_upload_drafts on public.raben_upload_drafts for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_upload_draft() returns trigger language plpgsql security invoker set search_path='' as $$declare path text;begin
 if exists(select 1 from jsonb_object_keys(new.paths) k where k not in ('imagePath','thumbPath','mediumPath')) or not(new.paths?'imagePath') then raise exception 'invalid_upload_draft';end if;
 for path in select value from jsonb_each_text(new.paths) where value is not null loop
  if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id=new.bucket and name=path) then raise exception 'invalid_upload_draft' using errcode='42501';end if;
 end loop;return new;end;$$;
revoke all on function raben_private.guard_upload_draft() from public,anon,authenticated;create trigger guard_upload_draft before insert on public.raben_upload_drafts for each row execute function raben_private.guard_upload_draft();
create function public.raben_own_upload_drafts() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(u)||jsonb_build_object('referenced',case when u.bucket='raben-profile-media' then not raben_private.personal_image_unused(u.paths->>'imagePath') when u.bucket='raben-media' then exists(select 1 from public.raben_records r where r.created_by=auth.uid() and r.details::text like '%'||(u.paths->>'imagePath')||'%') else exists(select 1 from public.raben_clan_information c where c.images::text like '%'||(u.paths->>'imagePath')||'%') end) order by u.created_at desc),'[]') from (select * from public.raben_upload_drafts where user_id=auth.uid() order by created_at desc limit 200)u;
$$;
revoke all on function public.raben_own_upload_drafts() from public,anon;grant execute on function public.raben_own_upload_drafts() to authenticated;

-- Capacity is checked at every boundary of overlapping bookings, not by adding disjoint bookings.
alter table public.raben_resources add column capacity integer not null default 1 check(capacity between 1 and 10000);
alter table public.raben_reservations add column units integer not null default 1 check(units between 1 and 10000);
grant update(capacity) on public.raben_resources to authenticated;grant update(units) on public.raben_reservations to authenticated;
create function raben_private.resource_load(p_resource uuid,p_start timestamptz,p_end timestamptz,p_exclude uuid default null) returns integer language sql stable security definer set search_path='' as $$
 with b as(select x.* from public.raben_reservations x join public.raben_records e on e.id=x.record_id where resource_id=p_resource and (p_exclude is null or x.id<>p_exclude) and x.starts_at<p_end and x.ends_at>p_start and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,x.occurrence_date)),points as(select p_start as t union select starts_at from b where starts_at>=p_start and starts_at<p_end)
 select case when auth.uid() is not null and raben_private.is_member() then coalesce(max((select coalesce(sum(units),0) from b where starts_at<=points.t and ends_at>points.t)),0)::integer else 0 end from points;
$$;
revoke all on function raben_private.resource_load(uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
create function raben_private.guard_resource_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;begin
 if tg_op='UPDATE' and new.capacity<old.capacity then
  select coalesce(max(raben_private.resource_load(new.id,b.starts_at,b.ends_at,null)),0) into n from public.raben_reservations b where b.resource_id=new.id and b.ends_at>now();
  if n>new.capacity then raise exception 'capacity_below_bookings' using errcode='23P01';end if;
 end if;return new;end;$$;
revoke all on function raben_private.guard_resource_capacity() from public,anon,authenticated;create trigger guard_resource_capacity before update on public.raben_resources for each row execute function raben_private.guard_resource_capacity();
create function public.raben_resource_remaining(p_resource uuid,p_record uuid,p_date date,p_setup integer default 0,p_teardown integer default 0) returns integer language plpgsql security invoker set search_path='' as $$
declare d jsonb;c integer;begin
 if p_setup not between 0 and 1440 or p_teardown not between 0 and 1440 then raise exception 'invalid_buffer';end if;
 select details into d from public.raben_records where id=p_record and kind='event';select capacity into c from public.raben_resources where id=p_resource and active;
 if d is null or c is null or not raben_private.event_occurs(d,p_date) then raise exception 'invalid_occurrence';end if;
 return greatest(0,c-raben_private.resource_load(p_resource,raben_private.event_start(d,p_date)-make_interval(mins=>p_setup),raben_private.event_start(d,p_date)+make_interval(mins=>coalesce((d->'occurrenceChanges'->p_date::text->>'duration')::integer,(d->>'duration')::integer,120)+p_teardown),null));
end;$$;
-- This bounded helper discloses only aggregate load of a clan resource to active members.
grant execute on function raben_private.resource_load(uuid,timestamptz,timestamptz,uuid) to authenticated;
revoke all on function public.raben_resource_remaining(uuid,uuid,date,integer,integer) from public,anon;grant execute on function public.raben_resource_remaining(uuid,uuid,date,integer,integer) to authenticated;

create function raben_private.series_impact(p_id uuid,p_details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.raben_records;result jsonb;begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=p_id and kind='event' and (created_by=auth.uid() or raben_private.has_permission('calendar'));
 if not found then raise exception 'entry_access_denied' using errcode='42501';end if;
 with days as(select occurrence_date d from public.raben_event_slots where record_id=p_id union select occurrence_date from public.raben_event_reminders where record_id=p_id union select occurrence_date from public.raben_reservations where record_id=p_id)
 select coalesce(jsonb_agg(jsonb_build_object('date',d,'occurs',raben_private.event_occurs(p_details,d),'moved',raben_private.event_start(r.details,d) is distinct from raben_private.event_start(p_details,d),'attendees',(select count(*) from public.raben_event_slots where record_id=p_id and occurrence_date=d),'reminders',(select count(*) from public.raben_event_reminders where record_id=p_id and occurrence_date=d),'reservations',(select count(*) from public.raben_reservations where record_id=p_id and occurrence_date=d)) order by d),'[]') into result from days;
 return jsonb_build_object('revision',r.revision,'days',result);end;$$;
revoke all on function raben_private.series_impact(uuid,jsonb) from public,anon;grant execute on function raben_private.series_impact(uuid,jsonb) to authenticated;
create function public.raben_series_impact(p_id uuid,p_details jsonb) returns jsonb language sql security invoker set search_path='' as $$select raben_private.series_impact(p_id,p_details)$$;
revoke all on function public.raben_series_impact(uuid,jsonb) from public,anon;grant execute on function public.raben_series_impact(uuid,jsonb) to authenticated;

-- Variant material lists reuse the validated recipe guard and history snapshots.
create table public.raben_recipe_variants(id uuid primary key default gen_random_uuid(),recipe_id uuid not null references public.raben_recipes(id) on delete cascade,title text not null check(length(btrim(title)) between 1 and 100),materials jsonb not null check(jsonb_typeof(materials)='array' and jsonb_array_length(materials) between 1 and 40),packages jsonb not null default '{}' check(jsonb_typeof(packages)='object'),waste_percent numeric not null default 0 check(waste_percent between 0 and 100),revision bigint not null default 1);
create index recipe_variants_recipe_idx on public.raben_recipe_variants(recipe_id);
alter table public.raben_recipe_variants enable row level security;revoke all on public.raben_recipe_variants from public,anon,authenticated;grant select,insert,delete on public.raben_recipe_variants to authenticated;grant update(title,materials,packages,waste_percent) on public.raben_recipe_variants to authenticated;
create policy variants_read on public.raben_recipe_variants for select to authenticated using((select raben_private.is_member()));
create policy variants_write on public.raben_recipe_variants for all to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content'))))) with check((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content')))));
create trigger guard_recipe before insert or update on public.raben_recipe_variants for each row execute function raben_private.guard_recipe();
create function raben_private.guard_variant_packages() returns trigger language plpgsql security invoker set search_path='' as $$declare k text;v jsonb;begin
 for k,v in select * from jsonb_each(new.packages) loop if k!~'^[a-f0-9-]{36}$' or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 0.001 and 1000000000 or (v#>>'{}')::numeric<>round((v#>>'{}')::numeric,3) then raise exception 'invalid_package';end if;end loop;return new;end;$$;
revoke all on function raben_private.guard_variant_packages() from public,anon,authenticated;create trigger guard_variant_packages before insert or update on public.raben_recipe_variants for each row execute function raben_private.guard_variant_packages();
create function public.raben_compare_materials(p_recipe uuid,p_multiplier numeric,p_reserve numeric default 0) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not raben_private.is_member() or p_multiplier is null or p_multiplier<=0 or p_multiplier>10000 or p_multiplier::text in ('NaN','Infinity','-Infinity') or p_reserve is null or p_reserve<0 or p_reserve>100 or p_reserve::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid_multiplier';end if;
 return coalesce((with variants as(select null::uuid id,title,materials,packages,0::numeric waste_percent from public.raben_recipes where id=p_recipe union all select id,title,materials,packages,waste_percent from public.raben_recipe_variants where recipe_id=p_recipe)
 select jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'waste',v.waste_percent,'materials',(select jsonb_agg(jsonb_build_object('item_id',s.id,'name',s.name,'unit',s.unit,'raw',round((m->>'quantity')::numeric*p_multiplier,3),'required',ceil(round((m->>'quantity')::numeric*p_multiplier*(1+(v.waste_percent+p_reserve)/100),3)/coalesce((v.packages->>s.id::text)::numeric,0.001))*coalesce((v.packages->>s.id::text)::numeric,0.001),'available',s.quantity)) from jsonb_array_elements(v.materials)m join public.raben_stock_items s on s.id=(m->>'item_id')::uuid))) from variants v),'[]');end;$$;
revoke all on function public.raben_compare_materials(uuid,numeric,numeric) from public,anon;grant execute on function public.raben_compare_materials(uuid,numeric,numeric) to authenticated;

create table public.raben_stock_watches(user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,item_id uuid not null references public.raben_stock_items(id) on delete cascade,minimum numeric(14,3) not null check(minimum>0 and minimum::text not in ('NaN','Infinity','-Infinity')),notified boolean not null default false,primary key(user_id,item_id));
create index stock_watches_item_idx on public.raben_stock_watches(item_id);
alter table public.raben_stock_watches enable row level security;revoke all on public.raben_stock_watches from public,anon,authenticated;grant select,insert,delete on public.raben_stock_watches to authenticated;grant update(minimum) on public.raben_stock_watches to authenticated;
create policy own_stock_watches on public.raben_stock_watches for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.check_low_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare w record;v numeric;begin
 if tg_table_name='raben_stock_watches' then
  select quantity into v from public.raben_stock_items where id=new.item_id for update;
  new.notified:=v<new.minimum;
  if new.notified and (tg_op='INSERT' or old.minimum is distinct from new.minimum) then insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(new.user_id,'stock','Ein beobachteter Lagerbestand liegt unter deiner Mindestmenge','stock',new.item_id);end if;return new;
 end if;
 for w in select * from public.raben_stock_watches where item_id=new.id for update loop
  if new.quantity<w.minimum and not w.notified then insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(w.user_id,'stock','Ein beobachteter Lagerbestand liegt unter deiner Mindestmenge','stock',new.id);end if;
  update public.raben_stock_watches set notified=(new.quantity<w.minimum) where user_id=w.user_id and item_id=w.item_id;
 end loop;return null;end;$$;
revoke all on function raben_private.check_low_stock() from public,anon,authenticated;create trigger check_low_stock before insert or update of minimum on public.raben_stock_watches for each row execute function raben_private.check_low_stock();create trigger check_low_stock after update of quantity on public.raben_stock_items for each row execute function raben_private.check_low_stock();

create or replace function raben_private.entry_collaborator(p_type text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(
  select 1 from public.raben_entry_editors e join public.raben_memberships m on m.user_id=e.owner_id and m.status='active'
  where e.parent_type=p_type and e.parent_id=p_id and e.editor_id=auth.uid() and e.accepted_at is not null and (e.expires_at is null or e.expires_at>now())
  and ((p_type='profile' and exists(select 1 from public.raben_profile_items i where i.id=p_id and i.owner_id=e.owner_id and i.kind in ('character','info')))
   or (p_type='record' and exists(select 1 from public.raben_records r where r.id=p_id and r.created_by=e.owner_id)))
 );
$$;

create or replace function raben_private.guard_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.raben_records;c integer;
begin
 if not raben_private.is_member() or (new.user_id<>auth.uid() and not (pg_trigger_depth()>1)) then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=new.record_id;
 if not found or r.kind<>'event' or r.visibility not in ('clan','public') or not raben_private.event_occurs(r.details,new.occurrence_date) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 select capacity into c from public.raben_resources where id=new.resource_id and (active or tg_op='UPDATE') for update;
 if not found then raise exception 'resource_unavailable' using errcode='23514';end if;
 new.starts_at:=raben_private.event_start(r.details,new.occurrence_date)-make_interval(mins=>new.setup_minutes);
 new.ends_at:=raben_private.event_start(r.details,new.occurrence_date)+make_interval(mins=>coalesce((r.details->'occurrenceChanges'->new.occurrence_date::text->>'duration')::integer,(r.details->>'duration')::integer,120)+new.teardown_minutes);
 if raben_private.resource_load(new.resource_id,new.starts_at,new.ends_at,new.id)+new.units>c then raise exception 'resource_conflict' using errcode='23P01';end if;
 return new;
end;$$;

alter table raben_private.discord_outbox add column scheduled_at timestamptz,add column planned_by uuid references public.raben_memberships(user_id),add column plan_revision bigint not null default 1;
alter table raben_private.discord_route_outbox add column scheduled_at timestamptz,add column planned_by uuid references public.raben_memberships(user_id),add column plan_revision bigint not null default 1;
create index discord_scheduled_idx on raben_private.discord_outbox(scheduled_at) where status='pending';create index discord_route_scheduled_idx on raben_private.discord_route_outbox(scheduled_at) where status='pending';
create table raben_private.discord_plan_history(id uuid primary key default gen_random_uuid(),message_id uuid not null,route_id uuid,actor_id uuid not null references public.raben_memberships(user_id),scheduled_at timestamptz,revision bigint not null,created_at timestamptz not null default now());
alter table raben_private.discord_plan_history enable row level security;revoke all on raben_private.discord_plan_history from public,anon,authenticated;
create function raben_private.schedule_discord(p_id uuid,p_route uuid,p_at timestamptz,p_expected bigint) returns void language plpgsql security definer set search_path='' as $$
declare rev bigint;begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_at is not null and (p_at<now()+interval '1 minute' or p_at>now()+interval '1 year') then raise exception 'invalid_schedule';end if;
 if p_route is null then update raben_private.discord_outbox set scheduled_at=p_at,approved=true,planned_by=auth.uid(),plan_revision=plan_revision+1,updated_at=now() where id=p_id and status='pending' and (p_at is not null or approved) and plan_revision=p_expected returning plan_revision into rev;
 else update raben_private.discord_route_outbox set scheduled_at=p_at,approved=true,planned_by=auth.uid(),plan_revision=plan_revision+1 where id=p_id and route_id=p_route and status='pending' and (p_at is not null or approved) and plan_revision=p_expected returning plan_revision into rev;end if;
 if rev is null then raise exception 'discord_conflict' using errcode='40001';end if;
 insert into raben_private.discord_plan_history(message_id,route_id,actor_id,scheduled_at,revision) values(p_id,p_route,auth.uid(),p_at,rev);end;$$;
revoke all on function raben_private.schedule_discord(uuid,uuid,timestamptz,bigint) from public,anon;grant execute on function raben_private.schedule_discord(uuid,uuid,timestamptz,bigint) to authenticated;
create function public.raben_schedule_discord(p_id uuid,p_route uuid,p_at timestamptz,p_expected bigint) returns void language sql security invoker set search_path='' as $$select raben_private.schedule_discord(p_id,p_route,p_at,p_expected)$$;
revoke all on function public.raben_schedule_discord(uuid,uuid,timestamptz,bigint) from public,anon;grant execute on function public.raben_schedule_discord(uuid,uuid,timestamptz,bigint) to authenticated;

create or replace function raben_private.dispatch_discord() returns void language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;q raben_private.discord_outbox;response record;address text;pause_seconds integer;still_visible boolean;code integer;response_body text;
begin
 if not pg_try_advisory_xact_lock(591832004) then return;end if;
 select * into c from raben_private.discord_config where id=1;
 if not c.enabled or c.secret_id is null then return;end if;
 select decrypted_secret into address from vault.decrypted_secrets where id=c.secret_id;
 if address is null then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 -- Any interrupted request is retried with the existing attempt limit.
 update raben_private.discord_outbox set status=case when attempts<5 then 'pending' else 'failed' end,next_attempt=now(),updated_at=now() where status='sending';
 for q in select * from raben_private.discord_outbox where status='pending' and approved and not paused and next_attempt<=now() and (scheduled_at is null or scheduled_at<=now()) order by created_at limit 3 for update skip locked loop
  still_visible:=q.scope='test';
  if q.source_table='raben_records' then
   select exists(select 1 from public.raben_records r where r.id=q.source_key and r.visibility in ('clan','public') and r.kind=q.scope and r.revision::text=q.source_revision) into still_visible;
  elsif q.source_table='raben_clan_posts' then
   select exists(select 1 from public.raben_clan_posts p where p.id=q.source_key and md5(jsonb_build_object('title',p.title,'body',p.body,'category',p.category,'event_date',p.event_date,'updated',extract(epoch from p.updated_at))::text)=q.source_revision) into still_visible;
  end if;
  if not still_visible or q.config_revision<>c.revision or (q.scope<>'test' and not(q.scope=any(c.scopes))) then update raben_private.discord_outbox set status='cancelled',updated_at=now() where id=q.id;continue;end if;
  code:=null;response_body:=null;
  begin
   select * into response from extensions.http_post(address||'?wait=true',q.payload::text,'application/json');
   code:=response.status;response_body:=response.content;
  exception when others then
   -- Network errors can contain URLs. Persist only status and retry information.
   code:=null;
  end;
  pause_seconds:=least(3600,(30*power(2,q.attempts+1))::integer);
  if code=429 and response_body is not null then
   begin pause_seconds:=greatest(pause_seconds,least(86400,ceil((response_body::jsonb->>'retry_after')::numeric)::integer));exception when others then null;end;
  end if;
  update raben_private.discord_outbox set
   status=case when code between 200 and 299 then 'sent' when q.attempts+1<5 and (code=429 or code>=500 or code is null) then 'pending' else 'failed' end,
   attempts=attempts+1,request_id=null,status_code=code,next_attempt=now()+make_interval(secs=>pause_seconds),updated_at=now() where id=q.id;
 end loop;
 delete from raben_private.discord_outbox where status in ('sent','failed','cancelled') and created_at<now()-interval '30 days';
end;$$;

create or replace function raben_private.dispatch_discord_routes() returns void language plpgsql security definer set search_path='' as $$
declare q raben_private.discord_route_outbox;c raben_private.discord_routes;address text;response record;code integer;wait_seconds integer;visible boolean;
begin
 if not pg_try_advisory_xact_lock(591832023) then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 update raben_private.discord_route_outbox set status=case when attempts<5 then 'pending' else 'failed' end where status='sending';
 for q in select * from raben_private.discord_route_outbox where status='pending' and approved and not paused and next_attempt<=now() and (scheduled_at is null or scheduled_at<=now()) order by created_at limit 3 for update skip locked loop
  select * into c from raben_private.discord_routes where id=q.route_id;
  visible:=false;
  if q.source_table='raben_records' then select exists(select 1 from public.raben_records where id=q.source_key and visibility in ('clan','public') and kind=q.scope and revision::text=q.source_revision) into visible;
  else select exists(select 1 from public.raben_clan_posts p where id=q.source_key and md5(jsonb_build_object('title',p.title,'body',p.body,'category',p.category,'event_date',p.event_date,'updated',extract(epoch from p.updated_at))::text)=q.source_revision) into visible;end if;
  if not visible or not c.enabled or c.revision<>q.config_revision or not(q.scope=any(c.scopes)) then update raben_private.discord_route_outbox set status='cancelled' where id=q.id;continue;end if;
  select decrypted_secret into address from vault.decrypted_secrets where id=c.secret_id;code:=null;wait_seconds:=least(3600,(30*power(2,q.attempts+1))::integer);
  if address is not null then begin select * into response from extensions.http_post(address||case when strpos(address,'?')>0 then '&wait=true' else '?wait=true' end,q.payload::text,'application/json');code:=response.status;
   if code=429 then begin wait_seconds:=greatest(wait_seconds,least(86400,ceil((response.content::jsonb->>'retry_after')::numeric)::integer));exception when others then null;end;end if;
  exception when others then code:=null;end;end if;
  update raben_private.discord_route_outbox set status=case when code between 200 and 299 then 'sent' when attempts+1<5 and (code is null or code=429 or code>=500) then 'pending' else 'failed' end,attempts=attempts+1,status_code=code,next_attempt=now()+make_interval(secs=>wait_seconds) where id=q.id;
 end loop;
 delete from raben_private.discord_route_outbox where status in ('sent','failed','cancelled') and created_at<now()-interval '30 days';
end;$$;

create or replace function raben_private.discord_review(p_action text,p_route uuid default null,p_id uuid default null,p_scopes text[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_action='settings' then
  if p_scopes is null or array_position(p_scopes,null) is not null or not(p_scopes<@array['posts','event','poll']) then raise exception 'invalid_scopes';end if;
  if p_route is null then update raben_private.discord_config set review_scopes=p_scopes where id=1;update raben_private.discord_outbox set approved=false where status='pending' and scope=any(p_scopes);else update raben_private.discord_routes set review_scopes=p_scopes where id=p_route;update raben_private.discord_route_outbox set approved=false where status='pending' and route_id=p_route and scope=any(p_scopes);end if;
 elsif p_action in ('approve','pause','resume','cancel') then
  if p_route is null then update raben_private.discord_outbox set approved=case when p_action='approve' then true else approved end,paused=case when p_action='pause' then true when p_action='resume' then false else paused end,status=case when p_action='cancel' then 'cancelled' else status end where id=p_id and status='pending';
  else update raben_private.discord_route_outbox set approved=case when p_action='approve' then true else approved end,paused=case when p_action='pause' then true when p_action='resume' then false else paused end,status=case when p_action='cancel' then 'cancelled' else status end where id=p_id and route_id=p_route and status='pending';end if;
 elsif p_action<>'list' then raise exception 'invalid_action';end if;
 return jsonb_build_object('routes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'review_scopes',review_scopes)) from raben_private.discord_routes),'[]'),'default_scopes',coalesce((select to_jsonb(review_scopes) from raben_private.discord_config where id=1),'[]'),'messages',coalesce((select jsonb_agg(x) from(select id,null::uuid route_id,scope,payload,approved,paused,status,created_at,scheduled_at,plan_revision,planned_by from raben_private.discord_outbox where status='pending' union all select id,route_id,scope,payload,approved,paused,status,created_at,scheduled_at,plan_revision,planned_by from raben_private.discord_route_outbox where status='pending' order by created_at limit 100)x),'[]'));
end;$$;

notify pgrst,'reload schema';

create function public.raben_save_notice_settings(p_data jsonb) returns void language sql security invoker set search_path='' as $$
 insert into public.raben_notice_settings(user_id,topics,quiet_start,quiet_end,time_zone,desktop) values(auth.uid(),array(select jsonb_array_elements_text(p_data->'topics')),nullif(p_data->>'quiet_start','')::time,nullif(p_data->>'quiet_end','')::time,p_data->>'time_zone',coalesce((p_data->>'desktop')::boolean,false)) on conflict(user_id) do update set topics=excluded.topics,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,time_zone=excluded.time_zone,desktop=excluded.desktop;
$$;
create function public.raben_save_chat_preference(p_peer uuid,p_archived boolean,p_muted boolean) returns void language sql security invoker set search_path='' as $$insert into public.raben_chat_preferences(user_id,peer_id,archived,muted) values(auth.uid(),p_peer,p_archived,p_muted) on conflict(user_id,peer_id) do update set archived=excluded.archived,muted=excluded.muted;$$;
create function public.raben_save_stock_watch(p_item uuid,p_minimum numeric) returns void language sql security invoker set search_path='' as $$insert into public.raben_stock_watches(user_id,item_id,minimum) values(auth.uid(),p_item,p_minimum) on conflict(user_id,item_id) do update set minimum=excluded.minimum;$$;
revoke all on function public.raben_save_notice_settings(jsonb),public.raben_save_chat_preference(uuid,boolean,boolean),public.raben_save_stock_watch(uuid,numeric) from public,anon;grant execute on function public.raben_save_notice_settings(jsonb),public.raben_save_chat_preference(uuid,boolean,boolean),public.raben_save_stock_watch(uuid,numeric) to authenticated;

create table public.raben_spotify_settings(id integer primary key default 1 check(id=1),client_id text not null default '' check(client_id='' or client_id~'^[a-f0-9]{32}$'));
insert into public.raben_spotify_settings(id) values(1);
alter table public.raben_spotify_settings enable row level security;revoke all on public.raben_spotify_settings from public,anon,authenticated;grant select on public.raben_spotify_settings to anon,authenticated;grant update(client_id) on public.raben_spotify_settings to authenticated;
create policy spotify_config_read on public.raben_spotify_settings for select to anon,authenticated using(true);
create policy spotify_config_admin on public.raben_spotify_settings for update to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
notify pgrst,'reload schema';

create function raben_private.guard_chat_reaction() returns trigger language plpgsql security definer set search_path='' as $$declare m public.raben_direct_messages;begin
 if auth.uid() is null or not raben_private.is_member() or new.user_id<>auth.uid() then raise exception 'chat_denied' using errcode='42501';end if;
 select * into m from public.raben_direct_messages where id=new.message_id and auth.uid() in (sender_id,recipient_id) and withdrawn_at is null;
 if not found or exists(select 1 from public.raben_chat_blocks where (user_id=m.sender_id and blocked_id=m.recipient_id) or (user_id=m.recipient_id and blocked_id=m.sender_id)) then raise exception 'chat_unavailable' using errcode='42501';end if;new.created_at:=now();return new;end;$$;
revoke all on function raben_private.guard_chat_reaction() from public,anon,authenticated;create trigger guard_chat_reaction before insert on public.raben_chat_reactions for each row execute function raben_private.guard_chat_reaction();
create function raben_private.discord_schedule_history(p_id uuid,p_route uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x order by revision desc) from (select actor_id,scheduled_at,revision,created_at from raben_private.discord_plan_history where message_id=p_id and route_id is not distinct from p_route order by revision desc limit 30)x),'[]');end;$$;
revoke all on function raben_private.discord_schedule_history(uuid,uuid) from public,anon;grant execute on function raben_private.discord_schedule_history(uuid,uuid) to authenticated;
create function public.raben_discord_schedule_history(p_id uuid,p_route uuid) returns jsonb language sql security invoker set search_path='' as $$select raben_private.discord_schedule_history(p_id,p_route)$$;
revoke all on function public.raben_discord_schedule_history(uuid,uuid) from public,anon;grant execute on function public.raben_discord_schedule_history(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
