create table public.raben_maps(
 id uuid primary key default gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 120),
 kind text not null default 'village' check(kind in ('world','village','building')),image_path text not null,public_path text,
 visibility text not null default 'clan' check(visibility in ('clan','public')),layers jsonb not null default '["Orte"]' check(jsonb_typeof(layers)='array' and jsonb_array_length(layers) between 1 and 20),
 created_at timestamptz not null default now(),revision integer not null default 1,
 check(visibility<>'public' or public_path is not null)
);
create index maps_created_idx on public.raben_maps(created_at,id);
create table public.raben_map_markers(
 id uuid primary key default gen_random_uuid(),map_id uuid not null references public.raben_maps(id) on delete cascade,
 place_id uuid not null references public.raben_records(id) on delete cascade,layer text not null check(length(layer) between 1 and 60),
 x numeric not null check(x between 0 and 100),y numeric not null check(y between 0 and 100),unique(map_id,place_id)
);
create index map_markers_place_idx on public.raben_map_markers(place_id);
alter table public.raben_maps enable row level security;alter table public.raben_map_markers enable row level security;
revoke all on public.raben_maps,public.raben_map_markers from public,anon,authenticated;
grant select(id,title,kind,public_path,visibility,layers,created_at,revision) on public.raben_maps to anon;
grant select on public.raben_map_markers to anon;
grant select,insert,delete on public.raben_maps,public.raben_map_markers to authenticated;
grant update(title,kind,image_path,public_path,visibility,layers) on public.raben_maps to authenticated;
grant update(layer,x,y) on public.raben_map_markers to authenticated;
create policy maps_read on public.raben_maps for select to anon,authenticated using(visibility='public');
create policy maps_clan_read on public.raben_maps for select to authenticated using((select raben_private.is_member()));
create policy maps_write on public.raben_maps for all to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create policy markers_read on public.raben_map_markers for select to anon,authenticated using(exists(select 1 from public.raben_maps where id=map_id) and exists(select 1 from public.raben_records where id=place_id and kind='place'));
create policy markers_write on public.raben_map_markers for all to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('raben-map-media','raben-map-media',false,52428800,array['image/jpeg','image/png','image/webp']);
create function raben_private.can_read_map_image(p_name text) returns boolean language sql stable security invoker set search_path='' as $$select (select raben_private.is_member()) and ((select raben_private.is_admin()) or exists(select 1 from public.raben_maps where image_path=p_name))$$;
revoke all on function raben_private.can_read_map_image(text) from public,anon;grant execute on function raben_private.can_read_map_image(text) to authenticated;
create policy map_images_read on storage.objects for select to authenticated using(bucket_id='raben-map-media' and raben_private.can_read_map_image(name));
create policy map_images_create on storage.objects for insert to authenticated with check(bucket_id='raben-map-media' and (select raben_private.is_admin()) and split_part(name,'/',1)=(select auth.uid())::text and name~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$');
create policy map_images_delete on storage.objects for delete to authenticated using(bucket_id='raben-map-media' and (select raben_private.is_admin()) and not exists(select 1 from public.raben_maps where image_path=name));
create policy map_images_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'raben-map-media' or raben_private.can_read_map_image(name));
create policy map_images_create_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'raben-map-media' or ((select raben_private.is_admin()) and split_part(name,'/',1)=(select auth.uid())::text and name~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$'));
create policy map_images_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'raben-map-media' or ((select raben_private.is_admin()) and not exists(select 1 from public.raben_maps where image_path=name)));
create policy map_images_no_replace on storage.objects as restrictive for update to authenticated using(bucket_id<>'raben-map-media') with check(bucket_id<>'raben-map-media');
create policy map_images_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'raben-map-media') with check(bucket_id<>'raben-map-media');
create function raben_private.guard_map() returns trigger language plpgsql security invoker set search_path='' as $$
declare v text;m public.raben_maps;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if tg_table_name='raben_maps' then
  if new.image_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-map-media' and name=new.image_path) then raise exception 'map_image_missing' using errcode='23514';end if;
  if new.public_path is not null and (new.public_path !~ '^[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.public_path)) then raise exception 'map_public_image_missing' using errcode='23514';end if;
  for v in select jsonb_array_elements_text(new.layers) loop if length(btrim(v)) not between 1 and 60 then raise exception 'invalid_layer' using errcode='23514';end if;end loop;
  if (select count(distinct value) from jsonb_array_elements(new.layers))<>jsonb_array_length(new.layers) or exists(select 1 from jsonb_array_elements(new.layers) where jsonb_typeof(value)<>'string') then raise exception 'invalid_layer' using errcode='23514';end if;
  if new.visibility='public' and exists(select 1 from public.raben_map_markers p join public.raben_records r on r.id=p.place_id where p.map_id=new.id and r.visibility<>'public') then raise exception 'map_place_not_public' using errcode='23514';end if;
  if tg_op='UPDATE' then new.revision:=old.revision+1;new.created_at:=old.created_at;if exists(select 1 from public.raben_map_markers where map_id=old.id and not(new.layers ? layer)) then raise exception 'layer_in_use' using errcode='23514';end if;end if;
 else
  select * into m from public.raben_maps where id=new.map_id;
  if not found or not(m.layers ? new.layer) or not exists(select 1 from public.raben_records where id=new.place_id and kind='place' and (m.visibility<>'public' or visibility='public')) then raise exception 'invalid_map_marker' using errcode='23514';end if;
 end if;return new;
end;$$;
revoke all on function raben_private.guard_map() from public,anon,authenticated;
create trigger guard_map before insert or update on public.raben_maps for each row execute function raben_private.guard_map();
create trigger guard_map before insert or update on public.raben_map_markers for each row execute function raben_private.guard_map();
create policy retain_map_public_image on storage.objects as restrictive for delete to authenticated using(bucket_id<>'raben-public' or not exists(select 1 from public.raben_maps where public_path=name));

create table public.raben_recipes(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.raben_memberships(user_id),title text not null check(length(btrim(title)) between 1 and 120),
 body text not null default '' check(length(body)<=5000),materials jsonb not null check(jsonb_typeof(materials)='array' and jsonb_array_length(materials) between 1 and 40),created_at timestamptz not null default now(),revision integer not null default 1
);
create index recipes_owner_idx on public.raben_recipes(owner_id);create index recipes_created_idx on public.raben_recipes(created_at desc,id);
alter table public.raben_recipes enable row level security;revoke all on public.raben_recipes from public,anon,authenticated;
grant select,insert,delete on public.raben_recipes to authenticated;grant update(title,body,materials) on public.raben_recipes to authenticated;
create policy recipes_read on public.raben_recipes for select to authenticated using((select raben_private.is_member()));
create policy recipes_insert on public.raben_recipes for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy recipes_update on public.raben_recipes for update to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.has_permission('content')))) with check((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.has_permission('content'))));
create policy recipes_delete on public.raben_recipes for delete to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.has_permission('content'))));
create function raben_private.guard_recipe() returns trigger language plpgsql security invoker set search_path='' as $$
declare v jsonb;n numeric;
begin
 for v in select value from jsonb_array_elements(new.materials) loop
  if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in ('item_id','quantity')) or coalesce(v->>'item_id','')!~'^[a-f0-9-]{36}$' or jsonb_typeof(v->'quantity') is distinct from 'number' then raise exception 'invalid_recipe' using errcode='23514';end if;
  n:=(v->>'quantity')::numeric;if n<=0 or n>1000000000 or n<>round(n,3) or not exists(select 1 from public.raben_stock_items where id=(v->>'item_id')::uuid) then raise exception 'invalid_recipe' using errcode='23514';end if;
 end loop;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(new.materials))<>jsonb_array_length(new.materials) then raise exception 'duplicate_material' using errcode='23514';end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;end if;return new;
