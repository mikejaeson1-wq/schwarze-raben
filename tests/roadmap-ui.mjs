import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const id=n=>'00000000-0000-4000-a000-'+String(n).padStart(12,'0');
const lead={user_id:id(1),status:'active',role:'admin',display_name:'Test-Admin'};
const member={user_id:id(2),status:'active',role:'member',display_name:'Test-Mitglied'};
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
async function setup(actor,mode='member'){
 const {document,Event,CustomEvent,HTMLSelectElement}=parseHTML('<html><body><main id="root"></main></body></html>');
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options)o.removeAttribute('selected');[...this.options].find(o=>o.value===String(value))?.setAttribute('selected','');}});
 let currentActor=actor;const calls=[],copies=[],transfers=[],downloads=[],exports=[],events=new Map();
 const data={raben_records:structuredClone(fixtures),raben_memberships:[lead,member],raben_site_content:[{id:1,revision:1,content:{name:'Schwarze Raben',extraInfos:[]}}],raben_content_versions:[{id:id(100),source_table:'raben_records',entity_key:characterId,kind:'character',title:'Alter Testcharakter',revision:1,operation:'insert',actor_name:'Test-Mitglied',changed_at:'2026-10-07T20:00:00Z',snapshot:{...fixtures[2],title:'Frühere Fassung'}}],raben_applications:[],raben_character_notes:[],raben_event_responses:[],raben_poll_votes:[],raben_task_claims:[],raben_clan_posts:[]};
 const files=new Map([['raben-media/'+privateAudio,new Blob([new Uint8Array([73,68,51,0])],{type:'audio/mpeg'})],['raben-public/'+releasedAudio,new Blob([new Uint8Array([73,68,51,0])],{type:'audio/mpeg'})]]);
 const inventory=()=>[...files].map(([key,blob])=>({bucket:key.split('/')[0],name:key.slice(key.indexOf('/')+1),size:blob.size,type:blob.type,used:key.endsWith(privateAudio),records:key.endsWith(privateAudio)?[{id:audioId,title:'Interne Aufnahme',kind:'media'}]:[],historyCount:0,website:false}));
 const value=(r,key)=>key.includes('->')?r.details?.[key.split(/->>?/)[1]]:r[key];
 const sb={auth:{getSession:async()=>({data:{session:currentActor?{access_token:'test-token'}:null},error:null})},from(table){
  const filters=[],orders=[];let operation='read',payload,offset=0,end=999,head=false,columns='*';
  const visible=r=>table!=='raben_records'||r.visibility==='public'||currentActor?.status==='active'&&(currentActor.role==='admin'||r.visibility==='clan'||r.created_by===currentActor.user_id);
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
 for(const name of ['vendor/fflate-0.8.3.js','media.js','history.js','community.js'])vm.runInContext(await readFile(name,'utf8'),sandbox);
 const root=document.getElementById('root');await (mode==='public'?context.RabenHub.mountPublic(root):mode==='admin'?context.RabenHub.mountAdmin(root,actor):context.RabenHub.mountMember(root,actor));await wait();
 const click=async text=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===text&&!b.disabled);assert.ok(b,'Button: '+text);b.click();await wait();return b;};
 return {context,sandbox,document,Event,root,data,files,calls,copies,transfers,downloads,exports,click,setActor:value=>{currentActor=value;}};
}
const visitor=await setup(null,'public');
assert.equal(visitor.root.querySelector('iframe'),null);assert.equal(visitor.root.querySelector('img'),null,'Text is never interpreted as HTML');
await visitor.click('Video laden');assert.match(visitor.root.querySelector('iframe').src,/^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
assert.equal(visitor.root.querySelector('audio'),null);assert.ok(!visitor.root.textContent.includes('Interne Aufnahme'));assert.ok(!visitor.calls.some(c=>c.table==='raben_content_versions'||c.rpc==='raben_export_content'));
assert.equal(visitor.context.RabenMedia.youtubeId('https://youtu.be/M7lc1UVf-VE?t=5'),'M7lc1UVf-VE');
for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://example.com/M7lc1UVf-VE','https://user:pass@youtube.com/watch?v=M7lc1UVf-VE'])assert.equal(visitor.context.RabenMedia.youtubeId(link),'');
const own=await setup(member);await own.click('Aufnahme laden');assert.equal(own.downloads[0].path,privateAudio);assert.match(own.root.querySelector('audio').src,/^blob:/);
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
