-- pg_net was introduced only for this feature and has no pending requests.
-- Abort rather than removing anything used by another Database Webhook.
do $$
begin
 if exists(select 1 from pg_extension where extname='pg_net') then
  if exists(select 1 from net.http_request_queue) then raise exception 'pg_net_has_pending_requests';end if;
  if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where n.nspname='supabase_functions' and p.proname='http_request' and not t.tgisinternal) then raise exception 'pg_net_has_database_webhooks';end if;
 end if;
end;$$;
drop extension if exists pg_net;
