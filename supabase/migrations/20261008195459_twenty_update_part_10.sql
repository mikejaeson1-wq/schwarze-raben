-- Delegated content and calendar editors remain members. Only actual admins can publish, manage permissions, or enter the admin app.
alter policy raben_records_clan_read on public.raben_records using((select raben_private.is_member()) and (visibility='clan' or created_by=(select auth.uid()) or (select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar')))));
alter policy raben_records_create on public.raben_records with check((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and visibility in ('draft','clan','review','archived') and ((select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar'))) or kind in ('character','task','journal','trade','knowledge','media')))));
alter policy raben_records_edit on public.raben_records using((select raben_private.is_member()) and ((select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar'))) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge','media')))) with check((select raben_private.is_member()) and ((select raben_private.is_admin()) or (visibility in ('draft','clan','review','archived') and ((select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar'))) or created_by=(select auth.uid())))));
alter policy raben_records_remove on public.raben_records using((select raben_private.is_member()) and ((select raben_private.has_permission('content')) or (kind='event' and (select raben_private.has_permission('calendar'))) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge','media'))));
create or replace function raben_private.can_read_hub_media(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and (raben_private.has_permission('content') or split_part(p_name,'/',1)=auth.uid()::text or exists(select 1 from public.raben_records r where (r.details->>'imagePath'=p_name or r.details->>'audioPath'=p_name or r.details->>'thumbPath'=p_name) and (r.visibility in ('clan','public') or (r.kind='event' and raben_private.has_permission('calendar')))));
$$;
alter table public.raben_clan_posts add column audience text not null default 'ooc' check(audience in ('ic','ooc','mixed')),add column speaker_id uuid,add column speaker_name text;
grant update(audience,speaker_id,speaker_name) on public.raben_clan_posts to authenticated;
create function raben_private.guard_post_speaker() returns trigger language plpgsql security invoker set search_path='' as $$
declare speaker text;
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if new.speaker_id is not null and (tg_op='INSERT' or new.speaker_id is distinct from old.speaker_id) then
  select title into speaker from public.raben_profile_items where id=new.speaker_id and owner_id=auth.uid() and kind='character';
  if speaker is null then select title into speaker from public.raben_records where id=new.speaker_id and created_by=auth.uid() and kind='character';end if;
  if speaker is null then raise exception 'invalid_speaker' using errcode='23514';end if;new.speaker_name:=speaker;
 elsif new.speaker_id is null then new.speaker_name:=null;elsif tg_op='UPDATE' then new.speaker_name:=old.speaker_name;end if;
 return new;
end;$$;
revoke all on function raben_private.guard_post_speaker() from public,anon,authenticated;
create trigger raben_guard_post_speaker before insert or update on public.raben_clan_posts for each row execute function raben_private.guard_post_speaker();
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
 'expansion',jsonb_build_object('version',2,'calendar',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_event_slots s),'[]'),'comments',coalesce((select jsonb_agg(to_jsonb(c)) from public.raben_comments c where parent_type<>'plot'),'[]'),'reactions',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_reactions r where parent_type<>'plot'),'[]'),'requests',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_rp_requests r),'[]'),'stockItems',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_stock_items s),'[]'),'stockMovements',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_stock_movements s),'[]'),'materials',coalesce((select jsonb_agg(to_jsonb(m)) from public.raben_project_materials m),'[]'),'ranks',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_ranks r),'[]'),'memberRanks',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_member_ranks r),'[]'),'permissions',coalesce((select jsonb_agg(to_jsonb(p)) from public.raben_permissions p),'[]'))) into result;
 return result;
end; $$;
revoke all on function public.raben_export_content() from public,anon;
grant execute on function public.raben_export_content() to authenticated;

-- Invoker search: each source keeps its own RLS, so private text never enters a result for an unauthorized viewer.
create function public.raben_search(p_query text,p_scope text default 'all',p_offset integer default 0)
returns table(type text,id uuid,owner_id uuid,title text,snippet text) language plpgsql stable security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if length(btrim(coalesce(p_query,''))) not between 1 and 100 or p_offset not between 0 and 10000 or p_scope not in ('all','record','profile','character','plot','request') then raise exception 'invalid_search' using errcode='23514';end if;
 return query select s.type,s.id,s.owner_id,s.title,s.snippet from (
 select 'record'::text type,r.id,r.created_by owner_id,r.title,left(r.body,250) snippet from public.raben_records r where p_scope in ('all','record') and (r.search @@ websearch_to_tsquery('german',p_query) or strpos(lower(r.title),lower(p_query))>0)
 union all select 'profile',p.user_id,p.user_id,p.display_name,'' from public.raben_profiles p where p_scope in ('all','profile') and strpos(lower(p.display_name),lower(p_query))>0
 union all select 'character',i.id,i.owner_id,i.title,left(i.body,250) from public.raben_profile_items i where i.kind='character' and p_scope in ('all','character') and strpos(lower(i.title||' '||i.body||' '||i.details::text),lower(p_query))>0
 union all select 'plot',p.id,p.owner_id,p.title,left(p.body,250) from public.raben_plots p where p_scope in ('all','plot') and strpos(lower(p.title||' '||p.body),lower(p_query))>0
 union all select 'request',r.id,r.created_by,r.title,left(r.body,250) from public.raben_rp_requests r where p_scope in ('all','request') and strpos(lower(r.title||' '||r.body),lower(p_query))>0
 ) s order by s.title,s.id limit 25 offset p_offset;
end;$$;
revoke all on function public.raben_search(text,text,integer) from public,anon;grant execute on function public.raben_search(text,text,integer) to authenticated;

-- Restoring stock records an adjustment instead of replacing the ledger or its authors.
create function public.raben_restore_stock(p_row jsonb,p_expected bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.raben_stock_items;delta numeric;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 if jsonb_typeof(p_row) is distinct from 'object' or jsonb_typeof(p_row->'quantity') is distinct from 'number' or (p_row->>'quantity') in ('NaN','Infinity','-Infinity') or length(btrim(coalesce(p_row->>'name',''))) not between 1 and 120 or length(coalesce(p_row->>'unit','')) not between 1 and 30 or (p_row->>'quantity')::numeric<0 then raise exception 'invalid_stock_backup' using errcode='23514';end if;
 select * into item from public.raben_stock_items where id=(p_row->>'id')::uuid for update;
 if not found then
  if p_expected is not null then raise exception 'stock_conflict' using errcode='40001';end if;
  insert into public.raben_stock_items(id,name,unit,created_by) values((p_row->>'id')::uuid,p_row->>'name',p_row->>'unit',auth.uid()) returning * into item;
 elsif item.revision is distinct from p_expected or item.name<>p_row->>'name' or item.unit<>p_row->>'unit' then raise exception 'stock_conflict' using errcode='40001';end if;
 delta:=(p_row->>'quantity')::numeric-item.quantity;
 if delta<>0 then
  insert into public.raben_stock_movements(item_id,delta,reason,created_by) values(item.id,delta,'Geprüfte Wiederherstellung aus einer Sicherung',auth.uid());
  update public.raben_stock_items set quantity=quantity+delta,revision=revision+1 where id=item.id returning * into item;
 end if;return to_jsonb(item);
end;$$;
revoke all on function public.raben_restore_stock(jsonb,bigint) from public,anon;grant execute on function public.raben_restore_stock(jsonb,bigint) to authenticated;

