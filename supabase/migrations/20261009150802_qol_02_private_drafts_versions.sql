-- QOL 6-7. Drafts, theme templates and profile history have no administrator override.
-- Replaced by the concrete per-entry grants in QOL 03 before the new UI is published.
create function raben_private.entry_collaborator(p_type text,p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select false;$$;
revoke all on function raben_private.entry_collaborator(text,uuid) from public,anon,authenticated;
create table public.raben_private_drafts(
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 draft_key text not null check(length(draft_key) between 1 and 180 and draft_key ~ '^[A-Za-z0-9:_-]+$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
 updated_at timestamptz not null default now(),primary key(user_id,draft_key)
);
alter table public.raben_private_drafts enable row level security;
revoke all on public.raben_private_drafts from public,anon,authenticated;
grant select,insert,delete on public.raben_private_drafts to authenticated;
grant update(payload,updated_at) on public.raben_private_drafts to authenticated;
create policy private_drafts_own on public.raben_private_drafts for all to authenticated
 using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));

create table public.raben_profile_versions(
 id uuid primary key default gen_random_uuid(),item_id uuid not null,owner_id uuid not null,
 revision bigint not null,snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=524288),
 transaction_id text not null,created_at timestamptz not null default now(),
 foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade,
 unique(item_id,transaction_id)
);
create index raben_profile_versions_owner_item_idx on public.raben_profile_versions(owner_id,item_id,created_at desc,id);
alter table public.raben_profile_versions enable row level security;
revoke all on public.raben_profile_versions from public,anon,authenticated;
grant select on public.raben_profile_versions to authenticated;
create policy profile_versions_owner on public.raben_profile_versions for select to authenticated
 using((select raben_private.is_member()) and owner_id=(select auth.uid()));

-- A private trigger writes authentic snapshots once per transaction, never caller-supplied history.
create function raben_private.capture_profile_version(p_item uuid) returns void language plpgsql security definer set search_path='' as $$
declare item public.raben_profile_items;
begin
 select * into item from public.raben_profile_items where id=p_item;
 if not found then return;end if;
 if auth.uid() is null or not raben_private.is_member() or (item.owner_id<>auth.uid() and not raben_private.entry_collaborator('profile',p_item)) then raise exception 'profile_access_denied' using errcode='42501';end if;
 insert into public.raben_profile_versions(item_id,owner_id,revision,transaction_id,snapshot)
 values(item.id,item.owner_id,item.revision,pg_current_xact_id()::text,jsonb_build_object('item',to_jsonb(item),
 'gallery',coalesce((select jsonb_agg(to_jsonb(g) order by sort_order,id) from public.raben_profile_gallery g where item_id=item.id),'[]'),
 'albums',coalesce((select jsonb_agg(to_jsonb(a) order by sort_order,id) from public.raben_profile_albums a where item_id=item.id),'[]'),
 'design',(select to_jsonb(s) from public.raben_profile_styles s where item_id=item.id))) on conflict(item_id,transaction_id) do nothing;
 delete from public.raben_profile_versions where item_id=item.id and id not in(select id from public.raben_profile_versions where item_id=item.id order by created_at desc,id desc limit 30);
end;$$;
revoke all on function raben_private.capture_profile_version(uuid) from public,anon,authenticated;
create function raben_private.profile_version_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='raben_profile_items' then
  if tg_op='UPDATE' then perform raben_private.capture_profile_version(old.id);end if;
 else perform raben_private.capture_profile_version(case when tg_op='DELETE' then old.item_id else new.item_id end);end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function raben_private.profile_version_trigger() from public,anon,authenticated;
create trigger a_profile_history before update on public.raben_profile_items for each row execute function raben_private.profile_version_trigger();
create trigger a_gallery_history before insert or update or delete on public.raben_profile_gallery for each row execute function raben_private.profile_version_trigger();
create trigger a_design_history before insert or update or delete on public.raben_profile_styles for each row execute function raben_private.profile_version_trigger();
create trigger a_album_history before insert or update or delete on public.raben_profile_albums for each row execute function raben_private.profile_version_trigger();

