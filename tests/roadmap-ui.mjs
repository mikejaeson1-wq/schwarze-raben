import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const id=n=>'00000000-0000-4000-a000-'+String(n).padStart(12,'0');
const lead={user_id:id(1),status:'active',role:'admin',display_name:'Test-Admin'};
const member={user_id:id(2),status:'active',role:'member',display_name:'Test-Mitglied'};
const friend={user_id:id(3),status:'active',role:'member',display_name:'Test-Freund'};
const videoId=id(20),audioId=id(21),characterId=id(22),journalId=id(23);
const privateAudio=member.user_id+'/'+id(90)+'.mp3',releasedAudio=id(91)+'.mp3';
const fixtures=[
 {id:videoId,kind:'media',title:'Video aus dem Norden',body:'<img src=x onerror=evil()>',details:{mediaType:'youtube',youtubeId:'M7lc1UVf-VE'},visibility:'public',created_by:lead.user_id,revision:1},
 {id:audioId,kind:'media',title:'Interne Aufnahme',body:'Ein eigener RP-Text',details:{mediaType:'mp3',audioPath:privateAudio,fileName:'raben.mp3'},visibility:'clan',created_by:member.user_id,revision:1},
 {id:characterId,kind:'character',title:'Testcharakter',body:'Test-Steckbrief',details:{mediaIds:[videoId,audioId],relatedIds:[journalId],story:'Reise nach Norden'},visibility:'clan',created_by:member.user_id,revision:1},
 {id:journalId,kind:'journal',title:'Tagebuch zur Reise',body:'Ein interner Bericht',details:{date:'2026-10-07',story:'Reise nach Norden',relatedIds:[characterId]},visibility:'clan',created_by:member.user_id,revision:1},
 {id:id(24),kind:'knowledge',title:'Wichtige Absprachen',body:'Angeheftet',details:{category:'RP',pinned:true},visibility:'clan',created_by:lead.user_id,revision:1}
];
const wait=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setTimeout(resolve,0));};
async function setup(actor,mode='member',personalData=null){
 const {document,Event,CustomEvent,HTMLSelectElement}=parseHTML('<html><body><main id="root"></main></body></html>');
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options)o.removeAttribute('selected');[...this.options].find(o=>o.value===String(value))?.setAttribute('selected','');}});
 let currentActor=actor;const calls=[],copies=[],transfers=[],downloads=[],exports=[],events=new Map();
 const data={raben_records:structuredClone(fixtures),raben_memberships:[lead,member],raben_site_content:[{id:1,revision:1,content:{name:'Schwarze Raben',extraInfos:[]}}],raben_content_versions:[{id:id(100),source_table:'raben_records',entity_key:characterId,kind:'character',title:'Alter Testcharakter',revision:1,operation:'insert',actor_name:'Test-Mitglied',changed_at:'2026-10-07T20:00:00Z',snapshot:{...fixtures[2],title:'Frühere Fassung'}}],raben_applications:[],raben_character_notes:[],raben_event_responses:[],raben_poll_votes:[],raben_task_claims:[],raben_clan_posts:[]};
 data.raben_memberships.push(friend);data.raben_profiles=[];data.raben_profile_items=[];data.raben_profile_grants=[];
 if(personalData)for(const name of ['raben_profiles','raben_profile_items','raben_profile_grants'])data[name]=structuredClone(personalData[name]);
 const files=new Map([['raben-media/'+privateAudio,new Blob([new Uint8Array([73,68,51,0])],{type:'audio/mpeg'})],['raben-public/'+releasedAudio,new Blob([new Uint8Array([73,68,51,0])],{type:'audio/mpeg'})]]);
 const inventory=()=>[...files].map(([key,blob])=>({bucket:key.split('/')[0],name:key.slice(key.indexOf('/')+1),size:blob.size,type:blob.type,used:key.endsWith(privateAudio),records:key.endsWith(privateAudio)?[{id:audioId,title:'Interne Aufnahme',kind:'media'}]:[],historyCount:0,website:false}));
 const value=(r,key)=>key.includes('->')?r.details?.[key.split(/->>?/)[1]]:r[key];
 const sb={auth:{getSession:async()=>({data:{session:currentActor?{access_token:'test-token'}:null},error:null})},from(table){
  const filters=[],orders=[];let operation='read',payload,offset=0,end=999,head=false,columns='*';
  const visible=r=>{
   if(table==='raben_profiles')return currentActor?.status==='active';
   if(table==='raben_profile_grants')return currentActor?.status==='active'&&(r.owner_id===currentActor.user_id||r.grantee_id===currentActor.user_id);
   if(table==='raben_profile_items')return currentActor?.status==='active'&&(r.owner_id===currentActor.user_id||r.visibility==='clan'||r.visibility==='selected'&&data.raben_profile_grants.some(g=>g.item_id===r.id&&g.grantee_id===currentActor.user_id));
   return table!=='raben_records'||r.visibility==='public'||currentActor?.status==='active'&&(currentActor.role==='admin'||r.visibility==='clan'||r.created_by===currentActor.user_id);
  };
  const query={
   select(c='*',options={}){columns=c;head=options.head;return query;},eq(k,v){filters.push(r=>value(r,k)===v);return query;},neq(k,v){filters.push(r=>value(r,k)!==v);return query;},in(k,values){filters.push(r=>values.includes(value(r,k)));return query;},not(k,_op,v){filters.push(r=>value(r,k)!=null);return query;},gte(k,v){filters.push(r=>value(r,k)>=v);return query;},lt(k,v){filters.push(r=>value(r,k)<v);return query;},contains(k,values){filters.push(r=>values.every(v=>value(r,k)?.includes(v)));return query;},ilike(k,text){filters.push(r=>String(value(r,k)||'').toLowerCase().includes(text.replaceAll('%','').toLowerCase()));return query;},textSearch(_k,text){filters.push(r=>(r.title+' '+r.body).toLowerCase().includes(text.toLowerCase()));return query;},order(k,options={}){orders.push([k,options]);return query;},range(a,b){offset=a;end=b;return query;},limit(n){end=n-1;return query;},insert(v){operation='insert';payload=v;return query;},update(v){operation='update';payload=v;return query;},delete(){operation='delete';return query;},single:async()=>{const r=await execute();return {...r,data:r.data?.[0]||null};},then(resolve,reject){return execute().then(resolve,reject);}
  };
  async function execute(){
   calls.push({table,operation,columns});
   if(table==='raben_content_versions'&&currentActor?.role!=='admin')return {data:[],count:0,error:null};
   if(!currentActor&&columns.includes('created_by'))return {error:{code:'42501'},data:null};
   let rows=(data[table]||[]).filter(visible).filter(r=>filters.every(f=>f(r)));
   if(operation==='insert'){const row={id:id(200+data.raben_records.length),created_by:currentActor.user_id,revision:1,...payload};data[table].push(row);rows=[row];}
   if(operation==='update')rows.forEach(r=>Object.assign(r,payload,{revision:(r.revision||0)+1}));
   if(operation==='delete')data[table]=data[table].filter(r=>!rows.includes(r));
   for(const [key,options] of [...orders].reverse())rows.sort((a,b)=>{const x=value(a,key),y=value(b,key);if(x==null)return 1;if(y==null)return -1;return (x<y?-1:x>y?1:0)*(options.ascending===false?-1:1);});
   return {data:head?null:structuredClone(rows.slice(offset,end+1)),count:rows.length,error:null};
  }return query;
 },async rpc(name,args={}){
  calls.push({rpc:name,args});if(['raben_storage_inventory','raben_export_content','raben_restore_version','raben_restore_backup_item'].includes(name)&&currentActor?.role!=='admin')return {error:{code:'42501'}};
  if(name==='raben_storage_inventory')return {data:inventory(),error:null};
  if(name==='raben_save_profile'||name==='raben_save_account'){
   let row=data.raben_profiles.find(p=>p.user_id===currentActor.user_id);
   if(!row){row={user_id:currentActor.user_id,revision:0};data.raben_profiles.push(row);}
   Object.assign(row,{display_name:args.p_name,revision:row.revision+1,...(name==='raben_save_account'?{avatar_path:args.p_avatar_path}:{})});return {data:structuredClone(row),error:null};
  }
  if(name==='raben_save_profile_item'){
   let row=data.raben_profile_items.find(p=>p.id===args.p_id);
   if(!row){row={id:id(500+data.raben_profile_items.length),owner_id:currentActor.user_id,revision:0,created_at:'2026-10-08T09:00:00Z'};data.raben_profile_items.push(row);}
   Object.assign(row,{kind:args.p_kind,title:args.p_title,body:args.p_body,image_path:args.p_image_path,visibility:args.p_visibility,revision:row.revision+1});
   data.raben_profile_grants=data.raben_profile_grants.filter(g=>g.item_id!==row.id);
   if(args.p_visibility==='selected')for(const grantee_id of args.p_recipients)data.raben_profile_grants.push({item_id:row.id,owner_id:row.owner_id,grantee_id});
   return {data:structuredClone(row),error:null};
  }
  if(name==='raben_export_content')return {data:{application:'schwarze-raben',schemaVersion:1,siteContent:data.raben_site_content[0],records:data.raben_records,posts:[],notes:[],versions:data.raben_content_versions,files:inventory()},error:null};
  if(name==='raben_restore_version'){const version=data.raben_content_versions.find(v=>v.id===args.p_version),row=data.raben_records.find(r=>r.id===version.entity_key);if(String(row.revision)!==args.p_expected)return {error:{message:'record_conflict'}};Object.assign(row,version.snapshot,{revision:row.revision+1,visibility:'draft'});return {data:{source:version.source_table},error:null};}
  return {data:[],error:null};
 },storage:{from(bucket){return {
  getPublicUrl:path=>({data:{publicUrl:'https://test.supabase.co/storage/v1/object/public/'+bucket+'/'+path}}),
  download:async path=>{downloads.push({bucket,path});if(bucket==='raben-media'&&currentActor?.status!=='active')return {error:{code:'42501'}};const blob=files.get(bucket+'/'+path);return blob?{data:blob,error:null}:{error:{message:'missing_file'}};},
  copy:async(path,target,options)=>{copies.push({bucket,path,target,options});files.set(options.destinationBucket+'/'+target,files.get(bucket+'/'+path));return {data:{path:target},error:null};},
  remove:async paths=>({data:paths.filter(path=>{const key=bucket+'/'+path;if(key.endsWith(privateAudio))return false;return files.delete(key);}).map(name=>({name})),error:null})
 };}}};
 document.body.addEventListener('click',event=>{if(event.target.tagName==='A'&&event.target.download)exports.push({name:event.target.download,url:event.target.href});});
 const context={document,Event,CustomEvent,console,URL,Intl,Date,Math,Uint8Array,Blob,File,TextEncoder,crypto:globalThis.crypto,structuredClone,setTimeout:(fn,delay)=>{const timer=setTimeout(fn,delay);timer.unref();return timer;},setInterval:()=>0,confirm:()=>true,
  location:{href:'https://example.com/'+(mode==='public'?'entdecken.html':'clan.html'),origin:'https://example.com'},
  addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},dispatchEvent:event=>{for(const fn of events.get(event.type)||[])fn(event);},
  Raben:{el:(tag,classes='',text='')=>{const element=document.createElement(tag);element.className=classes;element.textContent=text;return element;},check:async result=>{const r=await result;if(r.error)throw r.error;return r.data;},client:()=>sb,member:async()=>currentActor,config:{siteUrl:'https://example.com/',supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'test-key'},errorMessage:()=> 'Keine Rechte oder Fehler.',imageUrl:value=>value||''},
  tus:{Upload:class{
   constructor(file,options){this.file=file;this.options=options;transfers.push(this);}
   async start(){try{await this.options.onBeforeRequest({setHeader(){}});this.options.onProgress(this.file.size,this.file.size);files.set(this.options.metadata.bucketName+'/'+this.options.metadata.objectName,this.file);this.options.onSuccess();}catch(error){this.options.onError(error);}}
   async abort(){this.aborted=true;}
  }}
 };context.window=context;const sandbox=vm.createContext(context);
 for(const name of ['vendor/fflate-0.8.3.js','media.js','identity.js','history.js','profiles.js','community.js'])vm.runInContext(await readFile(name,'utf8'),sandbox);
 const root=document.getElementById('root');const hubContext=await (mode==='public'?context.RabenHub.mountPublic(root):mode==='admin'?context.RabenHub.mountAdmin(root,actor):context.RabenHub.mountMember(root,actor));await wait();
 const click=async text=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===text&&!b.disabled);assert.ok(b,'Button: '+text);b.click();await wait();return b;};
 return {context,sandbox,document,Event,root,hubContext,data,files,calls,copies,transfers,downloads,exports,click,setActor:value=>{currentActor=value;}};
}
const visitor=await setup(null,'public');
assert.equal(visitor.root.querySelector('iframe'),null);assert.equal(visitor.root.querySelector('img'),null,'Text is never interpreted as HTML');
await visitor.click('Video laden');assert.match(visitor.root.querySelector('iframe').src,/^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
assert.equal(visitor.root.querySelector('audio'),null);assert.ok(!visitor.root.textContent.includes('Interne Aufnahme'));assert.ok(!visitor.calls.some(c=>c.table==='raben_content_versions'||c.rpc==='raben_export_content'));
assert.equal(visitor.context.RabenMedia.youtubeId('https://youtu.be/M7lc1UVf-VE?t=5'),'M7lc1UVf-VE');
for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://example.com/M7lc1UVf-VE','https://user:pass@youtube.com/watch?v=M7lc1UVf-VE'])assert.equal(visitor.context.RabenMedia.youtubeId(link),'');
const own=await setup(member);await own.click('Medien');await own.click('Aufnahme laden');assert.equal(own.downloads[0].path,privateAudio);assert.match(own.root.querySelector('audio').src,/^blob:/);
await own.click('Charakterbuch');assert.ok(own.root.textContent.includes('Video aus dem Norden'));assert.ok(own.root.textContent.includes('Interne Aufnahme'));
await own.click('Bearbeiten');await wait();const selected=own.root.querySelector('.reference-order');assert.equal(selected.children.length,2);
const down=[...selected.querySelectorAll('button')].find(b=>b.textContent==='↓'&&!b.disabled);down.click();
let form=own.root.querySelector('.hub-editor');form.querySelector('input[type="text"]').value='Charakter geändert';form.dispatchEvent(new own.Event('submit'));await wait();
assert.deepEqual([...own.data.raben_records.find(r=>r.id===characterId).details.mediaIds],[audioId,videoId]);assert.equal(own.data.raben_records.find(r=>r.id===characterId).title,'Charakter geändert');
await own.click('Geschichte: Reise nach Norden');assert.ok(own.root.textContent.includes('Tagebuch zur Reise'));assert.ok(own.root.textContent.includes('Charakter geändert'));
await own.click('Medien');await own.click('Neu erstellen');form=own.root.querySelector('.hub-editor');form.querySelector('input[type="text"]').value='Meine MP3';form.querySelector('[data-hub-field="mediaType"]').value='mp3';form.querySelector('[data-hub-field="mediaType"]').dispatchEvent(new own.Event('change'));
const mp3=new File([new Uint8Array([73,68,51,0,1,2,3])],'lied.mp3',{type:'audio/mpeg'}),input=[...form.querySelectorAll('input[type="file"]')].find(element=>element.accept==='.mp3,audio/mpeg');Object.defineProperty(input,'files',{value:[mp3],configurable:true});form.dispatchEvent(new own.Event('submit'));await wait();
const uploaded=own.data.raben_records.find(r=>r.title==='Meine MP3');assert.equal(uploaded.details.mediaType,'mp3');assert.ok(uploaded.details.audioPath.startsWith(member.user_id+'/'));assert.equal(own.transfers[0].options.chunkSize,6*1024*1024);assert.equal(own.transfers[0].options.storeFingerprintForResuming,false);assert.equal(form.querySelector('progress').value,100);
await assert.rejects(()=>own.context.RabenMedia.validateFile(new File(['text'],'falsch.mp3'),true));
own.setActor({...member,status:'blocked'});own.context.dispatchEvent(new own.Event('raben-lock'));assert.equal(own.root.querySelector('audio'),null);assert.equal(own.root.querySelector('.hub-editor'),null);
const admin=await setup(lead,'admin');assert.ok(admin.root.textContent.includes('Clan-Speicher'));assert.ok(admin.root.querySelector('[data-kind="history"]'));
await admin.click('Medien');await admin.click('Bearbeiten');form=admin.root.querySelector('.hub-editor');const visibility=[...form.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='public'));visibility.value='public';form.dispatchEvent(new admin.Event('submit'));await wait();
// Publish the internal audio through its own editor; public copy stays separate.
await admin.click('Schließen');const audioCard=admin.root.querySelector('[data-record-id="'+audioId+'"]');[...audioCard.querySelectorAll('button')].find(b=>b.textContent==='Bearbeiten').click();await wait();form=admin.root.querySelector('.hub-editor');[...form.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='public')).value='public';form.dispatchEvent(new admin.Event('submit'));await wait();
assert.equal(admin.copies.find(c=>c.path===privateAudio).options.destinationBucket,'raben-public');assert.equal(admin.data.raben_records.find(r=>r.id===audioId).visibility,'public');
await admin.click('Versionen');assert.ok(admin.root.textContent.includes('Alter Testcharakter'));await admin.click('Wiederherstellen');assert.equal(admin.data.raben_records.find(r=>r.id===characterId).visibility,'draft');assert.equal(admin.data.raben_records.find(r=>r.id===characterId).title,'Frühere Fassung');
await admin.click('Speicher');assert.ok(admin.root.textContent.includes('Clan-Dateien'));assert.ok(admin.root.textContent.includes('geschützt vor dem Aufräumen'));
await admin.click('Sicherung');assert.ok(admin.root.textContent.includes('Inhalte und Dateien als ZIP sichern'));assert.ok(admin.root.textContent.includes('Originaldatei auswählen'));

