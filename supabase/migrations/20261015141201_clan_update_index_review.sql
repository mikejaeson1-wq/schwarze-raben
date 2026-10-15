-- Keep new queue lookups indexed and each recipe action governed by one policy.
create index discord_planned_by_idx on raben_private.discord_outbox(planned_by);
create index discord_route_planned_by_idx on raben_private.discord_route_outbox(planned_by);
create index discord_plan_actor_idx on raben_private.discord_plan_history(actor_id);
create index discord_plan_message_idx on raben_private.discord_plan_history(message_id,route_id,revision desc);
create policy no_client_history_access on raben_private.discord_plan_history for all to authenticated using(false) with check(false);
drop policy variants_write on public.raben_recipe_variants;
create policy variants_insert on public.raben_recipe_variants for insert to authenticated with check((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content')))));
create policy variants_update on public.raben_recipe_variants for update to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content'))))) with check((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content')))));
create policy variants_delete on public.raben_recipe_variants for delete to authenticated using((select raben_private.is_member()) and exists(select 1 from public.raben_recipes r where r.id=recipe_id and (r.owner_id=(select auth.uid()) or (select raben_private.has_permission('content')))));
