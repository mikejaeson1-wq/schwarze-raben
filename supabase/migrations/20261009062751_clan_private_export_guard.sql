-- Personal discussions and designs never enter the clan administration backup.
create or replace function public.raben_export_content() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select jsonb_build_object('application','schwarze-raben','schemaVersion',1,'exportedAt',now(),
 'siteContent',(select to_jsonb(s) from public.raben_site_content s where id=1),
 'records',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_records r),'[]'::jsonb),
 'posts',coalesce((select jsonb_agg(to_jsonb(p)) from public.raben_clan_posts p),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)) from public.raben_character_notes n),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from public.raben_memberships m),'[]'::jsonb),
 'responses',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_event_responses r),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(to_jsonb(c)) from public.raben_task_claims c),'[]'::jsonb),
 'votes',coalesce((select jsonb_agg(to_jsonb(v)) from public.raben_poll_votes v),'[]'::jsonb),
 'applications',coalesce((select jsonb_agg(to_jsonb(a)) from public.raben_applications a),'[]'::jsonb),
 'versions',coalesce((select jsonb_agg(to_jsonb(v)) from public.raben_content_versions v),'[]'::jsonb),
 'files',public.raben_storage_inventory(),
 'branding',(select to_jsonb(b) from public.raben_branding b where id=1),
 'expansion',jsonb_build_object('version',2,'calendar',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_event_slots s),'[]'),'comments',coalesce((select jsonb_agg(to_jsonb(c)) from public.raben_comments c where parent_type in ('record','post','request')),'[]'),'reactions',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_reactions r where parent_type in ('record','post','request')),'[]'),'requests',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_rp_requests r),'[]'),'stockItems',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_stock_items s),'[]'),'stockMovements',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_stock_movements s),'[]'),'materials',coalesce((select jsonb_agg(to_jsonb(m)) from public.raben_project_materials m),'[]'),'ranks',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_ranks r),'[]'),'memberRanks',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_member_ranks r),'[]'),'permissions',coalesce((select jsonb_agg(to_jsonb(p)) from public.raben_permissions p),'[]'))) into result;
 return result;
end; $$;
revoke all on function public.raben_export_content() from public,anon;
grant execute on function public.raben_export_content() to authenticated;
create or replace function public.raben_export_profile() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 return jsonb_build_object('application','schwarze-raben-profile','exportedAt',now(),'profile',(select to_jsonb(p) from public.raben_profiles p where user_id=auth.uid()),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.raben_profile_items i where owner_id=auth.uid()),'[]'),'grants',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_grants g where owner_id=auth.uid()),'[]'),'gallery',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_gallery g where owner_id=auth.uid()),'[]'),'styles',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_profile_styles s where owner_id=auth.uid()),'[]'),'relationships',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_relationships r where sender_id=auth.uid() or recipient_id=auth.uid()),'[]'));
end;$$;
revoke all on function public.raben_export_profile() from public,anon;grant execute on function public.raben_export_profile() to authenticated;
notify pgrst,'reload schema';
