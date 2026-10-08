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
revoke all on function raben_private.dispatch_discord() from public,anon,authenticated;
