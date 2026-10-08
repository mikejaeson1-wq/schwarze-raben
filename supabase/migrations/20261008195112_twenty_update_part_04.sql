create function raben_private.notify_expansion() returns trigger language plpgsql security definer set search_path='' as $$
declare ptype text;pid uuid;scope text;owner uuid;targets uuid[];mentioned uuid[]:='{}';
begin
 if auth.uid() is not null and not raben_private.is_member() then raise exception 'member_required' using errcode='42501';end if;
 if tg_table_name='raben_comments' then
  ptype:=new.parent_type;pid:=new.parent_id;scope:='reply';
  owner:=case ptype when 'record' then (select created_by from public.raben_records where id=pid) when 'post' then (select created_by from public.raben_clan_posts where id=pid) when 'request' then (select created_by from public.raben_rp_requests where id=pid) when 'plot' then (select owner_id from public.raben_plots where id=pid) end;
  mentioned:=new.mentions;targets:=array_append(mentioned,owner);
 else
  ptype:=case tg_table_name when 'raben_records' then 'record' when 'raben_clan_posts' then 'post' when 'raben_rp_requests' then 'request' else 'plot' end;
  pid:=new.id;if tg_table_name='raben_records' then scope:=new.kind;elsif tg_table_name='raben_clan_posts' then scope:='posts';elsif tg_table_name='raben_rp_requests' then scope:='requests';else scope:='plots';end if;
  select array_agg(user_id) into targets from public.raben_memberships where status='active';
 end if;
 insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id)
 select distinct u,case when tg_table_name='raben_comments' and u=any(mentioned) then 'mention' else scope end,
 case when tg_table_name='raben_comments' then 'Eine neue Antwort oder Erwähnung' when tg_op='INSERT' then 'Ein neuer Eintrag in einem verfolgten Bereich' else 'Ein verfolgter Eintrag wurde geändert' end,ptype,pid
 from unnest(coalesce(targets,'{}')) u
 where u<>coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid) and raben_private.recipient_can_view(ptype,pid,u)
 and case when tg_table_name='raben_comments' and u=any(mentioned) then 'mention' else scope end=any(coalesce((select subscriptions from public.raben_preferences where user_id=u),array['posts','event','reply','mention']));
 return null;
end;$$;
revoke all on function raben_private.notify_expansion() from public,anon,authenticated;
create trigger raben_notify_records after insert or update on public.raben_records for each row execute function raben_private.notify_expansion();
create trigger raben_notify_posts after insert or update on public.raben_clan_posts for each row execute function raben_private.notify_expansion();
create trigger raben_notify_requests after insert or update on public.raben_rp_requests for each row execute function raben_private.notify_expansion();
create trigger raben_notify_comments after insert on public.raben_comments for each row execute function raben_private.notify_expansion();
-- Plot notifications are emitted after guests are committed, by the save RPC's private AFTER grant trigger below.
create trigger raben_notify_plots after insert or update on public.raben_plots for each row execute function raben_private.notify_expansion();
create function raben_private.notify_plot_guest() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.owner_id<>auth.uid() or not raben_private.is_member() then raise exception 'owner_required' using errcode='42501';end if;
 if raben_private.recipient_can_view('plot',new.plot_id,new.user_id) and 'plots'=any(coalesce((select subscriptions from public.raben_preferences where user_id=new.user_id),array['posts','event','reply','mention'])) then
 insert into public.raben_notifications(user_id,scope,label,parent_type,parent_id) values(new.user_id,'plots','Du wurdest zu einer Plotgruppe eingeladen','plot',new.plot_id);end if;
 return null;
end;$$;
revoke all on function raben_private.notify_plot_guest() from public,anon,authenticated;
create trigger raben_notify_plot_guest after insert on public.raben_plot_guests for each row execute function raben_private.notify_plot_guest();

