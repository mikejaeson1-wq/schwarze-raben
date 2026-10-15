-- Clan update: ownership stays in Postgres; chat has no administrator read override.
create table public.raben_direct_messages (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null default auth.uid() references public.raben_memberships(user_id),
 recipient_id uuid not null references public.raben_memberships(user_id),body text not null check(length(btrim(body)) between 1 and 6000),
 client_id uuid not null,created_at timestamptz not null default now(),read_at timestamptz,
 check(sender_id<>recipient_id),unique(sender_id,client_id)
);
create index direct_messages_sender_idx on public.raben_direct_messages(sender_id,created_at desc,id);
create index direct_messages_recipient_idx on public.raben_direct_messages(recipient_id,created_at desc,id);
create table public.raben_chat_blocks(user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,blocked_id uuid not null references public.raben_memberships(user_id) on delete cascade,primary key(user_id,blocked_id),check(user_id<>blocked_id));
create index chat_blocks_recipient_idx on public.raben_chat_blocks(blocked_id);
alter table public.raben_direct_messages enable row level security;alter table public.raben_chat_blocks enable row level security;
revoke all on public.raben_direct_messages,public.raben_chat_blocks from public,anon,authenticated;
grant select on public.raben_direct_messages to authenticated;
grant insert(id,sender_id,recipient_id,body,client_id) on public.raben_direct_messages to authenticated;
grant update(read_at) on public.raben_direct_messages to authenticated;
grant select,insert,delete on public.raben_chat_blocks to authenticated;
create policy direct_read on public.raben_direct_messages for select to authenticated using((select raben_private.is_member()) and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy direct_send on public.raben_direct_messages for insert to authenticated with check((select raben_private.is_member()) and sender_id=(select auth.uid()) and exists(select 1 from public.raben_memberships m where m.user_id=recipient_id and m.status='active'));
create policy direct_mark_read on public.raben_direct_messages for update to authenticated using((select raben_private.is_member()) and recipient_id=(select auth.uid())) with check((select raben_private.is_member()) and recipient_id=(select auth.uid()));
create policy own_blocks on public.raben_chat_blocks for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_direct_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.recipient_id<>auth.uid() then raise exception 'chat_denied' using errcode='42501';end if;
  new.id:=old.id;new.sender_id:=old.sender_id;new.recipient_id:=old.recipient_id;new.body:=old.body;new.client_id:=old.client_id;new.created_at:=old.created_at;new.read_at:=coalesce(old.read_at,now());return new;
 end if;
 if new.sender_id<>auth.uid() or not exists(select 1 from public.raben_memberships where user_id=new.recipient_id and status='active') then raise exception 'chat_denied' using errcode='42501';end if;
 perform 1 from public.raben_memberships where user_id=auth.uid() for update;
 if exists(select 1 from public.raben_chat_blocks where (user_id=new.sender_id and blocked_id=new.recipient_id) or (user_id=new.recipient_id and blocked_id=new.sender_id)) then raise exception 'chat_unavailable' using errcode='42501';end if;
 if (select count(*) from public.raben_direct_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'chat_rate_limit' using errcode='23514';end if;
 new.body:=btrim(new.body);new.created_at:=now();new.read_at:=null;return new;
end;$$;
revoke all on function raben_private.guard_direct_message() from public,anon,authenticated;
create trigger guard_direct_message before insert or update on public.raben_direct_messages for each row execute function raben_private.guard_direct_message();

-- Image descriptions do not change captions, filenames or content visibility.
create table public.raben_image_descriptions(parent_type text not null check(parent_type in ('profile','gallery','record','clan')),parent_id uuid not null,owner_id uuid not null default auth.uid() references public.raben_memberships(user_id),alt_text text not null default '' check(length(alt_text)<=1000),primary key(parent_type,parent_id));
create index image_descriptions_owner_idx on public.raben_image_descriptions(owner_id);
alter table public.raben_image_descriptions enable row level security;revoke all on public.raben_image_descriptions from public,anon,authenticated;
grant select,insert on public.raben_image_descriptions to authenticated;grant update(alt_text) on public.raben_image_descriptions to authenticated;
create function raben_private.image_description_access(p_type text,p_id uuid,p_write boolean default false) returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then return false;end if;
 if p_type='profile' then return exists(select 1 from public.raben_profile_items where id=p_id and (not p_write or owner_id=auth.uid()));
 elsif p_type='gallery' then return exists(select 1 from public.raben_profile_gallery where id=p_id and (not p_write or owner_id=auth.uid()));
 elsif p_type='record' then return exists(select 1 from public.raben_records where id=p_id and (not p_write or created_by=auth.uid() or raben_private.has_permission('content')));
 elsif p_type='clan' then return (not p_write or raben_private.is_admin()) and exists(select 1 from public.raben_clan_information c,jsonb_array_elements(c.images) i where i->>'id'=p_id::text);
 end if;return false;
end;$$;
revoke all on function raben_private.image_description_access(text,uuid,boolean) from public,anon;grant execute on function raben_private.image_description_access(text,uuid,boolean) to authenticated;
create policy image_descriptions_read on public.raben_image_descriptions for select to authenticated using(raben_private.image_description_access(parent_type,parent_id,false));
create policy image_descriptions_insert on public.raben_image_descriptions for insert to authenticated with check(owner_id=(select auth.uid()) and raben_private.image_description_access(parent_type,parent_id,true));
create policy image_descriptions_update on public.raben_image_descriptions for update to authenticated using(raben_private.image_description_access(parent_type,parent_id,true)) with check(raben_private.image_description_access(parent_type,parent_id,true));

-- Suggestions remain readable only to their author and the entry owner while access exists.
alter table public.raben_entry_editors add column approval_required boolean not null default false;
grant update(approval_required) on public.raben_entry_editors to authenticated;
create policy entry_editors_update on public.raben_entry_editors for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create table public.raben_edit_suggestions(id uuid primary key default gen_random_uuid(),parent_type text not null check(parent_type in ('profile','record')),parent_id uuid not null,owner_id uuid not null references public.raben_memberships(user_id),author_id uuid not null default auth.uid() references public.raben_memberships(user_id),title text not null check(length(btrim(title)) between 1 and 200),body text not null check(length(body)<=30000),base_revision bigint not null,status text not null default 'pending' check(status in ('pending','accepted','rejected')),created_at timestamptz not null default now());
create index edit_suggestions_parent_idx on public.raben_edit_suggestions(parent_type,parent_id,created_at);
create index edit_suggestions_owner_idx on public.raben_edit_suggestions(owner_id);
create index edit_suggestions_author_idx on public.raben_edit_suggestions(author_id);
alter table public.raben_edit_suggestions enable row level security;revoke all on public.raben_edit_suggestions from public,anon,authenticated;
grant select,insert on public.raben_edit_suggestions to authenticated;grant update(status) on public.raben_edit_suggestions to authenticated;
create policy suggestions_read on public.raben_edit_suggestions for select to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or author_id=(select auth.uid())) and ((parent_type='profile' and exists(select 1 from public.raben_profile_items where id=parent_id)) or (parent_type='record' and exists(select 1 from public.raben_records where id=parent_id))));
create policy suggestions_insert on public.raben_edit_suggestions for insert to authenticated with check((select raben_private.is_member()) and author_id=(select auth.uid()) and status='pending' and raben_private.entry_collaborator(parent_type,parent_id) and exists(select 1 from public.raben_entry_editors e where e.parent_type=raben_edit_suggestions.parent_type and e.parent_id=raben_edit_suggestions.parent_id and e.owner_id=raben_edit_suggestions.owner_id and e.editor_id=(select auth.uid()) and (e.expires_at is null or e.expires_at>now())));
create policy suggestions_decide on public.raben_edit_suggestions for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create function raben_private.guard_suggestion_mode() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-'revision'-'updated_at') is distinct from (to_jsonb(old)-'revision'-'updated_at') then
  if exists(select 1 from public.raben_entry_editors e where e.parent_type=case tg_table_name when 'raben_profile_items' then 'profile' else 'record' end and e.parent_id=old.id and e.editor_id=auth.uid() and e.approval_required) then raise exception 'suggestion_required' using errcode='42501';end if;
 end if;return new;
