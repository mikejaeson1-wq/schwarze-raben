-- Additive: existing banners keep their previous appearance and ownership rules.
alter table public.raben_profiles add column banner_opacity integer not null default 100
  check (banner_opacity between 0 and 100);
grant update(banner_opacity) on public.raben_profiles to authenticated;

create function public.raben_save_profile_banner_design(p_path text,p_opacity integer,p_expected bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.raben_profiles;
begin
  if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
  if p_opacity is null or p_opacity not between 0 and 100 then raise exception 'invalid_banner_opacity' using errcode='23514';end if;
  update public.raben_profiles set banner_path=p_path,banner_opacity=p_opacity
  where user_id=auth.uid() and revision=p_expected returning * into result;
  if not found then raise exception 'profile_conflict' using errcode='40001';end if;
  return to_jsonb(result);
end;$$;
revoke all on function public.raben_save_profile_banner_design(text,integer,bigint) from public,anon;
grant execute on function public.raben_save_profile_banner_design(text,integer,bigint) to authenticated;
