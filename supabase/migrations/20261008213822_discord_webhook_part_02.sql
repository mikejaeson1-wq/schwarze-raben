create function raben_private.save_discord_webhook(p_url text,p_enabled boolean,p_scopes text[],p_clear boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;address text:=nullif(btrim(p_url),'');
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_enabled is null or p_clear is null or p_scopes is null or not(p_scopes <@ array['posts','event','poll']) or cardinality(p_scopes)>3 then raise exception 'invalid_webhook_options' using errcode='23514';end if;
 if address is not null and (length(address)>2048 or address !~ '^https://discord\.com/api(/v10)?/webhooks/[0-9]{16,22}/[A-Za-z0-9_-]{30,200}$') then raise exception 'invalid_webhook_url' using errcode='23514';end if;
 select * into c from raben_private.discord_config where id=1 for update;
 if p_clear then
  update raben_private.discord_config set secret_id=null where id=1;
  if c.secret_id is not null then delete from vault.secrets where id=c.secret_id;end if;c.secret_id:=null;p_enabled:=false;
 elsif address is not null then
  if c.secret_id is null then select vault.create_secret(address,'raben_discord_webhook','Schwarze Raben clan notification webhook') into c.secret_id;
  else perform vault.update_secret(c.secret_id,address);end if;
 end if;
 if p_enabled and c.secret_id is null then raise exception 'webhook_required' using errcode='23514';end if;
 -- Cancel queued requests from the previous configuration, including its old destination.
 delete from net.http_request_queue where id in(select request_id from raben_private.discord_outbox where status='sending');
 update raben_private.discord_outbox set status='cancelled',updated_at=now() where status in ('pending','sending');
 update raben_private.discord_config set secret_id=c.secret_id,enabled=p_enabled,scopes=p_scopes,revision=revision+1,updated_at=now() where id=1;
 return raben_private.discord_status();
end;$$;
revoke all on function raben_private.save_discord_webhook(text,boolean,text[],boolean) from public,anon;
grant execute on function raben_private.save_discord_webhook(text,boolean,text[],boolean) to authenticated;
create function public.raben_save_discord_webhook(p_url text,p_enabled boolean,p_scopes text[],p_clear boolean default false)
returns jsonb language sql security invoker set search_path='' as $$select raben_private.save_discord_webhook(p_url,p_enabled,p_scopes,p_clear)$$;
revoke all on function public.raben_save_discord_webhook(text,boolean,text[],boolean) from public,anon;
grant execute on function public.raben_save_discord_webhook(text,boolean,text[],boolean) to authenticated;
