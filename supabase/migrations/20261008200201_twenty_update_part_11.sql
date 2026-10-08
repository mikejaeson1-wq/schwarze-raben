-- Narrow public invoker wrappers keep elevated ledger writes out of the exposed API schema.
alter function public.raben_move_stock(uuid,numeric,text,uuid,bigint) set schema raben_private;
alter function public.raben_restore_stock(jsonb,bigint) set schema raben_private;
revoke all on function raben_private.raben_move_stock(uuid,numeric,text,uuid,bigint),raben_private.raben_restore_stock(jsonb,bigint) from public,anon;
grant execute on function raben_private.raben_move_stock(uuid,numeric,text,uuid,bigint),raben_private.raben_restore_stock(jsonb,bigint) to authenticated;
create function public.raben_move_stock(p_item uuid,p_delta numeric,p_reason text,p_project uuid,p_expected bigint) returns jsonb language sql security invoker set search_path='' as $$select raben_private.raben_move_stock(p_item,p_delta,p_reason,p_project,p_expected);$$;
create function public.raben_restore_stock(p_row jsonb,p_expected bigint) returns jsonb language sql security invoker set search_path='' as $$select raben_private.raben_restore_stock(p_row,p_expected);$$;
revoke all on function public.raben_move_stock(uuid,numeric,text,uuid,bigint),public.raben_restore_stock(jsonb,bigint) from public,anon;
grant execute on function public.raben_move_stock(uuid,numeric,text,uuid,bigint),public.raben_restore_stock(jsonb,bigint) to authenticated;
create index raben_profile_gallery_parent_owner_idx on public.raben_profile_gallery(item_id,owner_id);
-- Command-specific write policies avoid duplicate permissive SELECT policies.
drop policy raben_ranks_write on public.raben_ranks;
create policy raben_ranks_create on public.raben_ranks for insert to authenticated with check((select raben_private.is_admin()));
create policy raben_ranks_edit on public.raben_ranks for update to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create policy raben_ranks_remove on public.raben_ranks for delete to authenticated using((select raben_private.is_admin()));
drop policy raben_member_ranks_write on public.raben_member_ranks;
create policy raben_member_ranks_create on public.raben_member_ranks for insert to authenticated with check((select raben_private.is_admin()));
create policy raben_member_ranks_edit on public.raben_member_ranks for update to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create policy raben_member_ranks_remove on public.raben_member_ranks for delete to authenticated using((select raben_private.is_admin()));
drop policy raben_backup_runs_write on public.raben_backup_runs;
create policy raben_backup_runs_create on public.raben_backup_runs for insert to authenticated with check((select raben_private.is_admin()) and user_id=(select auth.uid()));
create policy raben_backup_runs_edit on public.raben_backup_runs for update to authenticated using((select raben_private.is_admin()) and user_id=(select auth.uid())) with check((select raben_private.is_admin()) and user_id=(select auth.uid()));
alter policy raben_records_public_read on public.raben_records to anon;
alter policy raben_records_clan_read on public.raben_records using(visibility='public' or ((select raben_private.is_member()) and (visibility='clan' or created_by=(select auth.uid()) or (select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar'))))));
