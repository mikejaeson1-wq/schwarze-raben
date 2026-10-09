import assert from 'node:assert/strict';
export async function verifyImprovements({db,as,denied,scalar,admin,member,other,blocked}) {
 const uuid=n=>'00000000-0000-4000-a000-'+String(n).padStart(12,'0');
 await as('postgres');await db.query("update public.raben_memberships set status='active' where user_id=any($1)",[[admin,member,other]]);
 await as('authenticated',member);
 const reading={heading_font:'fraktur',heading_size:32,heading_color:'#ffddee',heading_effect:'gradient',heading_from:'#aabbcc',heading_to:'#c0ffee',text_effect:'shadow',text_from:'#ffffff',text_to:'#00ff00'};
 const saveReading='select public.raben_save_reading_preferences($1,$2,$3,$4,$5)';
 for(const size of [18,20])await db.query(saveReading,[['posts'],'medieval','#f0eee8',size,reading]);
 assert.deepEqual(await scalar('select reading_style from public.raben_preferences'),reading);
 for(const bad of [{heading_font:'evil'},{heading_size:100},{heading_size:24.5},{heading_effect:'url(x)'},{text_from:'red'},{surprise:true}])await denied(saveReading,[[],'fraktur','#ffffff',16,bad]);
 await as('authenticated',admin);assert.equal((await db.query('select * from public.raben_preferences where user_id=$1',[member])).rows.length,0);
 await as('authenticated',member);
 if(!Number(await scalar('select count(*) from public.raben_profiles where user_id=$1',[member])))await db.query("select public.raben_save_profile('Gestaltetes Profil',null)");
 const banner=member+'/'+uuid(1601)+'.png',background=member+'/'+uuid(1602)+'.webp',picture=member+'/'+uuid(1603)+'.jpg';
 for(const path of [banner,background,picture])await db.query("insert into storage.objects(bucket_id,name) values('raben-profile-media',$1)",[path]);
 const profileRevision=await scalar('select revision from public.raben_profiles where user_id=$1',[member]);
 await db.query('select public.raben_save_profile_banner($1,$2)',[banner,profileRevision]);
 await denied('select public.raben_save_profile_banner(null,$1)',[profileRevision]);
 assert.equal((await db.query("delete from storage.objects where bucket_id='raben-profile-media' and name=$1 returning id",[banner])).rows.length,0);
 const saveEntry='select public.raben_save_designed_profile_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)';
 const gallery=[{image_path:picture,preview_path:null,caption:'DO_NOT_DISPLAY_ORIGINAL.jpg',display_title:'',sort_order:0}];
 const design={theme:'custom',style:{font:'fraktur',text:'#c0ffee',overlay:70},background_path:background,preview_path:null};
 const entry=await scalar(saveEntry,[null,'character','Privates Theme','PRIVATE_NEW_STYLE_SECRET',picture,'private',[],null,{},null,gallery,design]);
 const galleryId=await scalar('select id from public.raben_profile_gallery where item_id=$1',[entry.id]);
 await db.query("insert into public.raben_comments(parent_type,parent_id,body) values('profile_image',$1,'PRIVATE_NEW_COMMENT_SECRET')",[galleryId]);
 await db.query("insert into public.raben_reactions(parent_type,parent_id,emoji) values('profile_image',$1,'like')",[galleryId]);
 for(const actor of [other,admin,blocked]){
  await as('authenticated',actor);
  assert.equal((await db.query('select * from public.raben_profile_styles where item_id=$1',[entry.id])).rows.length,0);
  assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[background])).rows.length,0);
  assert.equal((await db.query('select * from public.raben_comments where parent_id=$1',[galleryId])).rows.length,0);
  await denied("insert into public.raben_comments(parent_type,parent_id,body) values('profile',$1,'Unbefugt')",[entry.id]);
  await denied("insert into public.raben_reactions(parent_type,parent_id,emoji) values('portrait',$1,'like')",[entry.id]);
 }
 await as('authenticated',admin);assert.ok(!JSON.stringify(await scalar('select public.raben_export_content()')).includes('PRIVATE_NEW'));
 await as('authenticated',member);
 const revised=await scalar(saveEntry,[entry.id,'character','Privates Theme','PRIVATE_NEW_STYLE_SECRET',picture,'selected',[other],entry.revision,{},null,gallery,design]);
 assert.equal(await scalar('select id from public.raben_profile_gallery where item_id=$1',[entry.id]),galleryId,'Gallery IDs retain reactions after profile edits');
 assert.equal(Number(await scalar('select count(*) from public.raben_reactions where parent_id=$1',[galleryId])),1);
 await as('authenticated',other);
 assert.equal((await db.query('select * from public.raben_profile_styles where item_id=$1',[entry.id])).rows.length,1);
 assert.equal((await db.query("select name from storage.objects where bucket_id='raben-profile-media' and name=$1",[background])).rows.length,1);
 await db.query("insert into public.raben_comments(parent_type,parent_id,body) values('profile',$1,'Freigegebener Kommentar')",[entry.id]);
 assert.equal((await db.query("update public.raben_profile_gallery set display_title='Hijack' where id=$1 returning id",[galleryId])).rows.length,0);
 await as('authenticated',member);await db.query("update public.raben_profile_gallery set display_title='Am Lagerfeuer' where id=$1",[galleryId]);
 const revisionNow=await scalar('select revision from public.raben_profile_items where id=$1',[entry.id]);assert.ok(revisionNow>revised.revision);
 await scalar(saveEntry,[entry.id,'character','Privates Theme','PRIVATE_NEW_STYLE_SECRET',picture,'private',[],revisionNow,{},null,[{...gallery[0],display_title:'Am Lagerfeuer'}],design]);
 const ownExport=await scalar('select public.raben_export_profile()');assert.equal(ownExport.profile.banner_path,banner);assert.ok(ownExport.styles.some(s=>s.item_id===entry.id));
 await as('authenticated',other);assert.equal((await db.query('select * from public.raben_comments where parent_id=$1',[entry.id])).rows.length,0);
 await as('authenticated',member);await denied('select public.raben_save_profile_style($1,$2,$3,null,null)',[entry.id,'custom',{background:'url(evil)'}]);
 await db.query('delete from public.raben_profile_items where id=$1',[entry.id]);
 await as('postgres');assert.equal(Number(await scalar('select count(*) from public.raben_comments where parent_id=any($1)',[[entry.id,galleryId]])),0);assert.equal(Number(await scalar('select count(*) from public.raben_reactions where parent_id=$1',[galleryId])),0);
 // Anonymous image likes expose aggregates only; comments and private images stay closed.
 await as('authenticated',admin);const publicPath=uuid(1610)+'.png';await db.query("insert into storage.objects(bucket_id,name) values('raben-public',$1)",[publicPath]);
 const publicImage=await scalar("insert into public.raben_records(kind,title,details,visibility) values('gallery','Öffentliches Bild',$1,'public') returning id",[{publicImage:publicPath}]);
 const visitor=uuid(1611);await as('anon');
 const like='select public.raben_public_image_like($1,$2,$3)';
 for(let i=0;i<2;i++)assert.deepEqual(await scalar(like,[publicImage,visitor,true]),{count:1,liked:true});
 await denied('select * from raben_private.public_image_likes');await denied("insert into public.raben_comments(parent_type,parent_id,body) values('record',$1,'Besucherkommentar')",[publicImage]);
 await denied(like,[entry.id,visitor,true]);assert.deepEqual(await scalar(like,[publicImage,visitor,false]),{count:0,liked:false});
 await as('authenticated',admin);await db.query("update public.raben_records set visibility='draft' where id=$1",[publicImage]);
 await as('anon');await denied(like,[publicImage,visitor,true]);
 // Provider identifiers are validated in the database, too.
 await as('authenticated',member);
 for(const spotifyType of ['track','playlist'])await db.query("insert into public.raben_records(kind,title,details) values('media','Spotify',$1)",[{mediaType:'spotify',spotifyType,spotifyId:'4uLU6hMCjMI75M1A2tKUQC'}]);
 for(const details of [{mediaType:'spotify',spotifyType:'album',spotifyId:'4uLU6hMCjMI75M1A2tKUQC'},{mediaType:'spotify',spotifyType:'track',spotifyId:'javascript:alert(1)'},{mediaType:'spotify',spotifyType:'track',spotifyId:'4uLU6hMCjMI75M1A2tKUQC',youtubeId:'M7lc1UVf-VE'},{mediaType:'youtube',youtubeId:'M7lc1UVf-VE',autoplay:'evil'}])await denied("insert into public.raben_records(kind,title,details) values('media','Ungültig',$1)",[details]);
 await db.query("insert into public.raben_records(kind,title,details) values('media','Autoplay',$1)",[{mediaType:'youtube',youtubeId:'M7lc1UVf-VE',autoplay:'true'}]);
 // Saving the same webhook preserves queued tests and no-op announcements.
 await as('authenticated',admin);const address='https://discord.com/api/webhooks/123456789012345678/'+'A'.repeat(60)+'?thread_id=123456789012345678';
 const saveHook='select public.raben_save_discord_webhook($1,true,$2,false)';await db.query(saveHook,[address,['posts','event','poll']]);
 await db.query('select public.raben_discord_test()');
 const post=await scalar("insert into public.raben_clan_posts(title,body,category) values('Wartender Hinweis','Text','aushang') returning id");
 await as('postgres');const configRev=await scalar('select revision from raben_private.discord_config');const pendingBefore=await scalar("select count(*)::int from raben_private.discord_outbox where status='pending'");
 await as('authenticated',admin);await db.query(saveHook,[null,['poll','event','posts']]);await db.query(saveHook,[address.replace('discord.com','discordapp.com'),['posts','event','poll']]);
 await db.query("update public.raben_clan_posts set title=title where id=$1",[post]);
 assert.deepEqual(await scalar('select public.raben_discord_check()'),{ok:true,status:200});
 await as('postgres');assert.equal(await scalar('select revision from raben_private.discord_config'),configRev);assert.equal(await scalar("select count(*)::int from raben_private.discord_outbox where status='pending'"),pendingBefore);
 await db.query('select raben_private.dispatch_discord()');assert.ok((await scalar('select url from raben_private.http_test_calls order by ctid desc limit 1')).endsWith('&wait=true'));
 await as('authenticated',member);await denied('select public.raben_discord_check()');
 // Admin branding is publicly readable, revision checked and protected from cleanup.
 await denied('select public.raben_save_emblem($1,1)',[publicPath]);
 await as('authenticated',admin);const brand=await scalar('select public.raben_save_emblem($1,1)',[publicPath]);assert.equal(brand.image_path,publicPath);await denied('select public.raben_save_emblem(null,1)');
 assert.equal((await db.query("delete from storage.objects where bucket_id='raben-public' and name=$1 returning id",[publicPath])).rows.length,0);
 await as('anon');assert.equal(await scalar('select image_path from public.raben_branding'),publicPath);await denied('select public.raben_save_emblem(null,2)');
 console.log('PASS: personal heading/text effects, private themes/banners, gallery ID retention and title ownership, private reaction/comment ACLs and cleanup, anonymous aggregate-only likes, Spotify/autoplay validation, unchanged webhook queue preservation, endpoint checks and admin-only replaceable emblems.');
}
