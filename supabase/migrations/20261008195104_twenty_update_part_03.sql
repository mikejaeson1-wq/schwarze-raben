create table public.raben_comments (
 id uuid primary key default gen_random_uuid(),parent_type text not null check(parent_type in ('record','post','request','plot')),parent_id uuid not null,
 created_by uuid not null default auth.uid() references public.raben_memberships(user_id),body text not null check(length(btrim(body)) between 1 and 4000),
 mentions uuid[] not null default '{}' check(cardinality(mentions)<=10),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision bigint not null default 1
);
create index raben_comments_parent_idx on public.raben_comments(parent_type,parent_id,created_at);
create index raben_comments_author_idx on public.raben_comments(created_by);
create table public.raben_reactions (
 parent_type text not null check(parent_type in ('record','post','request','plot')),parent_id uuid not null,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id),emoji text not null check(emoji in ('raven','heart','like')),created_at timestamptz not null default now(),
 primary key(parent_type,parent_id,user_id,emoji)
);
create index raben_reactions_user_idx on public.raben_reactions(user_id);
alter table public.raben_comments enable row level security;alter table public.raben_reactions enable row level security;
revoke all on public.raben_comments,public.raben_reactions from public,anon,authenticated;
grant select,insert,delete on public.raben_comments,public.raben_reactions to authenticated;
grant update(body,mentions) on public.raben_comments to authenticated;
create policy raben_comments_read on public.raben_comments for select to authenticated using(raben_private.can_view_parent(parent_type,parent_id));
create policy raben_comments_create on public.raben_comments for insert to authenticated with check(created_by=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create policy raben_comments_edit on public.raben_comments for update to authenticated using(created_by=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id)) with check(created_by=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create policy raben_comments_delete on public.raben_comments for delete to authenticated using(raben_private.can_view_parent(parent_type,parent_id) and (created_by=(select auth.uid()) or (parent_type<>'plot' and (select raben_private.is_admin())) or (parent_type='plot' and exists(select 1 from public.raben_plots p where p.id=parent_id and p.owner_id=(select auth.uid())))));
create policy raben_reactions_read on public.raben_reactions for select to authenticated using(raben_private.can_view_parent(parent_type,parent_id));
create policy raben_reactions_create on public.raben_reactions for insert to authenticated with check(user_id=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create policy raben_reactions_delete on public.raben_reactions for delete to authenticated using(user_id=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create function raben_private.guard_comment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.created_by<>auth.uid() or not raben_private.can_view_parent(new.parent_type,new.parent_id) then raise exception 'comment_access_denied' using errcode='42501';end if;
 if tg_op='UPDATE' then new.id:=old.id;new.parent_type:=old.parent_type;new.parent_id:=old.parent_id;new.created_by:=old.created_by;new.created_at:=old.created_at;new.revision:=old.revision+1;
 else new.revision:=1;new.created_at:=now();end if;
 if exists(select 1 from unnest(new.mentions) u where not exists(select 1 from public.raben_memberships m where m.user_id=u and m.status='active')) then raise exception 'invalid_mention' using errcode='23514';end if;
 new.body:=btrim(new.body);new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_comment() from public,anon,authenticated;
create trigger raben_guard_comment before insert or update on public.raben_comments for each row execute function raben_private.guard_comment();

create table public.raben_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 scope text not null,label text not null check(length(label)<=200),parent_type text not null check(parent_type in ('record','post','request','plot')),parent_id uuid not null,
 created_at timestamptz not null default now(),read_at timestamptz
);
create index raben_notifications_user_created_idx on public.raben_notifications(user_id,created_at desc);
create index raben_notifications_parent_idx on public.raben_notifications(parent_type,parent_id);
alter table public.raben_notifications enable row level security;
revoke all on public.raben_notifications from public,anon,authenticated;
grant select,delete on public.raben_notifications to authenticated;grant update(read_at) on public.raben_notifications to authenticated;
create policy raben_notifications_read on public.raben_notifications for select to authenticated using(user_id=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create policy raben_notifications_edit on public.raben_notifications for update to authenticated using(user_id=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id)) with check(user_id=(select auth.uid()) and raben_private.can_view_parent(parent_type,parent_id));
create policy raben_notifications_delete on public.raben_notifications for delete to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid()));
-- Only private triggers use this recipient lookup, necessary for fan-out without exposing another person's permissions.
create function raben_private.recipient_can_view(p_type text,p_id uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.raben_memberships m where m.user_id=p_user and m.status='active') and case p_type
 when 'record' then exists(select 1 from public.raben_records r where r.id=p_id and (r.visibility in ('clan','public') or r.created_by=p_user or exists(select 1 from public.raben_memberships m where m.user_id=p_user and m.status='active' and m.role='admin')))
 when 'post' then exists(select 1 from public.raben_clan_posts p where p.id=p_id)
 when 'request' then exists(select 1 from public.raben_rp_requests r where r.id=p_id and ((not r.closed and r.expires_at>now()) or r.created_by=p_user))
 when 'plot' then exists(select 1 from public.raben_plots p join public.raben_memberships o on o.user_id=p.owner_id and o.status='active' where p.id=p_id and (p.owner_id=p_user or p.visibility='clan' or (p.visibility='selected' and exists(select 1 from public.raben_plot_guests g where g.plot_id=p.id and g.user_id=p_user))))
 else false end;
$$;
revoke all on function raben_private.recipient_can_view(text,uuid,uuid) from public,anon,authenticated;
