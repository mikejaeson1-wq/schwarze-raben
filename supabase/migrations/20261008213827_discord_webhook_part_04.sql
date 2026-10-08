-- Server-side delivery runs even when no member has the website open.
create function raben_private.dispatch_discord() returns void language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;q raben_private.discord_outbox;response record;address text;request bigint;pause_seconds integer;still_visible boolean;
begin
 if not pg_try_advisory_xact_lock(591832004) then return;end if;
 select * into c from raben_private.discord_config where id=1;
 for q in select * from raben_private.discord_outbox where status='sending' for update skip locked loop
  select * into response from net._http_response where id=q.request_id;
  if found then
   if response.status_code between 200 and 299 then
    update raben_private.discord_outbox set status='sent',status_code=response.status_code,updated_at=now() where id=q.id;
   else
    pause_seconds:=least(3600,(30*power(2,q.attempts))::integer);
    if response.status_code=429 and response.content is not null then
     begin pause_seconds:=greatest(pause_seconds,least(86400,ceil((response.content::jsonb->>'retry_after')::numeric)::integer));exception when others then null;end;
    end if;
    update raben_private.discord_outbox set status=case when q.attempts<5 and (response.status_code=429 or response.status_code>=500 or response.status_code is null) then 'pending' else 'failed' end,status_code=response.status_code,next_attempt=now()+make_interval(secs=>pause_seconds),updated_at=now() where id=q.id;
   end if;
  elsif q.updated_at<now()-interval '2 minutes' then
   update raben_private.discord_outbox set status=case when q.attempts<5 then 'pending' else 'failed' end,next_attempt=now()+interval '1 minute',updated_at=now() where id=q.id;
  end if;
 end loop;
 if not c.enabled or c.secret_id is null then return;end if;
 select decrypted_secret into address from vault.decrypted_secrets where id=c.secret_id;
 if address is null then return;end if;
 -- Process a small ordered batch; retries obey Discord's rate limit response.
 for q in select * from raben_private.discord_outbox where status='pending' and next_attempt<=now() order by created_at limit 5 for update skip locked loop
  still_visible:=q.scope='test';
  if q.source_table='raben_records' then
   select exists(select 1 from public.raben_records r where r.id=q.source_key and r.visibility in ('clan','public') and r.kind=q.scope and r.revision::text=q.source_revision) into still_visible;
  elsif q.source_table='raben_clan_posts' then
   select exists(select 1 from public.raben_clan_posts p where p.id=q.source_key and p.updated_at::text=q.source_revision) into still_visible;
  end if;
  if not still_visible or q.config_revision<>c.revision or (q.scope<>'test' and not(q.scope=any(c.scopes))) then update raben_private.discord_outbox set status='cancelled',updated_at=now() where id=q.id;continue;end if;
  request:=net.http_post(url:=address,params:=jsonb_build_object('wait','true'),body:=q.payload,headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=10000);
  update raben_private.discord_outbox set status='sending',attempts=attempts+1,request_id=request,updated_at=now() where id=q.id;
 end loop;
 delete from raben_private.discord_outbox where status in ('sent','failed','cancelled') and created_at<now()-interval '30 days';
end;$$;
revoke all on function raben_private.dispatch_discord() from public,anon,authenticated;
select cron.schedule('raben-discord-notifications','* * * * *','select raben_private.dispatch_discord()');