end;$$;
revoke all on function raben_private.guard_recipe() from public,anon,authenticated;create trigger guard_recipe before insert or update on public.raben_recipes for each row execute function raben_private.guard_recipe();
create function public.raben_plan_materials(p_recipe uuid,p_multiplier numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.raben_recipes;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if p_multiplier is null or p_multiplier::text in ('NaN','Infinity','-Infinity') or p_multiplier<=0 or p_multiplier>10000 then raise exception 'invalid_multiplier' using errcode='23514';end if;
 select * into r from public.raben_recipes where id=p_recipe;if not found then raise exception 'recipe_missing' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('item_id',s.id,'name',s.name,'unit',s.unit,'required',round((v->>'quantity')::numeric*p_multiplier,3),'available',s.quantity,'missing',greatest(0,round((v->>'quantity')::numeric*p_multiplier,3)-s.quantity))) from jsonb_array_elements(r.materials) v join public.raben_stock_items s on s.id=(v->>'item_id')::uuid),'[]');
end;$$;
revoke all on function public.raben_plan_materials(uuid,numeric) from public,anon;grant execute on function public.raben_plan_materials(uuid,numeric) to authenticated;

create table public.raben_trade_details(
 record_id uuid primary key references public.raben_records(id) on delete cascade,quantity numeric(14,3) not null check(quantity>0 and quantity::text not in ('NaN','Infinity','-Infinity')),
 unit text not null default 'Stück' check(length(btrim(unit)) between 1 and 30),terms text not null default '' check(length(terms)<=4000),
 status text not null default 'open' check(status in ('open','reserved','completed','withdrawn')),revision integer not null default 1,updated_at timestamptz not null default now()
);
create table public.raben_trade_requests(
 id uuid primary key default gen_random_uuid(),record_id uuid not null references public.raben_trade_details(record_id) on delete cascade,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,quantity numeric(14,3) not null check(quantity>0 and quantity::text not in ('NaN','Infinity','-Infinity')),
 body text not null default '' check(length(body)<=4000),reply text not null default '' check(length(reply)<=4000),
 status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn','completed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1
);
create index trade_requests_record_idx on public.raben_trade_requests(record_id,created_at);create index trade_requests_user_idx on public.raben_trade_requests(user_id);
create table public.raben_trade_history(id uuid primary key default gen_random_uuid(),record_id uuid not null references public.raben_records(id) on delete cascade,status text not null,changed_by uuid references public.raben_memberships(user_id),created_at timestamptz not null default now());
create index trade_history_record_idx on public.raben_trade_history(record_id,created_at);
alter table public.raben_trade_details enable row level security;alter table public.raben_trade_requests enable row level security;alter table public.raben_trade_history enable row level security;
revoke all on public.raben_trade_details,public.raben_trade_requests,public.raben_trade_history from public,anon,authenticated;
grant select on public.raben_trade_details to anon;grant select,insert on public.raben_trade_details to authenticated;grant update(quantity,unit,terms,status) on public.raben_trade_details to authenticated;
grant select,insert on public.raben_trade_requests to authenticated;grant update(status,reply) on public.raben_trade_requests to authenticated;grant select on public.raben_trade_history to authenticated;
create policy trade_details_read on public.raben_trade_details for select to anon,authenticated using(exists(select 1 from public.raben_records where id=record_id and kind='trade'));
create policy trade_details_write on public.raben_trade_details for all to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_records where id=record_id and kind='trade' and (created_by=(select auth.uid()) or (select raben_private.is_admin())))) with check((select raben_private.is_member()) and exists(select 1 from public.raben_records where id=record_id and kind='trade' and (created_by=(select auth.uid()) or (select raben_private.is_admin()))));
create policy trade_requests_read on public.raben_trade_requests for select to authenticated using((select raben_private.is_member()) and raben_private.record_visible(record_id,'trade') and (user_id=(select auth.uid()) or exists(select 1 from public.raben_records where id=record_id and created_by=(select auth.uid())) or (select raben_private.is_admin())));
create policy trade_requests_insert on public.raben_trade_requests for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and raben_private.record_visible(record_id,'trade') and status='pending' and reply='');
create policy trade_requests_update on public.raben_trade_requests for update to authenticated using((select raben_private.is_member()) and raben_private.record_visible(record_id,'trade') and (user_id=(select auth.uid()) or exists(select 1 from public.raben_records where id=record_id and created_by=(select auth.uid())) or (select raben_private.is_admin()))) with check((select raben_private.is_member()) and raben_private.record_visible(record_id,'trade'));
create policy trade_history_read on public.raben_trade_history for select to authenticated using(raben_private.record_visible(record_id,'trade'));
-- The narrow definer locks the offer to serialize acceptance quantities; no credentials or unrelated rows are returned.
create function raben_private.guard_trade() returns trigger language plpgsql security definer set search_path='' as $$
declare offer public.raben_trade_details;owner uuid;total numeric;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select created_by into owner from public.raben_records where id=new.record_id and kind='trade';if owner is null then raise exception 'trade_missing' using errcode='23514';end if;
 if tg_table_name='raben_trade_details' then
  if owner<>auth.uid() and not raben_private.is_admin() then raise exception 'owner_required' using errcode='42501';end if;
  select coalesce(sum(quantity),0) into total from public.raben_trade_requests where record_id=new.record_id and status in ('accepted','completed');
  if new.quantity<total then raise exception 'trade_quantity_reserved' using errcode='23514';end if;
 else
  select * into offer from public.raben_trade_details where record_id=new.record_id for update;
  if tg_op='INSERT' then
   if new.user_id<>auth.uid() or owner=auth.uid() or new.status<>'pending' or new.reply<>'' or offer.status<>'open' or new.quantity>offer.quantity then raise exception 'trade_closed' using errcode='23514';end if;
  else
   if owner<>auth.uid() and not raben_private.is_admin() then
    if new.user_id<>auth.uid() or new.status<>'withdrawn' or old.status not in ('pending','accepted') or new.reply is distinct from old.reply then raise exception 'trade_owner_required' using errcode='42501';end if;
   elsif new.status not in ('accepted','declined','completed') or old.status in ('withdrawn','declined','completed') or (new.status='completed' and old.status<>'accepted') then raise exception 'invalid_trade_transition' using errcode='23514';end if;
   if new.status='accepted' and offer.status not in ('open','reserved') then raise exception 'trade_closed' using errcode='23514';end if;
   if new.status in ('accepted','completed') and (select coalesce(sum(quantity),0) from public.raben_trade_requests where record_id=new.record_id and id<>new.id and status in ('accepted','completed'))+new.quantity>offer.quantity then raise exception 'trade_quantity_reserved' using errcode='23514';end if;
  end if;
 end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;end if;new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_trade() from public,anon,authenticated;
