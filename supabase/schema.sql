-- Schwarze Raben: serverseitige Rechte, Discord-Identitäten und gemeinsame Inhalte.
-- Eigene raben_-Tabellen; bestehende Anwendungen werden nicht verändert. Keine geheimen Werte enthalten.
begin;
create schema if not exists raben_private;
revoke all on schema raben_private from public;
grant usage on schema raben_private to authenticated;

create table public.raben_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique not null check (discord_id ~ '^[0-9]{16,22}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'admin' or status = 'active')
);
create table raben_private.admin_allowlist (
  discord_id text primary key check (discord_id ~ '^[0-9]{16,22}$')
);
revoke all on raben_private.admin_allowlist from public, anon, authenticated;
create table public.raben_site_content (
  id integer primary key check (id = 1),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 500000),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.raben_clan_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 30000),
  category text not null default 'info' check (category in ('info','aushang','termin')),
  event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);
create index raben_posts_created_by_idx on public.raben_clan_posts(created_by);
alter table public.raben_memberships enable row level security;
alter table public.raben_site_content enable row level security;
alter table public.raben_clan_posts enable row level security;
revoke all on public.raben_memberships, public.raben_site_content, public.raben_clan_posts from public, anon, authenticated;
grant select on public.raben_site_content to anon, authenticated;
grant update(content) on public.raben_site_content to authenticated;
grant select on public.raben_memberships to authenticated;
grant update(status, role) on public.raben_memberships to authenticated;
grant select, insert, delete on public.raben_clan_posts to authenticated;
grant update(title, body, category, event_date) on public.raben_clan_posts to authenticated;

create function raben_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.raben_memberships where user_id = auth.uid() and status = 'active' and role = 'admin');
$$;
create function raben_private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.raben_memberships where user_id = auth.uid() and status = 'active');
$$;
revoke all on function raben_private.is_admin(), raben_private.is_member() from public;
grant execute on function raben_private.is_admin(), raben_private.is_member() to authenticated;

create policy public_site_read on public.raben_site_content for select to anon, authenticated using (true);
create policy admins_edit_site on public.raben_site_content for update to authenticated using ((select raben_private.is_admin())) with check ((select raben_private.is_admin()));
create policy membership_visibility on public.raben_memberships for select to authenticated using (
  user_id = (select auth.uid()) or (select raben_private.is_admin()) or (status = 'active' and (select raben_private.is_member()))
);
create policy admins_manage_members on public.raben_memberships for update to authenticated using ((select raben_private.is_admin())) with check ((select raben_private.is_admin()));
create policy members_read_posts on public.raben_clan_posts for select to authenticated using ((select raben_private.is_member()));
create policy admins_create_posts on public.raben_clan_posts for insert to authenticated with check ((select raben_private.is_admin()) and created_by = (select auth.uid()));
create policy admins_edit_posts on public.raben_clan_posts for update to authenticated using ((select raben_private.is_admin())) with check ((select raben_private.is_admin()));
create policy admins_delete_posts on public.raben_clan_posts for delete to authenticated using ((select raben_private.is_admin()));

create function raben_private.guard_membership() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.status = 'active' and (new.role <> 'admin' or new.status <> 'active') then
    perform pg_catalog.pg_advisory_xact_lock(734621987);
    if not exists (select 1 from public.raben_memberships where user_id <> old.user_id and status = 'active' and role = 'admin') then
      raise exception 'last_admin' using errcode = '42501';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
create trigger guard_membership before update on public.raben_memberships for each row execute function raben_private.guard_membership();
create function raben_private.touch_content() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  new.revision := old.revision + 1;
  return new;
end;
$$;
create trigger touch_content before update on public.raben_site_content for each row execute function raben_private.touch_content();
create function raben_private.touch_post() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := pg_catalog.now(); return new; end;
$$;
create trigger touch_post before update on public.raben_clan_posts for each row execute function raben_private.touch_post();

-- Discord-ID ausschließlich aus auth.identities, niemals aus frei änderbaren Profilfeldern.
-- Es gibt keinen automatischen 'erster Nutzer wird Admin'-Mechanismus.
create function raben_private.raben_request_membership() returns public.raben_memberships language plpgsql security definer set search_path = '' as $$
declare
  identity_row auth.identities;
  profile public.raben_memberships;
  owner_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into identity_row from auth.identities where user_id = auth.uid() and provider = 'discord' limit 1;
  if not found then raise exception 'Discord identity required' using errcode = '28000'; end if;
  select exists(select 1 from raben_private.admin_allowlist where discord_id = identity_row.provider_id) into owner_allowed;
  insert into public.raben_memberships(user_id, discord_id, display_name, status, role)
  values (
    auth.uid(), identity_row.provider_id,
    left(coalesce(nullif(identity_row.identity_data->>'full_name',''), nullif(identity_row.identity_data->>'global_name',''), nullif(identity_row.identity_data->>'name',''), nullif(identity_row.identity_data->>'user_name',''), 'Discord-Mitglied'),100),
    case when owner_allowed then 'active' else 'pending' end,
    case when owner_allowed then 'admin' else 'member' end
  )
  on conflict (user_id) do nothing
  returning * into profile;
  if not found then
    select * into profile from public.raben_memberships where user_id = auth.uid();
  end if;
  if owner_allowed and (profile.status <> 'active' or profile.role <> 'admin') then
    update public.raben_memberships set status = 'active', role = 'admin' where user_id = auth.uid() returning * into profile;
  end if;
  return profile;
end;
$$;
revoke all on function raben_private.raben_request_membership() from public;
grant execute on function raben_private.raben_request_membership() to authenticated;
create function public.raben_request_membership() returns setof public.raben_memberships language sql security invoker set search_path = '' as $$
  select m.* from raben_private.raben_request_membership() as m;
$$;
revoke all on function public.raben_request_membership() from public, anon;
grant execute on function public.raben_request_membership() to authenticated;
revoke all on function raben_private.guard_membership(), raben_private.touch_content(), raben_private.touch_post() from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raben-public','raben-public',true,8388608,array['image/jpeg','image/png','image/webp']);
create policy admins_upload_images on storage.objects for insert to authenticated with check (bucket_id = 'raben-public' and (select raben_private.is_admin()));
create policy admins_read_image_objects on storage.objects for select to authenticated using (bucket_id = 'raben-public' and (select raben_private.is_admin()));
create policy admins_delete_images on storage.objects for delete to authenticated using (bucket_id = 'raben-public' and (select raben_private.is_admin()));
-- Auch spätere allgemeine Storage-Policies dürfen keine Bearbeitung durch Clan-Fremde erlauben.
create policy raben_bucket_admin_guard on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'raben-public' or (select raben_private.is_admin()))
with check (bucket_id <> 'raben-public' or (select raben_private.is_admin()));
-- Der öffentliche Bucket enthält ausschließlich Hintergrundbilder für die öffentliche Seite.
-- Geschlossene Clan-Inhalte liegen nur in der durch RLS geschützten raben_clan_posts-Tabelle.
commit;
