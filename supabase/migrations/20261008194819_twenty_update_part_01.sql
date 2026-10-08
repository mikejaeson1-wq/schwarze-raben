-- Twenty-step expansion. Only Schwarze Raben objects are changed.
-- Private profiles, selected plots and relations have no administrator override.
create table public.raben_permissions (
 user_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 permission text not null check(permission in ('calendar','content')),
 primary key(user_id,permission)
);
create table public.raben_ranks (
 id uuid primary key default gen_random_uuid(),label text not null check(length(btrim(label)) between 1 and 60),
 description text not null default '' check(length(description)<=1000),sort_order integer not null default 0
);
create table public.raben_member_ranks (
 user_id uuid primary key references public.raben_memberships(user_id) on delete cascade,
 rank_id uuid not null references public.raben_ranks(id) on delete cascade
);
create index raben_member_ranks_rank_idx on public.raben_member_ranks(rank_id);
create table public.raben_preferences (
 user_id uuid primary key default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 subscriptions text[] not null default array['posts','event','reply','mention'],
 discord_reminders boolean not null default false,
 reminder_minutes integer not null default 60 check(reminder_minutes in (15,30,60,1440)),
 updated_at timestamptz not null default now(),
 check(cardinality(subscriptions)<=20 and subscriptions <@ array['posts','event','reply','mention','gallery','chronicle','character','task','project','knowledge','poll','journal','trade','media','requests','plots'])
);
alter table public.raben_permissions enable row level security;
alter table public.raben_ranks enable row level security;
alter table public.raben_member_ranks enable row level security;
alter table public.raben_preferences enable row level security;
revoke all on public.raben_permissions,public.raben_ranks,public.raben_member_ranks,public.raben_preferences from public,anon,authenticated;
grant select,insert,delete on public.raben_permissions,public.raben_ranks,public.raben_member_ranks,public.raben_preferences to authenticated;
grant update(label,description,sort_order) on public.raben_ranks to authenticated;
grant update(rank_id) on public.raben_member_ranks to authenticated;
grant update(subscriptions,discord_reminders,reminder_minutes) on public.raben_preferences to authenticated;
create policy raben_permissions_read on public.raben_permissions for select to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy raben_permissions_create on public.raben_permissions for insert to authenticated with check((select raben_private.is_admin()));
create policy raben_permissions_delete on public.raben_permissions for delete to authenticated using((select raben_private.is_admin()));
create policy raben_ranks_read on public.raben_ranks for select to authenticated using((select raben_private.is_member()));
create policy raben_ranks_write on public.raben_ranks for all to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create policy raben_member_ranks_read on public.raben_member_ranks for select to authenticated using((select raben_private.is_member()));
create policy raben_member_ranks_write on public.raben_member_ranks for all to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create policy raben_preferences_own on public.raben_preferences for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
-- Lookup is private and checks the authenticated identity, never user metadata.
create function raben_private.has_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and (raben_private.is_admin() or exists(select 1 from public.raben_permissions p where p.user_id=auth.uid() and p.permission=p_permission));
$$;
revoke all on function raben_private.has_permission(text) from public,anon;
grant execute on function raben_private.has_permission(text) to authenticated;
create function public.raben_my_capabilities() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 return jsonb_build_object('calendar',raben_private.has_permission('calendar'),'content',raben_private.has_permission('content'));
end;$$;
revoke all on function public.raben_my_capabilities() from public,anon;
grant execute on function public.raben_my_capabilities() to authenticated;

