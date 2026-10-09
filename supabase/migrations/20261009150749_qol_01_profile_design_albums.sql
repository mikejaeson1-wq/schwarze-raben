-- QOL 1-5: independent foreground opacity, banner framing and private album/theme tools.
create function raben_private.valid_banner_layout(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text;v numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>1000 then return false;end if;
 for k in select jsonb_object_keys(p) loop
  if k not in ('height','focusX','focusY','zoom','boxOpacity') or jsonb_typeof(p->k)<>'number' then return false;end if;
  v:=(p->>k)::numeric;
  if v<>trunc(v) or (case k when 'height' then v not between 160 and 800 when 'zoom' then v not between 100 and 300 else v not between 0 and 100 end) then return false;end if;
 end loop;return true;
end;$$;
revoke all on function raben_private.valid_banner_layout(jsonb) from public,anon;
grant execute on function raben_private.valid_banner_layout(jsonb) to authenticated;
alter table public.raben_profiles add column banner_layout jsonb not null default '{}' check(raben_private.valid_banner_layout(banner_layout));
grant update(banner_layout) on public.raben_profiles to authenticated;
create function public.raben_save_banner_layout(p_path text,p_opacity integer,p_layout jsonb,p_expected bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.raben_profiles;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 update public.raben_profiles set banner_path=p_path,banner_opacity=p_opacity,banner_layout=p_layout where user_id=auth.uid() and revision=p_expected returning * into result;
 if not found then raise exception 'profile_conflict' using errcode='40001';end if;return to_jsonb(result);
end;$$;
revoke all on function public.raben_save_banner_layout(text,integer,jsonb,bigint) from public,anon;
grant execute on function public.raben_save_banner_layout(text,integer,jsonb,bigint) to authenticated;

create or replace function raben_private.valid_profile_style(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>2000 then return false;end if;
 for k in select jsonb_object_keys(p) loop
  if k not in ('background','panel','text','accent','heading','font','overlay','imageOpacity') then return false;end if;
  if k in ('overlay','imageOpacity') then
   if jsonb_typeof(p->k)<>'number' or (p->>k)::numeric not between 0 and 100 or (p->>k)::numeric<>trunc((p->>k)::numeric) then return false;end if;
  elsif jsonb_typeof(p->k)<>'string' then return false;
  elsif k in ('background','panel','text','accent','heading') and p->>k !~ '^#[0-9a-fA-F]{6}$' then return false;end if;
 end loop;
 return coalesce(p->>'font','default') in ('default','system','serif','arial','verdana','monospace','fraktur','medieval','palatino','trebuchet','tahoma','times');
end;$$;

create table public.raben_theme_templates(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 100),theme text not null check(theme in ('standard','nordic','forest','aether','abyss','parchment','custom')),
 style jsonb not null default '{}' check(raben_private.valid_profile_style(style)),background_path text,preview_path text,created_at timestamptz not null default now()
);
create index raben_theme_templates_user_idx on public.raben_theme_templates(user_id,created_at desc);
alter table public.raben_theme_templates enable row level security;
revoke all on public.raben_theme_templates from public,anon,authenticated;
grant select,insert,delete on public.raben_theme_templates to authenticated;
create policy templates_own on public.raben_theme_templates for all to authenticated
 using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_theme_template() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() or new.user_id<>auth.uid() or not raben_private.check_personal_image(new.background_path) or not raben_private.check_personal_image(new.preview_path) then raise exception 'profile_access_denied' using errcode='42501';end if;
 if new.background_path is null and new.preview_path is not null then raise exception 'invalid_profile_image' using errcode='23514';end if;return new;
end;$$;
revoke all on function raben_private.guard_theme_template() from public,anon,authenticated;
create trigger guard_theme_template before insert on public.raben_theme_templates for each row execute function raben_private.guard_theme_template();

create table public.raben_profile_albums(
 id uuid primary key default gen_random_uuid(),item_id uuid not null,owner_id uuid not null default auth.uid(),
 title text not null check(length(btrim(title)) between 1 and 100),sort_order integer not null default 0 check(sort_order between 0 and 10000),
 foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade,unique(id,item_id,owner_id)
);
create index raben_profile_albums_item_idx on public.raben_profile_albums(item_id,sort_order);
alter table public.raben_profile_albums enable row level security;
revoke all on public.raben_profile_albums from public,anon,authenticated;
grant select,insert,delete on public.raben_profile_albums to authenticated;
grant update(title,sort_order) on public.raben_profile_albums to authenticated;
create policy albums_read on public.raben_profile_albums for select to authenticated using(exists(select 1 from public.raben_profile_items i where i.id=item_id));
create policy albums_write on public.raben_profile_albums for all to authenticated
 using((select raben_private.is_member()) and owner_id=(select auth.uid()))
 with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items i where i.id=item_id and i.kind='character' and i.owner_id=(select auth.uid())));
