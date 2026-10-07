-- Schwarze Raben: Medien, RP-Verknüpfungen, Inhaltsversionen und Sicherungen.
-- Ausschließlich eigene raben_-Objekte und die beiden Clan-Buckets.
alter table public.raben_records drop constraint raben_records_kind_check;
alter table public.raben_records add constraint raben_records_kind_check check(kind in ('gallery','place','chronicle','trade','event','character','task','project','knowledge','poll','journal','media'));
alter table public.raben_records drop constraint raben_records_check;
alter table public.raben_records add constraint raben_records_check check(visibility<>'public' or kind in ('gallery','place','chronicle','trade','event','character','media'));
create index raben_records_audio_idx on public.raben_records((details->>'audioPath')) where details ? 'audioPath';
create index raben_records_media_links_idx on public.raben_records using gin((details->'mediaIds'));
create index raben_records_related_links_idx on public.raben_records using gin((details->'relatedIds'));
create index raben_records_story_idx on public.raben_records((details->>'story')) where details ? 'story';
create or replace function raben_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare admin boolean:=raben_private.is_admin(); allowed text[]; date_key text; option_value jsonb; ref_value text; ref_row public.raben_records; extra_key text;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.created_by<>auth.uid() and not admin then raise exception 'owner_required' using errcode='42501'; end if;
  new.created_at:=now(); new.revision:=1;
 else
  if new.kind<>old.kind or new.created_by<>old.created_by or new.id<>old.id then raise exception 'immutable_record' using errcode='42501'; end if;
  new.created_at:=old.created_at; new.revision:=old.revision+1;
 end if;
 if not admin then
  if new.created_by<>auth.uid() or new.kind not in ('character','task','journal','trade','knowledge','media') then raise exception 'owner_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.visibility='public' and new.visibility='public' then new.visibility:='review'; end if;
  if new.visibility not in ('draft','clan','review','archived') then raise exception 'admin_publication_required' using errcode='42501'; end if;
  new.details:=new.details-'publicImage'-'publicAudio';
  if new.kind='knowledge' and ((tg_op='INSERT' and coalesce((new.details->>'pinned')::boolean,false)) or (tg_op='UPDATE' and new.details ? 'pinned' and new.details->'pinned' is distinct from old.details->'pinned')) then raise exception 'admin_pin_required' using errcode='42501'; end if;
  if new.details ? 'audioPath' and new.details->>'audioPath' not like auth.uid()::text || '/%' then raise exception 'audio_owner_required' using errcode='42501'; end if;
  if new.details ? 'imagePath' and new.details->>'imagePath' not like auth.uid()::text || '/%' then raise exception 'image_owner_required' using errcode='42501'; end if;
 end if;
 allowed:=case new.kind
  when 'gallery' then array['imagePath','publicImage','date']
  when 'place' then array['x','y','category']
  when 'chronicle' then array['date','sourceId','imagePath','publicImage']
  when 'trade' then array['category','contact','expires','imagePath','publicImage']
  when 'event' then array['date','time','location','registrationOpen']
  when 'character' then array['profession','relationships','imagePath','publicImage']
  when 'task' then array['category','dueDate']
  when 'project' then array['responsible','materials','progress']
  when 'knowledge' then array['category','tags']
  when 'poll' then array['options','endDate','open']
  when 'journal' then array['date']
  when 'media' then array['mediaType','youtubeId','audioPath','publicAudio','imagePath','publicImage','fileName'] end;
 allowed:=allowed || array['mediaIds','relatedIds','story'];
 if new.kind='knowledge' then allowed:=allowed || array['pinned']; end if;
 if exists(select 1 from jsonb_object_keys(new.details) k where not(k=any(allowed))) then raise exception 'invalid_details'; end if;
 if exists(select 1 from jsonb_each(new.details) e where e.key not in ('options','x','y','progress','open','registrationOpen','mediaIds','relatedIds','pinned') and jsonb_typeof(e.value)<>'string') then raise exception 'invalid_details'; end if;
 if new.details ? 'imagePath' and new.details->>'imagePath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_image_path'; end if;
 if new.details ? 'publicImage' and new.details->>'publicImage' !~ '^[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_public_image'; end if;
 foreach date_key in array array['date','dueDate','endDate','expires'] loop
  if new.details ? date_key then
   if new.details->>date_key !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_date'; end if;
   perform (new.details->>date_key)::date;
  end if;
 end loop;
 if new.kind='event' then
  if not(new.details ? 'date') then raise exception 'event_date_required'; end if;
  if new.details ? 'time' and new.details->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'invalid_time'; end if;
  if new.details ? 'registrationOpen' and jsonb_typeof(new.details->'registrationOpen')<>'boolean' then raise exception 'invalid_details'; end if;
 elsif new.kind='place' then
  if not(new.details ? 'x' and new.details ? 'y') or jsonb_typeof(new.details->'x')<>'number' or jsonb_typeof(new.details->'y')<>'number' then raise exception 'map_coordinates_required'; end if;
  if (new.details->>'x')::numeric not between 0 and 100 or (new.details->>'y')::numeric not between 0 and 100 then raise exception 'invalid_map_coordinates'; end if;
 elsif new.kind='project' and new.details ? 'progress' then
  if jsonb_typeof(new.details->'progress')<>'number' or (new.details->>'progress')::numeric not between 0 and 100 or (new.details->>'progress')::numeric<>trunc((new.details->>'progress')::numeric) then raise exception 'invalid_progress'; end if;
 elsif new.kind='poll' then
  if jsonb_typeof(new.details->'options') is distinct from 'array' or jsonb_array_length(new.details->'options') not between 2 and 8 then raise exception 'poll_options_required'; end if;
  for option_value in select value from jsonb_array_elements(new.details->'options') loop
   if jsonb_typeof(option_value)<>'string' or char_length(btrim(option_value#>>'{}')) not between 1 and 100 then raise exception 'invalid_poll_option'; end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(new.details->'options'))<>jsonb_array_length(new.details->'options') then raise exception 'duplicate_poll_options'; end if;
  if new.details ? 'open' and jsonb_typeof(new.details->'open')<>'boolean' then raise exception 'invalid_details'; end if;
  if tg_op='UPDATE' and new.details->'options' is distinct from old.details->'options' and exists(select 1 from public.raben_poll_votes where record_id=old.id) then raise exception 'poll_has_votes'; end if;
 end if;
 if new.kind='gallery' and new.visibility='public' and not(new.details ? 'publicImage') then raise exception 'public_image_required'; end if;

 -- Old open editor tabs must not silently discard newly introduced fields.
 if tg_op='UPDATE' then
  foreach extra_key in array array['mediaIds','relatedIds','story','pinned'] loop
   if not(new.details ? extra_key) and old.details ? extra_key then new.details:=new.details || jsonb_build_object(extra_key,old.details->extra_key); end if;
  end loop;
 end if;
 if new.details ? 'story' and char_length(new.details->>'story')>100 then raise exception 'invalid_story'; end if;
 if new.details ? 'pinned' and jsonb_typeof(new.details->'pinned')<>'boolean' then raise exception 'invalid_pin'; end if;
 foreach extra_key in array array['mediaIds','relatedIds'] loop
  if new.details ? extra_key then
   if jsonb_typeof(new.details->extra_key)<>'array' or jsonb_array_length(new.details->extra_key)>20 then raise exception 'invalid_links'; end if;
   if (select count(distinct value) from jsonb_array_elements(new.details->extra_key))<>jsonb_array_length(new.details->extra_key) then raise exception 'invalid_links'; end if;
   for ref_value in select jsonb_array_elements_text(new.details->extra_key) loop
    if ref_value !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or ref_value=new.id::text then raise exception 'invalid_links'; end if;
    select * into ref_row from public.raben_records where id=ref_value::uuid;
    if not found or (extra_key='mediaIds' and ref_row.kind<>'media') then raise exception 'linked_record_missing'; end if;
    if new.visibility='public' and ref_row.visibility<>'public' then raise exception 'linked_record_not_public'; end if;
   end loop;
  end if;
 end loop;
 if new.kind='media' then
  if new.details->>'mediaType' not in ('image','youtube','mp3') or not(new.details ? 'mediaType') then raise exception 'media_type_required'; end if;
  if new.details->>'mediaType'='youtube' then
   if new.details->>'youtubeId' !~ '^[a-zA-Z0-9_-]{11}$' or not(new.details ? 'youtubeId') then raise exception 'invalid_youtube'; end if;
   if new.details ? 'audioPath' or new.details ? 'publicAudio' then raise exception 'invalid_media'; end if;
  elsif new.details->>'mediaType'='mp3' then
   if new.details->>'audioPath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.mp3$' or not(new.details ? 'audioPath') then raise exception 'audio_file_required'; end if;
   if new.details ? 'youtubeId' then raise exception 'invalid_media'; end if;
   if not exists(select 1 from storage.objects where bucket_id='raben-media' and name=new.details->>'audioPath') then raise exception 'audio_file_missing'; end if;
   if new.visibility='public' then
    if new.details->>'publicAudio' !~ '^[a-f0-9-]{36}\.mp3$' or not(new.details ? 'publicAudio') then raise exception 'public_audio_required'; end if;
    if not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.details->>'publicAudio') then raise exception 'audio_file_missing'; end if;
   end if;
  elsif new.details->>'mediaType'='image' and not(new.details ? 'imagePath') then raise exception 'image_required';
  end if;
  if new.visibility='public' and new.details->>'mediaType'='image' and not(new.details ? 'publicImage') then raise exception 'public_image_required'; end if;
 end if;
 if new.details ? 'publicAudio' and new.details->>'publicAudio' !~ '^[a-f0-9-]{36}\.mp3$' then raise exception 'invalid_public_audio'; end if;
 new.updated_at:=now(); return new;
end; $$;

-- Own media may be submitted for review; only active admins publish.
alter policy raben_records_create on public.raben_records with check((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge','media') and visibility in ('draft','clan','review','archived'))));
alter policy raben_records_edit on public.raben_records using((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge','media')))) with check((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and visibility in ('draft','clan','review','archived'))));
alter policy raben_records_remove on public.raben_records using((select raben_private.is_member()) and ((select raben_private.is_admin()) or (created_by=(select auth.uid()) and kind in ('character','task','journal','trade','knowledge','media'))));
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','image/webp','audio/mpeg'] where id in ('raben-public','raben-media');
create or replace function raben_private.can_read_hub_media(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and (raben_private.is_admin() or split_part(p_name,'/',1)=auth.uid()::text or exists(select 1 from public.raben_records r where (r.details->>'imagePath'=p_name or r.details->>'audioPath'=p_name) and r.visibility in ('clan','public')));
$$;

create function raben_private.guard_site_media() returns trigger language plpgsql set search_path='' as $$
declare ids jsonb; item jsonb; entry jsonb;
begin
 for ids in select new.content->'rabenInfoMediaIds' union all select value->'mediaIds' from jsonb_array_elements(coalesce(new.content->'extraInfos','[]')) loop
  if ids is not null then
   if jsonb_typeof(ids)<>'array' or jsonb_array_length(ids)>20 then raise exception 'invalid_links'; end if;
   for item in select value from jsonb_array_elements(ids) loop
    if jsonb_typeof(item)<>'string' or item#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'invalid_links'; end if;
    if not exists(select 1 from public.raben_records where id=(item#>>'{}')::uuid and kind='media' and visibility='public') then raise exception 'linked_record_not_public'; end if;
   end loop;
  end if;
 end loop;
 return new;
end; $$;
revoke all on function raben_private.guard_site_media() from public,anon,authenticated;
create trigger guard_site_media before update on public.raben_site_content for each row execute function raben_private.guard_site_media();

create table public.raben_content_versions (
 id uuid primary key default gen_random_uuid(),
 source_table text not null check(source_table in ('raben_records','raben_site_content','raben_clan_posts','raben_character_notes')),
 entity_key text not null,
 kind text not null,
 title text not null,
 revision integer not null,
 operation text not null check(operation in ('baseline','insert','update','delete')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=600000),
 changed_by uuid references auth.users(id) on delete set null,
 actor_name text not null,
 changed_at timestamptz not null default now()
);
create index raben_versions_entity_idx on public.raben_content_versions(source_table,entity_key,changed_at desc);
create index raben_versions_actor_idx on public.raben_content_versions(changed_by);
alter table public.raben_content_versions enable row level security;
revoke all on public.raben_content_versions from public,anon,authenticated;
grant select,delete on public.raben_content_versions to authenticated;
create policy raben_versions_admin_read on public.raben_content_versions for select to authenticated using((select raben_private.is_admin()));
create policy raben_versions_admin_remove on public.raben_content_versions for delete to authenticated using((select raben_private.is_admin()));

-- No client can forge audit entries. This private trigger needs insertion rights
-- while clients intentionally have none on the history table.
create function raben_private.capture_version() returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb; entity text; actor text; label text; record_kind text; version integer;
begin
 if auth.uid() is not null and not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity:=coalesce(data->>'id',data->>'record_id');
 record_kind:=coalesce(data->>'kind',case tg_table_name when 'raben_site_content' then 'website' when 'raben_character_notes' then 'notes' else 'post' end);
 label:=coalesce(data->>'title',case tg_table_name when 'raben_site_content' then 'Website-Inhalte' when 'raben_character_notes' then 'Geheimnotizen' else 'Clanbeitrag' end);
 version:=coalesce((data->>'revision')::integer,(select coalesce(max(revision),0)+1 from public.raben_content_versions where source_table=tg_table_name and entity_key=entity));
 if tg_op='DELETE' and data ? 'revision' then version:=version+1; end if;
 select display_name into actor from public.raben_memberships where user_id=auth.uid();
 insert into public.raben_content_versions(source_table,entity_key,kind,title,revision,operation,snapshot,changed_by,actor_name)
 values(tg_table_name,entity,record_kind,label,version,lower(tg_op),data,auth.uid(),coalesce(actor,'System'));
 return null;
end; $$;
revoke all on function raben_private.capture_version() from public,anon,authenticated;
create trigger capture_record_version after insert or update or delete on public.raben_records for each row execute function raben_private.capture_version();
create trigger capture_site_version after update on public.raben_site_content for each row execute function raben_private.capture_version();
create trigger capture_post_version after insert or update or delete on public.raben_clan_posts for each row execute function raben_private.capture_version();
create trigger capture_note_version after insert or update or delete on public.raben_character_notes for each row execute function raben_private.capture_version();

insert into public.raben_content_versions(source_table,entity_key,kind,title,revision,operation,snapshot,actor_name)
 select 'raben_records',id::text,kind,title,revision,'baseline',to_jsonb(r),'Bestand vor dem Update' from public.raben_records r
 union all select 'raben_site_content',id::text,'website','Website-Inhalte',revision,'baseline',to_jsonb(s),'Bestand vor dem Update' from public.raben_site_content s
 union all select 'raben_clan_posts',id::text,'post',title,1,'baseline',to_jsonb(p),'Bestand vor dem Update' from public.raben_clan_posts p
 union all select 'raben_character_notes',record_id::text,'notes','Geheimnotizen',1,'baseline',to_jsonb(n),'Bestand vor dem Update' from public.raben_character_notes n;

create function raben_private.restore_snapshot(p_source text,p_key text,p_snapshot jsonb,p_expected text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision text; data jsonb; restored_details jsonb; target_id uuid; stamp timestamptz; saved public.raben_records;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 data:=p_snapshot;
 if p_source is null or jsonb_typeof(p_snapshot) is distinct from 'object' or p_source not in ('raben_records','raben_site_content','raben_character_notes','raben_clan_posts') then raise exception 'invalid_backup'; end if;
 if p_source='raben_site_content' then
  select revision::text into current_revision from public.raben_site_content where id=1 for update;
  if current_revision is distinct from p_expected then raise exception 'content_conflict'; end if;
  update public.raben_site_content set content=data->'content' where id=1 returning revision::text into current_revision;
 elsif p_source='raben_records' then
  target_id:=p_key::uuid;
  restored_details:=(data->'details')-'publicImage'-'publicAudio' || jsonb_build_object('mediaIds',coalesce(data->'details'->'mediaIds','[]'::jsonb),'relatedIds',coalesce(data->'details'->'relatedIds','[]'::jsonb),'story',coalesce(data->'details'->>'story',''));
  if data->>'kind'='knowledge' then restored_details:=restored_details || jsonb_build_object('pinned',coalesce(data->'details'->'pinned','false'::jsonb)); end if;
  select revision::text into current_revision from public.raben_records where id=target_id for update;
  if coalesce(current_revision,'') is distinct from coalesce(p_expected,'') then raise exception 'record_conflict'; end if;
  -- Restored records are drafts. Public release is a separate admin action.
  if current_revision is null then
   insert into public.raben_records(id,kind,title,body,details,visibility,created_by)
   values(target_id,data->>'kind',data->>'title',data->>'body',restored_details,'draft',(data->>'created_by')::uuid) returning * into saved;
  else
   update public.raben_records set title=data->>'title',body=data->>'body',details=restored_details,visibility='draft' where id=target_id returning * into saved;
  end if;
  current_revision:=saved.revision::text;
 elsif p_source='raben_character_notes' then
  target_id:=p_key::uuid;
  -- Avoid variable/column ambiguity and compare timestamps, not string formats.
  select n.updated_at into stamp from public.raben_character_notes n where n.record_id=p_key::uuid for update;
  if stamp is distinct from nullif(p_expected,'')::timestamptz then raise exception 'notes_conflict'; end if;
  insert into public.raben_character_notes(record_id,body) values(p_key::uuid,data->>'body')
  on conflict(record_id) do update set body=excluded.body returning updated_at into stamp;
  current_revision:=stamp::text;
 else
  select p.updated_at into stamp from public.raben_clan_posts p where p.id=p_key::uuid for update;
  if stamp is distinct from nullif(p_expected,'')::timestamptz then raise exception 'post_conflict'; end if;
  if stamp is null then
   insert into public.raben_clan_posts(id,title,body,category,event_date,created_by) values(p_key::uuid,data->>'title',data->>'body',data->>'category',nullif(data->>'event_date','')::date,auth.uid()) returning updated_at into stamp;
  else
   update public.raben_clan_posts set title=data->>'title',body=data->>'body',category=data->>'category',event_date=nullif(data->>'event_date','')::date where id=p_key::uuid returning updated_at into stamp;
  end if;
  current_revision:=stamp::text;
 end if;
 return jsonb_build_object('source',p_source,'id',p_key,'revision',current_revision);
end; $$;

revoke all on function raben_private.restore_snapshot(text,text,jsonb,text) from public,anon;
grant execute on function raben_private.restore_snapshot(text,text,jsonb,text) to authenticated;
create function public.raben_restore_version(p_version uuid,p_expected text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare version public.raben_content_versions;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select * into version from public.raben_content_versions where id=p_version;
 if not found then raise exception 'version_missing'; end if;
 return raben_private.restore_snapshot(version.source_table,version.entity_key,version.snapshot,p_expected);
end; $$;
revoke all on function public.raben_restore_version(uuid,text) from public,anon;
grant execute on function public.raben_restore_version(uuid,text) to authenticated;

-- Import restores one reviewed content item; never identities, roles or auth data.
create function public.raben_restore_backup_item(p_backup jsonb,p_source text,p_key text,p_expected text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare data jsonb; collection text;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_backup->>'application' is distinct from 'schwarze-raben' or p_backup->>'schemaVersion' is distinct from '1' or octet_length(p_backup::text)>10000000 then raise exception 'invalid_backup'; end if;
 collection:=case p_source when 'raben_records' then 'records' when 'raben_character_notes' then 'notes' when 'raben_clan_posts' then 'posts' when 'raben_site_content' then 'siteContent' end;
 if collection is null then raise exception 'invalid_backup'; end if;
 if collection='siteContent' then
  data:=p_backup->collection;
  if p_key<>'1' or data->>'id' is distinct from '1' then raise exception 'invalid_backup'; end if;
 else
  if jsonb_typeof(p_backup->collection)<>'array' then raise exception 'invalid_backup'; end if;
  select value into data from jsonb_array_elements(p_backup->collection) where coalesce(value->>'id',value->>'record_id')=p_key limit 1;
 end if;
 if data is null or jsonb_typeof(data)<>'object' then raise exception 'invalid_backup'; end if;
 return raben_private.restore_snapshot(p_source,p_key,data,p_expected);
end; $$;
revoke all on function public.raben_restore_backup_item(jsonb,text,text,text) from public,anon;
grant execute on function public.raben_restore_backup_item(jsonb,text,text,text) to authenticated;
create function raben_private.guard_media_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if old.created_by<>auth.uid() and not raben_private.is_admin() then raise exception 'owner_required' using errcode='42501'; end if;
 if old.kind='media' and (exists(select 1 from public.raben_records where id<>old.id and ((details->'mediaIds') @> jsonb_build_array(old.id::text) or (details->'relatedIds') @> jsonb_build_array(old.id::text))) or exists(select 1 from public.raben_site_content where content::text like '%'||old.id::text||'%')) then raise exception 'media_in_use'; end if;
 return old;
end; $$;
revoke all on function raben_private.guard_media_delete() from public,anon,authenticated;
create trigger guard_media_delete before delete on public.raben_records for each row execute function raben_private.guard_media_delete();

create function raben_private.file_in_use(p_bucket text,p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is null or not raben_private.is_member() or
 exists(select 1 from public.raben_records where details::text like '%'||p_name||'%') or
 exists(select 1 from public.raben_site_content where content::text like '%'||p_name||'%') or
 exists(select 1 from public.raben_content_versions where snapshot::text like '%'||p_name||'%');
$$;
revoke all on function raben_private.file_in_use(text,text) from public,anon;
grant execute on function raben_private.file_in_use(text,text) to authenticated;
create policy raben_retain_used_files on storage.objects as restrictive for delete to authenticated using(bucket_id not in ('raben-media','raben-public') or not raben_private.file_in_use(bucket_id,name));

create function public.raben_storage_inventory() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name,'size',coalesce((o.metadata->>'size')::bigint,0),'type',o.metadata->>'mimetype','used',raben_private.file_in_use(o.bucket_id,o.name),'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'kind',r.kind)) from public.raben_records r where r.details::text like '%'||o.name||'%'),'[]'::jsonb),'historyCount',(select count(*) from public.raben_content_versions v where v.snapshot::text like '%'||o.name||'%'),'website',exists(select 1 from public.raben_site_content s where s.content::text like '%'||o.name||'%')) order by o.name),'[]'::jsonb) into result
 from storage.objects o where o.bucket_id in ('raben-media','raben-public');
 return result;
end; $$;
revoke all on function public.raben_storage_inventory() from public,anon;
grant execute on function public.raben_storage_inventory() to authenticated;

create function public.raben_export_content() returns jsonb language plpgsql security invoker set search_path='' as $$
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
 'files',public.raben_storage_inventory()) into result;
 return result;
end; $$;
revoke all on function public.raben_export_content() from public,anon;
grant execute on function public.raben_export_content() to authenticated;

-- Canonical names also keep exported ZIP paths free of traversal segments.
create policy raben_media_canonical_names on storage.objects as restrictive for insert to authenticated
with check(bucket_id not in ('raben-media','raben-public') or (bucket_id='raben-media' and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp|mp3)$') or (bucket_id='raben-public' and name ~ '^[a-f0-9-]{36}\.(jpg|png|webp|mp3)$'));