create trigger guard_trade before insert or update on public.raben_trade_details for each row execute function raben_private.guard_trade();
create trigger guard_trade before insert or update on public.raben_trade_requests for each row execute function raben_private.guard_trade();
create function raben_private.trade_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.status is distinct from old.status then insert into public.raben_trade_history(record_id,status,changed_by) values(new.record_id,new.status,auth.uid());end if;return null;
end;$$;
revoke all on function raben_private.trade_history() from public,anon,authenticated;create trigger trade_history after insert or update on public.raben_trade_details for each row execute function raben_private.trade_history();

create table public.raben_character_timeline(
 id uuid primary key default gen_random_uuid(),item_id uuid not null,owner_id uuid not null default auth.uid(),parent_type text not null check(parent_type in ('record','plot')),parent_id uuid not null,
 event_date date not null,label text not null default '' check(length(label)<=120),foreign key(item_id,owner_id) references public.raben_profile_items(id,owner_id) on delete cascade,unique(item_id,parent_type,parent_id)
);
create index character_timeline_owner_idx on public.raben_character_timeline(owner_id);create index character_timeline_date_idx on public.raben_character_timeline(item_id,event_date);
alter table public.raben_character_timeline enable row level security;revoke all on public.raben_character_timeline from public,anon,authenticated;grant select,insert,delete on public.raben_character_timeline to authenticated;
create policy timeline_read on public.raben_character_timeline for select to authenticated using(exists(select 1 from public.raben_profile_items where id=item_id and kind='character') and ((parent_type='record' and raben_private.record_visible(parent_id)) or (parent_type='plot' and exists(select 1 from public.raben_plots where id=parent_id))));
create policy timeline_insert on public.raben_character_timeline for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items where id=item_id and owner_id=(select auth.uid()) and kind='character') and ((parent_type='record' and exists(select 1 from public.raben_records where id=parent_id and kind in ('journal','event','chronicle'))) or (parent_type='plot' and exists(select 1 from public.raben_plots where id=parent_id))));
create policy timeline_delete on public.raben_character_timeline for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()));

