-- Hosted extensions. Local tests replace these statements with controlled stubs.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Webhook tokens never appear in public tables, status responses, backups or browser caches.
create table raben_private.discord_config (
 id integer primary key check(id=1),secret_id uuid references vault.secrets(id),
 enabled boolean not null default false,scopes text[] not null default array['posts','event','poll'],
 revision integer not null default 1,updated_at timestamptz not null default now(),
 check(cardinality(scopes)<=3 and scopes <@ array['posts','event','poll'])
);
create table raben_private.discord_outbox (
 id uuid primary key default gen_random_uuid(),source_table text not null,source_key uuid not null,
 source_revision text not null,scope text not null,title text not null,payload jsonb not null,
 config_revision integer not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0,request_id bigint,status_code integer,
 next_attempt timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(source_table,source_key,source_revision)
);
create index raben_discord_pending_idx on raben_private.discord_outbox(next_attempt) where status in ('pending','sending');
alter table raben_private.discord_config enable row level security;
alter table raben_private.discord_outbox enable row level security;
revoke all on raben_private.discord_config,raben_private.discord_outbox from public,anon,authenticated;
insert into raben_private.discord_config(id) values(1);

create function raben_private.discord_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c raben_private.discord_config;recent jsonb;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 select * into c from raben_private.discord_config where id=1;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into recent from
 (select title,status,status_code,created_at from raben_private.discord_outbox order by created_at desc limit 15) q;
 return jsonb_build_object('configured',c.secret_id is not null,'enabled',c.enabled,'scopes',c.scopes,'pending',(select count(*) from raben_private.discord_outbox where status in ('pending','sending')),'recent',recent);
end;$$;
revoke all on function raben_private.discord_status() from public,anon;
grant execute on function raben_private.discord_status() to authenticated;
create function public.raben_discord_status() returns jsonb language sql security invoker set search_path='' as $$select raben_private.discord_status()$$;
revoke all on function public.raben_discord_status() from public,anon;
grant execute on function public.raben_discord_status() to authenticated;
