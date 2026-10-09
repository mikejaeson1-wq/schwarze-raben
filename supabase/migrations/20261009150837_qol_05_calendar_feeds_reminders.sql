-- Feed credentials and push keys never enter the public site, admin exports or local browser storage.
create table public.raben_calendar_feeds(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 100),mode text not null check(mode in ('all','attending')),
 token_hash text not null unique,revoked boolean not null default false,created_at timestamptz not null default now()
);
create index calendar_feeds_user_idx on public.raben_calendar_feeds(user_id);
alter table public.raben_calendar_feeds enable row level security;
revoke all on public.raben_calendar_feeds from public,anon,authenticated;
grant select(id,user_id,title,mode,revoked,created_at) on public.raben_calendar_feeds to authenticated;
create policy calendar_feeds_self on public.raben_calendar_feeds for select to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.create_calendar_feed(p_title text,p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');fid uuid;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 perform 1 from public.raben_memberships where user_id=auth.uid() and status='active' for update;
 if (select count(*) from public.raben_calendar_feeds where user_id=auth.uid() and not revoked)>=5 then raise exception 'feed_limit' using errcode='23514';end if;
 insert into public.raben_calendar_feeds(user_id,title,mode,token_hash) values(auth.uid(),btrim(p_title),p_mode,encode(sha256(convert_to(token,'UTF8')),'hex')) returning id into fid;
 return jsonb_build_object('id',fid,'token',token);
end;$$;
create function raben_private.revoke_calendar_feed(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 update public.raben_calendar_feeds set revoked=true where id=p_id and user_id=auth.uid();
 if not found then raise exception 'feed_missing' using errcode='42501';end if;
end;$$;
revoke all on function raben_private.create_calendar_feed(text,text),raben_private.revoke_calendar_feed(uuid) from public,anon;
grant execute on function raben_private.create_calendar_feed(text,text),raben_private.revoke_calendar_feed(uuid) to authenticated;
create function public.raben_create_calendar_feed(p_title text,p_mode text) returns jsonb language sql security invoker set search_path='' as $$select raben_private.create_calendar_feed(p_title,p_mode)$$;
create function public.raben_revoke_calendar_feed(p_id uuid) returns void language sql security invoker set search_path='' as $$select raben_private.revoke_calendar_feed(p_id)$$;
revoke all on function public.raben_create_calendar_feed(text,text),public.raben_revoke_calendar_feed(uuid) from public,anon;grant execute on function public.raben_create_calendar_feed(text,text),public.raben_revoke_calendar_feed(uuid) to authenticated;
-- Invoked by the Edge Function's server client only, after receiving the secret bearer token.
create function public.raben_calendar_feed_data(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.raben_calendar_feeds;
begin
 if p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into f from public.raben_calendar_feeds where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and not revoked;
 if not found or not exists(select 1 from public.raben_memberships where user_id=f.user_id and status='active') then return null;end if;
 return jsonb_build_object('title',f.title,'events',coalesce((select jsonb_agg(to_jsonb(r)) from (
  select id,title,body,details,revision,updated_at,case when f.mode='attending' then (select jsonb_agg(s.occurrence_date::text order by s.occurrence_date) from public.raben_event_slots s where s.record_id=e.id and s.user_id=f.user_id and s.choice='yes' and s.occurrence_date>=(now() at time zone 'Europe/Berlin')::date-1) else null end as attending_dates from public.raben_records e where kind='event' and visibility in ('clan','public')
  and not coalesce((details->>'cancelled')::boolean,false) and coalesce(nullif(details->>'repeatUntil','')::date,(details->>'date')::date)>=(now() at time zone 'Europe/Berlin')::date-1
  and (f.mode='all' or exists(select 1 from public.raben_event_slots s where s.record_id=e.id and s.user_id=f.user_id and s.choice='yes' and s.occurrence_date>=(now() at time zone 'Europe/Berlin')::date-1)) order by details->>'date',id limit 500
 ) r),'[]'::jsonb));
end;$$;
revoke all on function public.raben_calendar_feed_data(text) from public,anon,authenticated;grant execute on function public.raben_calendar_feed_data(text) to service_role;

create table public.raben_event_reminders(
 record_id uuid not null references public.raben_records(id) on delete cascade,user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 occurrence_date date not null,lead_minutes integer not null default 30 check(lead_minutes between 1 and 10080),push_enabled boolean not null default false,
 created_at timestamptz not null default now(),primary key(record_id,user_id,occurrence_date)
);
create index event_reminders_user_idx on public.raben_event_reminders(user_id,occurrence_date);
create index event_reminders_due_idx on public.raben_event_reminders(occurrence_date);
alter table public.raben_event_reminders enable row level security;
revoke all on public.raben_event_reminders from public,anon,authenticated;
grant select,insert,delete on public.raben_event_reminders to authenticated;grant update(lead_minutes,push_enabled) on public.raben_event_reminders to authenticated;
create policy reminders_self on public.raben_event_reminders for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
create function raben_private.guard_reminder() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.raben_records;start_time timestamptz;
begin
 select * into r from public.raben_records where id=new.record_id and kind='event' and visibility in ('clan','public');
 if not found or not raben_private.event_occurs(r.details,new.occurrence_date) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 start_time:=(new.occurrence_date+coalesce(nullif(r.details->>'time','')::time,'20:00'::time)) at time zone 'Europe/Berlin';
 if start_time<=now() then raise exception 'event_passed' using errcode='23514';end if;return new;
end;$$;
revoke all on function raben_private.guard_reminder() from public,anon,authenticated;
create trigger guard_reminder before insert or update on public.raben_event_reminders for each row execute function raben_private.guard_reminder();
create table public.raben_push_devices(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 20 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|[a-z0-9-]+[.]push[.]services[.]mozilla[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9.-]+[.]notify[.]windows[.]com)/'),
 p256dh text not null check(p256dh~'^[A-Za-z0-9_-]{80,100}={0,2}$'),auth_key text not null check(auth_key~'^[A-Za-z0-9_-]{20,30}={0,2}$'),created_at timestamptz not null default now()
);
create index push_devices_user_idx on public.raben_push_devices(user_id);
alter table public.raben_push_devices enable row level security;
revoke all on public.raben_push_devices from public,anon,authenticated;
grant select,insert,delete on public.raben_push_devices to authenticated;
create policy push_devices_self on public.raben_push_devices for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create table raben_private.reminder_config(id integer primary key check(id=1),vapid_public text,vapid_secret_id uuid,dispatch_secret_id uuid,edge_url text);
create table raben_private.reminder_deliveries(record_id uuid not null,user_id uuid not null,occurrence_date date not null,start_time timestamptz not null,lead_minutes integer not null,created_at timestamptz not null default now(),primary key(record_id,user_id,occurrence_date,start_time,lead_minutes));
create table raben_private.push_jobs(id uuid primary key default gen_random_uuid(),device_id uuid not null references public.raben_push_devices(id) on delete cascade,record_id uuid not null references public.raben_records(id) on delete cascade,occurrence_date date not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),attempts integer not null default 0,next_attempt timestamptz not null default now(),lease_until timestamptz,created_at timestamptz not null default now());
create index push_jobs_due_idx on raben_private.push_jobs(status,next_attempt);create index push_jobs_device_idx on raben_private.push_jobs(device_id);create index push_jobs_record_idx on raben_private.push_jobs(record_id);
revoke all on raben_private.reminder_config,raben_private.reminder_deliveries,raben_private.push_jobs from public,anon,authenticated;
create function raben_private.push_public_key() returns text language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;return(select vapid_public from raben_private.reminder_config where id=1);end;$$;
revoke all on function raben_private.push_public_key() from public,anon;grant execute on function raben_private.push_public_key() to authenticated;
create function public.raben_push_public_key() returns text language sql stable security invoker set search_path='' as $$select raben_private.push_public_key()$$;
revoke all on function public.raben_push_public_key() from public,anon;grant execute on function public.raben_push_public_key() to authenticated;
create function raben_private.queue_event_reminders() returns void language plpgsql security definer set search_path='' as $$
declare r record;due timestamptz;inserted integer;
begin
 if not pg_try_advisory_xact_lock(591832021) then return;end if;
 for r in select m.*,e.details from public.raben_event_reminders m join public.raben_records e on e.id=m.record_id and e.kind='event' and e.visibility in ('clan','public') join public.raben_memberships u on u.user_id=m.user_id and u.status='active' where m.occurrence_date between (now() at time zone 'Europe/Berlin')::date and (now() at time zone 'Europe/Berlin')::date+7 loop
  if not raben_private.event_occurs(r.details,r.occurrence_date) then continue;end if;
  due:=(r.occurrence_date+coalesce(nullif(r.details->>'time','')::time,'20:00'::time)) at time zone 'Europe/Berlin';
  if now()<due-make_interval(mins=>r.lead_minutes) or now()>=due then continue;end if;
  insert into raben_private.reminder_deliveries(record_id,user_id,occurrence_date,start_time,lead_minutes) values(r.record_id,r.user_id,r.occurrence_date,due,r.lead_minutes) on conflict do nothing;
  get diagnostics inserted=row_count;if inserted=0 then continue;end if;
  insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(r.user_id,'event','Deine RP-Terminerinnerung','record',r.record_id);
  if r.push_enabled then insert into raben_private.push_jobs(device_id,record_id,occurrence_date) select id,r.record_id,r.occurrence_date from public.raben_push_devices where user_id=r.user_id;end if;
 end loop;
 delete from raben_private.reminder_deliveries where created_at<now()-interval '90 days';
 delete from raben_private.push_jobs where created_at<now()-interval '30 days';
end;$$;
revoke all on function raben_private.queue_event_reminders() from public,anon,authenticated;
create function public.raben_claim_push_jobs(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.reminder_config;key text;result jsonb;
begin
 select * into c from raben_private.reminder_config where id=1;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.dispatch_secret_id;
 if key is null or p_secret is distinct from key then raise exception 'dispatch_denied' using errcode='42501';end if;
 update raben_private.push_jobs set status=case when attempts<5 then 'pending' else 'failed' end where status='sending' and lease_until<now();
 update raben_private.push_jobs j set status='failed' where status='pending' and not exists(select 1 from public.raben_records e join public.raben_push_devices d on d.id=j.device_id join public.raben_memberships m on m.user_id=d.user_id and m.status='active' where e.id=j.record_id and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,j.occurrence_date) and exists(select 1 from public.raben_event_reminders r where r.record_id=j.record_id and r.user_id=d.user_id and r.occurrence_date=j.occurrence_date and r.push_enabled) and ((j.occurrence_date+coalesce(nullif(e.details->>'time','')::time,'20:00'::time)) at time zone 'Europe/Berlin')>now());
 with chosen as(select id from raben_private.push_jobs where status='pending' and next_attempt<=now() order by created_at limit 20 for update skip locked),claimed as(update raben_private.push_jobs j set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' from chosen where j.id=chosen.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'recordId',j.record_id,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth_key)),'[]') into result from claimed j join public.raben_push_devices d on d.id=j.device_id;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.vapid_secret_id;
 return jsonb_build_object('publicKey',c.vapid_public,'privateKey',key,'jobs',result);
end;$$;
create function public.raben_complete_push_job(p_secret text,p_id uuid,p_status integer) returns void language plpgsql security definer set search_path='' as $$
declare key text;j raben_private.push_jobs;
begin
 select decrypted_secret into key from vault.decrypted_secrets where id=(select dispatch_secret_id from raben_private.reminder_config where id=1);
 if key is null or p_secret is distinct from key then raise exception 'dispatch_denied' using errcode='42501';end if;
 select * into j from raben_private.push_jobs where id=p_id and status='sending' for update;if not found then return;end if;
 if p_status in (404,410) then delete from public.raben_push_devices where id=j.device_id;return;end if;
 update raben_private.push_jobs set status=case when p_status between 200 and 299 then 'sent' when attempts<5 and (p_status=0 or p_status=429 or p_status>=500) then 'pending' else 'failed' end,next_attempt=now()+make_interval(secs=>least(3600,(30*power(2,attempts))::integer)),lease_until=null where id=p_id;
end;$$;
revoke all on function public.raben_claim_push_jobs(text),public.raben_complete_push_job(text,uuid,integer) from public,anon,authenticated;grant execute on function public.raben_claim_push_jobs(text),public.raben_complete_push_job(text,uuid,integer) to service_role;
create function raben_private.dispatch_event_push() returns void language plpgsql security definer set search_path='' as $$
declare c raben_private.reminder_config;key text;response record;
begin
 if not pg_try_advisory_xact_lock(591832022) or not exists(select 1 from raben_private.push_jobs where status in ('pending','sending') and next_attempt<=now()) then return;end if;
 select * into c from raben_private.reminder_config where id=1;if c.edge_url is null then return;end if;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.dispatch_secret_id;if key is null then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 begin select * into response from extensions.http_post(c.edge_url,jsonb_build_object('secret',key)::text,'application/json');exception when others then return;end;
end;$$;
revoke all on function raben_private.dispatch_event_push() from public,anon,authenticated;
select cron.schedule('raben-event-reminders','* * * * *','select raben_private.queue_event_reminders();');
select cron.schedule('raben-event-push','* * * * *','select raben_private.dispatch_event_push();');
