create table public.raben_rp_requests (
 id uuid primary key default gen_random_uuid(),created_by uuid not null default auth.uid() references public.raben_memberships(user_id),
 title text not null check(length(btrim(title)) between 1 and 200),body text not null default '' check(length(body)<=8000),
 character_name text not null default '' check(length(character_name)<=120),starts_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at>starts_at),closed boolean not null default false,revision bigint not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index raben_requests_active_idx on public.raben_rp_requests(expires_at) where not closed;
create index raben_requests_author_idx on public.raben_rp_requests(created_by);
alter table public.raben_rp_requests enable row level security;
revoke all on public.raben_rp_requests from public,anon,authenticated;
grant select,insert,delete on public.raben_rp_requests to authenticated;
grant update(title,body,character_name,starts_at,expires_at,closed) on public.raben_rp_requests to authenticated;
create policy raben_requests_read on public.raben_rp_requests for select to authenticated using((select raben_private.is_member()) and ((not closed and expires_at>now()) or created_by=(select auth.uid()) or (select raben_private.is_admin())));
create policy raben_requests_create on public.raben_rp_requests for insert to authenticated with check((select raben_private.is_member()) and created_by=(select auth.uid()));
create policy raben_requests_edit on public.raben_rp_requests for update to authenticated using((select raben_private.is_member()) and created_by=(select auth.uid())) with check((select raben_private.is_member()) and created_by=(select auth.uid()));
create policy raben_requests_delete on public.raben_rp_requests for delete to authenticated using((select raben_private.is_member()) and (created_by=(select auth.uid()) or (select raben_private.is_admin())));

create table public.raben_plots (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.raben_memberships(user_id),
 title text not null check(length(btrim(title)) between 1 and 200),body text not null default '' check(length(body)<=20000),
 visibility text not null default 'selected' check(visibility in ('private','selected','clan')),
 stage text not null default 'planning' check(stage in ('planning','active','finished')),
 chapters jsonb not null default '[]' check(jsonb_typeof(chapters)='array' and jsonb_array_length(chapters)<=40 and octet_length(chapters::text)<=80000),
 revision bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,owner_id)
);
create index raben_plots_owner_idx on public.raben_plots(owner_id);
create table public.raben_plot_guests (
 plot_id uuid not null,owner_id uuid not null,user_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 primary key(plot_id,user_id),foreign key(plot_id,owner_id) references public.raben_plots(id,owner_id) on delete cascade,check(owner_id<>user_id)
);
create index raben_plot_guests_owner_idx on public.raben_plot_guests(plot_id,owner_id);
create index raben_plot_guests_user_idx on public.raben_plot_guests(user_id,plot_id);
alter table public.raben_plots enable row level security;alter table public.raben_plot_guests enable row level security;
revoke all on public.raben_plots,public.raben_plot_guests from public,anon,authenticated;
grant select,insert,delete on public.raben_plots,public.raben_plot_guests to authenticated;
grant update(title,body,visibility,stage,chapters) on public.raben_plots to authenticated;
create policy raben_plot_guests_read on public.raben_plot_guests for select to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or user_id=(select auth.uid())));
create policy raben_plot_guests_write on public.raben_plot_guests for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()) and exists(select 1 from public.raben_memberships m where m.user_id=raben_plot_guests.user_id and m.status='active'));
create policy raben_plot_guests_remove on public.raben_plot_guests for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_plots_read on public.raben_plots for select to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_memberships m where m.user_id=owner_id and m.status='active') and (owner_id=(select auth.uid()) or visibility='clan' or (visibility='selected' and exists(select 1 from public.raben_plot_guests g where g.plot_id=raben_plots.id and g.user_id=(select auth.uid())))));
create policy raben_plots_create on public.raben_plots for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_plots_edit on public.raben_plots for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy raben_plots_delete on public.raben_plots for delete to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid()));
create function raben_private.touch_expansion() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if tg_table_name='raben_plots' then
  if new.owner_id<>auth.uid() then raise exception 'owner_required' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(new.chapters) c where jsonb_typeof(c)<>'object' or length(coalesce(c->>'title','')) not between 1 and 200 or length(coalesce(c->>'body',''))>10000 or length(coalesce(c->>'nextScene',''))>2000 or length(coalesce(c->>'result',''))>10000) then raise exception 'invalid_chapter' using errcode='23514';end if;
 else
  if new.created_by<>auth.uid() then raise exception 'owner_required' using errcode='42501';end if;
  if new.expires_at>now()+interval '90 days' or (tg_op='INSERT' and new.expires_at<=now()) then raise exception 'invalid_expiry' using errcode='23514';end if;
 end if;
 if tg_op='UPDATE' then new.id:=old.id;new.created_at:=old.created_at;new.revision:=old.revision+1;
 else new.created_at:=now();new.revision:=1;end if;
 new.title:=btrim(new.title);new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.touch_expansion() from public,anon,authenticated;
create trigger raben_touch_requests before insert or update on public.raben_rp_requests for each row execute function raben_private.touch_expansion();
create trigger raben_touch_plots before insert or update on public.raben_plots for each row execute function raben_private.touch_expansion();
create function public.raben_save_plot(p_id uuid,p_title text,p_body text,p_visibility text,p_stage text,p_chapters jsonb,p_guests uuid[],p_expected bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.raben_plots;guests uuid[];
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 select coalesce(array_agg(distinct u),'{}') into guests from unnest(coalesce(p_guests,'{}')) u;
 if p_visibility='selected' then
  if cardinality(guests) not between 1 and 40 or exists(select 1 from unnest(guests) u where u is null or u=auth.uid() or not exists(select 1 from public.raben_memberships m where m.user_id=u and m.status='active')) then raise exception 'invalid_plot_guests' using errcode='23514';end if;
 else guests:='{}';end if;
 if p_id is null then insert into public.raben_plots(title,body,visibility,stage,chapters) values(p_title,p_body,p_visibility,p_stage,p_chapters) returning * into result;
 else update public.raben_plots set title=p_title,body=p_body,visibility=p_visibility,stage=p_stage,chapters=p_chapters where id=p_id and owner_id=auth.uid() and revision=p_expected returning * into result;
  if not found then raise exception 'plot_conflict' using errcode='40001';end if;
 end if;
 delete from public.raben_plot_guests where plot_id=result.id and owner_id=auth.uid();
 insert into public.raben_plot_guests(plot_id,owner_id,user_id) select result.id,auth.uid(),u from unnest(guests) u;
 return to_jsonb(result);
end;$$;
revoke all on function public.raben_save_plot(uuid,text,text,text,text,jsonb,uuid[],bigint) from public,anon;
grant execute on function public.raben_save_plot(uuid,text,text,text,text,jsonb,uuid[],bigint) to authenticated;

-- Shared parent access is evaluated through the actual parent table's RLS.
create function raben_private.can_view_parent(p_type text,p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select (select raben_private.is_member()) and case p_type
 when 'record' then exists(select 1 from public.raben_records where id=p_id)
 when 'post' then exists(select 1 from public.raben_clan_posts where id=p_id)
 when 'request' then exists(select 1 from public.raben_rp_requests where id=p_id)
 when 'plot' then exists(select 1 from public.raben_plots where id=p_id) else false end;
$$;
revoke all on function raben_private.can_view_parent(text,uuid) from public,anon;
grant execute on function raben_private.can_view_parent(text,uuid) to authenticated;
