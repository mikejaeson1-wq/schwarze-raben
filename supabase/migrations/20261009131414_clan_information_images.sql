-- Clan-information images stay private; only active admins may edit or upload.
create function raben_private.valid_clan_info_images(p_images jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;path_pattern constant text := '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$';
begin
  if p_images is null or jsonb_typeof(p_images)<>'array' then return false;end if;
  if jsonb_array_length(p_images)>24 or octet_length(p_images::text)>30000 then return false;end if;
  for item in select value from jsonb_array_elements(p_images) loop
    if jsonb_typeof(item)<>'object' then return false;end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('id','section','imagePath','previewPath','position','width','paragraph','title')) then return false;end if;
    if coalesce(item->>'id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or coalesce(item->>'section','') not in ('body','rules','playtimes','contact')
      or coalesce(item->>'position','') not in ('left','right','center','wide')
      or coalesce(item->>'imagePath','') !~ path_pattern then return false;end if;
    if item->>'previewPath' is not null and item->>'previewPath' !~ path_pattern then return false;end if;
    if coalesce(jsonb_typeof(item->'width'),'')<>'number' or coalesce(jsonb_typeof(item->'paragraph'),'')<>'number' then return false;end if;
    if (item->>'width')::numeric not between 15 and 100 or (item->>'width')::numeric<>trunc((item->>'width')::numeric)
      or (item->>'paragraph')::numeric not between 0 and 2000 or (item->>'paragraph')::numeric<>trunc((item->>'paragraph')::numeric) then return false;end if;
    if coalesce(jsonb_typeof(item->'title'),'')<>'string' or length(item->>'title')>120 then return false;end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_images) i group by i->>'id' having count(*)>1) then return false;end if;
  return true;
end;$$;
revoke all on function raben_private.valid_clan_info_images(jsonb) from public,anon;
grant execute on function raben_private.valid_clan_info_images(jsonb) to authenticated;

alter table public.raben_clan_information add column images jsonb not null default '[]'
  check(raben_private.valid_clan_info_images(images));
grant update(images) on public.raben_clan_information to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('raben-clan-info-media','raben-clan-info-media',false,52428800,array['image/jpeg','image/png','image/webp']);

create function raben_private.guard_clan_info_images() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item jsonb;path text;
begin
  for item in select value from jsonb_array_elements(new.images) loop
    for path in select item->>'imagePath' union all select item->>'previewPath' loop
      if path is not null and not exists(select 1 from storage.objects where bucket_id='raben-clan-info-media' and name=path) then
        raise exception 'invalid_clan_info_image' using errcode='23514';
      end if;
    end loop;
  end loop;
  return new;
end;$$;
revoke all on function raben_private.guard_clan_info_images() from public,anon,authenticated;
create trigger guard_clan_info_images before insert or update of images on public.raben_clan_information
for each row execute function raben_private.guard_clan_info_images();

create policy clan_info_image_read on storage.objects for select to authenticated using(
  bucket_id='raben-clan-info-media' and (select raben_private.is_member()) and
  (((select raben_private.is_admin()) and split_part(name,'/',1)=(select auth.uid())::text)
    or exists(select 1 from public.raben_clan_information c cross join lateral jsonb_array_elements(c.images) i
      where i->>'imagePath'=name or i->>'previewPath'=name)));
create policy clan_info_image_insert on storage.objects for insert to authenticated with check(
  bucket_id='raben-clan-info-media' and (select raben_private.is_admin()) and
  split_part(name,'/',1)=(select auth.uid())::text and
  name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$');
create policy clan_info_image_delete on storage.objects for delete to authenticated using(
  bucket_id='raben-clan-info-media' and (select raben_private.is_admin()) and
  split_part(name,'/',1)=(select auth.uid())::text and
  not exists(select 1 from public.raben_clan_information c cross join lateral jsonb_array_elements(c.images) i
    where i->>'imagePath'=name or i->>'previewPath'=name));

-- Restrictive boundaries also apply when an unrelated permissive storage policy exists.
create policy clan_info_image_read_boundary on storage.objects as restrictive for select to authenticated using(
  bucket_id<>'raben-clan-info-media' or ((select raben_private.is_member()) and
    (((select raben_private.is_admin()) and split_part(name,'/',1)=(select auth.uid())::text)
      or exists(select 1 from public.raben_clan_information c cross join lateral jsonb_array_elements(c.images) i
        where i->>'imagePath'=name or i->>'previewPath'=name))));
create policy clan_info_image_insert_boundary on storage.objects as restrictive for insert to authenticated with check(
  bucket_id<>'raben-clan-info-media' or ((select raben_private.is_admin()) and
    split_part(name,'/',1)=(select auth.uid())::text and
    name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$'));
create policy clan_info_image_delete_boundary on storage.objects as restrictive for delete to authenticated using(
  bucket_id<>'raben-clan-info-media' or ((select raben_private.is_admin()) and
    split_part(name,'/',1)=(select auth.uid())::text and
    not exists(select 1 from public.raben_clan_information c cross join lateral jsonb_array_elements(c.images) i
      where i->>'imagePath'=name or i->>'previewPath'=name)));
create policy clan_info_image_no_replace on storage.objects as restrictive for update to authenticated
using(bucket_id<>'raben-clan-info-media') with check(bucket_id<>'raben-clan-info-media');
