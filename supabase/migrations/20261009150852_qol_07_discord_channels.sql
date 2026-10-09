-- Additional routes leave the previously configured default webhook and its pending messages intact.
create table raben_private.discord_routes(id uuid primary key default gen_random_uuid(),label text not null check(length(btrim(label)) between 1 and 100),secret_id uuid,enabled boolean not null default false,scopes text[] not null default '{}',revision integer not null default 1,created_at timestamptz not null default now());
create table raben_private.discord_route_outbox(id uuid primary key default gen_random_uuid(),route_id uuid not null references raben_private.discord_routes(id) on delete cascade,source_table text not null,source_key uuid not null,source_revision text not null,scope text not null,payload jsonb not null,config_revision integer not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),attempts integer not null default 0,status_code integer,next_attempt timestamptz not null default now(),created_at timestamptz not null default now(),unique(route_id,source_table,source_key,source_revision));
create index discord_routes_due_idx on raben_private.discord_route_outbox(status,next_attempt);create index discord_routes_fk_idx on raben_private.discord_route_outbox(route_id);
revoke all on raben_private.discord_routes,raben_private.discord_route_outbox from public,anon,authenticated;
create function raben_private.discord_routes_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'enabled',enabled,'scopes',scopes,'configured',secret_id is not null,'revision',revision,'pending',(select count(*) from raben_private.discord_route_outbox where route_id=r.id and status in ('pending','sending')),'recent',coalesce((select jsonb_agg(to_jsonb(q)) from (select status,status_code,attempts,created_at from raben_private.discord_route_outbox where route_id=r.id order by created_at desc limit 5) q),'[]')) order by created_at) from raben_private.discord_routes r),'[]');
end;$$;
create function raben_private.save_discord_route(p_id uuid,p_label text,p_url text,p_enabled boolean,p_scopes text[],p_expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_routes;address text:=nullif(btrim(p_url),'');old_address text;changed boolean;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_enabled is null or p_scopes is null or cardinality(p_scopes)>3 or array_position(p_scopes,null) is not null or not(p_scopes <@ array['posts','event','poll']) then raise exception 'invalid_webhook_options' using errcode='23514';end if;
 if address is not null then
  address:=regexp_replace(address,'^https://(canary[.]|ptb[.])?discord(app)?[.]com/','https://discord.com/');
  if length(address)>2048 or address !~ '^https://discord[.]com/api(/v10)?/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{30,200}([?]thread_id=[0-9]{16,22})?$' then raise exception 'invalid_webhook_url' using errcode='23514';end if;
 end if;
 if p_id is null then
  if (select count(*) from raben_private.discord_routes)>=8 then raise exception 'route_limit' using errcode='23514';end if;
  insert into raben_private.discord_routes(label) values(btrim(p_label)) returning * into c;
 else
  select * into c from raben_private.discord_routes where id=p_id for update;
  if not found or c.revision is distinct from p_expected then raise exception 'route_conflict' using errcode='40001';end if;
 end if;
 select decrypted_secret into old_address from vault.decrypted_secrets where id=c.secret_id;
 changed:=address is not null and address is distinct from old_address;
 if changed then
  if c.secret_id is null then select vault.create_secret(address,'raben_discord_route_'||c.id::text,'Clan category route') into c.secret_id;else perform vault.update_secret(c.secret_id,address);end if;
 end if;
 if p_enabled and c.secret_id is null then raise exception 'webhook_required' using errcode='23514';end if;
 if changed or c.label is distinct from btrim(p_label) or c.enabled is distinct from p_enabled or not(c.scopes @> p_scopes and c.scopes <@ p_scopes) then
  update raben_private.discord_routes set label=btrim(p_label),enabled=p_enabled,scopes=p_scopes,secret_id=c.secret_id,revision=revision+1 where id=c.id;
  update raben_private.discord_route_outbox set status='cancelled' where route_id=c.id and status in ('pending','sending');
 end if;return raben_private.discord_routes_status();
end;$$;
create function raben_private.remove_discord_route(p_id uuid,p_expected integer) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 delete from raben_private.discord_routes where id=p_id and revision=p_expected returning secret_id into sid;
 if not found then raise exception 'route_conflict' using errcode='40001';end if;if sid is not null then delete from vault.secrets where id=sid;end if;
end;$$;
create function raben_private.discord_payload(p_type text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare title text;description text;link text;label text;r public.raben_records;p public.raben_clan_posts;
begin
 if p_type='post' then select * into p from public.raben_clan_posts where id=p_id;if not found then return null;end if;title:=p.title;label:='Clanhinweis';link:='clan.html#post-'||p.id::text;
 elsif p_type='record' then
  select * into r from public.raben_records where id=p_id and kind in ('event','poll') and visibility in ('clan','public');if not found then return null;end if;
  title:=r.title;label:=case r.kind when 'event' then 'Clantermin' else 'Abstimmung' end;link:='clan.html?eintrag='||r.id::text;
 else return null;end if;
 description:='Neuigkeiten im Clan. Öffnen über die Discord-Anmeldung auf der Website.';
 if r.kind='event' then description:=description||E'\nTermin: '||coalesce(r.details->>'date','')||' '||coalesce(r.details->>'time','')||' (Europe/Berlin)';if coalesce((r.details->>'cancelled')::boolean,false) then description:=description||E'\nDieser Termin wurde abgesagt.';end if;end if;
 return jsonb_build_object('username','Schwarze Raben','allowed_mentions',jsonb_build_object('parse',jsonb_build_array()),'embeds',jsonb_build_array(jsonb_build_object('title',left(label||' · '||title,256),'description',left(description,2000),'url','https://mikejaeson1-wq.github.io/schwarze-raben/'||link,'color',13149292)));
end;$$;
-- The preview is read-only. No HTTP request is made.
create function raben_private.preview_discord(p_type text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;return raben_private.discord_payload(p_type,p_id);end;$$;
revoke all on function raben_private.discord_routes_status(),raben_private.save_discord_route(uuid,text,text,boolean,text[],integer),raben_private.remove_discord_route(uuid,integer),raben_private.preview_discord(text,uuid) from public,anon;
grant execute on function raben_private.discord_routes_status(),raben_private.save_discord_route(uuid,text,text,boolean,text[],integer),raben_private.remove_discord_route(uuid,integer),raben_private.preview_discord(text,uuid) to authenticated;
revoke all on function raben_private.discord_payload(text,uuid) from public,anon,authenticated;
create function public.raben_discord_routes() returns jsonb language sql stable security invoker set search_path='' as $$select raben_private.discord_routes_status()$$;
create function public.raben_save_discord_route(p_id uuid,p_label text,p_url text,p_enabled boolean,p_scopes text[],p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select raben_private.save_discord_route(p_id,p_label,p_url,p_enabled,p_scopes,p_expected)$$;
create function public.raben_remove_discord_route(p_id uuid,p_expected integer) returns void language sql security invoker set search_path='' as $$select raben_private.remove_discord_route(p_id,p_expected)$$;
create function public.raben_discord_preview(p_type text,p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select raben_private.preview_discord(p_type,p_id)$$;
revoke all on function public.raben_discord_routes(),public.raben_save_discord_route(uuid,text,text,boolean,text[],integer),public.raben_remove_discord_route(uuid,integer),public.raben_discord_preview(text,uuid) from public,anon;
grant execute on function public.raben_discord_routes(),public.raben_save_discord_route(uuid,text,text,boolean,text[],integer),public.raben_remove_discord_route(uuid,integer),public.raben_discord_preview(text,uuid) to authenticated;
create function raben_private.queue_discord_routes() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid:=coalesce(new.id,old.id);rev text;scope text;payload jsonb;
begin
 if tg_op='UPDATE' and new.title=old.title and new.body=old.body then
  if tg_table_name='raben_clan_posts' then
   if new.category=old.category and new.event_date is not distinct from old.event_date then rev:=md5(jsonb_build_object('title',new.title,'body',new.body,'category',new.category,'event_date',new.event_date,'updated',extract(epoch from new.updated_at))::text);update raben_private.discord_route_outbox set source_revision=rev where source_table=tg_table_name and source_key=rid and status='pending';return new;end if;
  elsif new.details=old.details and new.visibility=old.visibility then update raben_private.discord_route_outbox set source_revision=new.revision::text where source_table=tg_table_name and source_key=rid and status='pending';return new;end if;
 end if;
 update raben_private.discord_route_outbox set status='cancelled' where source_table=tg_table_name and source_key=rid and status in ('pending','sending');
 if tg_op='DELETE' then return old;end if;
 if tg_table_name='raben_clan_posts' then scope:='posts';rev:=md5(jsonb_build_object('title',new.title,'body',new.body,'category',new.category,'event_date',new.event_date,'updated',extract(epoch from new.updated_at))::text);payload:=raben_private.discord_payload('post',rid);
 else scope:=new.kind;rev:=new.revision::text;payload:=raben_private.discord_payload('record',rid);end if;
 if payload is null then return new;end if;
 insert into raben_private.discord_route_outbox(route_id,source_table,source_key,source_revision,scope,payload,config_revision) select id,tg_table_name,rid,rev,scope,payload,revision from raben_private.discord_routes where enabled and secret_id is not null and scope=any(scopes) on conflict do nothing;
 return new;
end;$$;
revoke all on function raben_private.queue_discord_routes() from public,anon,authenticated;
create trigger queue_discord_routes after insert or update or delete on public.raben_records for each row execute function raben_private.queue_discord_routes();
create trigger queue_discord_routes after insert or update or delete on public.raben_clan_posts for each row execute function raben_private.queue_discord_routes();
create function raben_private.dispatch_discord_routes() returns void language plpgsql security definer set search_path='' as $$
declare q raben_private.discord_route_outbox;c raben_private.discord_routes;address text;response record;code integer;wait_seconds integer;visible boolean;
begin
 if not pg_try_advisory_xact_lock(591832023) then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 update raben_private.discord_route_outbox set status=case when attempts<5 then 'pending' else 'failed' end where status='sending';
 for q in select * from raben_private.discord_route_outbox where status='pending' and next_attempt<=now() order by created_at limit 3 for update skip locked loop
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
 delete from raben_private.discord_route_outbox where created_at<now()-interval '30 days';
end;$$;
revoke all on function raben_private.dispatch_discord_routes() from public,anon,authenticated;
select cron.schedule('raben-discord-routes','* * * * *','select raben_private.dispatch_discord_routes();');
notify pgrst,'reload schema';

-- Use the same previewed payload for future messages on the legacy default route.
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
 values(tg_table_name,rid,rev,s,new.title,raben_private.discord_payload(case when tg_table_name='raben_clan_posts' then 'post' else 'record' end,rid),c.revision)
 on conflict(source_table,source_key,source_revision) do nothing;
 return new;
end;$$;
