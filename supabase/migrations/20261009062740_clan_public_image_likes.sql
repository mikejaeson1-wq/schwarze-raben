-- Anonymous visitors can like published images, never private images or comments.
grant usage on schema raben_private to anon;
create table raben_private.public_image_likes(record_id uuid not null references public.raben_records(id) on delete cascade,visitor_digest text not null,created_at timestamptz not null default now(),primary key(record_id,visitor_digest));
create index raben_public_likes_visitor_idx on raben_private.public_image_likes(visitor_digest,created_at);
alter table raben_private.public_image_likes enable row level security;
revoke all on raben_private.public_image_likes from public,anon,authenticated;
create function raben_private.public_image_status(p_record uuid,p_visitor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare visitor text:=md5(p_visitor::text||':raben-public-image');
begin
 if not exists(select 1 from public.raben_records where id=p_record and visibility='public' and details ? 'publicImage') then raise exception 'public_image_required' using errcode='42501';end if;
 return jsonb_build_object('count',(select count(*) from raben_private.public_image_likes where record_id=p_record)+(select count(*) from public.raben_reactions where parent_type='record' and parent_id=p_record and emoji='like'),'liked',exists(select 1 from raben_private.public_image_likes where record_id=p_record and visitor_digest=visitor));
end;$$;
create function raben_private.public_image_like(p_record uuid,p_visitor uuid,p_liked boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare visitor text:=md5(p_visitor::text||':raben-public-image');
begin
 if p_visitor is null or p_liked is null then raise exception 'invalid_like' using errcode='23514';end if;
 perform raben_private.public_image_status(p_record,p_visitor);
 if p_liked then
  if (select count(*) from raben_private.public_image_likes where visitor_digest=visitor and created_at>now()-interval '1 day')>=100 and not exists(select 1 from raben_private.public_image_likes where record_id=p_record and visitor_digest=visitor) then raise exception 'like_rate_limit' using errcode='23514';end if;
  insert into raben_private.public_image_likes(record_id,visitor_digest) values(p_record,visitor) on conflict do nothing;
 else delete from raben_private.public_image_likes where record_id=p_record and visitor_digest=visitor;end if;
 return raben_private.public_image_status(p_record,p_visitor);
end;$$;
revoke all on function raben_private.public_image_status(uuid,uuid),raben_private.public_image_like(uuid,uuid,boolean) from public;
grant execute on function raben_private.public_image_status(uuid,uuid),raben_private.public_image_like(uuid,uuid,boolean) to anon,authenticated;
create function public.raben_public_image_status(p_record uuid,p_visitor uuid) returns jsonb language sql stable security invoker set search_path='' as $$select raben_private.public_image_status(p_record,p_visitor)$$;
create function public.raben_public_image_like(p_record uuid,p_visitor uuid,p_liked boolean) returns jsonb language sql security invoker set search_path='' as $$select raben_private.public_image_like(p_record,p_visitor,p_liked)$$;
revoke all on function public.raben_public_image_status(uuid,uuid),public.raben_public_image_like(uuid,uuid,boolean) from public;
grant execute on function public.raben_public_image_status(uuid,uuid),public.raben_public_image_like(uuid,uuid,boolean) to anon,authenticated;
