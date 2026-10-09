-- Saving unchanged options must not cancel an already queued test or announcement.
alter table raben_private.discord_config add column checked_at timestamptz,add column check_status integer;
create or replace function raben_private.discord_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c raben_private.discord_config;recent jsonb;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 select * into c from raben_private.discord_config where id=1;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into recent from (select title,status,status_code,attempts,created_at from raben_private.discord_outbox order by created_at desc limit 15) q;
 return jsonb_build_object('configured',c.secret_id is not null,'enabled',c.enabled,'scopes',c.scopes,'updated_at',c.updated_at,'checked_at',c.checked_at,'check_status',c.check_status,'pending',(select count(*) from raben_private.discord_outbox where status in ('pending','sending')),'recent',recent);
end;$$;
create or replace function raben_private.save_discord_webhook(p_url text,p_enabled boolean,p_scopes text[],p_clear boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;address text:=nullif(btrim(p_url),'');old_address text;changed boolean;destination_changed boolean;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_enabled is null or p_clear is null or p_scopes is null or not(p_scopes <@ array['posts','event','poll']) or cardinality(p_scopes)>3 or array_position(p_scopes,null) is not null then raise exception 'invalid_webhook_options' using errcode='23514';end if;
 if address is not null then
  address:=regexp_replace(address,'^https://(canary[.]|ptb[.])?discord(app)?[.]com/','https://discord.com/');
  if length(address)>2048 or address !~ '^https://discord[.]com/api(/v10)?/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{30,200}([?]thread_id=[0-9]{16,22})?$' then raise exception 'invalid_webhook_url' using errcode='23514';end if;
 end if;
 select * into c from raben_private.discord_config where id=1 for update;
 if c.secret_id is not null then select decrypted_secret into old_address from vault.decrypted_secrets where id=c.secret_id;end if;
 destination_changed:=(p_clear and c.secret_id is not null) or (address is not null and address is distinct from old_address);
 if p_clear then p_enabled:=false;end if;
 changed:=destination_changed or p_enabled is distinct from c.enabled or not(p_scopes @> c.scopes and p_scopes <@ c.scopes);
 if not changed then return raben_private.discord_status();end if;
 if p_clear then
  update raben_private.discord_config set secret_id=null where id=1;
  if c.secret_id is not null then delete from vault.secrets where id=c.secret_id;end if;c.secret_id:=null;
 elsif destination_changed then
  if c.secret_id is null then select vault.create_secret(address,'raben_discord_webhook_'||gen_random_uuid()::text,'Schwarze Raben clan notification webhook') into c.secret_id;
  else perform vault.update_secret(c.secret_id,address);end if;
 end if;
 if p_enabled and c.secret_id is null then raise exception 'webhook_required' using errcode='23514';end if;
 update raben_private.discord_outbox set status='cancelled',updated_at=now() where status in ('pending','sending');
 update raben_private.discord_config set secret_id=c.secret_id,enabled=p_enabled,scopes=p_scopes,revision=revision+1,updated_at=now(),checked_at=case when destination_changed then null else checked_at end,check_status=case when destination_changed then null else check_status end where id=1;
 return raben_private.discord_status();
end;$$;
-- Check the already configured endpoint without sending a Discord message.
create function raben_private.check_discord_webhook() returns jsonb language plpgsql security definer set search_path='' as $$
declare address text;response record;code integer;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 select s.decrypted_secret into address from raben_private.discord_config c join vault.decrypted_secrets s on s.id=c.secret_id where c.id=1;
 if address is null then raise exception 'webhook_required' using errcode='23514';end if;
 if address !~ '^https://discord[.]com/api(/v10)?/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{30,200}([?]thread_id=[0-9]{16,22})?$' then raise exception 'invalid_webhook_url' using errcode='23514';end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 begin select * into response from extensions.http_get(address);code:=response.status;exception when others then code:=null;end;
 update raben_private.discord_config set checked_at=now(),check_status=code where id=1;
 return jsonb_build_object('ok',coalesce(code between 200 and 299,false),'status',code);
end;$$;
revoke all on function raben_private.check_discord_webhook() from public,anon;
grant execute on function raben_private.check_discord_webhook() to authenticated;
create function public.raben_discord_check() returns jsonb language sql security invoker set search_path='' as $$select raben_private.check_discord_webhook()$$;
revoke all on function public.raben_discord_check() from public,anon;
grant execute on function public.raben_discord_check() to authenticated;

-- Cron sends directly; the private outbox stores content and status, never credentials.
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
 for q in select * from raben_private.discord_outbox where status='pending' and next_attempt<=now() order by created_at limit 3 for update skip locked loop
  still_visible:=q.scope='test';
  if q.source_table='raben_records' then
   select exists(select 1 from public.raben_records r where r.id=q.source_key and r.visibility in ('clan','public') and r.kind=q.scope and r.revision::text=q.source_revision) into still_visible;
  elsif q.source_table='raben_clan_posts' then
   select exists(select 1 from public.raben_clan_posts p where p.id=q.source_key and md5(jsonb_build_object('title',p.title,'body',p.body,'category',p.category,'event_date',p.event_date,'updated',extract(epoch from p.updated_at))::text)=q.source_revision) into still_visible;
  end if;
  if not still_visible or q.config_revision<>c.revision or (q.scope<>'test' and not(q.scope=any(c.scopes))) then update raben_private.discord_outbox set status='cancelled',updated_at=now() where id=q.id;continue;end if;
  code:=null;response_body:=null;
  begin
   select * into response from extensions.http_post(address||case when strpos(address,'?')>0 then '&wait=true' else '?wait=true' end,q.payload::text,'application/json');
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
revoke all on function raben_private.dispatch_discord() from public,anon,authenticated;

-- Only clan-wide posts, published events and published polls produce messages.
create or replace function raben_private.queue_discord_change() returns trigger language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;s text;rid uuid;rev text;label text;link text;description text;record_visible boolean;
begin
 rid:=coalesce(new.id,old.id);
 if tg_op='UPDATE' and new.title=old.title and new.body=old.body then
  if tg_table_name='raben_clan_posts' then
  if new.category=old.category and new.event_date is not distinct from old.event_date then
   rev:=md5(jsonb_build_object('title',new.title,'body',new.body,'category',new.category,'event_date',new.event_date,'updated',extract(epoch from new.updated_at))::text);
   update raben_private.discord_outbox set source_revision=rev where source_table=tg_table_name and source_key=new.id and status='pending';return new;end if;
  elsif tg_table_name='raben_records' and new.details=old.details and new.visibility=old.visibility then
   update raben_private.discord_outbox set source_revision=new.revision::text where source_table=tg_table_name and source_key=new.id and status='pending';return new;
  end if;
 end if;

 update raben_private.discord_outbox set status='cancelled',updated_at=now() where source_table=tg_table_name and source_key=rid and status in ('pending','sending');
 if tg_op='DELETE' then return old;end if;
 select * into c from raben_private.discord_config where id=1;
 if not c.enabled or c.secret_id is null then return new;end if;
 if tg_table_name='raben_clan_posts' then
  s:='posts';label:='Clanhinweis';rev:=md5(jsonb_build_object('title',new.title,'body',new.body,'category',new.category,'event_date',new.event_date,'updated',extract(epoch from new.updated_at))::text);link:='clan.html#post-'||new.id::text;
 else
  if new.kind not in ('event','poll') or new.visibility not in ('clan','public') then return new;end if;
  s:=new.kind;label:=case s when 'event' then 'Clantermin' else 'Abstimmung' end;rev:=new.revision::text;link:='clan.html?eintrag='||new.id::text;
 end if;
 if not(s=any(c.scopes)) then return new;end if;
 if tg_op='UPDATE' and new.title=old.title and new.body=old.body then
  if tg_table_name='raben_clan_posts' then
   if new.category=old.category and new.event_date is not distinct from old.event_date then return new;end if;
  elsif new.details=old.details and new.visibility=old.visibility then return new;end if;
 end if;
 description:=case when tg_op='INSERT' then 'Neu im Clan.' else 'Im Clan aktualisiert.' end||' Öffnen über die Discord-Anmeldung auf der Website.';
 if tg_table_name='raben_records' and s='event' then
  description:=description||E'\nTermin: '||coalesce(new.details->>'date','')||' '||coalesce(new.details->>'time','')||' (Europe/Berlin)';
  if coalesce((new.details->>'cancelled')::boolean,false) then description:=description||E'\nDieser Termin wurde abgesagt.';end if;
 end if;
 insert into raben_private.discord_outbox(source_table,source_key,source_revision,scope,title,payload,config_revision)
 values(tg_table_name,rid,rev,s,new.title,jsonb_build_object('username','Schwarze Raben','allowed_mentions',jsonb_build_object('parse',jsonb_build_array()),'embeds',jsonb_build_array(jsonb_build_object('title',left(label||' · '||new.title,256),'description',left(description,2000),'url','https://mikejaeson1-wq.github.io/schwarze-raben/'||link,'color',13149292))),c.revision)
 on conflict(source_table,source_key,source_revision) do nothing;
 return new;
end;$$;
