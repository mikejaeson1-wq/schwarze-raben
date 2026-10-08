-- Stock is an append-only ledger. Only its narrow RPC may change computed balances.
create table public.raben_stock_items(id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 1 and 120),unit text not null default 'Stück' check(length(unit) between 1 and 30),quantity numeric(14,3) not null default 0 check(quantity>=0 and quantity::text not in ('NaN','Infinity','-Infinity')),revision bigint not null default 1,created_by uuid not null default auth.uid() references public.raben_memberships(user_id),unique(name,unit));
create index raben_stock_owner_idx on public.raben_stock_items(created_by);
create table public.raben_stock_movements(id uuid primary key default gen_random_uuid(),item_id uuid not null references public.raben_stock_items(id),delta numeric(14,3) not null check(delta<>0 and delta::text not in ('NaN','Infinity','-Infinity')),reason text not null check(length(btrim(reason)) between 1 and 500),project_id uuid references public.raben_records(id) on delete set null,created_by uuid not null default auth.uid() references public.raben_memberships(user_id),created_at timestamptz not null default now());
create index raben_stock_movement_item_idx on public.raben_stock_movements(item_id,created_at desc);create index raben_stock_movement_author_idx on public.raben_stock_movements(created_by);create index raben_stock_movement_project_idx on public.raben_stock_movements(project_id);
create table public.raben_project_materials(project_id uuid not null references public.raben_records(id) on delete cascade,item_id uuid not null references public.raben_stock_items(id),required numeric(14,3) not null check(required>0 and required::text not in ('NaN','Infinity','-Infinity')),primary key(project_id,item_id));
create index raben_material_item_idx on public.raben_project_materials(item_id);
alter table public.raben_stock_items enable row level security;alter table public.raben_stock_movements enable row level security;alter table public.raben_project_materials enable row level security;
revoke all on public.raben_stock_items,public.raben_stock_movements,public.raben_project_materials from public,anon,authenticated;
grant select on public.raben_stock_items,public.raben_stock_movements,public.raben_project_materials to authenticated;
grant insert(name,unit,created_by) on public.raben_stock_items to authenticated;grant insert,delete on public.raben_project_materials to authenticated;grant update(required) on public.raben_project_materials to authenticated;
create policy raben_stock_read on public.raben_stock_items for select to authenticated using((select raben_private.is_member()));
create policy raben_stock_create on public.raben_stock_items for insert to authenticated with check((select raben_private.is_member()) and created_by=(select auth.uid()) and quantity=0 and revision=1);
create policy raben_movements_read on public.raben_stock_movements for select to authenticated using((select raben_private.is_member()) and (project_id is null or raben_private.record_visible(project_id,'project')));
create policy raben_material_read on public.raben_project_materials for select to authenticated using(raben_private.record_visible(project_id,'project'));
create policy raben_material_create on public.raben_project_materials for insert to authenticated with check((select raben_private.has_permission('content')) and raben_private.record_visible(project_id,'project'));
create policy raben_material_edit on public.raben_project_materials for update to authenticated using((select raben_private.has_permission('content')) and raben_private.record_visible(project_id,'project')) with check((select raben_private.has_permission('content')) and raben_private.record_visible(project_id,'project'));
create policy raben_material_delete on public.raben_project_materials for delete to authenticated using((select raben_private.has_permission('content')) and raben_private.record_visible(project_id,'project'));
-- Definer is limited to a locked stock row, verified active author, visible project, and expected revision; no table writes granted to clients.
create function public.raben_move_stock(p_item uuid,p_delta numeric,p_reason text,p_project uuid,p_expected bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.raben_stock_items;result public.raben_stock_movements;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if p_project is not null and not exists(select 1 from public.raben_records where id=p_project and kind='project' and visibility in ('clan','public')) then raise exception 'project_missing' using errcode='23514';end if;
 select * into row from public.raben_stock_items where id=p_item for update;
 if not found or row.revision is distinct from p_expected then raise exception 'stock_conflict' using errcode='40001';end if;
 if p_delta is null or p_delta::text in ('NaN','Infinity','-Infinity') or p_delta=0 or row.quantity+p_delta<0 or length(btrim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'invalid_stock_move' using errcode='23514';end if;
 insert into public.raben_stock_movements(item_id,delta,reason,project_id,created_by) values(p_item,p_delta,p_reason,p_project,auth.uid()) returning * into result;
 update public.raben_stock_items set quantity=quantity+p_delta,revision=revision+1 where id=p_item;return to_jsonb(result);
end;$$;
revoke all on function public.raben_move_stock(uuid,numeric,text,uuid,bigint) from public,anon;grant execute on function public.raben_move_stock(uuid,numeric,text,uuid,bigint) to authenticated;
create table public.raben_backup_runs(user_id uuid primary key references public.raben_memberships(user_id) on delete cascade,completed_at timestamptz not null default now(),file_count integer not null check(file_count>=0));
alter table public.raben_backup_runs enable row level security;revoke all on public.raben_backup_runs from public,anon,authenticated;grant select,insert on public.raben_backup_runs to authenticated;grant update(completed_at,file_count) on public.raben_backup_runs to authenticated;
create policy raben_backup_runs_read on public.raben_backup_runs for select to authenticated using((select raben_private.is_admin()));
create policy raben_backup_runs_write on public.raben_backup_runs for all to authenticated using((select raben_private.is_admin()) and user_id=(select auth.uid())) with check((select raben_private.is_admin()) and user_id=(select auth.uid()));

