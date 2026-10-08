-- Only clan-wide posts, published events and published polls produce messages.
create function raben_private.queue_discord_change() returns trigger language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;s text;rid uuid;rev text;label text;link text;description text;record_visible boolean;
begin
 rid:=coalesce(new.id,old.id);
 delete from net.http_request_queue where id in(select request_id from raben_private.discord_outbox where source_table=tg_table_name and source_key=rid and status='sending');
 update raben_private.discord_outbox set status='cancelled',updated_at=now() where source_table=tg_table_name and source_key=rid and status in ('pending','sending');
 if tg_op='DELETE' then return old;end if;
 select * into c from raben_private.discord_config where id=1;
 if not c.enabled or c.secret_id is null then return new;end if;
 if tg_table_name='raben_clan_posts' then
  s:='posts';label:='Clanhinweis';rev:=new.updated_at::text;link:='clan.html#post-'||new.id::text;
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
revoke all on function raben_private.queue_discord_change() from public,anon,authenticated;
create trigger queue_discord_posts after insert or update or delete on public.raben_clan_posts for each row execute function raben_private.queue_discord_change();
create trigger queue_discord_records after insert or update or delete on public.raben_records for each row execute function raben_private.queue_discord_change();

create function raben_private.test_discord_webhook() returns void language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 select * into c from raben_private.discord_config where id=1;
 if c.secret_id is null or not c.enabled then raise exception 'webhook_required' using errcode='23514';end if;
 if exists(select 1 from raben_private.discord_outbox where scope='test' and created_at>now()-interval '1 minute') then raise exception 'test_rate_limit' using errcode='23514';end if;
 insert into raben_private.discord_outbox(source_table,source_key,source_revision,scope,title,payload,config_revision)
 values('test',gen_random_uuid(),'1','test','Webhook-Test',jsonb_build_object('username','Schwarze Raben','content','Die Discord-Verbindung der Schwarzen Raben funktioniert.','allowed_mentions',jsonb_build_object('parse',jsonb_build_array())),c.revision);
end;$$;
revoke all on function raben_private.test_discord_webhook() from public,anon;
grant execute on function raben_private.test_discord_webhook() to authenticated;
create function public.raben_discord_test() returns void language sql security invoker set search_path='' as $$select raben_private.test_discord_webhook()$$;
revoke all on function public.raben_discord_test() from public,anon;
grant execute on function public.raben_discord_test() to authenticated;
