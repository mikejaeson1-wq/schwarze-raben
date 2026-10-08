-- Recurring events use one protected reservation per occurrence. Parent row locks serialize capacity changes.
create table public.raben_event_slots (
 record_id uuid not null references public.raben_records(id) on delete cascade,occurrence_date date not null,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 choice text not null check(choice in ('yes','maybe','no','wait')),wait_since timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(record_id,occurrence_date,user_id)
);
create index raben_event_slots_user_idx on public.raben_event_slots(user_id);
alter table public.raben_event_slots enable row level security;
revoke all on public.raben_event_slots from public,anon,authenticated;
grant select,insert,delete on public.raben_event_slots to authenticated;grant update(choice) on public.raben_event_slots to authenticated;
create policy raben_slots_read on public.raben_event_slots for select to authenticated using(raben_private.record_visible(record_id,'event'));
create policy raben_slots_create on public.raben_event_slots for insert to authenticated with check(user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
create policy raben_slots_edit on public.raben_event_slots for update to authenticated using(user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event')) with check(user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
create policy raben_slots_delete on public.raben_event_slots for delete to authenticated using(user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
insert into public.raben_event_slots(record_id,occurrence_date,user_id,choice,wait_since,updated_at)
 select r.id,(r.details->>'date')::date,e.user_id,e.choice,e.updated_at,e.updated_at from public.raben_event_responses e join public.raben_records r on r.id=e.record_id where r.kind='event';
-- Definer parent lock is required because regular attendees cannot UPDATE the event; explicit UID, member and published-parent checks remain mandatory.
create function raben_private.guard_event_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.raben_records;start_date date;delta integer;cap integer;trusted boolean:=pg_trigger_depth()>1 and current_user not in ('authenticated','anon') and tg_op='UPDATE';
begin
 if trusted and (old.choice<>'wait' or new.choice<>'yes' or new.record_id<>old.record_id or new.user_id<>old.user_id or new.occurrence_date<>old.occurrence_date) then raise exception 'invalid_promotion' using errcode='42501';end if;
 if not trusted and (not raben_private.is_member() or new.user_id<>auth.uid()) then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=new.record_id for update;
 if not found or r.kind<>'event' or r.visibility not in ('public','clan') then raise exception 'event_missing' using errcode='42501';end if;
 start_date:=(r.details->>'date')::date;delta:=new.occurrence_date-start_date;
 if delta<0 or new.occurrence_date>coalesce(nullif(r.details->>'repeatUntil','')::date,start_date) or
  not (new.occurrence_date=start_date or (r.details->>'repeat'='weekly' and delta%7=0) or (r.details->>'repeat'='fortnightly' and delta%14=0) or (r.details->>'repeat'='monthly' and extract(day from new.occurrence_date)=extract(day from start_date))) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 if coalesce((r.details->>'cancelled')::boolean,false) or r.details->'exceptions' @> to_jsonb(array[new.occurrence_date::text]) or r.details->>'registrationOpen'='false' or new.occurrence_date<(now() at time zone 'Europe/Berlin')::date then raise exception 'registration_closed' using errcode='23514';end if;
 if tg_op='UPDATE' then new.record_id:=old.record_id;new.user_id:=old.user_id;new.occurrence_date:=old.occurrence_date;new.wait_since:=old.wait_since;end if;
 cap:=nullif(r.details->>'capacity','')::integer;
 if new.choice in ('yes','wait') then
  if cap is not null and (select count(*) from public.raben_event_slots s where s.record_id=new.record_id and s.occurrence_date=new.occurrence_date and s.choice='yes' and s.user_id<>new.user_id and exists(select 1 from public.raben_memberships m where m.user_id=s.user_id and m.status='active'))>=cap then
   new.choice:='wait';if tg_op='INSERT' then new.wait_since:=now();elsif old.choice<>'wait' then new.wait_since:=now();end if;
  else new.choice:='yes';end if;
 end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function raben_private.guard_event_slot() from public,anon,authenticated;
create trigger raben_guard_slot before insert or update on public.raben_event_slots for each row execute function raben_private.guard_event_slot();
-- A private definer is required only to promote another user's existing reservation. No public execute permission.
create function raben_private.promote_waitlist() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid:=old.record_id;day date:=old.occurrence_date;r public.raben_records;cap integer;candidate uuid;
begin
 if pg_trigger_depth()>1 or (tg_op='UPDATE' and (old.choice<>'yes' or new.choice='yes')) or (tg_op='DELETE' and old.choice<>'yes') then return null;end if;
 select * into r from public.raben_records where id=rid for update;cap:=nullif(r.details->>'capacity','')::integer;
 if not found or coalesce((r.details->>'cancelled')::boolean,false) or r.details->'exceptions' @> to_jsonb(array[day::text]) or day<(now() at time zone 'Europe/Berlin')::date then return null;end if;
 if cap is null or (select count(*) from public.raben_event_slots where record_id=rid and occurrence_date=day and choice='yes')<cap then
  select s.user_id into candidate from public.raben_event_slots s join public.raben_memberships m on m.user_id=s.user_id and m.status='active' where s.record_id=rid and s.occurrence_date=day and s.choice='wait' order by s.wait_since,s.user_id limit 1;
  if candidate is not null then update public.raben_event_slots set choice='yes' where record_id=rid and occurrence_date=day and user_id=candidate;
   insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(candidate,'event','Du bist von der Warteliste nachgerückt','record',rid);end if;
 end if;return null;
end;$$;
revoke all on function raben_private.promote_waitlist() from public,anon,authenticated;
create trigger raben_promote_slot after update or delete on public.raben_event_slots for each row execute function raben_private.promote_waitlist();
create function public.raben_event_respond_on(p_record uuid,p_choice text,p_date date) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_choice not in ('yes','maybe','no') then raise exception 'invalid_choice' using errcode='23514';end if;
 insert into public.raben_event_slots(record_id,occurrence_date,choice) values(p_record,p_date,p_choice) on conflict(record_id,occurrence_date,user_id) do update set choice=excluded.choice;
end;$$;
create or replace function public.raben_event_respond(p_record uuid,p_choice text) returns void language sql security invoker set search_path='' as $$
 select public.raben_event_respond_on(p_record,p_choice,(select (details->>'date')::date from public.raben_records where id=p_record));
$$;
revoke all on function public.raben_event_respond_on(uuid,text,date) from public,anon;grant execute on function public.raben_event_respond_on(uuid,text,date) to authenticated;