await admin.click('Inhalte als JSON sichern');assert.ok(admin.exports.some(e=>e.name.endsWith('.json')));
await admin.click('Inhalte und Dateien als ZIP sichern');assert.ok(admin.exports.some(e=>e.name.endsWith('.zip')));
const importInput=admin.root.querySelector('input[accept=".json,application/json"]')||[...admin.root.querySelectorAll('input[type="file"]')].find(e=>e.accept==='.json,application/json');
const importFile=new File([JSON.stringify({application:'schwarze-raben',schemaVersion:1,records:[fixtures[2]],files:[]})],'backup.json',{type:'application/json'});
Object.defineProperty(importInput,'files',{value:[importFile],configurable:true});importInput.dispatchEvent(new admin.Event('change'));await wait();
const importChoices=admin.root.querySelector('select[aria-label="Inhalt zur Wiederherstellung auswählen"]');importChoices.value='0';importChoices.dispatchEvent(new admin.Event('change'));await admin.click('Ausgewählten Inhalt wiederherstellen');
const restoreRequest=admin.calls.find(c=>c.rpc==='raben_restore_backup_item');assert.equal(restoreRequest.args.p_key,characterId);assert.equal(restoreRequest.args.p_backup.records.length,1);assert.equal(restoreRequest.args.p_backup.memberships,undefined);
fixtures.push({id:id(25),kind:'media',title:'Öffentliche Aufnahme',body:'',details:{mediaType:'mp3',audioPath:privateAudio,publicAudio:releasedAudio},visibility:'public',created_by:lead.user_id,revision:1});
const publicAudio=await setup(null,'public');assert.match(publicAudio.root.querySelector('audio').src,/\/object\/public\/raben-public\//);assert.equal(publicAudio.downloads.length,0);
const ordinary=await setup(member);assert.equal(ordinary.root.querySelector('[data-kind="history"]'),null);assert.equal(ordinary.root.querySelector('[data-kind="backup"]'),null);
console.log('PASS: click-to-load YouTube, safe URLs/text, private MP3 playback, ordered attachments, RP story links, MP3 upload/progress, admin publication, history restore, storage, backup UI and logout clearing.');
const personal=await setup(member);assert.equal(personal.root.querySelector('[data-kind="profiles"]').getAttribute('aria-selected'),'true');
await personal.click('Mein Profil erstellen');let profileForm=personal.root.querySelector('.profile-editor');profileForm.querySelector('input').value='Mein Rabenprofil';profileForm.dispatchEvent(new personal.Event('submit'));await wait();
assert.equal(personal.data.raben_profiles[0].display_name,'Mein Rabenprofil');assert.ok(personal.root.textContent.includes('Charakter hinzufügen'));
await personal.click('Infokarte hinzufügen');profileForm=personal.root.querySelector('.profile-editor');
assert.equal(profileForm.querySelector('[data-profile-field="visibility"]').value,'private','Safe private default');
profileForm.querySelector('input[type="text"]').value='Private Infos';profileForm.querySelector('textarea').value='<img src=x onerror=evil()> Persönliche Notiz';profileForm.dispatchEvent(new personal.Event('submit'));await wait();
assert.equal(personal.data.raben_profile_items[0].visibility,'private');assert.equal(personal.root.querySelector('img'),null,'Profile info is plain text');
await personal.click('Infokarte hinzufügen');profileForm=personal.root.querySelector('.profile-editor');profileForm.querySelector('input[type="text"]').value='Spielzeiten für den Clan';profileForm.querySelector('textarea').value='Ein abgesprochener RP-Abend';profileForm.querySelector('[data-profile-field="visibility"]').value='clan';profileForm.dispatchEvent(new personal.Event('submit'));await wait();
await personal.click('Charakter hinzufügen');profileForm=personal.root.querySelector('.profile-editor');profileForm.querySelector('input[type="text"]').value='Geteilter Testcharakter';profileForm.querySelector('textarea').value='Nur für einen RP-Partner';const profileVisibility=profileForm.querySelector('[data-profile-field="visibility"]');profileVisibility.value='selected';profileVisibility.dispatchEvent(new personal.Event('change'));
assert.equal(profileForm.querySelector('.profile-recipients').hidden,false);profileForm.dispatchEvent(new personal.Event('submit'));await wait();
assert.ok(personal.root.textContent.includes('mindestens ein aktives Clanmitglied'),'Selected visibility needs recipients');assert.equal(personal.data.raben_profile_items.length,2);
const recipient=[...profileForm.querySelectorAll('.profile-recipient-options input')].find(i=>i.value===friend.user_id);recipient.checked=true;recipient.dispatchEvent(new personal.Event('change'));
const profilePic=new File([new Uint8Array([137,80,78,71])],'charakter.png',{type:'image/png'});Object.defineProperty(profileForm.querySelector('input[type="file"]'),'files',{value:[profilePic],configurable:true});profileForm.dispatchEvent(new personal.Event('submit'));await wait();
const personalCharacter=personal.data.raben_profile_items.find(i=>i.kind==='character');assert.equal(personalCharacter.visibility,'selected');assert.equal(personal.data.raben_profile_grants[0].grantee_id,friend.user_id);
const profileSave=personal.calls.find(c=>c.rpc==='raben_save_profile_item'&&c.args.p_kind==='character');assert.deepEqual([...profileSave.args.p_recipients],[friend.user_id]);
assert.equal(personal.transfers[0].options.metadata.bucketName,'raben-profile-media');assert.equal(personal.transfers[0].options.storeFingerprintForResuming,false);
assert.ok(personal.downloads.some(d=>d.bucket==='raben-profile-media'&&d.path===personalCharacter.image_path));assert.equal(personal.copies.length,0,'Profile images are never copied publicly');
await personal.click('Profilbild hinzufügen');profileForm=personal.root.querySelector('.profile-editor');Object.defineProperty(profileForm.querySelector('input[type="file"]'),'files',{value:[new File([profilePic],'avatar.png',{type:'image/png'})],configurable:true});profileForm.dispatchEvent(new personal.Event('submit'));await wait();
const avatarRow=personal.data.raben_profile_items.find(i=>i.kind==='avatar');assert.equal(avatarRow.visibility,'private');assert.equal(personal.root.querySelector('.profile-avatar').getAttribute('alt'),'Profilbild');
// Editing an info item keeps the already downloaded portrait intact.
const portraitUrl=personal.root.querySelector('.profile-avatar').src;const infoCard=personal.root.querySelector('[data-profile-item="'+personal.data.raben_profile_items[0].id+'"]');[...infoCard.querySelectorAll('button')].find(b=>b.textContent==='Bearbeiten').click();await wait();assert.equal(personal.root.querySelector('.profile-avatar').src,portraitUrl);await personal.click('Schließen');
const adminProfiles=await setup(lead,'admin',personal.data);await adminProfiles.click('Clanprofile');adminProfiles.root.querySelector('.profile-directory-card').click();await wait();
assert.ok(adminProfiles.root.textContent.includes('Spielzeiten für den Clan'));assert.ok(!adminProfiles.root.textContent.includes('Private Infos'));assert.ok(!adminProfiles.root.textContent.includes('Geteilter Testcharakter'));
assert.equal(adminProfiles.root.querySelector('.profile-avatar'),null);assert.ok(![...adminProfiles.root.querySelectorAll('button')].some(b=>['Bearbeiten','Löschen','Profilname ändern','Charakter hinzufügen'].includes(b.textContent)),'Another admin has no profile editing controls');
const friendProfiles=await setup(friend,'member',personal.data);friendProfiles.files.set('raben-profile-media/'+personalCharacter.image_path,profilePic);friendProfiles.root.querySelector('.profile-directory-card').click();await wait();
assert.ok(friendProfiles.root.textContent.includes('Geteilter Testcharakter'));assert.ok(!friendProfiles.root.textContent.includes('Private Infos'));assert.equal(friendProfiles.root.querySelector('.profile-avatar'),null);
friendProfiles.data.raben_profile_grants=[];await friendProfiles.context.RabenProfiles.audit(friendProfiles.hubContext);await wait();assert.ok(!friendProfiles.root.textContent.includes('Geteilter Testcharakter'),'Periodic audit removes revoked information');assert.equal(friendProfiles.root.querySelector('img'),null);
personal.setActor({...member,status:'blocked'});personal.context.dispatchEvent(new personal.Event('raben-lock'));assert.ok(!personal.root.textContent.includes('Persönliche Notiz'));assert.equal(personal.root.querySelector('.profile-avatar'),null);
assert.equal(visitor.root.querySelector('[data-kind="profiles"]'),null,'Profiles have no public tab');
console.log('PASS: member profile creation, private default, multiple info/character entries, selected recipient validation, private resumable image uploads, avatar rendering, plain text, no admin controls/visibility override, revoked-grant refresh and logout clearing.');

const accounts=await setup(member,'member',personal.data);
for(const [path,blob] of personal.files)accounts.files.set(path,blob);
accounts.data.raben_profile_items.push({id:id(700),owner_id:friend.user_id,kind:'character',title:'Fremder privater Charakter',body:'Geheim',visibility:'private',revision:1});
accounts.data.raben_records.push({id:id(701),kind:'character',title:'Fremder Charakterbucheintrag',created_by:friend.user_id,visibility:'clan',revision:1,details:{}});
await accounts.click('Mein Profil öffnen');await accounts.click('Kontoname & Bild');
let accountForm=accounts.root.querySelector('.account-editor'),pick=accountForm.querySelector('[data-account-field="character"]');
assert.ok([...pick.options].some(o=>o.value===personalCharacter.title),'Own private character available');
assert.ok([...pick.options].some(o=>o.value===fixtures[2].title),'Own legacy character available');
assert.ok(!pick.textContent.includes('Fremder'),'Only own characters are offered');
pick.value=personalCharacter.title;pick.dispatchEvent(new accounts.Event('change'));
assert.equal(accountForm.querySelector('input[type="text"]').value,personalCharacter.title);
const accountFile=new File([profilePic],'kontobild.png',{type:'image/png'}),accountInput=accountForm.querySelector('[data-account-field="avatar"]');
Object.defineProperty(accountInput,'files',{value:[accountFile],configurable:true});accountInput.dispatchEvent(new accounts.Event('change'));await wait();
assert.ok(accountForm.querySelector('.account-preview img'),'Circular preview before saving');
accountForm.dispatchEvent(new accounts.Event('submit'));await wait();
const accountCore=accounts.data.raben_profiles.find(p=>p.user_id===member.user_id),accountPath=accountCore.avatar_path;
assert.equal(accountCore.display_name,personalCharacter.title);assert.ok(accountPath.startsWith(member.user_id+'/'));
assert.equal(accounts.data.raben_profile_items.find(p=>p.id===personalCharacter.id).visibility,'selected','Using character name does not share the character');
assert.ok(accounts.root.querySelector('.account-avatar img'));assert.equal(accounts.copies.length,0,'No public account image copy');
// All author instances for one person use one authenticated image download per view.
accounts.data.raben_records.push({id:id(702),kind:'journal',title:'Mein RP-Bericht',body:'Erlebnis',details:{},visibility:'clan',created_by:member.user_id,revision:1});
await accounts.click('RP-Tagebuch');assert.ok(accounts.root.querySelector('[data-account-id="'+member.user_id+'"] .account-avatar img'));
accounts.data.raben_profiles[0].display_name='Eisrabe <img src=x onerror=evil()>';
accounts.context.dispatchEvent(new accounts.Event('raben-identity-updated'));await wait();
assert.ok(accounts.root.textContent.includes('Eingetragen von Eisrabe <img src=x onerror=evil()>'));
assert.equal(accounts.root.querySelector('img[onerror]'),null,'Account names are plain text');
const authorCtx=accounts.hubContext,host=accounts.document.createElement('div');accounts.root.append(host);
const beforeDownloads=accounts.downloads.filter(d=>d.path===accountPath).length;
for(let i=0;i<8;i++)host.append(accounts.context.RabenIdentity.person(authorCtx,member.user_id));await wait();
assert.equal(accounts.downloads.filter(d=>d.path===accountPath).length,beforeDownloads,'Repeated avatar nodes reuse one download');
// Incoming account refresh leaves an open editor and the member's draft intact.
await accounts.click('Neu erstellen');let journalForm=accounts.root.querySelector('.hub-editor');journalForm.querySelector('input[type="text"]').value='Noch nicht gespeichert';
accounts.context.dispatchEvent(new accounts.Event('raben-identity-updated'));await wait();assert.equal(accounts.root.querySelector('.hub-editor'),journalForm);assert.equal(journalForm.querySelector('input[type="text"]').value,'Noch nicht gespeichert');
const accountFriend=await setup(friend,'member',accounts.data);accountFriend.files.set('raben-profile-media/'+accountPath,accountFile);accountFriend.root.querySelector('.profile-directory-card').click();await wait();
assert.ok(accountFriend.root.querySelector('.account-avatar img'),'Clan sees shared account avatar');assert.equal(accountFriend.root.querySelector('.profile-avatar'),null,'Private personal portrait still hidden');
assert.ok(![...accountFriend.root.querySelectorAll('button')].some(b=>b.textContent==='Kontoname & Bild'));
await accounts.click('Clanprofile');await accounts.click('Mein Profil öffnen');await accounts.click('Kontoname & Bild');accountForm=accounts.root.querySelector('.account-editor');
accountForm.querySelector('[data-account-field="remove"]').checked=true;accountForm.querySelector('input[type="text"]').value='Hrafn';accountForm.dispatchEvent(new accounts.Event('submit'));await wait();
assert.equal(accounts.data.raben_profiles[0].avatar_path,null);assert.equal(accounts.root.querySelector('.account-avatar img'),null);assert.ok(accounts.root.querySelector('.profile-avatar'),'Account image removal does not delete private portrait');
// Local crop creates a small WebP once per source file, including EXIF-aware decoding.
let crop,decoded=0,closed=0;const originalCreate=accounts.document.createElement.bind(accounts.document);
accounts.context.createImageBitmap=async(_file,options)=>{assert.equal(options.imageOrientation,'from-image');decoded++;return {width:1200,height:800,close(){closed++;}};};
accounts.document.createElement=tag=>tag==='canvas'?{width:0,height:0,getContext:()=>({drawImage:(_image,...args)=>{crop=args;}}),toBlob:callback=>callback(new Blob(['thumbnail'],{type:'image/webp'}))}:originalCreate(tag);
const cropSource=new File([profilePic],'portrait.png',{type:'image/png'}),thumb=await accounts.context.RabenIdentity.thumbnail(cropSource);assert.equal(thumb.type,'image/webp');assert.deepEqual(crop,[200,0,800,800,0,0,256,256]);
assert.equal(await accounts.context.RabenIdentity.thumbnail(cropSource),thumb);assert.equal(decoded,1);assert.equal(closed,1);accounts.document.createElement=originalCreate;
accounts.context.dispatchEvent(new accounts.Event('raben-lock'));assert.equal(accounts.root.querySelector('.account-person'),null);assert.equal(authorCtx.identityImages.size,0);
console.log('PASS: account settings, own-character name choice, isolated private content, round preview, shared avatar, author alias refresh, repeated-image reuse, plain-text names, retained drafts, portrait removal, local 256px crop and logout cleanup.');

// Exercise the real clan page and both admin shells, rather than only the shared hub.
for(const pageName of ['clan.html','admin.html','app/index.html']){
 const adminPage=pageName!=='clan.html',page=await setup(adminPage?lead:member,adminPage?'admin':'member',accounts.data);
 page.context.RabenHub.lock();
 const template=parseHTML(await readFile(pageName,'utf8')).document;
 page.document.body.replaceChildren(...template.body.childNodes);page.document.body.dataset.adminApp=pageName==='app/index.html'?'true':'false';
 page.data.raben_profiles=[{user_id:member.user_id,display_name:'Hrafn aus dem Eis',avatar_path:accountPath,revision:4},{user_id:lead.user_id,display_name:'Jarl der Raben',avatar_path:null,revision:1}];
 page.data.raben_clan_posts=[{id:id(710),title:'Ein Hinweis an die Raben',body:'Treffen am Langhaus',category:'aushang',created_by:member.user_id,created_at:'2026-10-08T10:00:00Z',updated_at:'2026-10-08T10:00:00Z'}];
 page.files.set('raben-profile-media/'+accountPath,accountFile);
 Object.assign(page.context.Raben,{configured:()=>true,finishAdminSignIn:()=>false,status:(id,text)=>{const n=page.document.getElementById(id);if(n){n.textContent=text;n.hidden=!text;}},applyImages:()=>{}});
 page.context.requestAnimationFrame=()=>0;page.context.RabenEffects={create:()=>({update(){}}),normalize:v=>v};
 page.context.Raben.client().auth.onAuthStateChange=()=>({});
 for(const form of page.document.querySelectorAll('form')){form.reset=()=>{};Object.defineProperty(form,'elements',{value:Object.fromEntries([...form.querySelectorAll('[name]')].map(n=>[n.name,n])),configurable:true});}
 if(adminPage)vm.runInContext(await readFile('default-content.js','utf8'),page.sandbox);
 vm.runInContext(await readFile(adminPage?'admin.js':'clan.js','utf8'),page.sandbox);await wait();await wait();
 const manager=page.document.getElementById(adminPage?'member-manager':'roster'),posts=page.document.getElementById(adminPage?'internal-posts':'clan-posts');
 assert.ok(manager.textContent.includes('Hrafn aus dem Eis'),pageName+' roster account name');assert.ok(manager.querySelector('.account-avatar img'),pageName+' round portrait');
 assert.ok(posts.textContent.includes('Veröffentlicht von Hrafn aus dem Eis'),pageName+' post attribution');assert.ok(posts.querySelector('.account-avatar img'));
 assert.ok(page.document.getElementById('account').textContent.includes(adminPage?'Jarl der Raben':'Hrafn aus dem Eis'));
 page.data.raben_profiles[0].display_name='Hrafn der Schwarze';page.context.dispatchEvent(new page.Event('raben-identity-updated'));await wait();await wait();
 assert.ok(manager.textContent.includes('Hrafn der Schwarze'),pageName+' existing roster refresh');assert.ok(posts.textContent.includes('Hrafn der Schwarze'),pageName+' existing author refresh');
 page.setActor({...adminPage?lead:member,status:'blocked'});page.context.dispatchEvent(new page.Event('raben-lock'));
 assert.equal(manager.querySelector('.account-person'),null);assert.equal(posts.querySelector('.account-person'),null);assert.equal(page.document.getElementById('account').childNodes.length,0);
}
console.log('PASS: actual clan roster/header/post authors and desktop/mobile admin identity display, live rename refresh and logout clearing.');
