-- Structured character fields and galleries inherit the item's exact privacy, including against other admins.
alter table public.raben_profile_items add column details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=30000),add column preview_path text;
grant update(details,preview_path) on public.raben_profile_items to authenticated;
create index raben_profile_preview_idx on public.raben_profile_items(preview_path) where preview_path is not null;
create table public.raben_profile_gallery (
 id uuid primary key default gen_random_uuid(),item_id uuid not null,owner_id uuid not null default auth.uid(),image_path text not null,preview_path text,caption text not null default '' check(length(caption)<=300),sort_order integer not null default 0,
 foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade
);
create index raben_profile_gallery_item_idx on public.raben_profile_gallery(item_id,sort_order);
create index raben_profile_gallery_owner_idx on public.raben_profile_gallery(owner_id);
create index raben_profile_gallery_image_idx on public.raben_profile_gallery(image_path);
create index raben_profile_gallery_preview_idx on public.raben_profile_gallery(preview_path) where preview_path is not null;
alter table public.raben_profile_gallery enable row level security;
revoke all on public.raben_profile_gallery from public,anon,authenticated;grant select,insert,delete on public.raben_profile_gallery to authenticated;
create policy raben_profile_gallery_read on public.raben_profile_gallery for select to authenticated using(exists(select 1 from public.raben_profile_items i where i.id=raben_profile_gallery.item_id));
create policy raben_profile_gallery_write on public.raben_profile_gallery for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items i where i.id=raben_profile_gallery.item_id and i.kind='character' and i.owner_id=(select auth.uid())));
create policy raben_profile_gallery_delete on public.raben_profile_gallery for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()));
create function raben_private.check_personal_image(p_path text) returns boolean language sql stable security invoker set search_path='' as $$
 select p_path is null or (p_path~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' and split_part(p_path,'/',1)=auth.uid()::text and exists(select 1 from storage.objects where bucket_id='raben-profile-media' and name=p_path));
$$;
revoke all on function raben_private.check_personal_image(text) from public,anon;grant execute on function raben_private.check_personal_image(text) to authenticated;
create function raben_private.guard_profile_expansion() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
 if not raben_private.is_member() or new.owner_id<>auth.uid() or not raben_private.check_personal_image(new.preview_path) then raise exception 'profile_access_denied' using errcode='42501';end if;
 if tg_table_name='raben_profile_gallery' then
  if not raben_private.check_personal_image(new.image_path) then raise exception 'profile_image_missing' using errcode='23514';end if;
  if (select count(*) from public.raben_profile_gallery where item_id=new.item_id)>=12 then raise exception 'gallery_limit' using errcode='23514';end if;
 else
  if exists(select 1 from jsonb_object_keys(new.details) k where k not in ('race','age','origin','appearance','skills','goals','custom')) then raise exception 'invalid_character_details' using errcode='23514';end if;
  if exists(select 1 from jsonb_each(new.details) d where d.key<>'custom' and (jsonb_typeof(d.value)<>'string' or length(d.value#>>'{}')>4000)) then raise exception 'invalid_character_details' using errcode='23514';end if;
  if new.details ? 'custom' then
   if jsonb_typeof(new.details->'custom')<>'array' or jsonb_array_length(new.details->'custom')>12 then raise exception 'invalid_character_details' using errcode='23514';end if;
   for entry in select value from jsonb_array_elements(new.details->'custom') loop
    if jsonb_typeof(entry)<>'object' or length(coalesce(entry->>'label','')) not between 1 and 100 or length(coalesce(entry->>'value',''))>4000 then raise exception 'invalid_character_details' using errcode='23514';end if;
   end loop;
  end if;
 end if;return new;
end;$$;
revoke all on function raben_private.guard_profile_expansion() from public,anon,authenticated;
create trigger raben_guard_profile_extra before insert or update on public.raben_profile_items for each row execute function raben_private.guard_profile_expansion();
create trigger raben_guard_gallery before insert on public.raben_profile_gallery for each row execute function raben_private.guard_profile_expansion();
create or replace function raben_private.can_read_profile_image(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select raben_private.is_member() and (split_part(p_name,'/',1)=auth.uid()::text or exists(select 1 from public.raben_profile_items where image_path=p_name or preview_path=p_name) or exists(select 1 from public.raben_profile_gallery where image_path=p_name or preview_path=p_name) or exists(select 1 from public.raben_profiles where avatar_path=p_name));
$$;
create function raben_private.personal_image_unused(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.raben_profile_items where image_path=p_name or preview_path=p_name) and not exists(select 1 from public.raben_profile_gallery where image_path=p_name or preview_path=p_name) and not exists(select 1 from public.raben_profiles where avatar_path=p_name);
$$;
revoke all on function raben_private.personal_image_unused(text) from public,anon;grant execute on function raben_private.personal_image_unused(text) to authenticated;
alter policy raben_profile_images_delete on storage.objects using(bucket_id='raben-profile-media' and (select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text and raben_private.personal_image_unused(name));
alter policy raben_profile_images_delete_guard on storage.objects using(bucket_id<>'raben-profile-media' or ((select raben_private.is_member()) and split_part(name,'/',1)=(select auth.uid())::text and raben_private.personal_image_unused(name)));
create function public.raben_save_profile_entry(p_id uuid,p_kind text,p_title text,p_body text,p_image_path text,p_visibility text,p_recipients uuid[],p_expected bigint,p_details jsonb,p_preview text,p_gallery jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;row public.raben_profile_items;entry jsonb;
begin
 if jsonb_typeof(p_gallery) is distinct from 'array' or jsonb_array_length(p_gallery)>12 then raise exception 'invalid_gallery' using errcode='23514';end if;
 result:=public.raben_save_profile_item(p_id,p_kind,p_title,p_body,p_image_path,p_visibility,p_recipients,p_expected);
 update public.raben_profile_items set details=coalesce(p_details,'{}'),preview_path=p_preview where id=(result->>'id')::uuid returning * into row;
 delete from public.raben_profile_gallery where item_id=row.id and owner_id=auth.uid();
 for entry in select value from jsonb_array_elements(p_gallery) loop
  insert into public.raben_profile_gallery(item_id,image_path,preview_path,caption,sort_order) values(row.id,entry->>'image_path',entry->>'preview_path',coalesce(entry->>'caption',''),coalesce((entry->>'sort_order')::integer,0));
 end loop;return to_jsonb(row);
end;$$;
revoke all on function public.raben_save_profile_entry(uuid,text,text,text,text,text,uuid[],bigint,jsonb,text,jsonb) from public,anon;grant execute on function public.raben_save_profile_entry(uuid,text,text,text,text,text,uuid[],bigint,jsonb,text,jsonb) to authenticated;

