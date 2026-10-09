-- All typography remains personal, including for website administrators.
alter table public.raben_preferences drop constraint raben_preferences_font_family_check;
alter table public.raben_preferences add constraint raben_preferences_font_family_check check(font_family in ('default','system','serif','arial','verdana','monospace','fraktur','medieval','palatino','trebuchet','tahoma','times'));
create function raben_private.valid_reading_style(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and octet_length(p::text)<=2000
 and not exists(select 1 from jsonb_object_keys(p) k where k not in ('heading_font','heading_size','heading_color','heading_effect','heading_from','heading_to','text_effect','text_from','text_to'))
 and not exists(select 1 from jsonb_each(p) e where (e.key<>'heading_size' and jsonb_typeof(e.value)<>'string') or (e.key='heading_size' and (jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 18 and 48 or (e.value#>>'{}')::numeric<>trunc((e.value#>>'{}')::numeric))))
 and coalesce(p->>'heading_font','default') in ('default','system','serif','arial','verdana','monospace','fraktur','medieval','palatino','trebuchet','tahoma','times')
 and coalesce(p->>'heading_effect','none') in ('none','gradient','shadow','glow') and coalesce(p->>'text_effect','none') in ('none','gradient','shadow','glow')
 and not exists(select 1 from jsonb_each_text(p) e where e.key in ('heading_color','heading_from','heading_to','text_from','text_to') and e.value !~ '^#[0-9a-fA-F]{6}$'),false);
$$;
revoke all on function raben_private.valid_reading_style(jsonb) from public,anon;
grant execute on function raben_private.valid_reading_style(jsonb) to authenticated;
alter table public.raben_preferences add column reading_style jsonb not null default '{}' check(raben_private.valid_reading_style(reading_style));
grant update(reading_style) on public.raben_preferences to authenticated;
create function public.raben_save_reading_preferences(p_subscriptions text[],p_font_family text,p_font_color text,p_font_size integer,p_style jsonb) returns public.raben_preferences language plpgsql security invoker set search_path='' as $$
declare result public.raben_preferences;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 insert into public.raben_preferences(user_id,subscriptions,font_family,font_color,font_size,reading_style) values(auth.uid(),p_subscriptions,p_font_family,p_font_color,p_font_size,p_style)
 on conflict(user_id) do update set subscriptions=excluded.subscriptions,font_family=excluded.font_family,font_color=excluded.font_color,font_size=excluded.font_size,reading_style=excluded.reading_style returning * into result;
 return result;
end;$$;
revoke all on function public.raben_save_reading_preferences(text[],text,text,integer,jsonb) from public,anon;
grant execute on function public.raben_save_reading_preferences(text[],text,text,integer,jsonb) to authenticated;
