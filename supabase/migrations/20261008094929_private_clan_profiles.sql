-- Personal profiles are separate from moderated records and admin backups.
-- No admin override and no public copies of personal images.
create table public.raben_profiles (
  user_id uuid primary key references public.raben_memberships(user_id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index raben_profiles_name_idx on public.raben_profiles(display_name,user_id);
create table public.raben_profile_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.raben_profiles(user_id) on delete cascade,
  kind text not null check (kind in ('avatar','character','info')),
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null default '' check (length(body)<=20000),
  image_path text,
  visibility text not null default 'private' check (visibility in ('private','clan','selected')),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id),
  check (kind<>'avatar' or image_path is not null),
  check (kind<>'info' or image_path is null)
);
create unique index raben_profile_avatar_idx on public.raben_profile_items(owner_id) where kind='avatar';
create index raben_profile_items_owner_idx on public.raben_profile_items(owner_id,kind,created_at);
create index raben_profile_items_image_idx on public.raben_profile_items(image_path) where image_path is not null;
create table public.raben_profile_grants (
  item_id uuid not null,
  owner_id uuid not null,
  grantee_id uuid not null references public.raben_memberships(user_id) on delete cascade,
  primary key(item_id,grantee_id),
  foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade,
  check (owner_id<>grantee_id)
);
create index raben_profile_grants_owner_idx on public.raben_profile_grants(owner_id);
create index raben_profile_grants_recipient_idx on public.raben_profile_grants(grantee_id,item_id);
alter table public.raben_profiles enable row level security;
alter table public.raben_profile_items enable row level security;
alter table public.raben_profile_grants enable row level security;
revoke all on public.raben_profiles,public.raben_profile_items,public.raben_profile_grants from anon,authenticated;
grant select,insert,delete on public.raben_profiles,public.raben_profile_items,public.raben_profile_grants to authenticated;
grant update(display_name) on public.raben_profiles to authenticated;
grant update(title,body,image_path,visibility) on public.raben_profile_items to authenticated;

create policy raben_profiles_read on public.raben_profiles for select to authenticated
  using ((select raben_private.is_member()) and exists(select 1 from public.raben_memberships m where m.user_id=raben_profiles.user_id and m.status='active'));