end;$$;
revoke all on function raben_private.guard_suggestion_mode() from public,anon,authenticated;
create trigger guard_suggestion_mode before update on public.raben_profile_items for each row execute function raben_private.guard_suggestion_mode();
create trigger guard_suggestion_mode before update on public.raben_records for each row execute function raben_private.guard_suggestion_mode();
create function public.raben_review_suggestion(p_id uuid,p_accept boolean,p_expected bigint) returns void language plpgsql security invoker set search_path='' as $$
declare s public.raben_edit_suggestions;n integer;
begin
 select * into s from public.raben_edit_suggestions where id=p_id and owner_id=auth.uid() and status='pending' for update;
 if not found or not raben_private.is_member() then raise exception 'entry_access_denied' using errcode='42501';end if;
 if p_accept then
  if s.parent_type='profile' then update public.raben_profile_items set title=s.title,body=s.body where id=s.parent_id and owner_id=auth.uid() and revision=p_expected;
  else update public.raben_records set title=s.title,body=s.body where id=s.parent_id and created_by=auth.uid() and revision=p_expected;end if;
  get diagnostics n=row_count;if n=0 then raise exception 'entry_conflict' using errcode='40001';end if;
 end if;update public.raben_edit_suggestions set status=case when p_accept then 'accepted' else 'rejected' end where id=p_id;
end;$$;
revoke all on function public.raben_review_suggestion(uuid,boolean,bigint) from public,anon;grant execute on function public.raben_review_suggestion(uuid,boolean,bigint) to authenticated;

-- Free time windows work without candidate slots. A poll is still the shared planning context.
create table public.raben_open_plans(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.raben_memberships(user_id),title text not null check(length(btrim(title)) between 1 and 160),closed boolean not null default false,created_at timestamptz not null default now());
create index open_plans_owner_idx on public.raben_open_plans(owner_id);
create table public.raben_time_windows(id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.raben_open_plans(id) on delete cascade,user_id uuid not null default auth.uid() references public.raben_memberships(user_id),starts_at timestamptz not null,ends_at timestamptz not null,check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'));
create index time_windows_plan_idx on public.raben_time_windows(plan_id,starts_at);create index time_windows_user_idx on public.raben_time_windows(user_id);
alter table public.raben_open_plans enable row level security;alter table public.raben_time_windows enable row level security;
revoke all on public.raben_open_plans,public.raben_time_windows from public,anon,authenticated;
grant select,insert,delete on public.raben_open_plans to authenticated;grant update(closed) on public.raben_open_plans to authenticated;grant select,insert,delete on public.raben_time_windows to authenticated;
create policy open_plans_read on public.raben_open_plans for select to authenticated using((select raben_private.is_member()));
create policy open_plans_write on public.raben_open_plans for all to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy time_windows_read on public.raben_time_windows for select to authenticated using((select raben_private.is_member()));
create policy time_windows_write on public.raben_time_windows for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()) and starts_at>now() and exists(select 1 from public.raben_open_plans p where p.id=plan_id and not p.closed));

-- Buffer times are included in the server's serialized resource checks.
alter table public.raben_reservations add column setup_minutes integer not null default 0 check(setup_minutes between 0 and 1440),add column teardown_minutes integer not null default 0 check(teardown_minutes between 0 and 1440);
grant update(setup_minutes,teardown_minutes) on public.raben_reservations to authenticated;
create policy reservation_buffers_update on public.raben_reservations for update to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));

alter table public.raben_calendar_feeds add column expires_at timestamptz,add column notify_expiry boolean not null default false,add column expiry_notified_at timestamptz;
grant select(expires_at,notify_expiry) on public.raben_calendar_feeds to authenticated;
create function raben_private.create_timed_feed(p_title text,p_mode text,p_expires timestamptz,p_notify boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if p_expires is not null and (p_expires<=now() or p_expires>now()+interval '5 years') then raise exception 'invalid_expiry' using errcode='23514';end if;
 result:=raben_private.create_calendar_feed(p_title,p_mode);
 update public.raben_calendar_feeds set expires_at=p_expires,notify_expiry=coalesce(p_notify,false) where id=(result->>'id')::uuid and user_id=auth.uid();if p_notify and p_expires<=now()+interval '3 days' then insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(auth.uid(),'event','Kalender-Abo „'||btrim(p_title)||'“ läuft in Kürze ab.','calendarFeed',(result->>'id')::uuid);update public.raben_calendar_feeds set expiry_notified_at=now() where id=(result->>'id')::uuid;end if;return result;
end;$$;
revoke all on function raben_private.create_timed_feed(text,text,timestamptz,boolean) from public,anon;grant execute on function raben_private.create_timed_feed(text,text,timestamptz,boolean) to authenticated;
create function public.raben_create_timed_feed(p_title text,p_mode text,p_expires timestamptz,p_notify boolean) returns jsonb language sql security invoker set search_path='' as $$select raben_private.create_timed_feed(p_title,p_mode,p_expires,p_notify)$$;
revoke all on function public.raben_create_timed_feed(text,text,timestamptz,boolean) from public,anon;grant execute on function public.raben_create_timed_feed(text,text,timestamptz,boolean) to authenticated;
create function raben_private.notify_feed_expiry() returns void language plpgsql security definer set search_path='' as $$
declare f public.raben_calendar_feeds;
begin
 for f in select c.* from public.raben_calendar_feeds c join public.raben_memberships m on m.user_id=c.user_id and m.status='active' where not c.revoked and c.notify_expiry and c.expiry_notified_at is null and c.expires_at between now() and now()+interval '3 days' for update of c skip locked loop
  insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(f.user_id,'event','Kalender-Abo „'||f.title||'“ läuft in Kürze ab.','calendarFeed',f.id);update public.raben_calendar_feeds set expiry_notified_at=now() where id=f.id;
 end loop;
end;$$;
revoke all on function raben_private.notify_feed_expiry() from public,anon,authenticated;
select cron.schedule('raben-feed-expiry','0 * * * *','select raben_private.notify_feed_expiry();');

alter table public.raben_push_devices add column label text not null default '' check(length(label)<=80);
grant update(label) on public.raben_push_devices to authenticated;
alter table raben_private.push_jobs add column is_test boolean not null default false;
alter table raben_private.push_jobs alter column record_id drop not null,alter column occurrence_date drop not null;
create function raben_private.test_push(p_device uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 perform 1 from public.raben_push_devices where id=p_device and user_id=auth.uid() for update;if not found then raise exception 'device_denied' using errcode='42501';end if;
 if exists(select 1 from raben_private.push_jobs where device_id=p_device and is_test and created_at>now()-interval '1 minute') then raise exception 'test_rate_limit' using errcode='23514';end if;
 insert into raben_private.push_jobs(device_id,is_test) values(p_device,true) returning id into result;return result;
end;$$;
revoke all on function raben_private.test_push(uuid) from public,anon;grant execute on function raben_private.test_push(uuid) to authenticated;
create function public.raben_test_push(p_device uuid) returns uuid language sql security invoker set search_path='' as $$select raben_private.test_push(p_device)$$;
revoke all on function public.raben_test_push(uuid) from public,anon;grant execute on function public.raben_test_push(uuid) to authenticated;
create function raben_private.push_test_status(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 return(select jsonb_build_object('status',j.status,'attempts',j.attempts) from raben_private.push_jobs j join public.raben_push_devices d on d.id=j.device_id where j.id=p_id and d.user_id=auth.uid() and j.is_test);
end;$$;
revoke all on function raben_private.push_test_status(uuid) from public,anon;grant execute on function raben_private.push_test_status(uuid) to authenticated;
create function public.raben_push_test_status(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select raben_private.push_test_status(p_id)$$;
revoke all on function public.raben_push_test_status(uuid) from public,anon;grant execute on function public.raben_push_test_status(uuid) to authenticated;

-- Personal saved timeline views never widen the visibility of linked content.
create table public.raben_timeline_views(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,item_id uuid not null references public.raben_profile_items(id) on delete cascade,title text not null check(length(btrim(title)) between 1 and 100),filters jsonb not null default '{}' check(jsonb_typeof(filters)='object' and octet_length(filters::text)<=3000));
create index timeline_views_user_idx on public.raben_timeline_views(user_id,item_id);create index timeline_views_item_idx on public.raben_timeline_views(item_id);
alter table public.raben_timeline_views enable row level security;revoke all on public.raben_timeline_views from public,anon,authenticated;grant select,insert,delete on public.raben_timeline_views to authenticated;
create policy timeline_views_own on public.raben_timeline_views for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items where id=item_id)) with check((select raben_private.is_member()) and user_id=(select auth.uid()) and exists(select 1 from public.raben_profile_items where id=item_id));

alter table public.raben_recipes add column packages jsonb not null default '{}' check(jsonb_typeof(packages)='object' and octet_length(packages::text)<=6000);
grant update(packages) on public.raben_recipes to authenticated;
create table public.raben_recipe_versions(id uuid primary key default gen_random_uuid(),recipe_id uuid not null references public.raben_recipes(id) on delete cascade,revision integer not null,snapshot jsonb not null,created_at timestamptz not null default now());
create index recipe_versions_recipe_idx on public.raben_recipe_versions(recipe_id,revision desc);
alter table public.raben_recipe_versions enable row level security;revoke all on public.raben_recipe_versions from public,anon,authenticated;grant select on public.raben_recipe_versions to authenticated;
create policy recipe_versions_read on public.raben_recipe_versions for select to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_recipes where id=recipe_id));
create function raben_private.version_recipe() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;v jsonb;
begin
 for k,v in select * from jsonb_each(new.packages) loop
  if k!~'^[a-f0-9-]{36}$' or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 0.001 and 1000000000 then raise exception 'invalid_package' using errcode='23514';end if;
 end loop;
 if tg_op='UPDATE' then insert into public.raben_recipe_versions(recipe_id,revision,snapshot) values(old.id,old.revision,to_jsonb(old));delete from public.raben_recipe_versions where recipe_id=old.id and id not in(select id from public.raben_recipe_versions where recipe_id=old.id order by revision desc limit 30);end if;return new;
