-- Reuse clan discussions. Every personal target is looked up through its own RLS.
alter table public.raben_comments drop constraint raben_comments_parent_type_check;
alter table public.raben_comments add constraint raben_comments_parent_type_check check(parent_type in ('record','post','request','plot','profile','portrait','profile_image'));
alter table public.raben_reactions drop constraint raben_reactions_parent_type_check;
alter table public.raben_reactions add constraint raben_reactions_parent_type_check check(parent_type in ('record','post','request','plot','profile','portrait','profile_image'));
create or replace function raben_private.can_view_parent(p_type text,p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select (select raben_private.is_member()) and case p_type
 when 'record' then exists(select 1 from public.raben_records where id=p_id)
 when 'post' then exists(select 1 from public.raben_clan_posts where id=p_id)
 when 'request' then exists(select 1 from public.raben_rp_requests where id=p_id)
 when 'plot' then exists(select 1 from public.raben_plots where id=p_id)
 when 'profile' then exists(select 1 from public.raben_profile_items where id=p_id)
 when 'portrait' then exists(select 1 from public.raben_profile_items where id=p_id and image_path is not null)
 when 'profile_image' then exists(select 1 from public.raben_profile_gallery where id=p_id)
 else false end;
$$;
alter policy raben_comments_delete on public.raben_comments using(raben_private.can_view_parent(parent_type,parent_id) and (created_by=(select auth.uid())
 or (parent_type in ('record','post','request') and (select raben_private.is_admin()))
 or (parent_type='plot' and exists(select 1 from public.raben_plots p where p.id=parent_id and p.owner_id=(select auth.uid())))
 or (parent_type in ('profile','portrait') and exists(select 1 from public.raben_profile_items p where p.id=parent_id and p.owner_id=(select auth.uid())))
 or (parent_type='profile_image' and exists(select 1 from public.raben_profile_gallery g where g.id=parent_id and g.owner_id=(select auth.uid())))));
create function raben_private.cleanup_profile_discussion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='raben_profile_gallery' then
  delete from public.raben_comments where parent_type='profile_image' and parent_id=old.id;
  delete from public.raben_reactions where parent_type='profile_image' and parent_id=old.id;
 else
  delete from public.raben_comments where parent_type in ('profile','portrait') and parent_id=old.id;
  delete from public.raben_reactions where parent_type in ('profile','portrait') and parent_id=old.id;
 end if;return null;
end;$$;
revoke all on function raben_private.cleanup_profile_discussion() from public,anon,authenticated;
create trigger raben_cleanup_profile_comments after delete on public.raben_profile_items for each row execute function raben_private.cleanup_profile_discussion();
create trigger raben_cleanup_gallery_comments after delete on public.raben_profile_gallery for each row execute function raben_private.cleanup_profile_discussion();
