import assert from 'node:assert/strict';
export async function verifyAccounts(db,{as,denied,scalar,admin,member,other,blocked}){
 const peer='00000000-0000-4000-a000-000000000005';
 const path=member+'/00000000-0000-4000-a000-000000000210.webp';
 const privatePath=member+'/00000000-0000-4000-a000-000000000211.png';
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='active' where user_id=$1",[other]);
 await as('authenticated',member);
 await db.query("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1),('raben-profile-media',$2)",[path,privatePath]);
 const before=await scalar('select revision::text from public.raben_profiles where user_id=$1',[member]);
 const saved=await scalar('select public.raben_save_account($1,$2,$3)',['  Hrafn vom Eis  ',path,before]);
 assert.equal(saved.display_name,'Hrafn vom Eis');assert.equal(saved.avatar_path,path);
 await denied('select public.raben_save_account($1,$2,$3)',['Veralteter Name',null,before]);
 // An account nickname cannot change membership status, Discord identity or roles.
 assert.equal((await db.query("update public.raben_memberships set role='admin' where user_id=$1 returning user_id",[member])).rows.length,0);
 await denied("update public.raben_memberships set discord_id='999999999999999999' where user_id=$1",[member]);
 const privateItem=await scalar("select public.raben_save_profile_item(null,'avatar','Persönliches Bild','',$1,'private','{}',null)",[privatePath]);
 assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,0,'Referenced account picture retained');
 for(const viewer of [other,peer,admin]){
  await as('authenticated',viewer);
  assert.equal(await scalar('select display_name from public.raben_profiles where user_id=$1',[member]),'Hrafn vom Eis');
  assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[path])).rows.length,1,'Active clan can read account picture');
  assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[privatePath])).rows.length,0,'Private portrait remains private even for another admin');
  assert.equal((await db.query('update public.raben_profiles set display_name=$1,avatar_path=null where user_id=$2 returning user_id',['Fremder Alias',member])).rows.length,0);
  assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,0,'Only owner may remove account picture');
 }
 await as('authenticated',other);
 await denied('select public.raben_save_account($1,$2,null)',['Fremdes Bild',path]);
 await as('anon');await denied('select public.raben_save_account($1,$2,null)',['Gast',null]);await denied('select * from public.raben_profiles');
 assert.equal((await db.query("select name from storage.objects where name=$1",[path])).rows.length,0);
 await as('authenticated',blocked);await denied('select public.raben_save_account($1,$2,null)',['Gesperrt',null]);
 assert.equal((await db.query("select name from storage.objects where name=$1",[path])).rows.length,0);
 await as('postgres');await db.query("update public.raben_memberships set status='pending' where user_id=$1",[blocked]);
 await as('authenticated',blocked);await denied('select public.raben_save_account($1,$2,null)',['Wartend',null]);
 assert.equal((await db.query("select name from storage.objects where name=$1",[path])).rows.length,0);
 await as('authenticated',member);
 const absentPath=member+'/00000000-0000-4000-a000-000000000212.webp';
 await denied('select public.raben_save_account($1,$2,$3)',['Bild fehlt',absentPath,saved.revision]);
 await denied('select public.raben_save_account($1,$2,$3)',['Pfad ungültig',member+'/../avatar.png',saved.revision]);
 await denied('select public.raben_save_account($1,$2,$3)',['   ',path,saved.revision]);
 // Legacy name-only edit must preserve the account picture.
 const renamed=await scalar('select public.raben_save_profile($1,$2)',['Eisrabe',saved.revision]);assert.equal(renamed.avatar_path,path);
 await as('authenticated',admin);
 const exported=await scalar('select public.raben_export_content()');assert.ok(!JSON.stringify(exported).includes(privatePath));assert.ok(!JSON.stringify(exported).includes('Eisrabe'),'Private profile tables excluded from general backups');
 await db.query("update public.raben_memberships set status='blocked' where user_id=$1",[member]);
 await as('authenticated',other);assert.equal((await db.query("select name from storage.objects where name=$1",[path])).rows.length,0,'Blocking the owner revokes account picture access');
 assert.equal((await db.query('select user_id from public.raben_profiles where user_id=$1',[member])).rows.length,0);
 await as('authenticated',member);await denied('select public.raben_save_account($1,$2,$3)',['Gesperrter Eigentümer',null,renamed.revision]);
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='active' where user_id=$1",[member]);
 await as('authenticated',member);
 const removed=await scalar('select public.raben_save_account($1,null,$2)',['Eisrabe',renamed.revision]);assert.equal(removed.avatar_path,null);
 assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,1,'Detached account picture may be removed');
 assert.equal((await db.query('select id from public.raben_profile_items where id=$1',[privateItem.id])).rows.length,1,'Removing account portrait leaves private items intact');
 console.log('PASS: account alias/avatar ownership, clan image access, retained private portraits, no role escalation, blocked/pending/anonymous access, stale edits, file validation and cleanup.');
}