end;$$;
revoke all on function raben_private.version_recipe() from public,anon,authenticated;
create trigger version_recipe before insert or update on public.raben_recipes for each row execute function raben_private.version_recipe();

create table public.raben_trade_stock_links(request_id uuid primary key references public.raben_trade_requests(id),movement_id uuid not null unique references public.raben_stock_movements(id),created_by uuid not null references public.raben_memberships(user_id),created_at timestamptz not null default now());
create index trade_stock_links_author_idx on public.raben_trade_stock_links(created_by);
alter table public.raben_trade_stock_links enable row level security;revoke all on public.raben_trade_stock_links from public,anon,authenticated;grant select on public.raben_trade_stock_links to authenticated;
create policy trade_stock_links_read on public.raben_trade_stock_links for select to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_trade_requests where id=request_id));
create function raben_private.book_trade(p_request uuid,p_item uuid,p_delta numeric,p_expected bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.raben_trade_requests;movement jsonb;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select t0.* into t from public.raben_trade_requests t0 join public.raben_records r on r.id=t0.record_id where t0.id=p_request and (r.created_by=auth.uid() or raben_private.is_admin()) for update of t0;
 if not found or t.status<>'completed' then raise exception 'trade_not_completed' using errcode='42501';end if;
 if exists(select 1 from public.raben_trade_stock_links where request_id=p_request) then raise exception 'trade_already_booked' using errcode='23505';end if;
 if not exists(select 1 from public.raben_stock_items i join public.raben_trade_details d on d.record_id=t.record_id where i.id=p_item and i.unit=d.unit) then raise exception 'trade_unit_mismatch' using errcode='23514';end if;
 if p_delta is null or abs(p_delta)<>t.quantity then raise exception 'trade_quantity_mismatch' using errcode='23514';end if;
 movement:=public.raben_move_stock(p_item,p_delta,'Handelsabschluss '||t.id::text,null,p_expected);
 insert into public.raben_trade_stock_links(request_id,movement_id,created_by) values(t.id,(movement->>'id')::uuid,auth.uid());return movement;
end;$$;
revoke all on function raben_private.book_trade(uuid,uuid,numeric,bigint) from public,anon;grant execute on function raben_private.book_trade(uuid,uuid,numeric,bigint) to authenticated;
create function public.raben_book_trade(p_request uuid,p_item uuid,p_delta numeric,p_expected bigint) returns jsonb language sql security invoker set search_path='' as $$select raben_private.book_trade(p_request,p_item,p_delta,p_expected)$$;
revoke all on function public.raben_book_trade(uuid,uuid,numeric,bigint) from public,anon;grant execute on function public.raben_book_trade(uuid,uuid,numeric,bigint) to authenticated;


create or replace function raben_private.valid_banner_layout(p jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text;v numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>1000 then return false;end if;
 for k in select jsonb_object_keys(p) loop
  if k not in ('height','focusX','focusY','zoom','boxOpacity','mobileHeight','mobileFocusX','mobileFocusY','mobileZoom') or jsonb_typeof(p->k)<>'number' then return false;end if;
  v:=(p->>k)::numeric;
  if v<>trunc(v) or (case k when 'mobileHeight' then v not between 160 and 800 when 'height' then v not between 160 and 800 when 'mobileZoom' then v not between 100 and 300 when 'zoom' then v not between 100 and 300 else v not between 0 and 100 end) then return false;end if;
 end loop;return true;
end;$$;

create function raben_private.event_start(p jsonb,p_day date) returns timestamptz language sql immutable set search_path='' as $$select (coalesce(nullif(p->'occurrenceChanges'->p_day::text->>'date','')::date,p_day)+coalesce(nullif(p->'occurrenceChanges'->p_day::text->>'time','')::time,nullif(p->>'time','')::time,'20:00'::time)) at time zone 'Europe/Berlin'$$;
revoke all on function raben_private.event_start(jsonb,date) from public,anon;grant execute on function raben_private.event_start(jsonb,date) to authenticated;

create or replace function raben_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare admin boolean:=raben_private.is_admin(); allowed text[]; date_key text; option_value jsonb; ref_value text; ref_row public.raben_records; extra_key text; delegated boolean; speaker text;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.created_by<>auth.uid() and not admin then raise exception 'owner_required' using errcode='42501'; end if;
  new.created_at:=now(); new.revision:=1;
 else
  if new.kind<>old.kind or new.created_by<>old.created_by or new.id<>old.id then raise exception 'immutable_record' using errcode='42501'; end if;
  new.created_at:=old.created_at; new.revision:=old.revision+1;
 end if;
 delegated:=raben_private.has_permission('content') or (new.kind='event' and raben_private.has_permission('calendar'));
 if tg_op='UPDATE' and not admin and not delegated and new.created_by<>auth.uid() and raben_private.entry_collaborator('record',old.id) then
  if new.details is distinct from old.details or new.visibility<>old.visibility then raise exception 'owner_controls_required' using errcode='42501';end if;
  delegated:=true;
 end if;
 if not admin then
  if not delegated and (new.created_by<>auth.uid() or new.kind not in ('character','task','journal','trade','knowledge','media')) then raise exception 'owner_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.visibility='public' and new.visibility='public' then new.visibility:='review'; end if;
  if new.visibility not in ('draft','clan','review','archived') then raise exception 'admin_publication_required' using errcode='42501'; end if;
  new.details:=new.details-'publicImage'-'publicAudio'-'publicThumb';
  if new.kind='knowledge' and ((tg_op='INSERT' and coalesce((new.details->>'pinned')::boolean,false)) or (tg_op='UPDATE' and new.details ? 'pinned' and new.details->'pinned' is distinct from old.details->'pinned')) then raise exception 'admin_pin_required' using errcode='42501'; end if;
  if new.details ? 'audioPath' and new.details->>'audioPath' not like auth.uid()::text || '/%' and not (tg_op='UPDATE' and delegated and new.details->'audioPath'=old.details->'audioPath') then raise exception 'audio_owner_required' using errcode='42501'; end if;
  if new.details ? 'imagePath' and new.details->>'imagePath' not like auth.uid()::text || '/%' and not (tg_op='UPDATE' and delegated and new.details->'imagePath'=old.details->'imagePath') then raise exception 'image_owner_required' using errcode='42501'; end if;
 end if;
 allowed:=case new.kind
  when 'gallery' then array['imagePath','publicImage','date']
  when 'place' then array['x','y','category']
  when 'chronicle' then array['date','sourceId','imagePath','publicImage']
  when 'trade' then array['category','contact','expires','imagePath','publicImage']
  when 'event' then array['date','time','location','registrationOpen','repeat','repeatUntil','capacity','cancelled','exceptions','duration']
  when 'character' then array['profession','relationships','imagePath','publicImage']
  when 'task' then array['category','dueDate']
  when 'project' then array['responsible','materials','progress']
  when 'knowledge' then array['category','tags']
  when 'poll' then array['options','endDate','open']
  when 'journal' then array['date']
  when 'media' then array['mediaType','youtubeId','spotifyType','spotifyId','autoplay','audioPath','publicAudio','imagePath','publicImage','fileName'] end;
 if new.kind='event' then allowed:=allowed || array['occurrenceChanges'];end if;
 allowed:=allowed || array['mediaIds','relatedIds','story','audience','speakerId','speakerName','thumbPath','publicThumb'];
 if new.kind='knowledge' then allowed:=allowed || array['pinned']; end if;
 if exists(select 1 from jsonb_object_keys(new.details) k where not(k=any(allowed))) then raise exception 'invalid_details'; end if;
 if exists(select 1 from jsonb_each(new.details) e where e.key not in ('options','x','y','progress','open','registrationOpen','mediaIds','relatedIds','pinned','capacity','cancelled','exceptions','duration','occurrenceChanges') and jsonb_typeof(e.value)<>'string') then raise exception 'invalid_details'; end if;
 if new.details ? 'imagePath' and new.details->>'imagePath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_image_path'; end if;
 if new.details ? 'publicImage' and new.details->>'publicImage' !~ '^[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_public_image'; end if;
 foreach date_key in array array['date','dueDate','endDate','expires','repeatUntil'] loop
  if new.details ? date_key then
   if new.details->>date_key !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
   perform (new.details->>date_key)::date;
  end if;
 end loop;
 if new.kind='event' then
  if not(new.details ? 'date') then raise exception 'event_date_required'; end if;
  if new.details ? 'time' and new.details->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_time'; end if;
  if new.details ? 'registrationOpen' and jsonb_typeof(new.details->'registrationOpen')<>'boolean' then raise exception 'invalid_details'; end if;
 elsif new.kind='place' then
  if not(new.details ? 'x' and new.details ? 'y') or jsonb_typeof(new.details->'x')<>'number' or jsonb_typeof(new.details->'y')<>'number' then raise exception 'map_coordinates_required'; end if;
  if (new.details->>'x')::numeric not between 0 and 100 or (new.details->>'y')::numeric not between 0 and 100 then raise exception 'invalid_map_coordinates'; end if;
 elsif new.kind='project' and new.details ? 'progress' then
  if jsonb_typeof(new.details->'progress')<>'number' or (new.details->>'progress')::numeric not between 0 and 100 or (new.details->>'progress')::numeric<>trunc((new.details->>'progress')::numeric) then raise exception 'invalid_progress'; end if;
 elsif new.kind='poll' then
  if jsonb_typeof(new.details->'options') is distinct from 'array' or jsonb_array_length(new.details->'options') not between 2 and 8 then raise exception 'poll_options_required'; end if;
  for option_value in select value from jsonb_array_elements(new.details->'options') loop
   if jsonb_typeof(option_value)<>'string' or char_length(btrim(option_value#>>'{}')) not between 1 and 100 then raise exception 'invalid_poll_option'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(new.details->'options'))<>jsonb_array_length(new.details->'options') then raise exception 'duplicate_poll_options'; end if;
  if new.details ? 'open' and jsonb_typeof(new.details->'open')<>'boolean' then raise exception 'invalid_details'; end if;
  if tg_op='UPDATE' and new.details->'options' is distinct from old.details->'options' and exists(select 1 from public.raben_poll_votes where record_id=old.id) then raise exception 'poll_has_votes'; end if;
 end if;
 if new.kind='gallery' and new.visibility='public' and not(new.details ? 'publicImage') then raise exception 'public_image_required'; end if;

 -- Old open editor tabs must not silently discard newly introduced fields.
 if tg_op='UPDATE' then
  foreach extra_key in array array['mediaIds','relatedIds','story','pinned','audience','speakerId','speakerName','thumbPath','publicThumb','repeat','repeatUntil','capacity','cancelled','exceptions','duration','occurrenceChanges'] loop
   if not(new.details ? extra_key) and old.details ? extra_key then new.details:=new.details || jsonb_build_object(extra_key,old.details->extra_key); end if;
  end loop;
 end if;
 if new.details ? 'story' and char_length(new.details->>'story')>100 then raise exception 'invalid_story'; end if;
 if new.details ? 'pinned' and jsonb_typeof(new.details->'pinned')<>'boolean' then raise exception 'invalid_pin'; end if;
 foreach extra_key in array array['mediaIds','relatedIds'] loop
  if new.details ? extra_key then
   if jsonb_typeof(new.details->extra_key)<>'array' or jsonb_array_length(new.details->extra_key)>20 then raise exception 'invalid_links'; end if;
   if (select count(distinct value) from jsonb_array_elements(new.details->extra_key))<>jsonb_array_length(new.details->extra_key) then raise exception 'invalid_links'; end if;
   for ref_value in select jsonb_array_elements_text(new.details->extra_key) loop
    if ref_value !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or ref_value=new.id::text then raise exception 'invalid_links'; end if;
    select * into ref_row from public.raben_records where id=ref_value::uuid;
    if not found or (extra_key='mediaIds' and ref_row.kind<>'media') then raise exception 'linked_record_missing'; end if;
    if new.visibility='public' and ref_row.visibility<>'public' then raise exception 'linked_record_not_public'; end if;
   end loop;
  end if;
 end loop;
 if new.kind='media' then
  if new.details->>'mediaType' not in ('image','youtube','mp3','spotify') or not(new.details ? 'mediaType') then raise exception 'media_type_required'; end if;
  if new.details->>'mediaType'='youtube' then
   if new.details->>'youtubeId' !~ '^[a-zA-Z0-9_-]{11}$' or not(new.details ? 'youtubeId') then raise exception 'invalid_youtube'; end if;
   if new.details ? 'audioPath' or new.details ? 'publicAudio' then raise exception 'invalid_media'; end if;
  elsif new.details->>'mediaType'='spotify' then
   if coalesce(new.details->>'spotifyType','') not in ('track','playlist') or coalesce(new.details->>'spotifyId','') !~ '^[A-Za-z0-9]{22}$' then raise exception 'invalid_spotify' using errcode='23514';end if;
   if new.details ? 'youtubeId' or new.details ? 'audioPath' or new.details ? 'publicAudio' then raise exception 'invalid_media';end if;
  elsif new.details->>'mediaType'='mp3' then
   if new.details->>'audioPath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.mp3$' or not(new.details ? 'audioPath') then raise exception 'audio_file_required'; end if;
   if new.details ? 'youtubeId' then raise exception 'invalid_media'; end if;
   if not exists(select 1 from storage.objects where bucket_id='raben-media' and name=new.details->>'audioPath') then raise exception 'audio_file_missing'; end if;
   if new.visibility='public' then
    if new.details->>'publicAudio' !~ '^[a-f0-9-]{36}\.mp3$' or not(new.details ? 'publicAudio') then raise exception 'public_audio_required'; end if;
    if not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.details->>'publicAudio') then raise exception 'audio_file_missing'; end if;
   end if;
  elsif new.details->>'mediaType'='image' and not(new.details ? 'imagePath') then raise exception 'image_required';
  end if;
  if new.visibility='public' and new.details->>'mediaType'='image' and not(new.details ? 'publicImage') then raise exception 'public_image_required'; end if;
 end if;
 if new.details ? 'publicAudio' and new.details->>'publicAudio' !~ '^[a-f0-9-]{36}\.mp3$' then raise exception 'invalid_public_audio'; end if;

 if new.details ? 'audience' and new.details->>'audience' not in ('ic','ooc','mixed') then raise exception 'invalid_audience' using errcode='23514';end if;
 if new.details->>'speakerId'='' then new.details:=new.details-'speakerId'-'speakerName';
 elsif new.details ? 'speakerId' and (tg_op='INSERT' or new.details->'speakerId' is distinct from old.details->'speakerId') then
  if new.details->>'speakerId' !~ '^[a-f0-9-]{36}$' then raise exception 'invalid_speaker' using errcode='23514';end if;
  select title into speaker from public.raben_profile_items where id=(new.details->>'speakerId')::uuid and owner_id=auth.uid() and kind='character';
  if speaker is null then select title into speaker from public.raben_records where id=(new.details->>'speakerId')::uuid and created_by=auth.uid() and kind='character';end if;
  if speaker is null then raise exception 'invalid_speaker' using errcode='23514';end if;
  new.details:=new.details || jsonb_build_object('speakerName',speaker);
 elsif tg_op='UPDATE' and new.details ? 'speakerId' then new.details:=new.details || jsonb_build_object('speakerName',old.details->>'speakerName');
 elsif new.details ? 'speakerName' then raise exception 'invalid_speaker' using errcode='23514';end if;
 if new.details ? 'thumbPath' then
  if new.details->>'thumbPath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-media' and name=new.details->>'thumbPath') then raise exception 'invalid_thumbnail' using errcode='23514';end if;
 end if;
 if new.details ? 'publicThumb' and (new.details->>'publicThumb' !~ '^[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.details->>'publicThumb')) then raise exception 'invalid_thumbnail' using errcode='23514';end if;
 if new.kind='event' then
  if new.details ? 'capacity' and (jsonb_typeof(new.details->'capacity')<>'number' or (new.details->>'capacity')::numeric not between 1 and 500 or (new.details->>'capacity')::numeric<>trunc((new.details->>'capacity')::numeric)) then raise exception 'invalid_capacity' using errcode='23514';end if;
  if new.details ? 'duration' and (jsonb_typeof(new.details->'duration')<>'number' or (new.details->>'duration')::integer not between 15 and 1440) then raise exception 'invalid_duration' using errcode='23514';end if;
  if new.details ? 'repeat' and new.details->>'repeat' not in ('none','weekly','fortnightly','monthly') then raise exception 'invalid_repeat' using errcode='23514';end if;
  if coalesce(new.details->>'repeat','none')<>'none' and (not(new.details ? 'repeatUntil') or (new.details->>'repeatUntil')::date<(new.details->>'date')::date or (new.details->>'repeatUntil')::date>(new.details->>'date')::date+interval '2 years') then raise exception 'repeat_until_required' using errcode='23514';end if;
  if new.details ? 'cancelled' and jsonb_typeof(new.details->'cancelled')<>'boolean' then raise exception 'invalid_cancelled' using errcode='23514';end if;
  if new.details ? 'exceptions' then
   if jsonb_typeof(new.details->'exceptions')<>'array' or jsonb_array_length(new.details->'exceptions')>100 then raise exception 'invalid_exceptions' using errcode='23514';end if;
   for ref_value in select jsonb_array_elements_text(new.details->'exceptions') loop perform ref_value::date;end loop;
  end if;
 end if;
 if new.details ? 'autoplay' and (new.kind<>'media' or new.details->>'mediaType' not in ('youtube','spotify') or new.details->>'autoplay' not in ('true','false')) then raise exception 'invalid_autoplay' using errcode='23514';end if;
 if new.details->>'mediaType'<>'spotify' and (new.details ? 'spotifyType' or new.details ? 'spotifyId') then raise exception 'invalid_spotify' using errcode='23514';end if;
 if new.details ? 'occurrenceChanges' then
  if new.kind<>'event' or jsonb_typeof(new.details->'occurrenceChanges')<>'object' or (select count(*) from jsonb_object_keys(new.details->'occurrenceChanges'))>100 then raise exception 'invalid_occurrence_change';end if;
  for extra_key,option_value in select * from jsonb_each(new.details->'occurrenceChanges') loop
   if extra_key !~ '^\d{4}-\d\d-\d\d$' or not raben_private.event_occurs(new.details-'exceptions'-'cancelled',extra_key::date) or jsonb_typeof(option_value)<>'object' or exists(select 1 from jsonb_object_keys(option_value) k where k not in ('date','time','duration')) then raise exception 'invalid_occurrence_change';end if;
   if coalesce(option_value->>'date','') !~ '^\d{4}-\d\d-\d\d$' or coalesce(option_value->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(option_value->'duration') is distinct from 'number' or (option_value->>'duration')::numeric not between 15 and 1440 or (option_value->>'duration')::numeric<>trunc((option_value->>'duration')::numeric) then raise exception 'invalid_occurrence_change';end if;
   if (option_value->>'date')::date < (new.details->>'date')::date-interval '2 years' or (option_value->>'date')::date>(new.details->>'date')::date+interval '4 years' then raise exception 'invalid_occurrence_change';end if;
  end loop;
 end if;
 new.updated_at:=now(); return new;
end; $$;

create or replace function raben_private.guard_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.raben_records;
begin
 if not raben_private.is_member() or (new.user_id<>auth.uid() and not (pg_trigger_depth()>1)) then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=new.record_id;
 if not found or r.kind<>'event' or r.visibility not in ('clan','public') or not raben_private.event_occurs(r.details,new.occurrence_date) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 perform 1 from public.raben_resources where id=new.resource_id and (active or tg_op='UPDATE') for update;
 if not found then raise exception 'resource_unavailable' using errcode='23514';end if;
 new.starts_at:=raben_private.event_start(r.details,new.occurrence_date)-make_interval(mins=>new.setup_minutes);
 new.ends_at:=raben_private.event_start(r.details,new.occurrence_date)+make_interval(mins=>coalesce((r.details->'occurrenceChanges'->new.occurrence_date::text->>'duration')::integer,(r.details->>'duration')::integer,120)+new.teardown_minutes);
 if exists(select 1 from public.raben_reservations b join public.raben_records e on e.id=b.record_id where b.resource_id=new.resource_id and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,b.occurrence_date)) then raise exception 'resource_conflict' using errcode='23P01';end if;
 return new;
end;$$;

create or replace function raben_private.guard_reminder() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.raben_records;start_time timestamptz;
begin
 select * into r from public.raben_records where id=new.record_id and kind='event' and visibility in ('clan','public');
 if not found or not raben_private.event_occurs(r.details,new.occurrence_date) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 start_time:=raben_private.event_start(r.details,new.occurrence_date);
 if start_time<=now() then raise exception 'event_passed' using errcode='23514';end if;return new;
end;$$;

create or replace function raben_private.queue_event_reminders() returns void language plpgsql security definer set search_path='' as $$
declare r record;due timestamptz;inserted integer;
begin
 if not pg_try_advisory_xact_lock(591832021) then return;end if;
 for r in select m.*,e.details from public.raben_event_reminders m join public.raben_records e on e.id=m.record_id and e.kind='event' and e.visibility in ('clan','public') join public.raben_memberships u on u.user_id=m.user_id and u.status='active' where (coalesce(e.details->'occurrenceChanges'->m.occurrence_date::text->>'date',m.occurrence_date::text))::date between (now() at time zone 'Europe/Berlin')::date and (now() at time zone 'Europe/Berlin')::date+7 loop
  if not raben_private.event_occurs(r.details,r.occurrence_date) then continue;end if;
  due:=raben_private.event_start(r.details,r.occurrence_date);
  if now()<due-make_interval(mins=>r.lead_minutes) or now()>=due then continue;end if;
  insert into raben_private.reminder_deliveries(record_id,user_id,occurrence_date,start_time,lead_minutes) values(r.record_id,r.user_id,r.occurrence_date,due,r.lead_minutes) on conflict do nothing;
  get diagnostics inserted=row_count;if inserted=0 then continue;end if;
  insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(r.user_id,'event','Deine RP-Terminerinnerung','record',r.record_id);
  if r.push_enabled then insert into raben_private.push_jobs(device_id,record_id,occurrence_date) select id,r.record_id,r.occurrence_date from public.raben_push_devices where user_id=r.user_id;end if;
 end loop;
 delete from raben_private.reminder_deliveries where created_at<now()-interval '90 days';
 delete from raben_private.push_jobs where created_at<now()-interval '30 days';
end;$$;

create or replace function public.raben_calendar_feed_data(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.raben_calendar_feeds;
begin
 if p_token !~ '^[a-f0-9]{64}$' then return null;end if;
 select * into f from public.raben_calendar_feeds where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and not revoked and (expires_at is null or expires_at>now());
 if not found or not exists(select 1 from public.raben_memberships where user_id=f.user_id and status='active') then return null;end if;
 return jsonb_build_object('title',f.title,'events',coalesce((select jsonb_agg(to_jsonb(r)) from (
  select id,title,body,details,revision,updated_at,case when f.mode='attending' then (select jsonb_agg(s.occurrence_date::text order by s.occurrence_date) from public.raben_event_slots s where s.record_id=e.id and s.user_id=f.user_id and s.choice='yes' and (coalesce(e.details->'occurrenceChanges'->s.occurrence_date::text->>'date',s.occurrence_date::text))::date>=(now() at time zone 'Europe/Berlin')::date-1) else null end as attending_dates from public.raben_records e where kind='event' and visibility in ('clan','public')
  and not coalesce((details->>'cancelled')::boolean,false) and (coalesce(nullif(details->>'repeatUntil','')::date,(details->>'date')::date)>=(now() at time zone 'Europe/Berlin')::date-1 or exists(select 1 from jsonb_each(coalesce(details->'occurrenceChanges','{}')) x where (x.value->>'date')::date>=(now() at time zone 'Europe/Berlin')::date-1))
  and (f.mode='all' or exists(select 1 from public.raben_event_slots s where s.record_id=e.id and s.user_id=f.user_id and s.choice='yes' and (coalesce(e.details->'occurrenceChanges'->s.occurrence_date::text->>'date',s.occurrence_date::text))::date>=(now() at time zone 'Europe/Berlin')::date-1)) order by details->>'date',id limit 500
 ) r),'[]'::jsonb));
end;$$;

create or replace function public.raben_claim_push_jobs(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c raben_private.reminder_config;key text;result jsonb;
begin
 select * into c from raben_private.reminder_config where id=1;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.dispatch_secret_id;
 if key is null or p_secret is distinct from key then raise exception 'dispatch_denied' using errcode='42501';end if;
 update raben_private.push_jobs set status=case when attempts<5 then 'pending' else 'failed' end where status='sending' and lease_until<now();
 update raben_private.push_jobs j set status='failed' where status='pending' and not j.is_test and not exists(select 1 from public.raben_records e join public.raben_push_devices d on d.id=j.device_id join public.raben_memberships m on m.user_id=d.user_id and m.status='active' where e.id=j.record_id and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,j.occurrence_date) and exists(select 1 from public.raben_event_reminders r where r.record_id=j.record_id and r.user_id=d.user_id and r.occurrence_date=j.occurrence_date and r.push_enabled) and raben_private.event_start(e.details,j.occurrence_date)>now());
 update raben_private.push_jobs j set status='failed' where j.is_test and j.status='pending' and not exists(select 1 from public.raben_push_devices d join public.raben_memberships m on m.user_id=d.user_id and m.status='active' where d.id=j.device_id);
 with chosen as(select id from raben_private.push_jobs where status='pending' and next_attempt<=now() order by created_at limit 20 for update skip locked),claimed as(update raben_private.push_jobs j set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' from chosen where j.id=chosen.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'recordId',j.record_id,'test',j.is_test,'endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth_key)),'[]') into result from claimed j join public.raben_push_devices d on d.id=j.device_id;
 select decrypted_secret into key from vault.decrypted_secrets where id=c.vapid_secret_id;
 return jsonb_build_object('publicKey',c.vapid_public,'privateKey',key,'jobs',result);
end;$$;

create or replace function public.raben_plan_materials(p_recipe uuid,p_multiplier numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.raben_recipes;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if p_multiplier is null or p_multiplier::text in ('NaN','Infinity','-Infinity') or p_multiplier<=0 or p_multiplier>10000 then raise exception 'invalid_multiplier' using errcode='23514';end if;
 select * into r from public.raben_recipes where id=p_recipe;if not found then raise exception 'recipe_missing' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('item_id',s.id,'name',s.name,'unit',s.unit,'required',(ceil(round((v->>'quantity')::numeric*p_multiplier,3)/coalesce((r.packages->>s.id::text)::numeric,0.001))*coalesce((r.packages->>s.id::text)::numeric,0.001)),'available',s.quantity,'missing',greatest(0,(ceil(round((v->>'quantity')::numeric*p_multiplier,3)/coalesce((r.packages->>s.id::text)::numeric,0.001))*coalesce((r.packages->>s.id::text)::numeric,0.001))-s.quantity))) from jsonb_array_elements(r.materials) v join public.raben_stock_items s on s.id=(v->>'item_id')::uuid),'[]');