create function public.raben_restore_own_profile_version(p_version uuid,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.raben_profile_versions;current_item public.raben_profile_items;s jsonb;recipients uuid[];result jsonb;a jsonb;g jsonb;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select * into v from public.raben_profile_versions where id=p_version and owner_id=auth.uid();
 if not found then raise exception 'profile_access_denied' using errcode='42501';end if;
 select * into current_item from public.raben_profile_items where id=v.item_id and owner_id=auth.uid() for update;
 if not found or current_item.revision<>p_expected then raise exception 'profile_conflict' using errcode='40001';end if;
 s:=v.snapshot;
 select coalesce(array_agg(grantee_id),'{}') into recipients from public.raben_profile_grants where item_id=v.item_id and owner_id=auth.uid();
 result:=public.raben_save_profile_entry(v.item_id,current_item.kind,s->'item'->>'title',s->'item'->>'body',s->'item'->>'image_path',current_item.visibility,recipients,p_expected,coalesce(s->'item'->'details','{}'),s->'item'->>'preview_path',coalesce(s->'gallery','[]'));
 delete from public.raben_profile_albums where item_id=v.item_id and owner_id=auth.uid() and id not in(select (value->>'id')::uuid from jsonb_array_elements(coalesce(s->'albums','[]')));
 for a in select value from jsonb_array_elements(coalesce(s->'albums','[]')) loop
  insert into public.raben_profile_albums(id,item_id,title,sort_order) values((a->>'id')::uuid,v.item_id,a->>'title',(a->>'sort_order')::integer)
  on conflict(id) do update set title=excluded.title,sort_order=excluded.sort_order;
 end loop;
 for g in select value from jsonb_array_elements(coalesce(s->'gallery','[]')) loop
  update public.raben_profile_gallery set album_id=nullif(g->>'album_id','')::uuid where item_id=v.item_id and image_path=g->>'image_path' and owner_id=auth.uid();
 end loop;
 if current_item.kind='character' and jsonb_typeof(s->'design')='object' then
  perform public.raben_save_profile_style(v.item_id,s->'design'->>'theme',s->'design'->'style',s->'design'->>'background_path',s->'design'->>'preview_path');
 elsif current_item.kind='character' then delete from public.raben_profile_styles where item_id=v.item_id and owner_id=auth.uid();
 end if;
 select to_jsonb(i) into result from public.raben_profile_items i where id=v.item_id;return result;
end;$$;
revoke all on function public.raben_restore_own_profile_version(uuid,bigint) from public,anon;
grant execute on function public.raben_restore_own_profile_version(uuid,bigint) to authenticated;

create or replace function raben_private.personal_image_unused(p_name text) returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.raben_profile_items where image_path=p_name or preview_path=p_name)
 and not exists(select 1 from public.raben_profile_gallery where image_path=p_name or preview_path=p_name)
 and not exists(select 1 from public.raben_profiles where avatar_path=p_name or banner_path=p_name)
 and not exists(select 1 from public.raben_profile_styles where background_path=p_name or preview_path=p_name)
 and not exists(select 1 from public.raben_theme_templates where background_path=p_name or preview_path=p_name)
 and not exists(select 1 from public.raben_profile_versions where owner_id=auth.uid() and snapshot::text like '%'||p_name||'%');
$$;
create function public.raben_save_private_draft(p_key text,p_payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 insert into public.raben_private_drafts(user_id,draft_key,payload) values(auth.uid(),p_key,p_payload) on conflict(user_id,draft_key) do update set payload=excluded.payload,updated_at=now();
end;$$;
revoke all on function public.raben_save_private_draft(text,jsonb) from public,anon;grant execute on function public.raben_save_private_draft(text,jsonb) to authenticated;
