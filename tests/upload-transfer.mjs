import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Exercise the actual vendored browser TUS client over HTTP. The XHR bridge
// preserves the browser rule that repeated setRequestHeader calls append.
const requests=[],uploads=new Map();
let forceStatus=0,failPatch=false,holdPatch=false,held;
const server=createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const body=Buffer.concat(chunks),method=req.method;
 requests.push({method,path:req.url,headers:req.headers,bytes:body.length});
 res.setHeader('Tus-Resumable','1.0.0');
 if(!/^Bearer test-token-\d+$/.test(req.headers.authorization||'')){
  res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'AccessDenied',message:'Invalid Compact JWS'}));return;
 }
 if(forceStatus){res.writeHead(forceStatus,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Test storage error'}));return;}
 if(method==='POST'){
  const path='/storage/v1/upload/resumable/'+crypto.randomUUID();
  const metadata=Object.fromEntries((req.headers['upload-metadata']||'').split(',').map(part=>{const [key,value]=part.trim().split(' ');return [key,Buffer.from(value||'','base64').toString()];}));
  uploads.set(path,{offset:body.length,length:Number(req.headers['upload-length']),metadata});
  res.writeHead(201,{'Location':path,'Upload-Offset':String(body.length)});res.end();return;
 }
 const item=uploads.get(req.url);
 if(!item){res.writeHead(404);res.end();return;}
 if(method==='HEAD'){res.writeHead(200,{'Upload-Offset':String(item.offset),'Upload-Length':String(item.length)});res.end();return;}
 if(method==='PATCH'){
  if(holdPatch){held?.();return;}
  if(failPatch){failPatch=false;res.writeHead(500);res.end();return;}
  assert.equal(Number(req.headers['upload-offset']),item.offset);
  item.offset+=body.length;res.writeHead(204,{'Upload-Offset':String(item.offset)});res.end();return;
 }
 res.writeHead(405);res.end();
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
class BrowserXHR {
 constructor(){this.upload={};this.headers=new Headers();this.controller=new AbortController();}
 open(method,url){this.method=method;this.url=url;}
 setRequestHeader(key,value){this.headers.append(key,value);}
 getResponseHeader(key){return this.responseHeaders?.get(key)||null;}
 abort(){this.aborted=true;this.controller.abort();}
 async send(body){
  try{
   this.upload.onprogress?.({lengthComputable:true,loaded:body?.size||0});
   const response=await fetch(origin+new URL(this.url).pathname,{method:this.method,headers:this.headers,body,signal:this.controller.signal});
   this.status=response.status;this.responseHeaders=response.headers;this.responseText=await response.text();if(!this.aborted)this.onload?.();
  }catch(error){if(!this.aborted)this.onerror?.(error);}
 }
}
const actor={user_id:'00000000-0000-4000-a000-000000000001',status:'active',role:'admin',display_name:'Test Admin'};
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const until=async fn=>{for(let n=0;n<300;n++){if(fn())return;await tick();}throw new Error('Test timed out');};
async function setup(page=null){
 const {document,Event}=parseHTML(page?await readFile(page,'utf8'):'<html><body></body></html>');
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,get(){return [...this.options].find(o=>o.selected)?.value||this.options[0]?.value||'';},set(value){for(const option of this.options)option.selected=option.value===String(value);}});
 for(const form of document.querySelectorAll('form'))form.reset=()=>{};
 let member=actor,sessionNumber=0;const listeners=new Map();
 const sb={auth:{getSession:async()=>({data:{session:member?{access_token:'test-token-'+(++sessionNumber)}:null},error:null}),onAuthStateChange:()=>({})},storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:'https://test.supabase.co/storage/v1/object/public/'+bucket+'/'+path}})})},from:table=>{
  const result={data:table==='raben_site_content'?{content:{extraInfos:[]},revision:1}:[],error:null};
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:()=>q,limit:()=>q,single:async()=>result,then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};return q;
 }};
 const context={document,Event,console,URL,Intl,Date,Math,Uint8Array,Blob,File,crypto:globalThis.crypto,XMLHttpRequest:BrowserXHR,AbortController,setTimeout,clearTimeout,setInterval:()=>0,requestAnimationFrame:()=>0,confirm:()=>true,
  location:{href:'https://example.com/',origin:'https://example.com'},navigator:{onLine:true},
  addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);},
  Raben:{el:(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;},check:async promise=>{const r=await promise;if(r.error)throw r.error;return r.data;},client:()=>sb,member:async()=>member,config:{supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'sb_publishable_test',siteUrl:'https://example.com/'},configured:()=>true,errorMessage:()=> 'Fehler',imageUrl:value=>value||'',applyImages:()=>{},status:(id,text,error)=>{document.getElementById(id).textContent=text;}},
  RabenEffects:{create:()=>({update:()=>{}}),normalize:value=>value},RabenHub:{mountAdmin:async()=>{},lock:()=>{}}
 };context.window=context;const sandbox=vm.createContext(context);
 for(const name of ['vendor/tus-4.3.1.js','default-content.js','media.js'])vm.runInContext(await readFile(name,'utf8'),sandbox);
 if(page){vm.runInContext(await readFile('admin.js','utf8'),sandbox);await until(()=>!document.getElementById('admin-content').hidden);}
 return {context,document,Event,setMember:value=>{member=value;},ctx:{actor,admin:true,public:false,disposed:false,epoch:0}};
}
try{
 const t=await setup(),controls=t.context.RabenMedia.progressControls();
 const audioBytes=new Uint8Array(8*1024*1024);audioBytes.set([73,68,51,0]);
 const audio=new File([audioBytes],'aufnahme.mp3',{type:'audio/mpeg'});
 failPatch=true;
 const path=await t.context.RabenMedia.upload(t.ctx,audio,null,controls,true);
 const saved=[...uploads.values()].find(u=>u.metadata.objectName===path);
 assert.equal(saved.offset,audio.size);assert.equal(controls.progress.value,100);assert.equal(controls.label.textContent,'Datei hochgeladen.');
 assert.ok(requests.some(r=>r.method==='HEAD'),'Interrupted chunks resume via HEAD');
 for(const request of requests){assert.match(request.headers.authorization,/^Bearer test-token-\d+$/);assert.equal(request.headers.apikey,undefined);assert.ok(request.bytes<=6*1024*1024);}
 assert.ok(new Set(requests.map(r=>r.headers.authorization)).size>1,'Each request reads the current session token');
 const image=new File([new Uint8Array(13*1024*1024)],'hintergrund.png',{type:'image/png'});
 const imagePath=await t.context.RabenMedia.upload(t.ctx,image,null,controls);
 assert.equal([...uploads.values()].find(u=>u.metadata.objectName===imagePath).offset,image.size);
 t.setMember({...actor,role:'member'});
 const profileCtx={...t.ctx,admin:false};
 const profilePath=await t.context.RabenMedia.upload(profileCtx,image,actor.user_id,controls,false,null,'raben-profile-media');
 const profileTransfer=[...uploads.values()].find(u=>u.metadata.objectName===profilePath);
 assert.equal(profileTransfer.metadata.bucketName,'raben-profile-media');assert.equal(profileTransfer.offset,image.size);
 await assert.rejects(()=>t.context.RabenMedia.upload(profileCtx,audio,actor.user_id,controls,true,null,'raben-profile-media'),error=>error.code==='42501');
 await assert.rejects(()=>t.context.RabenMedia.upload(profileCtx,image,'00000000-0000-4000-a000-000000000999',controls,false,null,'raben-profile-media'),error=>error.code==='42501');
 t.setMember(actor);
 await t.context.RabenMedia.validateFile({name:'gross.png',type:'image/png',size:50*1024*1024},false);
 await assert.rejects(()=>t.context.RabenMedia.validateFile({name:'zu-gross.png',type:'image/png',size:50*1024*1024+1},false));
 await assert.rejects(()=>t.context.RabenMedia.validateFile({name:'zu-gross.mp3',size:20*1024*1024+1},true));
 forceStatus=403;
 await assert.rejects(()=>t.context.RabenMedia.upload(t.ctx,new File(['x'],'abgelehnt.png',{type:'image/png'}),null,controls),error=>error.message==='upload_forbidden');
 assert.match(controls.label.textContent,/Zugriffsrechte/);forceStatus=0;
 // Cancel and resume the same File object without starting a second upload.
 holdPatch=true;const waiting=new Promise(resolve=>{held=resolve;});
 const pausedFile=new File([new Uint8Array(7*1024*1024)],'pause.png',{type:'image/png'});
 const paused=t.context.RabenMedia.upload(t.ctx,pausedFile,null,controls);paused.catch(()=>{});await waiting;
 controls.cancel.onclick();await assert.rejects(()=>paused,error=>error.message==='upload_interrupted');
 const creations=requests.filter(r=>r.method==='POST').length;holdPatch=false;
 await t.context.RabenMedia.upload(t.ctx,pausedFile,null,controls);assert.equal(requests.filter(r=>r.method==='POST').length,creations);
 for(const page of ['admin.html','app/index.html']){
  const editor=await setup(page),input=editor.document.querySelector('[data-image="heroImage"]');
  Object.defineProperty(input,'files',{value:[image],configurable:true});input.dispatchEvent(new editor.Event('change'));
  await until(()=>editor.document.getElementById('admin-status').textContent.includes('Bild hochgeladen'));
  assert.match(editor.document.getElementById('hero-preview').src,/\/raben-public\/[a-f0-9-]{36}\.png$/);
  const latest=[...uploads.values()].at(-1);assert.equal(latest.offset,image.size);assert.equal(latest.metadata.bucketName,'raben-public');
  holdPatch=true;const waitForPause=new Promise(resolve=>{held=resolve;});
  Object.defineProperty(input,'files',{value:[pausedFile],configurable:true});input.dispatchEvent(new editor.Event('change'));await waitForPause;
  const cancel=[...editor.document.querySelectorAll('button')].find(b=>b.textContent==='Upload abbrechen');cancel.onclick();await until(()=>!input.disabled);
  const created=requests.filter(r=>r.method==='POST').length;holdPatch=false;
  const retry=[...editor.document.querySelectorAll('button')].find(b=>b.textContent==='Upload erneut versuchen');assert.equal(retry.hidden,false);retry.click();
  await until(()=>editor.document.getElementById('admin-status').textContent.includes('Bild hochgeladen'));
  assert.equal(requests.filter(r=>r.method==='POST').length,created,'Background retry resumes the existing upload');
  assert.equal(retry.hidden,true);
  if(page==='app/index.html'){
   holdPatch=true;const waitForLock=new Promise(resolve=>{held=resolve;});
   Object.defineProperty(input,'files',{value:[new File([new Uint8Array(7*1024*1024)],'logout.png',{type:'image/png'})],configurable:true});
   input.dispatchEvent(new editor.Event('change'));await waitForLock;
   editor.context.dispatchEvent(new editor.Event('raben-lock'));await until(()=>!input.disabled);holdPatch=false;
   assert.equal(editor.document.getElementById('admin-content').hidden,true);assert.equal(editor.document.getElementById('admin-gate').hidden,false);
   assert.equal(input.closest('.image-editor').querySelector('.media-upload-progress').hidden,true);
  }
 }
 t.setMember({...actor,status:'blocked'});
 await assert.rejects(()=>t.context.RabenMedia.upload(t.ctx,image,null,controls));
 console.log('PASS: real TUS/XHR authorization, multi-chunk MP3/images/private member profile uploads, network retry, pause/resume, 50 MB image limit, denied uploads, and desktop/mobile backgrounds.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
