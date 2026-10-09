-- An invitation concerns one entry only. Owners retain images, publication and sharing controls.
create table public.raben_entry_editors(
 parent_type text not null check(parent_type in ('profile','record')),parent_id uuid not null,
 owner_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 editor_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 expires_at timestamptz,created_at timestamptz not null default now(),
 primary key(parent_type,parent_id,editor_id),check(owner_id<>editor_id)
);
create index raben_editors_owner_idx on public.raben_entry_editors(owner_id,parent_type,parent_id);
create index raben_editors_editor_idx on public.raben_entry_editors(editor_id,parent_type,parent_id);
alter table public.raben_entry_editors enable row level security;
revoke all on public.raben_entry_editors from public,anon,authenticated;
grant select,insert,delete on public.raben_entry_editors to authenticated;
create policy entry_editors_read on public.raben_entry_editors for select to authenticated
 using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or editor_id=(select auth.uid())));
create policy entry_editors_create on public.raben_entry_editors for insert to authenticated
 with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy entry_editors_delete on public.raben_entry_editors for delete to authenticated
 using((select raben_private.is_member()) and owner_id=(select auth.uid()));
create function raben_private.guard_entry_editor() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() or new.owner_id<>auth.uid() or not exists(select 1 from public.raben_memberships where user_id=new.editor_id and status='active') then raise exception 'entry_access_denied' using errcode='42501';end if;
 if new.parent_type='profile' then
  perform 1 from public.raben_profile_items where id=new.parent_id and owner_id=auth.uid() and kind in ('character','info') for update;
 else perform 1 from public.raben_records where id=new.parent_id and created_by=auth.uid() for update;end if;
 if not found then raise exception 'entry_access_denied' using errcode='42501';end if;
 if new.expires_at is not null and (new.expires_at<=now() or new.expires_at>now()+interval '1 year') then raise exception 'invalid_expiry' using errcode='23514';end if;
 if (select count(*) from public.raben_entry_editors where parent_type=new.parent_type and parent_id=new.parent_id)>=20 then raise exception 'editor_limit' using errcode='23514';end if;
 new.created_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_entry_editor() from public,anon,authenticated;