end;$$;

alter table raben_private.discord_config add column review_scopes text[] not null default '{}';
alter table raben_private.discord_routes add column review_scopes text[] not null default '{}';
alter table raben_private.discord_outbox add column approved boolean not null default true,add column paused boolean not null default false;
alter table raben_private.discord_route_outbox add column approved boolean not null default true,add column paused boolean not null default false;
create function raben_private.gate_discord_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='discord_outbox' then new.approved:=not exists(select 1 from raben_private.discord_config where new.scope=any(review_scopes));
 else new.approved:=not exists(select 1 from raben_private.discord_routes where id=new.route_id and new.scope=any(review_scopes));end if;return new;
end;$$;
revoke all on function raben_private.gate_discord_message() from public,anon,authenticated;
create trigger gate_discord_message before insert on raben_private.discord_outbox for each row execute function raben_private.gate_discord_message();
create trigger gate_discord_message before insert on raben_private.discord_route_outbox for each row execute function raben_private.gate_discord_message();
create function raben_private.discord_review(p_action text,p_route uuid default null,p_id uuid default null,p_scopes text[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if p_action='settings' then
  if p_scopes is null or array_position(p_scopes,null) is not null or not(p_scopes<@array['posts','event','poll']) then raise exception 'invalid_scopes';end if;
  if p_route is null then update raben_private.discord_config set review_scopes=p_scopes where id=1;update raben_private.discord_outbox set approved=false where status='pending' and scope=any(p_scopes);else update raben_private.discord_routes set review_scopes=p_scopes where id=p_route;update raben_private.discord_route_outbox set approved=false where status='pending' and route_id=p_route and scope=any(p_scopes);end if;
 elsif p_action in ('approve','pause','resume','cancel') then
  if p_route is null then update raben_private.discord_outbox set approved=case when p_action='approve' then true else approved end,paused=case when p_action='pause' then true when p_action='resume' then false else paused end,status=case when p_action='cancel' then 'cancelled' else status end where id=p_id and status='pending';
  else update raben_private.discord_route_outbox set approved=case when p_action='approve' then true else approved end,paused=case when p_action='pause' then true when p_action='resume' then false else paused end,status=case when p_action='cancel' then 'cancelled' else status end where id=p_id and route_id=p_route and status='pending';end if;
 elsif p_action<>'list' then raise exception 'invalid_action';end if;
 return jsonb_build_object('routes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'review_scopes',review_scopes)) from raben_private.discord_routes),'[]'),'default_scopes',coalesce((select to_jsonb(review_scopes) from raben_private.discord_config where id=1),'[]'),'messages',coalesce((select jsonb_agg(x) from(select id,null::uuid route_id,scope,payload,approved,paused,status,created_at from raben_private.discord_outbox where status='pending' union all select id,route_id,scope,payload,approved,paused,status,created_at from raben_private.discord_route_outbox where status='pending' order by created_at limit 100)x),'[]'));
end;$$;
revoke all on function raben_private.discord_review(text,uuid,uuid,text[]) from public,anon;grant execute on function raben_private.discord_review(text,uuid,uuid,text[]) to authenticated;
create function public.raben_discord_review(p_action text,p_route uuid default null,p_id uuid default null,p_scopes text[] default '{}') returns jsonb language sql security invoker set search_path='' as $$select raben_private.discord_review(p_action,p_route,p_id,p_scopes)$$;
revoke all on function public.raben_discord_review(text,uuid,uuid,text[]) from public,anon;grant execute on function public.raben_discord_review(text,uuid,uuid,text[]) to authenticated;


create or replace function raben_private.dispatch_discord() returns void language plpgsql security definer set search_path='' as $$
declare c raben_private.discord_config;q raben_private.discord_outbox;response record;address text;pause_seconds integer;still_visible boolean;code integer;response_body text;
begin
 if not pg_try_advisory_xact_lock(591832004) then return;end if;
 select * into c from raben_private.discord_config where id=1;
 if not c.enabled or c.secret_id is null then return;end if;
 select decrypted_secret into address from vault.decrypted_secrets where id=c.secret_id;
 if address is null then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');
 perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 -- Any interrupted request is retried with the existing attempt limit.
 update raben_private.discord_outbox set status=case when attempts<5 then 'pending' else 'failed' end,next_attempt=now(),updated_at=now() where status='sending';
 for q in select * from raben_private.discord_outbox where status='pending' and approved and not paused and next_attempt<=now() order by created_at limit 3 for update skip locked loop
  still_visible:=q.scope='test';
  if q.source_table='raben_records' then
   select exists(select 1 from public.raben_records r where r.id=q.source_key and r.visibility in ('clan','public') and r.kind=q.scope and r.revision::text=q.source_revision) into still_visible;
  elsif q.source_table='raben_clan_posts' then
   select exists(select 1 from public.raben_clan_posts p where p.id=q.source_key and md5(jsonb_build_object('title',p.title,'body',p.body,'category',p.category,'event_date',p.event_date,'updated',extract(epoch from p.updated_at))::text)=q.source_revision) into still_visible;
  end if;
  if not still_visible or q.config_revision<>c.revision or (q.scope<>'test' and not(q.scope=any(c.scopes))) then update raben_private.discord_outbox set status='cancelled',updated_at=now() where id=q.id;continue;end if;
  code:=null;response_body:=null;
  begin
   select * into response from extensions.http_post(address||'?wait=true',q.payload::text,'application/json');
   code:=response.status;response_body:=response.content;
  exception when others then
   -- Network errors can contain URLs. Persist only status and retry information.
   code:=null;
  end;
  pause_seconds:=least(3600,(30*power(2,q.attempts+1))::integer);
  if code=429 and response_body is not null then
   begin pause_seconds:=greatest(pause_seconds,least(86400,ceil((response_body::jsonb->>'retry_after')::numeric)::integer));exception when others then null;end;
  end if;
  update raben_private.discord_outbox set
   status=case when code between 200 and 299 then 'sent' when q.attempts+1<5 and (code=429 or code>=500 or code is null) then 'pending' else 'failed' end,
   attempts=attempts+1,request_id=null,status_code=code,next_attempt=now()+make_interval(secs=>pause_seconds),updated_at=now() where id=q.id;
 end loop;
 delete from raben_private.discord_outbox where status in ('sent','failed','cancelled') and created_at<now()-interval '30 days';
end;$$;

create or replace function raben_private.dispatch_discord_routes() returns void language plpgsql security definer set search_path='' as $$
declare q raben_private.discord_route_outbox;c raben_private.discord_routes;address text;response record;code integer;wait_seconds integer;visible boolean;
begin
 if not pg_try_advisory_xact_lock(591832023) then return;end if;
 perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','3000');perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000');
 update raben_private.discord_route_outbox set status=case when attempts<5 then 'pending' else 'failed' end where status='sending';
 for q in select * from raben_private.discord_route_outbox where status='pending' and approved and not paused and next_attempt<=now() order by created_at limit 3 for update skip locked loop
  select * into c from raben_private.discord_routes where id=q.route_id;
  visible:=false;
  if q.source_table='raben_records' then select exists(select 1 from public.raben_records where id=q.source_key and visibility in ('clan','public') and kind=q.scope and revision::text=q.source_revision) into visible;
  else select exists(select 1 from public.raben_clan_posts p where id=q.source_key and md5(jsonb_build_object('title',p.title,'body',p.body,'category',p.category,'event_date',p.event_date,'updated',extract(epoch from p.updated_at))::text)=q.source_revision) into visible;end if;
  if not visible or not c.enabled or c.revision<>q.config_revision or not(q.scope=any(c.scopes)) then update raben_private.discord_route_outbox set status='cancelled' where id=q.id;continue;end if;
  select decrypted_secret into address from vault.decrypted_secrets where id=c.secret_id;code:=null;wait_seconds:=least(3600,(30*power(2,q.attempts+1))::integer);
  if address is not null then begin select * into response from extensions.http_post(address||case when strpos(address,'?')>0 then '&wait=true' else '?wait=true' end,q.payload::text,'application/json');code:=response.status;
   if code=429 then begin wait_seconds:=greatest(wait_seconds,least(86400,ceil((response.content::jsonb->>'retry_after')::numeric)::integer));exception when others then null;end;end if;
  exception when others then code:=null;end;end if;
  update raben_private.discord_route_outbox set status=case when code between 200 and 299 then 'sent' when attempts+1<5 and (code is null or code=429 or code>=500) then 'pending' else 'failed' end,attempts=attempts+1,status_code=code,next_attempt=now()+make_interval(secs=>wait_seconds) where id=q.id;
 end loop;
 delete from raben_private.discord_route_outbox where created_at<now()-interval '30 days';
end;$$;

notify pgrst,'reload schema';
create function public.raben_chat_messages(p_peer uuid,p_before_time timestamptz default null,p_before_id uuid default null) returns setof public.raben_direct_messages language sql stable security invoker set search_path='' as $$
 select m.* from public.raben_direct_messages m where ((m.sender_id=auth.uid() and m.recipient_id=p_peer) or (m.recipient_id=auth.uid() and m.sender_id=p_peer)) and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id)) order by m.created_at desc,m.id desc limit 50
