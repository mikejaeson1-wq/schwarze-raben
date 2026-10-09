import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
export async function prepareSettings(db,path) {
  await db.exec(await readFile(path+'migrations/20261008211951_personal_settings_clan_offices.sql','utf8'));
  // Deterministic HTTP/Vault/Cron stubs: no Discord messages leave the test runner.
  await db.exec(`
    create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text,name text,description text);
    create view vault.decrypted_secrets as select *,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(p_secret text,p_name text default null,p_description text default '') returns uuid language sql as $$insert into vault.secrets(secret,name,description) values(p_secret,p_name,p_description) returning id$$;
    create function vault.update_secret(p_id uuid,p_secret text,p_name text default null,p_description text default null) returns void language sql as $$update vault.secrets set secret=p_secret where id=p_id$$;
    create schema net;create table net.http_request_queue(id bigint generated always as identity,method text,url text,headers jsonb,body jsonb,timeout_milliseconds integer);
    create table net._http_response(id bigint,status_code integer,content text,created timestamptz default now());
    create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language sql as $$insert into net.http_request_queue(method,url,headers,body,timeout_milliseconds) values('POST',url,headers,body,timeout_milliseconds) returning id$$;
    create schema cron;create table cron.job(jobname text,schedule text,command text);
    create function cron.schedule(p_name text,p_schedule text,p_command text) returns bigint language sql as $$insert into cron.job values(p_name,p_schedule,p_command) returning 1::bigint$$;
    create schema if not exists extensions;
    create table raben_private.http_test_response(status integer,content text);
    insert into raben_private.http_test_response values(200,'{}');
    create table raben_private.http_test_calls(url text,body jsonb,content_type text);
    create function extensions.http_set_curlopt(p_option text,p_value text) returns boolean language sql as $$select true$$;
    create function extensions.http_post(p_url text,p_body text,p_content_type text) returns table(status integer,content text) language plpgsql as $$begin insert into raben_private.http_test_calls values(p_url,p_body::jsonb,p_content_type);return query select r.status,r.content from raben_private.http_test_response r;end;$$;
    create function extensions.http_get(p_url text) returns table(status integer,content text) language sql as $$select r.status,r.content from raben_private.http_test_response r$$;
  `);
  for(const filename of (await readdir(path+'migrations')).filter(name=>name.includes('discord_webhook_part')).sort()) {
    const hosted=await readFile(path+'migrations/'+filename,'utf8');
    await db.exec(hosted.replace(/^create extension if not exists pg_(net|cron);$/gm,''));
  }
  for(const filename of (await readdir(path+'migrations')).filter(name=>name.includes('private_discord_http_')).sort()) {
    const hosted=await readFile(path+'migrations/'+filename,'utf8');
    await db.exec(hosted.replace(/^create extension if not exists http with schema extensions;$/gm,'').replace(/^drop extension if exists pg_net;$/gm,'drop schema net cascade;'));
  }
}
export async function verifySettingsAccess({db,as,denied,scalar,admin,member,other,blocked}) {
  await as('authenticated',member);
  const save="select public.raben_save_preferences($1,$2,$3,$4)";
  await db.query(save,[['posts','poll'],'verdana','#abcdef',20]);
  await db.query(save,[['event'],'serif','#c0ffee',18]);
  assert.equal(Number(await scalar('select count(*) from public.raben_preferences')),1);
  assert.equal(await scalar('select font_size from public.raben_preferences'),18);
  // PostgREST upsert updating all input columns would fail: never broaden this grant.
  await denied('update public.raben_preferences set user_id=$1',[other]);
  await denied(save,[[],'url(evil)','#fff',99]);
  assert.equal(Number(await scalar('select count(*) from public.raben_clan_information')),1);
  assert.equal((await db.query("update public.raben_clan_information set body='Unbefugt' returning id")).rows.length,0);
  await denied('select public.raben_assign_clan_roles($1,null,$2,false,false)',[member,[]]);
  await denied('select public.raben_discord_status()');
  await denied('select * from raben_private.discord_config');
  await denied('select * from raben_private.discord_outbox');
  await denied('select * from vault.decrypted_secrets');
  await denied('select raben_private.dispatch_discord()');
  await as('authenticated',admin);
  assert.equal(Number(await scalar('select count(*) from public.raben_preferences')),0,'Admins cannot read other members preferences');
  await db.query(save,[['reply'],'system','#f0eee8',16]);await db.query(save,[[],'arial','#aaccdd',24]);
  const jarl=await scalar("select id from public.raben_ranks where label='Jarl'"),godi=await scalar("select id from public.raben_ranks where label='Godi'"),smith=await scalar("select id from public.raben_ranks where label='Hofschmied'");
  await db.query('select public.raben_assign_clan_roles($1,$2,$3,true,false)',[member,jarl,[godi,smith]]);
  await db.query('select public.raben_assign_clan_roles($1,$2,$3,false,true)',[member,jarl,[godi]]);
  assert.equal(await scalar('select role from public.raben_memberships where user_id=$1',[member]),'member');
  assert.equal(Number(await scalar('select count(*) from public.raben_member_offices where user_id=$1',[member])),1);
  await denied('select public.raben_assign_clan_roles($1,$2,$3,false,false)',[member,godi,[smith]]);
  assert.equal(await scalar('select rank_id from public.raben_member_ranks where user_id=$1',[member]),jarl,'Invalid assignment rolled back atomically');
  await denied("update public.raben_ranks set category='office' where id=$1",[jarl]);
  await denied('select public.raben_assign_clan_roles($1,$2,$3,false,false)',[blocked,jarl,[]]);
  await db.query("update public.raben_clan_information set body='Interne Claninfos' where id=1");
  assert.equal(await scalar('select revision from public.raben_clan_information'),2);
  const address='https://discord.com/api/webhooks/123456789012345678/'+'A'.repeat(60);
  for(const bad of ['https://evil.test/api/webhooks/123/xxx','https://discord.com.evil.test/api/webhooks/123/xxx','http://discord.com/api/webhooks/123/xxx',address+'?thread_id=123'])await denied('select public.raben_save_discord_webhook($1,true,$2,false)',[bad,['posts']]);
  await db.query('select public.raben_save_discord_webhook($1,true,$2,false)',[address,['posts','event','poll']]);
  const state=await scalar('select public.raben_discord_status()');assert.equal(state.configured,true);assert.ok(!JSON.stringify(state).includes('AAAA'));
  const post=await scalar("insert into public.raben_clan_posts(title,body,category) values('Testhinweis','Interner Text','aushang') returning id");
  const draft=await scalar("insert into public.raben_records(kind,title,body,visibility,details) values('poll','Geheime Abstimmung','Privater Text','draft',$1) returning id",[{options:['A','B']}]);
  await as('postgres',admin);
  assert.equal(Number(await scalar("select count(*) from raben_private.discord_outbox where source_key=$1",[draft])),0);
  await db.query("update raben_private.http_test_response set status=429,content='{"+'"retry_after":120'+"}'");
  await db.query("set timezone='Europe/Berlin'");await db.query('select raben_private.dispatch_discord()');assert.equal(Number(await scalar('select count(*) from raben_private.http_test_calls')),1);
  const request=(await db.query('select * from raben_private.http_test_calls')).rows[0];assert.equal(request.url,address+'?wait=true');assert.equal(request.content_type,'application/json');assert.equal(request.body.allowed_mentions.parse.length,0);assert.ok(!JSON.stringify(request.body).includes('Interner Text'));
  assert.equal(await scalar('select status from raben_private.discord_outbox where source_key=$1',[post]),'pending');
  assert.ok(Number(await scalar('select extract(epoch from next_attempt-now()) from raben_private.discord_outbox where source_key=$1',[post]))>=119);
  await db.query("update raben_private.http_test_response set status=200,content='{}'");await db.query('update raben_private.discord_outbox set next_attempt=now()');await db.query('select raben_private.dispatch_discord()');assert.equal(await scalar('select status from raben_private.discord_outbox where source_key=$1',[post]),'sent');
  assert.equal(await scalar('select attempts from raben_private.discord_outbox where source_key=$1',[post]),2);
  assert.ok(!JSON.stringify((await db.query('select * from raben_private.discord_outbox')).rows).includes(address));
  await as('authenticated',admin);await db.query("update public.raben_records set visibility='clan' where id=$1",[draft]);
  await as('postgres',admin);assert.equal(Number(await scalar("select count(*) from raben_private.discord_outbox where source_key=$1 and status='pending'",[draft])),1);
  await as('authenticated',admin);await db.query("update public.raben_records set visibility='draft' where id=$1",[draft]);
  await as('postgres',admin);assert.equal(Number(await scalar("select count(*) from raben_private.discord_outbox where source_key=$1 and status='pending'",[draft])),0);
  await as('authenticated',admin);await db.query('select public.raben_save_discord_webhook(null,false,$1,true)',[[]]);const cleared=await scalar('select public.raben_discord_status()');assert.equal(cleared.configured,false);
  await as('postgres',admin);assert.equal(Number(await scalar('select count(*) from vault.secrets')),0);
  assert.equal(await scalar("select to_regnamespace('net')"),null);
  for(const actor of [blocked,other]) {await as('authenticated',actor);await denied('select public.raben_save_discord_webhook($1,true,$2,false)',[address,['posts']]);if(actor===blocked){await denied(save,[[],'system','#ffffff',16]);assert.equal(Number(await scalar('select count(*) from public.raben_clan_information')),0);}}
  await as('anon');await denied('select public.raben_save_preferences($1,$2,$3,$4)',[[],'system','#ffffff',16]);await denied('select public.raben_discord_status()');
  console.log('PASS: repeated self-only preference saves, validated typography, private admin preferences, read/edit clan info boundaries, atomic rank/office assignments, no privilege escalation, secret webhook protection, publish-only delivery, withdrawal, HTTP 429 retry and success.');
}
