import assert from 'node:assert/strict';
export async function verifyProfiles(db,{as,denied,scalar,admin,member,other,blocked}){
 const peer='00000000-0000-4000-a000-000000000005',pending='00000000-0000-4000-a000-000000000006';
 await as('postgres');
 for(const [id,state] of [[peer,'active'],[pending,'pending']]){
  await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query("insert into public.raben_memberships(user_id,discord_id,display_name,status) values($1,$2,'Profile test',$3)",[id,'12345678901234567'+id.slice(-1),state]);
 }
 const historyBefore=await scalar('select count(*)::int from public.raben_content_versions');
 assert.equal(await scalar("select public from storage.buckets where id='raben-profile-media'"),false);
 assert.equal(Number(await scalar("select file_size_limit from storage.buckets where id='raben-profile-media'")),50*1024*1024);
 assert.deepEqual(await scalar("select allowed_mime_types from storage.buckets where id='raben-profile-media'"),['image/jpeg','image/png','image/webp']);
 // Simulate another application's broad permissive policies. Ours must still win.
 await db.exec(`grant select on storage.objects to anon;grant update on storage.objects to authenticated;
 create policy unrelated_read_all on storage.objects for select to anon,authenticated using(true);
 create policy unrelated_create_all on storage.objects for insert to authenticated with check(true);
 create policy unrelated_delete_all on storage.objects for delete to authenticated using(true);
 create policy unrelated_update_all on storage.objects for update to authenticated using(true) with check(true);`);
 await as('authenticated',member);
 const profile=await scalar('select public.raben_save_profile($1,null)',['Rabe mit eigenem Profil']);
 assert.equal(profile.user_id,member);assert.equal(profile.revision,1);
 await denied('select public.raben_save_profile($1,null)',['Doppeltes Profil']);
 await denied('select public.raben_save_profile($1,999)',['Konflikt']);
 const core=await scalar('select public.raben_save_profile($1,1)',['Eigener Profilname']);assert.equal(core.revision,2);
 const avatarPath=member+'/00000000-0000-4000-a000-000000000801.png';
 const charPath=member+'/00000000-0000-4000-a000-000000000802.webp';
 const unusedPath=member+'/00000000-0000-4000-a000-000000000803.jpg';
 for(const path of [avatarPath,charPath,unusedPath])await db.query("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1)",[path]);
 await denied("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1)",[other+'/00000000-0000-4000-a000-000000000804.png']);
 await denied("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1)",[member+'/bad.png']);
 await denied("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1)",[member+'/00000000-0000-4000-a000-000000000804.mp3']);
 const saveItem=(id,kind,title,body,path,visibility,recipients=[],revision=null)=>scalar('select public.raben_save_profile_item($1,$2,$3,$4,$5,$6,$7,$8)',[id,kind,title,body,path,visibility,recipients,revision]);
 const secret=await saveItem(null,'info','Persönliche Notiz','PRIVATE_PROFILE_SECRET_NEVER_IN_ADMIN_BACKUPS',null,'private');
 const avatar=await saveItem(null,'avatar','Profilbild','',avatarPath,'private');
 const clan=await saveItem(null,'character','Für den Clan','Clan-Steckbrief',null,'clan');
 const selected=await saveItem(null,'character','Gemeinsames Geheimnis','SELECTED_SECRET',charPath,'selected',[other]);
 const implicit=await scalar("insert into public.raben_profile_items(kind,title) values('info','Standard ist privat') returning visibility");assert.equal(implicit,'private');
 await denied('select public.raben_save_profile_item(null,$1,$2,$3,null,$4,$5,null)',['info','Ohne Empfänger','','selected',[]]);
 await denied('select public.raben_save_profile_item(null,$1,$2,$3,null,$4,$5,null)',['info','Gesperrter Empfänger','','selected',[blocked]]);
 await denied('select public.raben_save_profile_item(null,$1,$2,$3,null,$4,$5,null)',['info','Noch kein Mitglied','','selected',[pending]]);
 await denied('select public.raben_save_profile_item(null,$1,$2,$3,null,$4,$5,null)',['info','Eigenes Konto','','selected',[member]]);
 await denied('select public.raben_save_profile_item(null,$1,$2,$3,$4,$5,$6,null)',['character','Fremdes Bild','',other+'/00000000-0000-4000-a000-000000000801.png','private',[]]);
 assert.equal((await db.query("delete from storage.objects where bucket_id='raben-profile-media' and name=$1 returning name",[avatarPath])).rows.length,0,'An attached image is retained');
 assert.equal((await db.query("update storage.objects set name='moved.png' where bucket_id='raben-profile-media' returning id")).rows.length,0,'Profile images cannot be overwritten or moved');
 for(const [viewer,expected] of [[member,5],[other,2],[peer,1],[admin,1],[blocked,0],[pending,0]]){
  await as('authenticated',viewer);
  assert.equal((await db.query('select id from public.raben_profile_items where owner_id=$1',[member])).rows.length,expected,'visibility for '+viewer);
  const paths=(await db.query("select name from storage.objects where bucket_id='raben-profile-media'")).rows.map(r=>r.name);
  assert.equal(paths.includes(avatarPath),viewer===member,'Private avatar has no admin override');
  assert.equal(paths.includes(charPath),[member,other].includes(viewer),'Selected image follows the same grant');
  assert.equal(paths.includes(unusedPath),viewer===member,'Unattached images are owner-only');
  if(viewer!==member){
   assert.equal((await db.query('update public.raben_profiles set display_name=$1 where user_id=$2 returning user_id',['Hijack',member])).rows.length,0);
   assert.equal((await db.query("update public.raben_profile_items set body='Hijack' where id=$1 returning id",[clan.id])).rows.length,0);
   assert.equal((await db.query('delete from public.raben_profile_items where id=$1 returning id',[clan.id])).rows.length,0);
   assert.equal((await db.query("delete from storage.objects where bucket_id='raben-profile-media' and name=$1 returning id",[charPath])).rows.length,0);
  }
 }
 await as('authenticated',admin);
 const backup=await scalar('select public.raben_export_content()');
 assert.ok(!JSON.stringify(backup).includes('PRIVATE_PROFILE_SECRET'));assert.ok(!JSON.stringify(backup).includes('SELECTED_SECRET'));
 assert.ok(!(await scalar('select public.raben_storage_inventory()')).some(f=>f.bucket==='raben-profile-media'));
 assert.equal(await scalar('select count(*)::int from public.raben_content_versions'),historyBefore);
 await as('anon');await denied('select * from public.raben_profiles');await denied('select * from public.raben_profile_items');
 assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media'")).rows.length,0);
 await denied("select public.raben_save_profile('Anonymous',null)");
 await as('authenticated',pending);await denied("select public.raben_save_profile('Pending',null)");
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='active' where user_id=$1",[pending]);
 await as('authenticated',pending);assert.equal((await scalar("select public.raben_save_profile('Angenommener Rabe',null)")).user_id,pending);
 await as('authenticated',member);
 await denied('update public.raben_profiles set user_id=$1 where user_id=$2',[other,member]);
 await denied('update public.raben_profile_items set owner_id=$1 where id=$2',[other,secret.id]);
 await denied('insert into public.raben_profile_grants(item_id,owner_id,grantee_id) values($1,$2,$3)',[selected.id,other,peer]);
 const revoked=await saveItem(selected.id,'character',selected.title,selected.body,charPath,'private',[],selected.revision);
 assert.equal(revoked.revision,2);
 await denied('select public.raben_save_profile_item($1,$2,$3,$4,$5,$6,$7,$8)',[selected.id,'character','Stale','',charPath,'clan',[],selected.revision]);
 assert.equal(await scalar('select count(*)::int from public.raben_profile_grants where item_id=$1',[selected.id]),0);
 await as('authenticated',other);assert.equal((await db.query('select id from public.raben_profile_items where id=$1',[selected.id])).rows.length,0);
 assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[charPath])).rows.length,0);
 await as('authenticated',member);
 const sharedAvatar=await saveItem(avatar.id,'avatar',avatar.title,'',avatarPath,'clan',[],avatar.revision);
 await as('authenticated',peer);assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[avatarPath])).rows.length,1);
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='blocked' where user_id=$1",[member]);
 await as('authenticated',other);assert.equal((await db.query('select id from public.raben_profile_items where owner_id=$1',[member])).rows.length,0);
 assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[avatarPath])).rows.length,0,'Blocking the profile owner revokes image access');
 await as('authenticated',member);assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media'")).rows.length,0);
 await denied("select public.raben_save_profile('Blocked owner',2)");
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='active' where user_id=$1",[member]);
 await as('authenticated',member);await saveItem(sharedAvatar.id,'avatar','Profilbild','',avatarPath,'selected',[other],sharedAvatar.revision);
 await as('authenticated',admin);await db.query("update public.raben_memberships set status='blocked' where user_id=$1",[other]);
 await as('authenticated',other);assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[avatarPath])).rows.length,0,'Blocking a recipient revokes image access');
 await as('authenticated',member);
 assert.equal((await db.query("delete from storage.objects where bucket_id='raben-profile-media' and name=$1 returning name",[unusedPath])).rows.length,1);
 await db.query('delete from public.raben_profile_items where id=$1',[avatar.id]);
 assert.equal(await scalar('select count(*)::int from public.raben_profile_grants where item_id=$1',[avatar.id]),0,'Deleting an item removes grants');
 assert.equal((await db.query("delete from storage.objects where bucket_id='raben-profile-media' and name=$1 returning name",[avatarPath])).rows.length,1);
 console.log('PASS: profiles private/clan/selected, avatar and character image ACLs, no admin override or backup leak, pending/blocked access, grant revocation, optimistic conflicts, ownership, immutable files and restrictive guards against unrelated storage policies.');
}
