-- Clan-visible account identity is separate from individually shared profile items.
-- Membership identity, Discord verification and role grants are unchanged.
alter table public.raben_profiles add column avatar_path text;
create index raben_profiles_avatar_idx on public.raben_profiles(avatar_path) where avatar_path is not null;
grant update(avatar_path) on public.raben_profiles to authenticated;

create or replace function raben_private.guard_personal_profile() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not raben_private.is_member() or new.user_id is distinct from auth.uid() then raise exception 'profile_access_denied' using errcode='42501';end if;
  new.display_name:=btrim(new.display_name);new.avatar_path:=nullif(new.avatar_path,'');
  if new.avatar_path is not null then
    if new.avatar_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or split_part(new.avatar_path,'/',1)<>new.user_id::text then
      raise exception 'invalid_profile_image' using errcode='23514';
    end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='raben-profile-media' and o.name=new.avatar_path) then
      raise exception 'profile_image_missing' using errcode='23514';
    end if;
  end if;
  if tg_op='UPDATE' then
    new.user_id:=old.user_id;new.created_at:=old.created_at;new.revision:=old.revision+1;
  else new.revision:=1;new.created_at:=now();end if;
  new.updated_at:=now();return new;
end;
$$;

create function public.raben_save_account(p_name text,p_avatar_path text,p_expected bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.raben_profiles;
begin
  if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
  if p_expected is null then
    if exists(select 1 from public.raben_profiles where user_id=auth.uid()) then raise exception 'profile_conflict' using errcode='40001';end if;
    insert into public.raben_profiles(user_id,display_name,avatar_path) values(auth.uid(),p_name,p_avatar_path) returning * into result;
  else
    update public.raben_profiles set display_name=p_name,avatar_path=p_avatar_path
      where user_id=auth.uid() and revision=p_expected returning * into result;
    if not found then raise exception 'profile_conflict' using errcode='40001';end if;
  end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.raben_save_account(text,text,bigint) from public,anon;
grant execute on function public.raben_save_account(text,text,bigint) to authenticated;

-- Both tables are RLS filtered: account images are clan-visible, item images keep their own ACL.
create or replace function raben_private.can_read_profile_image(p_name text) returns boolean
language sql stable security invoker set search_path='' as $$
  select (select raben_private.is_member()) and (
    split_part(p_name,'/',1)=(select auth.uid())::text
    or exists(select 1 from public.raben_profile_items i where i.image_path=p_name)
    or exists(select 1 from public.raben_profiles p where p.avatar_path=p_name)
  );
$$;
alter policy raben_profile_images_delete on storage.objects
  using (bucket_id='raben-profile-media' and (select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text
    and not exists(select 1 from public.raben_profile_items i where i.image_path=storage.objects.name)
    and not exists(select 1 from public.raben_profiles p where p.avatar_path=storage.objects.name));
alter policy raben_profile_images_delete_guard on storage.objects
  using (bucket_id<>'raben-profile-media' or ((select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text
    and not exists(select 1 from public.raben_profile_items i where i.image_path=storage.objects.name)
    and not exists(select 1 from public.raben_profiles p where p.avatar_path=storage.objects.name)));
