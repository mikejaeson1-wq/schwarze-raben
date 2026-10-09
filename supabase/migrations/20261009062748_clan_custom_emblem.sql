create table public.raben_branding(id integer primary key check(id=1),image_path text,revision bigint not null default 1,updated_at timestamptz not null default now());
alter table public.raben_branding enable row level security;
revoke all on public.raben_branding from public,anon,authenticated;
grant select on public.raben_branding to anon,authenticated;
grant update(image_path) on public.raben_branding to authenticated;
create policy raben_branding_read on public.raben_branding for select to anon,authenticated using(true);
create policy raben_branding_edit on public.raben_branding for update to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
insert into public.raben_branding(id) values(1);
create function raben_private.guard_clan_emblem() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if new.image_path is not null and (new.image_path !~ '^[a-f0-9-]{36}[.]png$' or not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.image_path)) then raise exception 'invalid_emblem' using errcode='23514';end if;
 new.revision:=old.revision+1;new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_clan_emblem() from public,anon,authenticated;
create trigger raben_guard_emblem before update on public.raben_branding for each row execute function raben_private.guard_clan_emblem();
create function public.raben_save_emblem(p_path text,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.raben_branding;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 update public.raben_branding set image_path=p_path where id=1 and revision=p_expected returning * into result;
 if not found then raise exception 'emblem_conflict' using errcode='40001';end if;return to_jsonb(result);
end;$$;
revoke all on function public.raben_save_emblem(text,bigint) from public,anon;
grant execute on function public.raben_save_emblem(text,bigint) to authenticated;

create or replace function raben_private.file_in_use(p_bucket text,p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or not raben_private.is_member() or
 exists(select 1 from public.raben_records where details::text like '%'||p_name||'%') or
 exists(select 1 from public.raben_site_content where content::text like '%'||p_name||'%') or
 exists(select 1 from public.raben_content_versions where snapshot::text like '%'||p_name||'%') or (p_bucket='raben-public' and exists(select 1 from public.raben_branding where image_path=p_name));
$$;
