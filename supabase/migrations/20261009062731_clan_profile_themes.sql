-- Profile banners are clan-visible; character designs inherit the character's privacy.
alter table public.raben_profiles add column banner_path text;
grant update(banner_path) on public.raben_profiles to authenticated;
create function raben_private.guard_profile_banner() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.check_personal_image(new.banner_path) then raise exception 'invalid_profile_image' using errcode='23514';end if;return new;
end;$$;
revoke all on function raben_private.guard_profile_banner() from public,anon,authenticated;
create trigger raben_guard_banner before insert or update on public.raben_profiles for each row execute function raben_private.guard_profile_banner();
create function public.raben_save_profile_banner(p_path text,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.raben_profiles;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 update public.raben_profiles set banner_path=p_path where user_id=auth.uid() and revision=p_expected returning * into result;
 if not found then raise exception 'profile_conflict' using errcode='40001';end if;return to_jsonb(result);
end;$$;
revoke all on function public.raben_save_profile_banner(text,bigint) from public,anon;
grant execute on function public.raben_save_profile_banner(text,bigint) to authenticated;
create function raben_private.valid_profile_style(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and octet_length(p::text)<=2000
 and not exists(select 1 from jsonb_object_keys(p) k where k not in ('background','panel','text','accent','heading','font','overlay'))
 and not exists(select 1 from jsonb_each(p) e where (e.key<>'overlay' and jsonb_typeof(e.value)<>'string') or (e.key='overlay' and (jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 20 and 95)))
 and not exists(select 1 from jsonb_each_text(p) e where e.key in ('background','panel','text','accent','heading') and e.value !~ '^#[0-9a-fA-F]{6}$')
 and coalesce(p->>'font','default') in ('default','system','serif','arial','verdana','monospace','fraktur','medieval','palatino','trebuchet','tahoma','times'),false);
$$;
revoke all on function raben_private.valid_profile_style(jsonb) from public,anon;
grant execute on function raben_private.valid_profile_style(jsonb) to authenticated;
create table public.raben_profile_styles (
 item_id uuid primary key,owner_id uuid not null default auth.uid(),
 theme text not null default 'standard' check(theme in ('standard','nordic','forest','aether','abyss','parchment','custom')),
 style jsonb not null default '{}' check(raben_private.valid_profile_style(style)),background_path text,preview_path text,updated_at timestamptz not null default now(),
 foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade
);
create index raben_profile_styles_owner_idx on public.raben_profile_styles(owner_id);
create index raben_profile_styles_background_idx on public.raben_profile_styles(background_path) where background_path is not null;
create index raben_profile_styles_preview_idx on public.raben_profile_styles(preview_path) where preview_path is not null;
alter table public.raben_profile_styles enable row level security;
revoke all on public.raben_profile_styles from public,anon,authenticated;
grant select,insert,delete on public.raben_profile_styles to authenticated;
grant update(theme,style,background_path,preview_path) on public.raben_profile_styles to authenticated;
create policy profile_style_read on public.raben_profile_styles for select to authenticated using(exists(select 1 from public.raben_profile_items i where i.id=item_id));
create policy profile_style_insert on public.raben_profile_styles for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items i where i.id=item_id and i.kind='character' and i.owner_id=(select auth.uid())));
create policy profile_style_update on public.raben_profile_styles for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy profile_style_delete on public.raben_profile_styles for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()));
create function raben_private.guard_profile_style() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() or new.owner_id<>auth.uid() or not raben_private.check_personal_image(new.background_path) or not raben_private.check_personal_image(new.preview_path) then raise exception 'profile_access_denied' using errcode='42501';end if;
 if new.background_path is null and new.preview_path is not null then raise exception 'invalid_profile_image' using errcode='23514';end if;new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_profile_style() from public,anon,authenticated;
create trigger raben_guard_profile_style before insert or update on public.raben_profile_styles for each row execute function raben_private.guard_profile_style();
create function public.raben_save_profile_style(p_item uuid,p_theme text,p_style jsonb,p_background text,p_preview text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() or not exists(select 1 from public.raben_profile_items where id=p_item and kind='character' and owner_id=auth.uid()) then raise exception 'profile_access_denied' using errcode='42501';end if;
 insert into public.raben_profile_styles(item_id,theme,style,background_path,preview_path) values(p_item,p_theme,p_style,p_background,p_preview)
 on conflict(item_id) do update set theme=excluded.theme,style=excluded.style,background_path=excluded.background_path,preview_path=excluded.preview_path;
end;$$;
revoke all on function public.raben_save_profile_style(uuid,text,jsonb,text,text) from public,anon;
grant execute on function public.raben_save_profile_style(uuid,text,jsonb,text,text) to authenticated;
create or replace function raben_private.can_read_profile_image(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select raben_private.is_member() and (split_part(p_name,'/',1)=auth.uid()::text or exists(select 1 from public.raben_profile_items where image_path=p_name or preview_path=p_name) or exists(select 1 from public.raben_profile_gallery where image_path=p_name or preview_path=p_name) or exists(select 1 from public.raben_profiles where avatar_path=p_name or banner_path=p_name) or exists(select 1 from public.raben_profile_styles where background_path=p_name or preview_path=p_name));
$$;
create or replace function raben_private.personal_image_unused(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.raben_profile_items where image_path=p_name or preview_path=p_name) and not exists(select 1 from public.raben_profile_gallery where image_path=p_name or preview_path=p_name) and not exists(select 1 from public.raben_profiles where avatar_path=p_name or banner_path=p_name) and not exists(select 1 from public.raben_profile_styles where background_path=p_name or preview_path=p_name);
$$;