create table public.raben_feedback(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 kind text not null check(kind in ('feature','bug')),title text not null check(length(btrim(title)) between 1 and 160),body text not null check(length(btrim(body)) between 5 and 10000),
 status text not null default 'new' check(status in ('new','planned','in_progress','done','declined')),reply text not null default '' check(length(reply)<=5000),created_at timestamptz not null default now(),revision integer not null default 1
);
create index feedback_user_idx on public.raben_feedback(user_id);create index feedback_created_idx on public.raben_feedback(created_at desc,id);
create table public.raben_feature_support(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 ticket_id uuid references public.raben_feedback(id) on delete cascade,roadmap_key text,created_at timestamptz not null default now(),
 check((ticket_id is null)<>(roadmap_key is null)),check(roadmap_key is null or roadmap_key~'^\d{8}v[1-9][0-9]{0,3}-(0[1-9]|1[0-9]|20)$'),unique(user_id,ticket_id),unique(user_id,roadmap_key)
);
create index feature_support_ticket_idx on public.raben_feature_support(ticket_id) where ticket_id is not null;create index feature_support_roadmap_idx on public.raben_feature_support(roadmap_key) where roadmap_key is not null;
alter table public.raben_feedback enable row level security;alter table public.raben_feature_support enable row level security;revoke all on public.raben_feedback,public.raben_feature_support from public,anon,authenticated;
grant select,insert,delete on public.raben_feedback to authenticated;grant update(title,body,status,reply) on public.raben_feedback to authenticated;grant select,insert,delete on public.raben_feature_support to authenticated;
create policy feedback_read on public.raben_feedback for select to authenticated using((select raben_private.is_member()));
create policy feedback_insert on public.raben_feedback for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and status='new' and reply='');
create policy feedback_update on public.raben_feedback for update to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin()))) with check((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy feedback_delete on public.raben_feedback for delete to authenticated using((select raben_private.is_member()) and ((user_id=(select auth.uid()) and status='new') or (select raben_private.is_admin())));
create policy support_read on public.raben_feature_support for select to authenticated using((select raben_private.is_member()));
create policy support_insert on public.raben_feature_support for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create policy support_delete on public.raben_feature_support for delete to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_feedback() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if not raben_private.is_admin() and (new.status<>old.status or new.reply<>old.reply or old.status<>'new') then raise exception 'feedback_admin_required' using errcode='42501';end if;
  new.revision:=old.revision+1;
 end if;return new;
end;$$;
revoke all on function raben_private.guard_feedback() from public,anon,authenticated;create trigger guard_feedback before update on public.raben_feedback for each row execute function raben_private.guard_feedback();
