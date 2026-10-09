-- Extend the existing complete record guard to Spotify autoplay; retain all previous guards.
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

create function raben_private.guard_home_spotify() returns trigger
language plpgsql security invoker set search_path='' as $$
declare music jsonb := new.content->'homeSpotify';
begin
  if music is null or music='null'::jsonb or music='{}'::jsonb then return new;end if;
  if jsonb_typeof(music)<>'object' then raise exception 'invalid_home_spotify' using errcode='23514';end if;
  if exists(select 1 from jsonb_object_keys(music) k where k not in ('type','id','title','enabled','autoplay'))
    or coalesce(music->>'type','') not in ('track','playlist')
    or coalesce(music->>'id','') !~ '^[A-Za-z0-9]{22}$'
    or coalesce(jsonb_typeof(music->'title'),'')<>'string' or length(music->>'title')>120
    or coalesce(jsonb_typeof(music->'enabled'),'')<>'boolean'
    or coalesce(jsonb_typeof(music->'autoplay'),'')<>'boolean' then
    raise exception 'invalid_home_spotify' using errcode='23514';
  end if;
  return new;
end;$$;
revoke all on function raben_private.guard_home_spotify() from public,anon,authenticated;
create trigger guard_home_spotify before insert or update on public.raben_site_content
for each row execute function raben_private.guard_home_spotify();