create policy raben_profiles_create on public.raben_profiles for insert to authenticated
  with check ((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy raben_profiles_edit on public.raben_profiles for update to authenticated
  using ((select raben_private.is_member()) and user_id=(select auth.uid()))
  with check ((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy raben_profiles_delete on public.raben_profiles for delete to authenticated
  using ((select raben_private.is_member()) and user_id=(select auth.uid()));

-- Grant rows carry a composite owner FK, avoiding recursive RLS lookups.
create policy raben_profile_grants_read on public.raben_profile_grants for select to authenticated
  using ((select raben_private.is_member()) and (owner_id=(select auth.uid()) or grantee_id=(select auth.uid())));
create policy raben_profile_grants_create on public.raben_profile_grants for insert to authenticated
  with check ((select raben_private.is_member()) and owner_id=(select auth.uid()) and grantee_id<>owner_id
    and exists(select 1 from public.raben_memberships m where m.user_id=raben_profile_grants.grantee_id and m.status='active'));
create policy raben_profile_grants_delete on public.raben_profile_grants for delete to authenticated
  using ((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_profile_items_read on public.raben_profile_items for select to authenticated
  using ((select raben_private.is_member())
    and exists(select 1 from public.raben_memberships m where m.user_id=raben_profile_items.owner_id and m.status='active')
    and (owner_id=(select auth.uid()) or visibility='clan' or (visibility='selected' and exists(
      select 1 from public.raben_profile_grants g where g.item_id=raben_profile_items.id and g.grantee_id=(select auth.uid())))));
create policy raben_profile_items_create on public.raben_profile_items for insert to authenticated
  with check ((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_profile_items_edit on public.raben_profile_items for update to authenticated
  using ((select raben_private.is_member()) and owner_id=(select auth.uid()))
  with check ((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_profile_items_delete on public.raben_profile_items for delete to authenticated
  using ((select raben_private.is_member()) and owner_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('raben-profile-media','raben-profile-media',false,52428800,array['image/jpeg','image/png','image/webp']);
-- Invoker function: referenced items themselves are filtered by their RLS.
create function raben_private.can_read_profile_image(p_name text) returns boolean
language sql stable security invoker set search_path='' as $$
  select (select raben_private.is_member()) and (
    split_part(p_name,'/',1)=(select auth.uid())::text
    or exists(select 1 from public.raben_profile_items i where i.image_path=p_name)
  );
$$;
revoke all on function raben_private.can_read_profile_image(text) from public,anon;
grant execute on function raben_private.can_read_profile_image(text) to authenticated;
create policy raben_profile_images_read on storage.objects for select to authenticated
  using (bucket_id='raben-profile-media' and raben_private.can_read_profile_image(name));
create policy raben_profile_images_create on storage.objects for insert to authenticated
  with check (bucket_id='raben-profile-media' and (select raben_private.is_member())
    and split_part(name,'/',1)=(select auth.uid())::text and name~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$');
create policy raben_profile_images_delete on storage.objects for delete to authenticated
  using (bucket_id='raben-profile-media' and (select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text
    and not exists(select 1 from public.raben_profile_items i where i.image_path=storage.objects.name));
-- Restrictive guards also protect against unrelated permissive storage policies.
create policy raben_profile_images_read_guard on storage.objects as restrictive for select to authenticated
  using (bucket_id<>'raben-profile-media' or raben_private.can_read_profile_image(name));
create policy raben_profile_images_create_guard on storage.objects as restrictive for insert to authenticated
  with check (bucket_id<>'raben-profile-media' or ((select raben_private.is_member())
    and split_part(name,'/',1)=(select auth.uid())::text and name~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$'));
create policy raben_profile_images_update_guard on storage.objects as restrictive for update to authenticated
  using (bucket_id<>'raben-profile-media') with check (bucket_id<>'raben-profile-media');
create policy raben_profile_images_delete_guard on storage.objects as restrictive for delete to authenticated
  using (bucket_id<>'raben-profile-media' or ((select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text
    and not exists(select 1 from public.raben_profile_items i where i.image_path=storage.objects.name)));
create policy raben_profile_images_anon_guard on storage.objects as restrictive for all to anon
  using (bucket_id<>'raben-profile-media') with check (bucket_id<>'raben-profile-media');

create function raben_private.guard_personal_profile() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not raben_private.is_member() or new.user_id is distinct from auth.uid() then raise exception 'profile_access_denied' using errcode='42501';end if;
  new.display_name:=btrim(new.display_name);
  if tg_op='UPDATE' then
    new.user_id:=old.user_id;new.created_at:=old.created_at;new.revision:=old.revision+1;
  else new.revision:=1;new.created_at:=now();end if;
  new.updated_at:=now();return new;
end;
$$;
create trigger raben_guard_personal_profile before insert or update on public.raben_profiles
  for each row execute function raben_private.guard_personal_profile();
create function raben_private.guard_personal_item() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not raben_private.is_member() or new.owner_id is distinct from auth.uid() then raise exception 'profile_access_denied' using errcode='42501';end if;
  new.title:=btrim(new.title);new.body:=btrim(new.body);new.image_path:=nullif(new.image_path,'');
  if new.image_path is not null then
    if new.image_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or split_part(new.image_path,'/',1)<>new.owner_id::text then
      raise exception 'invalid_profile_image' using errcode='23514';
    end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='raben-profile-media' and o.name=new.image_path) then
      raise exception 'profile_image_missing' using errcode='23514';
    end if;
  end if;
  if tg_op='UPDATE' then
    new.id:=old.id;new.owner_id:=old.owner_id;new.kind:=old.kind;new.created_at:=old.created_at;new.revision:=old.revision+1;
  else new.revision:=1;new.created_at:=now();end if;
  new.updated_at:=now();return new;
end;
$$;
create trigger raben_guard_personal_item before insert or update on public.raben_profile_items
  for each row execute function raben_private.guard_personal_item();
revoke all on function raben_private.guard_personal_profile(),raben_private.guard_personal_item() from public,anon,authenticated;

create function public.raben_save_profile(p_name text,p_expected bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.raben_profiles;
begin
  if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
  if p_expected is null then
    if exists(select 1 from public.raben_profiles where user_id=auth.uid()) then raise exception 'profile_conflict' using errcode='40001';end if;
    insert into public.raben_profiles(user_id,display_name) values(auth.uid(),p_name) returning * into result;
  else
    update public.raben_profiles set display_name=p_name where user_id=auth.uid() and revision=p_expected returning * into result;
    if not found then raise exception 'profile_conflict' using errcode='40001';end if;
  end if;
  return to_jsonb(result);
end;
$$;
-- Item changes and recipient changes commit as a single transaction.
create function public.raben_save_profile_item(p_id uuid,p_kind text,p_title text,p_body text,p_image_path text,p_visibility text,p_recipients uuid[],p_expected bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.raben_profile_items; recipients uuid[];
begin
  if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
  select coalesce(array_agg(distinct r),'{}'::uuid[]) into recipients from unnest(coalesce(p_recipients,'{}'::uuid[])) r;
  if p_visibility='selected' then
    if cardinality(recipients)<1 or cardinality(recipients)>20 or exists(
      select 1 from unnest(recipients) r where r is null or r=auth.uid()
        or not exists(select 1 from public.raben_memberships m where m.user_id=r and m.status='active')
    ) then raise exception 'invalid_profile_recipients' using errcode='23514';end if;
  else recipients:='{}'::uuid[];end if;
  if p_id is null then
    if p_expected is not null then raise exception 'profile_conflict' using errcode='40001';end if;
    insert into public.raben_profile_items(kind,title,body,image_path,visibility)
      values(p_kind,p_title,coalesce(p_body,''),p_image_path,p_visibility) returning * into result;
  else
    select * into result from public.raben_profile_items where id=p_id and owner_id=auth.uid() for update;
    if not found then raise exception 'profile_access_denied' using errcode='42501';end if;
    if result.revision is distinct from p_expected or result.kind<>p_kind then raise exception 'profile_conflict' using errcode='40001';end if;
    update public.raben_profile_items set title=p_title,body=coalesce(p_body,''),image_path=p_image_path,visibility=p_visibility
      where id=p_id and owner_id=auth.uid() returning * into result;
  end if;
  delete from public.raben_profile_grants where item_id=result.id and owner_id=auth.uid();
  insert into public.raben_profile_grants(item_id,owner_id,grantee_id) select result.id,auth.uid(),r from unnest(recipients) r;
  return to_jsonb(result);
end;
$$;
revoke all on function public.raben_save_profile(text,bigint),public.raben_save_profile_item(uuid,text,text,text,text,text,uuid[],bigint) from public,anon;
grant execute on function public.raben_save_profile(text,bigint),public.raben_save_profile_item(uuid,text,text,text,text,text,uuid[],bigint) to authenticated;
-- Deliberately no admin history/export triggers for these personal tables.