alter table public.raben_profile_gallery add column album_id uuid;
alter table public.raben_profile_gallery add constraint profile_gallery_album_fk foreign key(album_id,item_id,owner_id) references public.raben_profile_albums(id,item_id,owner_id) on delete set null (album_id);
create index raben_profile_gallery_album_idx on public.raben_profile_gallery(album_id,sort_order);
grant update(album_id) on public.raben_profile_gallery to authenticated;
create function public.raben_order_profile_gallery(p_item uuid,p_images jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare image jsonb;n integer:=0;
begin
 if not raben_private.is_member() or not exists(select 1 from public.raben_profile_items where id=p_item and owner_id=auth.uid() and kind='character') then raise exception 'profile_access_denied' using errcode='42501';end if;
 if jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>12 or (select count(distinct value->>'id') from jsonb_array_elements(p_images))<>jsonb_array_length(p_images)
 or jsonb_array_length(p_images)<>(select count(*) from public.raben_profile_gallery where item_id=p_item) then raise exception 'invalid_gallery' using errcode='23514';end if;
 for image in select value from jsonb_array_elements(p_images) loop
  update public.raben_profile_gallery set sort_order=n,album_id=nullif(image->>'album_id','')::uuid where id=(image->>'id')::uuid and item_id=p_item and owner_id=auth.uid();
  if not found then raise exception 'profile_access_denied' using errcode='42501';end if;n:=n+1;
 end loop;
end;$$;
revoke all on function public.raben_order_profile_gallery(uuid,jsonb) from public,anon;
grant execute on function public.raben_order_profile_gallery(uuid,jsonb) to authenticated;

create function raben_private.valid_clan_layout(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>80000 then return false;end if;
 for k in select jsonb_object_keys(p) loop if k not in ('columns','gap','imageSpacing','order') then return false;end if;end loop;
 if p ? 'columns' and (jsonb_typeof(p->'columns')<>'number' or (p->>'columns')::numeric not in (1,2,3)) then return false;end if;
 if p ? 'gap' and (jsonb_typeof(p->'gap')<>'number' or (p->>'gap')::numeric not between 0 and 48) then return false;end if;
 if p ? 'imageSpacing' and (jsonb_typeof(p->'imageSpacing')<>'number' or (p->>'imageSpacing')::numeric not between 0 and 48) then return false;end if;
 if p ? 'order' then
  if jsonb_typeof(p->'order')<>'object' then return false;end if;
  for k,v in select * from jsonb_each(p->'order') loop
   if k not in ('body','rules','playtimes','contact') or jsonb_typeof(v)<>'array' or jsonb_array_length(v)>2024 then return false;end if;
   if exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^(text:[0-9]{1,4}|image:[a-f0-9-]{36})$') then return false;end if;
   if (select count(distinct value) from jsonb_array_elements(v))<>jsonb_array_length(v) then return false;end if;
  end loop;
 end if;return true;
end;$$;
revoke all on function raben_private.valid_clan_layout(jsonb) from public,anon;
grant execute on function raben_private.valid_clan_layout(jsonb) to authenticated;
alter table public.raben_clan_information add column layout jsonb not null default '{}' check(raben_private.valid_clan_layout(layout));
grant update(layout) on public.raben_clan_information to authenticated;
create index raben_records_kind_updated_id_idx on public.raben_records(kind,updated_at desc,id);
create index raben_records_speaker_idx on public.raben_records((details->>'speakerId')) where details ? 'speakerId';
