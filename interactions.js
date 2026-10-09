(() => {
 'use strict';const {el,check}=Raben;let visitor;
 const active=(ctx,e,host)=>!ctx.disposed&&ctx.epoch===e&&host.isConnected;
 const visitorId=()=>{if(visitor)return visitor;try{visitor=localStorage.getItem('raben-public-like-id');if(!RabenMedia.UUID.test(visitor||'')){visitor=crypto.randomUUID();localStorage.setItem('raben-public-like-id',visitor);}}catch(_){visitor=crypto.randomUUID();}return visitor;};
 const like=(ctx,type,id,host,publicImage=false)=>{
  const epoch=ctx.epoch,b=el('button','button outline small-button image-like','♡ Gefällt mir · 0');b.type='button';b.setAttribute('aria-pressed','false');host.append(b);let mine=false;
  const redraw=state=>{mine=!!state.liked;b.textContent=(mine?'♥ Gefällt dir':'♡ Gefällt mir')+' · '+Number(state.count||0);b.setAttribute('aria-pressed',String(mine));};
  const read=async()=>{if(publicImage)return check(Raben.client().rpc('raben_public_image_status',{p_record:id,p_visitor:visitorId()}));const rows=await check(Raben.client().from('raben_reactions').select('user_id').eq('parent_type',type).eq('parent_id',id).eq('emoji','like'));return {liked:rows.some(r=>r.user_id===ctx.actor.user_id),count:rows.length};};
  Promise.resolve().then(read).then(state=>{if(active(ctx,epoch,b))redraw(state);}).catch(()=>{if(active(ctx,epoch,b)){b.textContent='♡ Gefällt mir';}});
  b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;try{if(!publicImage)await ctx.authorize();if(!active(ctx,epoch,b))return;let state;if(publicImage)state=await check(Raben.client().rpc('raben_public_image_like',{p_record:id,p_visitor:visitorId(),p_liked:!mine}));else{const q=Raben.client().from('raben_reactions');await check(mine?q.delete().eq('parent_type',type).eq('parent_id',id).eq('user_id',ctx.actor.user_id).eq('emoji','like'):q.insert({parent_type:type,parent_id:id,emoji:'like'}));state=await read();}if(active(ctx,epoch,b))redraw(state);}catch(error){if(active(ctx,epoch,b))ctx.report?.(Raben.errorMessage(error),true);}finally{b.disabled=false;}});return b;
 };
 window.RabenInteractions={like,visitorId};
})();
