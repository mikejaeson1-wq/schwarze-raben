create table public.raben_relationships (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.raben_profile_items(id) on delete cascade,target_id uuid not null references public.raben_profile_items(id) on delete cascade,
 sender_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,recipient_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 120),status text not null default 'pending' check(status in ('pending','accepted','rejected')),created_at timestamptz not null default now(),check(source_id<>target_id),unique(source_id,target_id)
);
create index raben_relationship_target_idx on public.raben_relationships(target_id);create index raben_relationship_sender_idx on public.raben_relationships(sender_id);create index raben_relationship_recipient_idx on public.raben_relationships(recipient_id);
alter table public.raben_relationships enable row level security;
revoke all on public.raben_relationships from public,anon,authenticated;grant select,insert,delete on public.raben_relationships to authenticated;grant update(status) on public.raben_relationships to authenticated;
create policy raben_relationships_read on public.raben_relationships for select to authenticated using((select raben_private.is_member()) and (status='accepted' or sender_id=(select auth.uid()) or recipient_id=(select auth.uid())) and exists(select 1 from public.raben_profile_items where id=source_id and kind='character') and exists(select 1 from public.raben_profile_items where id=target_id and kind='character'));
create policy raben_relationships_create on public.raben_relationships for insert to authenticated with check((select raben_private.is_member()) and sender_id=(select auth.uid()) and status='pending' and exists(select 1 from public.raben_profile_items where id=source_id and owner_id=(select auth.uid()) and kind='character') and exists(select 1 from public.raben_profile_items where id=target_id and owner_id=recipient_id and kind='character'));
create policy raben_relationships_accept on public.raben_relationships for update to authenticated using(recipient_id=(select auth.uid()) and status='pending') with check(recipient_id=(select auth.uid()) and status in ('accepted','rejected'));
create policy raben_relationships_delete on public.raben_relationships for delete to authenticated using((select raben_private.is_member()) and sender_id=(select auth.uid()));
create function raben_private.guard_relationship() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() or not exists(select 1 from public.raben_profile_items where id=new.source_id and kind='character') or not exists(select 1 from public.raben_profile_items where id=new.target_id and kind='character') then raise exception 'relationship_access_denied' using errcode='42501';end if;
 if tg_op='INSERT' then
  if new.sender_id<>auth.uid() or new.recipient_id=new.sender_id or not exists(select 1 from public.raben_profile_items i where i.id=new.source_id and i.owner_id=auth.uid() and (i.visibility='clan' or (i.visibility='selected' and exists(select 1 from public.raben_profile_grants g where g.item_id=i.id and g.grantee_id=new.recipient_id)))) then raise exception 'character_not_shared' using errcode='23514';end if;
  new.status:='pending';new.created_at:=now();
 elsif new.recipient_id<>auth.uid() or old.status<>'pending' or new.status not in ('accepted','rejected') then raise exception 'relationship_access_denied' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function raben_private.guard_relationship() from public,anon,authenticated;
create trigger raben_guard_relationship before insert or update on public.raben_relationships for each row execute function raben_private.guard_relationship();

-- Personal exports and deletion are self-only, and never touch shared auth users or clan approval.
create function public.raben_export_profile() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 return jsonb_build_object('application','schwarze-raben-profile','exportedAt',now(),'profile',(select to_jsonb(p) from public.raben_profiles p where user_id=auth.uid()),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.raben_profile_items i where owner_id=auth.uid()),'[]'),'grants',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_grants g where owner_id=auth.uid()),'[]'),'gallery',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_gallery g where owner_id=auth.uid()),'[]'),'relationships',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_relationships r where sender_id=auth.uid() or recipient_id=auth.uid()),'[]'));
end;$$;
revoke all on function public.raben_export_profile() from public,anon;grant execute on function public.raben_export_profile() to authenticated;

