-- Only clan-wide posts, published events and published polls produce messages.
create or replace function raben_private.queue_discord_change() returns trigger language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;s text;rid uuid;rev text;label text;link text;description text;record_visible boolean;
begin
 rid:=coalesce(new.id,old.id);
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
