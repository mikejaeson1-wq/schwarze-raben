import {calendarICS} from '../_shared/calendar.mjs';
import {createRPC,noCache} from '../_shared/server.mjs';
const rpc=createRPC(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
// Custom authentication: a 256-bit feed token, checked against a hash, revocation and current membership by a server-only RPC.
export async function handler(req:Request):Promise<Response>{
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{...noCache,Allow:'GET, HEAD'}});
 const token=new URL(req.url).searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return new Response('Kalender-Abo nicht verfügbar',{status:404,headers:noCache});
 try{const data=await rpc('raben_calendar_feed_data',{p_token:token});if(!data)return new Response('Kalender-Abo nicht verfügbar',{status:404,headers:noCache});
  return new Response(req.method==='HEAD'?null:calendarICS(data.events,data.title),{headers:{...noCache,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="schwarze-raben.ics"'}});
 }catch(_){return new Response('Kalender vorübergehend nicht erreichbar',{status:503,headers:noCache});}
}
Deno.serve(handler);
