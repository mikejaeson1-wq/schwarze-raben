-- Personal settings stay self-only, including for administrators.
alter table public.raben_preferences
 add column font_family text not null default 'default' check(font_family in ('default','system','serif','arial','verdana','monospace')),
 add column font_color text not null default '#f0eee8' check(font_color ~ '^#[0-9a-fA-F]{6}$'),
 add column font_size integer not null default 16 check(font_size between 14 and 24);
grant update(font_family,font_color,font_size) on public.raben_preferences to authenticated;
create function public.raben_save_preferences(p_subscriptions text[],p_font_family text,p_font_color text,p_font_size integer)
returns public.raben_preferences language plpgsql security invoker set search_path='' as $$
declare result public.raben_preferences;
begin
 if not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 -- Only mutable fields appear in the conflict update. No UPDATE(user_id) grant is needed.
 insert into public.raben_preferences(user_id,subscriptions,font_family,font_color,font_size)
 values(auth.uid(),p_subscriptions,p_font_family,p_font_color,p_font_size)
 on conflict(user_id) do update set subscriptions=excluded.subscriptions,font_family=excluded.font_family,font_color=excluded.font_color,font_size=excluded.font_size
 returning * into result;
 return result;
end;$$;
revoke all on function public.raben_save_preferences(text[],text,text,integer) from public,anon;
grant execute on function public.raben_save_preferences(text[],text,text,integer) to authenticated;

create table public.raben_clan_information (
 id integer primary key default 1 check(id=1),
 title text not null default 'Schwarze Raben' check(length(btrim(title)) between 1 and 120),
 body text not null default '' check(length(body)<=20000),
 rules text not null default '' check(length(rules)<=20000),
 playtimes text not null default '' check(length(playtimes)<=10000),
 contact text not null default '' check(length(contact)<=10000),
 revision integer not null default 1,updated_at timestamptz not null default now()
);
alter table public.raben_clan_information enable row level security;
revoke all on public.raben_clan_information from public,anon,authenticated;
grant select on public.raben_clan_information to authenticated;
grant update(title,body,rules,playtimes,contact) on public.raben_clan_information to authenticated;
create policy clan_information_read on public.raben_clan_information for select to authenticated using((select raben_private.is_member()));
create policy clan_information_edit on public.raben_clan_information for update to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create function raben_private.guard_clan_information() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1;new.updated_at:=now();return new;end;$$;
revoke all on function raben_private.guard_clan_information() from public,anon,authenticated;
create trigger guard_clan_information before update on public.raben_clan_information for each row execute function raben_private.guard_clan_information();
insert into public.raben_clan_information(id) values(1);

alter table public.raben_ranks add column category text not null default 'rank' check(category in ('rank','office'));
grant update(category) on public.raben_ranks to authenticated;
create table public.raben_member_offices (
 user_id uuid not null references public.raben_memberships(user_id) on delete cascade,
 office_id uuid not null references public.raben_ranks(id) on delete cascade,
 primary key(user_id,office_id)
);
create index raben_member_offices_office_idx on public.raben_member_offices(office_id);
alter table public.raben_member_offices enable row level security;
revoke all on public.raben_member_offices from public,anon,authenticated;
grant select,insert,delete on public.raben_member_offices to authenticated;
create policy clan_offices_read on public.raben_member_offices for select to authenticated using((select raben_private.is_member()));
create policy clan_offices_write on public.raben_member_offices for all to authenticated using((select raben_private.is_admin())) with check((select raben_private.is_admin()));
create function raben_private.guard_clan_rank() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text;rid uuid;
begin
 if tg_table_name='raben_member_ranks' then kind:='rank';rid:=new.rank_id;else kind:='office';rid:=new.office_id;end if;
 if not exists(select 1 from public.raben_ranks where id=rid and category=kind) or not exists(select 1 from public.raben_memberships where user_id=new.user_id and status='active') then raise exception 'invalid_clan_assignment' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function raben_private.guard_clan_rank() from public,anon,authenticated;
create trigger guard_clan_rank before insert or update on public.raben_member_ranks for each row execute function raben_private.guard_clan_rank();
create trigger guard_clan_office before insert on public.raben_member_offices for each row execute function raben_private.guard_clan_rank();
create function raben_private.guard_rank_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.category<>old.category and (exists(select 1 from public.raben_member_ranks where rank_id=old.id) or exists(select 1 from public.raben_member_offices where office_id=old.id)) then raise exception 'assigned_rank_category' using errcode='23514';end if;return new;
end;$$;
revoke all on function raben_private.guard_rank_category() from public,anon,authenticated;
create trigger guard_rank_category before update on public.raben_ranks for each row execute function raben_private.guard_rank_category();

-- Keep existing names and assignments; seed only missing requested ranks and offices.
insert into public.raben_ranks(label,description,sort_order,category)
select s.label,s.description,s.sort_order,s.category from (values
 ('Jarl','Clan-Owner und Clanführung. Website-Rechte werden separat vergeben.',0,'rank'),
 ('Hirdführer','Führung der Hird.',10,'rank'),('Huskarl','Gefolgsmann der Clanführung.',20,'rank'),
 ('Karl','Freies Mitglied der Dorfgemeinschaft.',30,'rank'),('Krieger & Jäger','Kampf und Jagd.',40,'rank'),
 ('Handwerker','Handwerk im Dorf.',50,'rank'),('Bauern & Handwerker','Versorgung und Handwerk.',60,'rank'),
 ('Neusiedler & Fremdlinge','Neuankömmlinge im Dorf.',70,'rank'),
 ('Völva','Besonderes Amt im Clan.',0,'office'),('Hofschmied','Besonderes Amt im Clan.',10,'office'),
 ('Godi','Besonderes Amt im Clan.',20,'office'),('Skalde/Barde','Besonderes Amt im Clan.',30,'office'),
 ('Dorfwache','Besonderes Amt im Clan.',40,'office'),('Tavernwirt','Besonderes Amt im Clan.',50,'office')
) as s(label,description,sort_order,category)
where not exists(select 1 from public.raben_ranks r where lower(r.label)=lower(s.label) and r.category=s.category);

-- Atomically assign one rank, several offices and the existing delegated website capabilities.
create function public.raben_assign_clan_roles(p_user uuid,p_rank uuid,p_offices uuid[],p_calendar boolean,p_content boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not raben_private.is_admin() then raise exception 'admin_required' using errcode='42501';end if;
 perform 1 from public.raben_memberships where user_id=p_user and status='active' for update;
 if not found then raise exception 'active_member_required' using errcode='23514';end if;
 if cardinality(p_offices)>30 then raise exception 'invalid_clan_assignment' using errcode='23514';end if;
 if p_rank is null then delete from public.raben_member_ranks where user_id=p_user;
 else insert into public.raben_member_ranks(user_id,rank_id) values(p_user,p_rank) on conflict(user_id) do update set rank_id=excluded.rank_id;end if;
 delete from public.raben_member_offices where user_id=p_user;
 insert into public.raben_member_offices(user_id,office_id) select p_user,v from unnest(coalesce(p_offices,'{}'::uuid[])) v group by v;
 delete from public.raben_permissions where user_id=p_user;
 insert into public.raben_permissions(user_id,permission) select p_user,permission from (values('calendar',p_calendar),('content',p_content)) p(permission,enabled) where enabled;
end;$$;
revoke all on function public.raben_assign_clan_roles(uuid,uuid,uuid[],boolean,boolean) from public,anon;
grant execute on function public.raben_assign_clan_roles(uuid,uuid,uuid[],boolean,boolean) to authenticated;
