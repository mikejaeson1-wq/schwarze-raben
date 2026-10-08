-- Cover the complete composite FK for item deletion and owner cascades.
create index raben_profile_grants_item_owner_idx on public.raben_profile_grants(item_id,owner_id);
