-- File names remain metadata. Display titles are explicitly chosen by the owner.
alter table public.raben_profile_gallery add column display_title text not null default '' check(length(display_title)<=120);
grant update(display_title,caption,sort_order) on public.raben_profile_gallery to authenticated;
create policy profile_gallery_edit on public.raben_profile_gallery for update to authenticated using((select raben_private.is_member()) and owner_id=(select auth.uid())) with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
-- Keep existing gallery IDs when saving a character so reactions remain attached.
create or replace function public.raben_save_profile_entry(p_id uuid,p_kind text,p_title text,p_body text,p_image_path text,p_visibility text,p_recipients uuid[],p_expected bigint,p_details jsonb,p_preview text,p_gallery jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;row public.raben_profile_items;entry jsonb;existing uuid;
begin
 if jsonb_typeof(p_gallery) is distinct from 'array' or jsonb_array_length(p_gallery)>12 then raise exception 'invalid_gallery' using errcode='23514';end if;
 if (select count(distinct value->>'image_path') from jsonb_array_elements(p_gallery))<>jsonb_array_length(p_gallery) then raise exception 'invalid_gallery' using errcode='23514';end if;
 result:=public.raben_save_profile_item(p_id,p_kind,p_title,p_body,p_image_path,p_visibility,p_recipients,p_expected);
 update public.raben_profile_items set details=coalesce(p_details,'{}'),preview_path=p_preview where id=(result->>'id')::uuid returning * into row;
 delete from public.raben_profile_gallery g where item_id=row.id and owner_id=auth.uid() and not exists(select 1 from jsonb_array_elements(p_gallery) e where e->>'image_path'=g.image_path);
 for entry in select value from jsonb_array_elements(p_gallery) loop
  select id into existing from public.raben_profile_gallery where item_id=row.id and image_path=entry->>'image_path' order by sort_order limit 1;
  if existing is not null then
   update public.raben_profile_gallery set sort_order=coalesce((entry->>'sort_order')::integer,0),display_title=coalesce(entry->>'display_title',display_title) where id=existing;
  else
   insert into public.raben_profile_gallery(item_id,image_path,preview_path,caption,display_title,sort_order) values(row.id,entry->>'image_path',entry->>'preview_path',coalesce(entry->>'caption',''),coalesce(entry->>'display_title',''),coalesce((entry->>'sort_order')::integer,0));
  end if;
 end loop;select * into row from public.raben_profile_items where id=row.id;return to_jsonb(row);
end;$$;
create function public.raben_save_designed_profile_entry(p_id uuid,p_kind text,p_title text,p_body text,p_image_path text,p_visibility text,p_recipients uuid[],p_expected bigint,p_details jsonb,p_preview text,p_gallery jsonb,p_design jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=public.raben_save_profile_entry(p_id,p_kind,p_title,p_body,p_image_path,p_visibility,p_recipients,p_expected,p_details,p_preview,p_gallery);
 if p_kind<>'character' or jsonb_typeof(p_design) is distinct from 'object' then raise exception 'invalid_profile_design' using errcode='23514';end if;
 perform public.raben_save_profile_style((result->>'id')::uuid,coalesce(p_design->>'theme','standard'),coalesce(p_design->'style','{}'),nullif(p_design->>'background_path',''),nullif(p_design->>'preview_path',''));
 return result;
end;$$;
revoke all on function public.raben_save_designed_profile_entry(uuid,text,text,text,text,text,uuid[],bigint,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.raben_save_designed_profile_entry(uuid,text,text,text,text,text,uuid[],bigint,jsonb,text,jsonb,jsonb) to authenticated;
create function raben_private.touch_gallery_parent() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and raben_private.is_member() then update public.raben_profile_items set body=body where id=coalesce(new.item_id,old.item_id) and owner_id=auth.uid();end if;return null;
end;$$;
revoke all on function raben_private.touch_gallery_parent() from public,anon,authenticated;
create trigger raben_gallery_changed after insert or update or delete on public.raben_profile_gallery for each row execute function raben_private.touch_gallery_parent();
