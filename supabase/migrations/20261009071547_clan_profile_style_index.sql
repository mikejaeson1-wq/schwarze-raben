-- Cover the character/owner foreign key used by private theme policies.
create index raben_profile_styles_parent_idx on public.raben_profile_styles(item_id,owner_id);
