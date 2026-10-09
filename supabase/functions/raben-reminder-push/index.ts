import webpush from 'npm:web-push@3.6.7';
import {createRPC,noCache,validPushEndpoint} from '../_shared/server.mjs';
declare const EdgeRuntime:{waitUntil(promise:Promise<unknown>):void};
const rpc=createRPC(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
type Job={id:string,recordId:string,endpoint:string,p256dh:string,auth:string};
async function deliver(data:{jobs:Job[],publicKey:string,privateKey:string},secret:string){
 const jobs=[...data.jobs];const worker=async()=>{let job;while((job=jobs.shift())){let status=0;try{
  if(!validPushEndpoint(job.endpoint))status=410;
  else{const result=await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify({recordId:job.recordId}),{TTL:900,timeout:5000,vapidDetails:{subject:'https://mikejaeson1-wq.github.io/schwarze-raben/',publicKey:data.publicKey,privateKey:data.privateKey}});status=result.statusCode;}
 }catch(error){status=Number((error as {statusCode?:number}).statusCode)||0;}try{await rpc('raben_complete_push_job',{p_secret:secret,p_id:job.id,p_status:status});}catch(_){/* The lease allows the next authorized worker to retry. */}}};await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));
}
// Custom authentication: the Vault dispatch secret is validated by a server-only RPC before any job or VAPID key is read.
export async function handler(req:Request):Promise<Response>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:noCache});
 if(Number(req.headers.get('content-length')||0)>512)return new Response('Forbidden',{status:403,headers:noCache});
 let secret='';try{const body=await req.text();if(body.length>512)throw new Error();secret=JSON.parse(body).secret||'';}catch(_){return new Response('Forbidden',{status:403,headers:noCache});}
 if(!/^[a-f0-9]{64}$/.test(secret))return new Response('Forbidden',{status:403,headers:noCache});
 try{const data=await rpc('raben_claim_push_jobs',{p_secret:secret}),work=deliver(data,secret);if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(work);else await work;return new Response('Accepted',{status:202,headers:noCache});}
 catch(_){return new Response('Forbidden',{status:403,headers:noCache});}
}
Deno.serve(handler);
