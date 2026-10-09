create function raben_private.valid_availability_slots(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v jsonb;a timestamptz;b timestamptz;
begin
 if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 40 then return false;end if;
 for v in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in ('start','end')) then return false;end if;
  if coalesce(v->>'start','') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d([.]\d{3})?Z$' or coalesce(v->>'end','') !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d([.]\d{3})?Z$' then return false;end if;
  a:=(v->>'start')::timestamptz;b:=(v->>'end')::timestamptz;if b<=a or b>a+interval '24 hours' then return false;end if;
 end loop;
 return (select count(distinct value) from jsonb_array_elements(p))=jsonb_array_length(p);
exception when others then return false;
end;$$;
revoke all on function raben_private.valid_availability_slots(jsonb) from public,anon;grant execute on function raben_private.valid_availability_slots(jsonb) to authenticated;
create table public.raben_availability_polls(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),body text not null default '' check(length(body)<=5000),
 slots jsonb not null check(raben_private.valid_availability_slots(slots)),closed boolean not null default false,
 created_at timestamptz not null default now(),revision integer not null default 1
);
create index availability_owner_idx on public.raben_availability_polls(owner_id);
create index availability_created_idx on public.raben_availability_polls(created_at desc,id);
create table public.raben_availability_answers(
 poll_id uuid not null references public.raben_availability_polls(id) on delete cascade,user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 slot_index integer not null check(slot_index between 0 and 39),choice text not null check(choice in ('yes','maybe','no')),updated_at timestamptz not null default now(),primary key(poll_id,user_id,slot_index)
);
create index availability_answers_user_idx on public.raben_availability_answers(user_id);
alter table public.raben_availability_polls enable row level security;alter table public.raben_availability_answers enable row level security;
revoke all on public.raben_availability_polls,public.raben_availability_answers from public,anon,authenticated;
grant select,insert,delete on public.raben_availability_polls to authenticated;grant update(title,body,closed) on public.raben_availability_polls to authenticated;
grant select,insert,delete on public.raben_availability_answers to authenticated;grant update(choice) on public.raben_availability_answers to authenticated;
create policy availability_read on public.raben_availability_polls for select to authenticated using((select raben_private.is_member()));
create policy availability_create on public.raben_availability_polls for insert to authenticated with check((select raben_private.is_member()) and owner_id=(select auth.uid()));
create policy availability_update on public.raben_availability_polls for update to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.is_admin()))) with check((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy availability_delete on public.raben_availability_polls for delete to authenticated using((select raben_private.is_member()) and (owner_id=(select auth.uid()) or (select raben_private.is_admin())));
create policy availability_answers_read on public.raben_availability_answers for select to authenticated using((select raben_private.is_member()));
create policy availability_answers_write on public.raben_availability_answers for all to authenticated using((select raben_private.is_member()) and user_id=(select auth.uid())) with check((select raben_private.is_member()) and user_id=(select auth.uid()));
create function raben_private.guard_availability() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.raben_availability_polls;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if tg_table_name='raben_availability_polls' then
  if tg_op='INSERT' and new.owner_id<>auth.uid() then raise exception 'owner_required' using errcode='42501';end if;
  if tg_op='UPDATE' then new.revision:=old.revision+1;new.owner_id:=old.owner_id;new.slots:=old.slots;new.created_at:=old.created_at;end if;
 else
  if new.user_id<>auth.uid() then raise exception 'owner_required' using errcode='42501';end if;
  select * into p from public.raben_availability_polls where id=new.poll_id for update;
  if not found or p.closed or new.slot_index>=jsonb_array_length(p.slots) or (p.slots->new.slot_index->>'end')::timestamptz<=now() then raise exception 'availability_closed' using errcode='23514';end if;
  if tg_op='UPDATE' then new.poll_id:=old.poll_id;new.user_id:=old.user_id;new.slot_index:=old.slot_index;end if;new.updated_at:=now();
 end if;return new;
end;$$;
revoke all on function raben_private.guard_availability() from public,anon,authenticated;
create trigger guard_availability before insert or update on public.raben_availability_polls for each row execute function raben_private.guard_availability();
create trigger guard_availability before insert or update on public.raben_availability_answers for each row execute function raben_private.guard_availability();

create function raben_private.event_occurs(p jsonb,p_day date) returns boolean language plpgsql immutable set search_path='' as $$
declare start_day date:=(p->>'date')::date;delta integer:=p_day-start_day;
begin
 return not coalesce((p->>'cancelled')::boolean,false) and not coalesce(p->'exceptions' @> to_jsonb(array[p_day::text]),false)
 and delta>=0 and p_day<=coalesce(nullif(p->>'repeatUntil','')::date,start_day)
 and (p_day=start_day or (p->>'repeat'='weekly' and delta%7=0) or (p->>'repeat'='fortnightly' and delta%14=0)
 or (p->>'repeat'='monthly' and extract(day from p_day)=extract(day from start_day)));
exception when others then return false;
end;$$;
revoke all on function raben_private.event_occurs(jsonb,date) from public,anon;grant execute on function raben_private.event_occurs(jsonb,date) to authenticated;
create table public.raben_resources(
 id uuid primary key default gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 120),
 description text not null default '' check(length(description)<=3000),kind text not null default 'place' check(kind in ('place','resource')),
 place_id uuid references public.raben_records(id) on delete set null,active boolean not null default true,created_at timestamptz not null default now()
);
create index resources_place_idx on public.raben_resources(place_id) where place_id is not null;
create table public.raben_reservations(
 id uuid primary key default gen_random_uuid(),resource_id uuid not null references public.raben_resources(id) on delete cascade,
 record_id uuid not null references public.raben_records(id) on delete cascade,occurrence_date date not null,
 user_id uuid not null default auth.uid() references public.raben_memberships(user_id) on delete cascade,
 starts_at timestamptz not null,ends_at timestamptz not null,created_at timestamptz not null default now(),unique(resource_id,record_id,occurrence_date),check(ends_at>starts_at)
);
create index reservations_resource_time_idx on public.raben_reservations(resource_id,starts_at,ends_at);
create index reservations_event_idx on public.raben_reservations(record_id,occurrence_date);
create index reservations_user_idx on public.raben_reservations(user_id);
alter table public.raben_resources enable row level security;alter table public.raben_reservations enable row level security;
revoke all on public.raben_resources,public.raben_reservations from public,anon,authenticated;
grant select,insert,delete on public.raben_resources to authenticated;grant update(title,description,kind,place_id,active) on public.raben_resources to authenticated;
grant select,insert,delete on public.raben_reservations to authenticated;
create policy resources_read on public.raben_resources for select to authenticated using((select raben_private.is_member()));
create policy resources_write on public.raben_resources for all to authenticated using((select raben_private.has_permission('calendar'))) with check((select raben_private.has_permission('calendar')) and (place_id is null or raben_private.record_visible(place_id,'place')));
create policy reservations_read on public.raben_reservations for select to authenticated using(raben_private.record_visible(record_id,'event'));
create policy reservations_create on public.raben_reservations for insert to authenticated with check((select raben_private.is_member()) and user_id=(select auth.uid()) and raben_private.record_visible(record_id,'event'));
create policy reservations_delete on public.raben_reservations for delete to authenticated using((select raben_private.is_member()) and (user_id=(select auth.uid()) or (select raben_private.has_permission('calendar'))));
-- Resource row locks serialize even concurrent bookings. Never disclose the conflicting private event.
create function raben_private.guard_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.raben_records;
begin
 if not raben_private.is_member() or (new.user_id<>auth.uid() and not (pg_trigger_depth()>1)) then raise exception 'member_required' using errcode='42501';end if;
 select * into r from public.raben_records where id=new.record_id;
 if not found or r.kind<>'event' or r.visibility not in ('clan','public') or not raben_private.event_occurs(r.details,new.occurrence_date) then raise exception 'invalid_occurrence' using errcode='23514';end if;
 perform 1 from public.raben_resources where id=new.resource_id and (active or tg_op='UPDATE') for update;
 if not found then raise exception 'resource_unavailable' using errcode='23514';end if;
 new.starts_at:=(new.occurrence_date+coalesce(nullif(r.details->>'time','')::time,'20:00'::time)) at time zone 'Europe/Berlin';
 new.ends_at:=new.starts_at+make_interval(mins=>coalesce((r.details->>'duration')::integer,120));
 if exists(select 1 from public.raben_reservations b join public.raben_records e on e.id=b.record_id where b.resource_id=new.resource_id and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at and e.visibility in ('clan','public') and raben_private.event_occurs(e.details,b.occurrence_date)) then raise exception 'resource_conflict' using errcode='23P01';end if;
 return new;
end;$$;
revoke all on function raben_private.guard_reservation() from public,anon,authenticated;
create trigger guard_reservation before insert or update on public.raben_reservations for each row execute function raben_private.guard_reservation();
create function raben_private.refresh_reservations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'event' or (new.details,new.visibility) is not distinct from (old.details,old.visibility) then return null;end if;
 perform 1 from public.raben_resources where id in(select resource_id from public.raben_reservations where record_id=new.id) order by id for update;
 delete from public.raben_reservations where record_id=new.id and not raben_private.event_occurs(new.details,occurrence_date);
 if new.visibility not in ('clan','public') then return null;end if;
 update public.raben_reservations set starts_at=starts_at where record_id=new.id;
 return null;
end;$$;
revoke all on function raben_private.refresh_reservations() from public,anon,authenticated;
create trigger refresh_reservations after update on public.raben_records for each row execute function raben_private.refresh_reservations();
create function public.raben_answer_availability(p_poll uuid,p_answers jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare a jsonb;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)>40 or (select count(distinct value->>'slot_index') from jsonb_array_elements(p_answers))<>jsonb_array_length(p_answers) then raise exception 'invalid_answers' using errcode='23514';end if;
 for a in select value from jsonb_array_elements(p_answers) loop insert into public.raben_availability_answers(poll_id,user_id,slot_index,choice) values(p_poll,auth.uid(),(a->>'slot_index')::integer,a->>'choice') on conflict(poll_id,user_id,slot_index) do update set choice=excluded.choice;end loop;
 delete from public.raben_availability_answers where poll_id=p_poll and user_id=auth.uid() and slot_index not in(select (value->>'slot_index')::integer from jsonb_array_elements(p_answers));
end;$$;
revoke all on function public.raben_answer_availability(uuid,jsonb) from public,anon;grant execute on function public.raben_answer_availability(uuid,jsonb) to authenticated;