create trigger guard_entry_editor before insert on public.raben_entry_editors for each row execute function raben_private.guard_entry_editor();
-- Private definer avoids recursive parent RLS. Explicit identity, active owners and exact parent ownership are mandatory.
create or replace function raben_private.entry_collaborator(p_type text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(
  select 1 from public.raben_entry_editors e join public.raben_memberships m on m.user_id=e.owner_id and m.status='active'
  where e.parent_type=p_type and e.parent_id=p_id and e.editor_id=auth.uid() and (e.expires_at is null or e.expires_at>now())
  and ((p_type='profile' and exists(select 1 from public.raben_profile_items i where i.id=p_id and i.owner_id=e.owner_id and i.kind in ('character','info')))
   or (p_type='record' and exists(select 1 from public.raben_records r where r.id=p_id and r.created_by=e.owner_id)))
 );
$$;
revoke all on function raben_private.entry_collaborator(text,uuid) from public,anon;
grant execute on function raben_private.entry_collaborator(text,uuid) to authenticated;
create policy profile_coeditor_read on public.raben_profile_items for select to authenticated using(raben_private.entry_collaborator('profile',id));
create policy profile_coeditor_update on public.raben_profile_items for update to authenticated using(raben_private.entry_collaborator('profile',id)) with check(raben_private.entry_collaborator('profile',id));
create policy record_coeditor_read on public.raben_records for select to authenticated using(raben_private.entry_collaborator('record',id));
create policy record_coeditor_update on public.raben_records for update to authenticated using(raben_private.entry_collaborator('record',id)) with check(raben_private.entry_collaborator('record',id) and visibility in ('draft','clan','review','archived'));
create or replace function raben_private.record_visible(p_id uuid,p_kind text default null) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and raben_private.is_member() and exists(select 1 from public.raben_records r where r.id=p_id and (p_kind is null or r.kind=p_kind)
 and (r.visibility in ('clan','public') or r.created_by=auth.uid() or raben_private.is_admin() or raben_private.entry_collaborator('record',r.id)));
$$;
create function public.raben_coedit_entry(p_type text,p_id uuid,p_title text,p_body text,p_expected bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not raben_private.entry_collaborator(p_type,p_id) then raise exception 'entry_access_denied' using errcode='42501';end if;
 if p_type='profile' then update public.raben_profile_items set title=p_title,body=p_body where id=p_id and revision=p_expected returning to_jsonb(raben_profile_items.*) into result;
 elsif p_type='record' then update public.raben_records set title=p_title,body=p_body where id=p_id and revision=p_expected returning to_jsonb(raben_records.*) into result;
 else raise exception 'invalid_entry' using errcode='23514';end if;
 if result is null then raise exception 'entry_conflict' using errcode='40001';end if;return result;
end;$$;
revoke all on function public.raben_coedit_entry(text,uuid,text,text,bigint) from public,anon;grant execute on function public.raben_coedit_entry(text,uuid,text,text,bigint) to authenticated;
create function raben_private.clear_entry_editors() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from public.raben_entry_editors where parent_id=old.id and parent_type=case tg_table_name when 'raben_profile_items' then 'profile' else 'record' end;return null;end;$$;
revoke all on function raben_private.clear_entry_editors() from public,anon,authenticated;
create trigger clear_entry_editors after delete on public.raben_profile_items for each row execute function raben_private.clear_entry_editors();
create trigger clear_entry_editors after delete on public.raben_records for each row execute function raben_private.clear_entry_editors();

create or replace function raben_private.guard_personal_item() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
  if new.owner_id is distinct from auth.uid() then
    if tg_op<>'UPDATE' or not raben_private.entry_collaborator('profile',old.id) then raise exception 'profile_access_denied' using errcode='42501';end if;
    if (new.id,new.owner_id,new.kind,new.image_path,new.preview_path,new.visibility) is distinct from (old.id,old.owner_id,old.kind,old.image_path,old.preview_path,old.visibility) then raise exception 'owner_controls_required' using errcode='42501';end if;
  end if;
  new.title:=btrim(new.title);new.body:=btrim(new.body);new.image_path:=nullif(new.image_path,'');
  if new.image_path is not null then
    if new.image_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or split_part(new.image_path,'/',1)<>new.owner_id::text then
      raise exception 'invalid_profile_image' using errcode='23514';
    end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='raben-profile-media' and o.name=new.image_path) then
      raise exception 'profile_image_missing' using errcode='23514';
    end if;
  end if;
  if tg_op='UPDATE' then
    new.id:=old.id;new.owner_id:=old.owner_id;new.kind:=old.kind;new.created_at:=old.created_at;new.revision:=old.revision+1;
  else new.revision:=1;new.created_at:=now();end if;
  new.updated_at:=now();return new;
end;
$$;
create or replace function raben_private.guard_profile_expansion() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
 if not raben_private.is_member() then raise exception 'profile_access_denied' using errcode='42501';end if;
 if new.owner_id<>auth.uid() then
  if tg_table_name<>'raben_profile_items' or tg_op<>'UPDATE' then raise exception 'profile_access_denied' using errcode='42501';end if;
  if not raben_private.entry_collaborator('profile',old.id) or new.preview_path is distinct from old.preview_path then raise exception 'profile_access_denied' using errcode='42501';end if;
 elsif not raben_private.check_personal_image(new.preview_path) then raise exception 'profile_access_denied' using errcode='42501';end if;
 if tg_table_name='raben_profile_gallery' then
  if not raben_private.check_personal_image(new.image_path) then raise exception 'profile_image_missing' using errcode='23514';end if;
  if (select count(*) from public.raben_profile_gallery where item_id=new.item_id)>=12 then raise exception 'gallery_limit' using errcode='23514';end if;
 else
  if exists(select 1 from jsonb_object_keys(new.details) k where k not in ('race','age','origin','appearance','skills','goals','custom')) then raise exception 'invalid_character_details' using errcode='23514';end if;
  if exists(select 1 from jsonb_each(new.details) d where d.key<>'custom' and (jsonb_typeof(d.value)<>'string' or length(d.value#>>'{}')>4000)) then raise exception 'invalid_character_details' using errcode='23514';end if;
  if new.details ? 'custom' then
   if jsonb_typeof(new.details->'custom')<>'array' or jsonb_array_length(new.details->'custom')>12 then raise exception 'invalid_character_details' using errcode='23514';end if;
   for entry in select value from jsonb_array_elements(new.details->'custom') loop
    if jsonb_typeof(entry)<>'object' or length(coalesce(entry->>'label','')) not between 1 and 100 or length(coalesce(entry->>'value',''))>4000 then raise exception 'invalid_character_details' using errcode='23514';end if;
   end loop;
  end if;
 end if;return new;
end;$$;
create or replace function raben_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare admin boolean:=raben_private.is_admin(); allowed text[]; date_key text; option_value jsonb; ref_value text; ref_row public.raben_records; extra_key text; delegated boolean; speaker text;
begin
 if auth.uid() is null or not raben_private.is_member() then raise exception 'member_required' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.created_by<>auth.uid() and not admin then raise exception 'owner_required' using errcode='42501'; end if;
  new.created_at:=now(); new.revision:=1;
 else
  if new.kind<>old.kind or new.created_by<>old.created_by or new.id<>old.id then raise exception 'immutable_record' using errcode='42501'; end if;
  new.created_at:=old.created_at; new.revision:=old.revision+1;
 end if;
 delegated:=raben_private.has_permission('content') or (new.kind='event' and raben_private.has_permission('calendar'));
 if tg_op='UPDATE' and not admin and not delegated and new.created_by<>auth.uid() and raben_private.entry_collaborator('record',old.id) then
  if new.details is distinct from old.details or new.visibility<>old.visibility then raise exception 'owner_controls_required' using errcode='42501';end if;
  delegated:=true;
 end if;
 if not admin then
  if not delegated and (new.created_by<>auth.uid() or new.kind not in ('character','task','journal','trade','knowledge','media')) then raise exception 'owner_required' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.visibility='public' and new.visibility='public' then new.visibility:='review'; end if;
  if new.visibility not in ('draft','clan','review','archived') then raise exception 'admin_publication_required' using errcode='42501'; end if;
  new.details:=new.details-'publicImage'-'publicAudio'-'publicThumb';
  if new.kind='knowledge' and ((tg_op='INSERT' and coalesce((new.details->>'pinned')::boolean,false)) or (tg_op='UPDATE' and new.details ? 'pinned' and new.details->'pinned' is distinct from old.details->'pinned')) then raise exception 'admin_pin_required' using errcode='42501'; end if;
  if new.details ? 'audioPath' and new.details->>'audioPath' not like auth.uid()::text || '/%' and not (tg_op='UPDATE' and delegated and new.details->'audioPath'=old.details->'audioPath') then raise exception 'audio_owner_required' using errcode='42501'; end if;
  if new.details ? 'imagePath' and new.details->>'imagePath' not like auth.uid()::text || '/%' and not (tg_op='UPDATE' and delegated and new.details->'imagePath'=old.details->'imagePath') then raise exception 'image_owner_required' using errcode='42501'; end if;
 end if;
 allowed:=case new.kind
  when 'gallery' then array['imagePath','publicImage','date']
  when 'place' then array['x','y','category']
  when 'chronicle' then array['date','sourceId','imagePath','publicImage']
  when 'trade' then array['category','contact','expires','imagePath','publicImage']
  when 'event' then array['date','time','location','registrationOpen','repeat','repeatUntil','capacity','cancelled','exceptions','duration']
  when 'character' then array['profession','relationships','imagePath','publicImage']
  when 'task' then array['category','dueDate']
  when 'project' then array['responsible','materials','progress']
  when 'knowledge' then array['category','tags']
  when 'poll' then array['options','endDate','open']
  when 'journal' then array['date']
  when 'media' then array['mediaType','youtubeId','spotifyType','spotifyId','autoplay','audioPath','publicAudio','imagePath','publicImage','fileName'] end;
 allowed:=allowed || array['mediaIds','relatedIds','story','audience','speakerId','speakerName','thumbPath','publicThumb'];
 if new.kind='knowledge' then allowed:=allowed || array['pinned']; end if;
 if exists(select 1 from jsonb_object_keys(new.details) k where not(k=any(allowed))) then raise exception 'invalid_details'; end if;
 if exists(select 1 from jsonb_each(new.details) e where e.key not in ('options','x','y','progress','open','registrationOpen','mediaIds','relatedIds','pinned','capacity','cancelled','exceptions','duration') and jsonb_typeof(e.value)<>'string') then raise exception 'invalid_details'; end if;
 if new.details ? 'imagePath' and new.details->>'imagePath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_image_path'; end if;
 if new.details ? 'publicImage' and new.details->>'publicImage' !~ '^[a-f0-9-]{36}\.(jpg|png|webp)$' then raise exception 'invalid_public_image'; end if;
 foreach date_key in array array['date','dueDate','endDate','expires','repeatUntil'] loop
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
  foreach extra_key in array array['mediaIds','relatedIds','story','pinned','audience','speakerId','speakerName','thumbPath','publicThumb','repeat','repeatUntil','capacity','cancelled','exceptions','duration'] loop
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
  if new.details->>'mediaType' not in ('image','youtube','mp3','spotify') or not(new.details ? 'mediaType') then raise exception 'media_type_required'; end if;
  if new.details->>'mediaType'='youtube' then
   if new.details->>'youtubeId' !~ '^[a-zA-Z0-9_-]{11}$' or not(new.details ? 'youtubeId') then raise exception 'invalid_youtube'; end if;
   if new.details ? 'audioPath' or new.details ? 'publicAudio' then raise exception 'invalid_media'; end if;
  elsif new.details->>'mediaType'='spotify' then
   if coalesce(new.details->>'spotifyType','') not in ('track','playlist') or coalesce(new.details->>'spotifyId','') !~ '^[A-Za-z0-9]{22}$' then raise exception 'invalid_spotify' using errcode='23514';end if;
   if new.details ? 'youtubeId' or new.details ? 'audioPath' or new.details ? 'publicAudio' then raise exception 'invalid_media';end if;
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

 if new.details ? 'audience' and new.details->>'audience' not in ('ic','ooc','mixed') then raise exception 'invalid_audience' using errcode='23514';end if;
 if new.details->>'speakerId'='' then new.details:=new.details-'speakerId'-'speakerName';
 elsif new.details ? 'speakerId' and (tg_op='INSERT' or new.details->'speakerId' is distinct from old.details->'speakerId') then
  if new.details->>'speakerId' !~ '^[a-f0-9-]{36}$' then raise exception 'invalid_speaker' using errcode='23514';end if;
  select title into speaker from public.raben_profile_items where id=(new.details->>'speakerId')::uuid and owner_id=auth.uid() and kind='character';
  if speaker is null then select title into speaker from public.raben_records where id=(new.details->>'speakerId')::uuid and created_by=auth.uid() and kind='character';end if;
  if speaker is null then raise exception 'invalid_speaker' using errcode='23514';end if;
  new.details:=new.details || jsonb_build_object('speakerName',speaker);
 elsif tg_op='UPDATE' and new.details ? 'speakerId' then new.details:=new.details || jsonb_build_object('speakerName',old.details->>'speakerName');
 elsif new.details ? 'speakerName' then raise exception 'invalid_speaker' using errcode='23514';end if;
 if new.details ? 'thumbPath' then
  if new.details->>'thumbPath' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-media' and name=new.details->>'thumbPath') then raise exception 'invalid_thumbnail' using errcode='23514';end if;
 end if;
 if new.details ? 'publicThumb' and (new.details->>'publicThumb' !~ '^[a-f0-9-]{36}[.](jpg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='raben-public' and name=new.details->>'publicThumb')) then raise exception 'invalid_thumbnail' using errcode='23514';end if;
 if new.kind='event' then
  if new.details ? 'capacity' and (jsonb_typeof(new.details->'capacity')<>'number' or (new.details->>'capacity')::numeric not between 1 and 500 or (new.details->>'capacity')::numeric<>trunc((new.details->>'capacity')::numeric)) then raise exception 'invalid_capacity' using errcode='23514';end if;
  if new.details ? 'duration' and (jsonb_typeof(new.details->'duration')<>'number' or (new.details->>'duration')::integer not between 15 and 1440) then raise exception 'invalid_duration' using errcode='23514';end if;
  if new.details ? 'repeat' and new.details->>'repeat' not in ('none','weekly','fortnightly','monthly') then raise exception 'invalid_repeat' using errcode='23514';end if;
  if coalesce(new.details->>'repeat','none')<>'none' and (not(new.details ? 'repeatUntil') or (new.details->>'repeatUntil')::date<(new.details->>'date')::date or (new.details->>'repeatUntil')::date>(new.details->>'date')::date+interval '2 years') then raise exception 'repeat_until_required' using errcode='23514';end if;
  if new.details ? 'cancelled' and jsonb_typeof(new.details->'cancelled')<>'boolean' then raise exception 'invalid_cancelled' using errcode='23514';end if;
  if new.details ? 'exceptions' then
   if jsonb_typeof(new.details->'exceptions')<>'array' or jsonb_array_length(new.details->'exceptions')>100 then raise exception 'invalid_exceptions' using errcode='23514';end if;
   for ref_value in select jsonb_array_elements_text(new.details->'exceptions') loop perform ref_value::date;end loop;
  end if;
 end if;
 if new.details ? 'autoplay' and (new.kind<>'media' or new.details->>'mediaType' not in ('youtube','spotify') or new.details->>'autoplay' not in ('true','false')) then raise exception 'invalid_autoplay' using errcode='23514';end if;
 if new.details->>'mediaType'<>'spotify' and (new.details ? 'spotifyType' or new.details ? 'spotifyId') then raise exception 'invalid_spotify' using errcode='23514';end if;
 new.updated_at:=now(); return new;
end; $$;

create or replace function public.raben_export_profile() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 return jsonb_build_object('application','schwarze-raben-profile','exportedAt',now(),'profile',(select to_jsonb(p) from public.raben_profiles p where user_id=auth.uid()),'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.raben_profile_items i where owner_id=auth.uid()),'[]'),'grants',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_grants g where owner_id=auth.uid()),'[]'),'gallery',coalesce((select jsonb_agg(to_jsonb(g)) from public.raben_profile_gallery g where owner_id=auth.uid()),'[]'),'styles',coalesce((select jsonb_agg(to_jsonb(s)) from public.raben_profile_styles s where owner_id=auth.uid()),'[]'),'albums',coalesce((select jsonb_agg(to_jsonb(a)) from public.raben_profile_albums a where owner_id=auth.uid()),'[]'),'templates',coalesce((select jsonb_agg(to_jsonb(t)) from public.raben_theme_templates t where user_id=auth.uid()),'[]'),'profileVersions',coalesce((select jsonb_agg(to_jsonb(v)) from public.raben_profile_versions v where owner_id=auth.uid()),'[]'),'drafts',coalesce((select jsonb_agg(to_jsonb(d)) from public.raben_private_drafts d where user_id=auth.uid()),'[]'),'entryEditors',coalesce((select jsonb_agg(to_jsonb(e)) from public.raben_entry_editors e where owner_id=auth.uid()),'[]'),'relationships',coalesce((select jsonb_agg(to_jsonb(r)) from public.raben_relationships r where sender_id=auth.uid() or recipient_id=auth.uid()),'[]'));
end;$$;
revoke all on function public.raben_export_profile() from public,anon;grant execute on function public.raben_export_profile() to authenticated;