$$;
revoke all on function public.raben_chat_messages(uuid,timestamptz,uuid) from public,anon;grant execute on function public.raben_chat_messages(uuid,timestamptz,uuid) to authenticated;
create function public.raben_save_image_description(p_type text,p_id uuid,p_text text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.image_description_access(p_type,p_id,true) then raise exception 'image_denied' using errcode='42501';end if;
 insert into public.raben_image_descriptions(parent_type,parent_id,owner_id,alt_text) values(p_type,p_id,auth.uid(),p_text) on conflict(parent_type,parent_id) do update set alt_text=excluded.alt_text;
end;$$;
revoke all on function public.raben_save_image_description(text,uuid,text) from public,anon;grant execute on function public.raben_save_image_description(text,uuid,text) to authenticated;
create function public.raben_image_size(p_bucket text,p_path text) returns bigint language sql stable security invoker set search_path='' as $$ select (metadata->>'size')::bigint from storage.objects where bucket_id=p_bucket and name=p_path and p_bucket in ('raben-profile-media','raben-media','raben-map-media') limit 1 $$;
revoke all on function public.raben_image_size(text,text) from public,anon;grant execute on function public.raben_image_size(text,text) to authenticated;
create function public.raben_bulk_gallery(p_item uuid,p_ids uuid[],p_album uuid,p_delete boolean,p_expected bigint) returns void language plpgsql security invoker set search_path='' as $$
declare rev bigint;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select revision into rev from public.raben_profile_items where id=p_item and owner_id=auth.uid() for update;
 if not found then raise exception 'owner_required' using errcode='42501';end if;
 if rev is distinct from p_expected then raise exception 'profile_conflict' using errcode='40001';end if;
 if p_ids is null or cardinality(p_ids) not between 1 and 12 or (select count(distinct x) from unnest(p_ids)x)<>cardinality(p_ids) or (select count(*) from public.raben_profile_gallery where item_id=p_item and owner_id=auth.uid() and id=any(p_ids))<>cardinality(p_ids) then raise exception 'invalid_selection' using errcode='23514';end if;
 if p_delete then delete from public.raben_profile_gallery where item_id=p_item and id=any(p_ids) and owner_id=auth.uid();else update public.raben_profile_gallery set album_id=p_album where item_id=p_item and id=any(p_ids) and owner_id=auth.uid();end if;
end;$$;
revoke all on function public.raben_bulk_gallery(uuid,uuid[],uuid,boolean,bigint) from public,anon;grant execute on function public.raben_bulk_gallery(uuid,uuid[],uuid,boolean,bigint) to authenticated;
notify pgrst,'reload schema';

create or replace function raben_private.guard_profile_expansion() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
 if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
 if new.owner_id<>auth.uid() then
  if tg_table_name<>'raben_profile_items' or tg_op<>'UPDATE' then raise exception 'profile_access_denied' using errcode='42501';end if;
  if not raben_private.entry_collaborator('profile',old.id) or new.preview_path is distinct from old.preview_path then raise exception 'profile_access_denied' using errcode='42501';end if;
 elsif not raben_private.check_personal_image(new.preview_path) then raise exception 'profile_access_denied' using errcode='42501';end if;
 if tg_table_name='raben_profile_gallery' then
  if not raben_private.check_personal_image(new.image_path) then raise exception 'profile_image_missing' using errcode='23514';end if;
  if (select count(*) from public.raben_profile_gallery where item_id=new.item_id and id<>new.id)>=12 then raise exception 'gallery_limit' using errcode='23514';end if;
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

create or replace function raben_private.guard_event_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.raben_records;start_date date;delta integer;cap integer;trusted boolean:=pg_trigger_depth()>1 and current_user not in ('authenticated','anon') and tg_op='UPDATE';
begin
 if trusted and (old.choice<>'wait' or new.choice<>'yes' or new.record_id<>old.record_id or new.user_id<>old.user_id or new.occurrence_date<>old.occurrence_date) then raise exception 'invalid_promotion' using errcode='42501';end if;
 if not trusted and (not raben_private.is_member() or new.user_id<>auth.uid()) then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=new.record_id for update;
 if not found or r.kind<>'event' or r.visibility not in ('public','clan') then raise exception 'event_missing' using errcode='42501';end if;
 start_date:=(r.details->>'date')::date;delta:=new.occurrence_date-start_date;
 if delta<0 or new.occurrence_date>coalesce(nullif(r.details->>'repeatUntil','')::date,start_date) or
  not (new.occurrence_date=start_date or (r.details->>'repeat'='weekly' and delta%7=0) or (r.details->>'repeat'='fortnightly' and delta%14=0) or (r.details->>'repeat'='monthly' and extract(day from new.occurrence_date)=extract(day from start_date))) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 if coalesce((r.details->>'cancelled')::boolean,false) or r.details->'exceptions' @> to_jsonb(array[new.occurrence_date::text]) or r.details->>'registrationOpen'='false' or (raben_private.event_start(r.details,new.occurrence_date) at time zone 'Europe/Berlin')::date<(now() at time zone 'Europe/Berlin')::date then raise exception 'registration_closed' using errcode='23514';end if;
 if tg_op='UPDATE' then new.record_id:=old.record_id;new.user_id:=old.user_id;new.occurrence_date:=old.occurrence_date;new.wait_since:=old.wait_since;end if;
 cap:=nullif(r.details->>'capacity','')::integer;
 if new.choice in ('yes','wait') then
  if cap is not null and (select count(*) from public.raben_event_slots s where s.record_id=new.record_id and s.occurrence_date=new.occurrence_date and s.choice='yes' and s.user_id<>new.user_id and exists(select 1 from public.raben_memberships m where m.user_id=s.user_id and m.status='active'))>=cap then
   new.choice:='wait';if tg_op='INSERT' then new.wait_since:=now();elsif old.choice<>'wait' then new.wait_since:=now();end if;
  else new.choice:='yes';end if;
 end if;
 new.updated_at:=now();return new;
end;$$;

create function raben_private.guard_time_window() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() or new.user_id<>auth.uid() then raise exception 'member_required' using errcode='42501';end if;
 perform 1 from public.raben_open_plans where id=new.plan_id and not closed for update;if not found then raise exception 'planning_closed' using errcode='23514';end if;
 if (select count(*) from public.raben_time_windows where plan_id=new.plan_id and user_id=auth.uid())>=40 then raise exception 'window_limit' using errcode='23514';end if;return new;
end;$$;
revoke all on function raben_private.guard_time_window() from public,anon,authenticated;
create trigger guard_time_window before insert on public.raben_time_windows for each row execute function raben_private.guard_time_window();
notify pgrst,'reload schema';

-- Calendar notices point at self-only feed metadata, never at a made-up public record.
alter table public.raben_notifications drop constraint raben_notifications_parent_type_check;
alter table public.raben_notifications add constraint raben_notifications_parent_type_check check(parent_type in ('record','post','request','plot','calendarFeed'));
drop policy raben_notifications_read on public.raben_notifications;
drop policy raben_notifications_edit on public.raben_notifications;
create policy raben_notifications_read on public.raben_notifications for select to authenticated using(user_id=(select auth.uid()) and (raben_private.can_view_parent(parent_type,parent_id) or (parent_type='calendarFeed' and exists(select 1 from public.raben_calendar_feeds f where f.id=parent_id and f.user_id=(select auth.uid())))));
create policy raben_notifications_edit on public.raben_notifications for update to authenticated using(user_id=(select auth.uid()) and (raben_private.can_view_parent(parent_type,parent_id) or (parent_type='calendarFeed' and exists(select 1 from public.raben_calendar_feeds f where f.id=parent_id and f.user_id=(select auth.uid()))))) with check(user_id=(select auth.uid()) and (raben_private.can_view_parent(parent_type,parent_id) or (parent_type='calendarFeed' and exists(select 1 from public.raben_calendar_feeds f where f.id=parent_id and f.user_id=(select auth.uid())))));
notify pgrst,'reload schema';
