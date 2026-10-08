(() => {
  'use strict';
  const {el,check}=Raben,BUCKET='raben-profile-media';
  const specs=new WeakMap();
  const valid=(ctx,epoch)=>!ctx.disposed&&!ctx.public&&ctx.actor?.status==='active'&&ctx.epoch===epoch;
  const name=(ctx,id,fallback='Clanmitglied')=>ctx.identities?.get(id)?.display_name||fallback;
  const releaseImages=ctx=>{
    for(const entry of ctx.identityImages?.values()||[])if(entry.url){URL.revokeObjectURL(entry.url);ctx.urls?.delete(entry.url);}
    ctx.identityImages?.clear();ctx.identityImageEpoch=(ctx.identityImageEpoch||0)+1;
  };
  const release=ctx=>{releaseImages(ctx);ctx.identityNodes?.clear();ctx.identities?.clear();};
  const picture=(ctx,path)=>{
    if(ctx.identityCacheEpoch!==ctx.epoch){releaseImages(ctx);ctx.identityCacheEpoch=ctx.epoch;}
    ctx.identityImages||=new Map();let entry=ctx.identityImages.get(path);
    if(entry)return entry.promise;
    const epoch=ctx.epoch,generation=ctx.identityImageEpoch;
    entry={url:null,promise:null};ctx.identityImages.set(path,entry);
    entry.promise=(async()=>{
      try{
        const blob=await check(Raben.client().storage.from(BUCKET).download(path));
        if(!valid(ctx,epoch)||ctx.identityImageEpoch!==generation||ctx.identityImages.get(path)!==entry)return null;
        entry.url=URL.createObjectURL(blob);ctx.urls||=new Set();ctx.urls.add(entry.url);return entry.url;
      }catch(_){if(ctx.identityImages.get(path)===entry)ctx.identityImages.delete(path);return null;}
    })();return entry.promise;
  };
  const paint=(ctx,node)=>{
    const spec=specs.get(node);if(!spec)return;
    const person=ctx.identities?.get(spec.id),label=name(ctx,spec.id,spec.fallback),path=person?.avatar_path||null;
    const key=JSON.stringify([label,path,ctx.epoch,ctx.identityImageEpoch,ctx.rankLabels?.get(spec.id),ctx.officeLabels?.get(spec.id)]);if(node.dataset.identityKey===key)return;
    node.dataset.identityKey=key;node.replaceChildren();
    if(spec.prefix)node.append(el('span','',spec.prefix));
    const face=el('span','account-avatar',Array.from(label.trim())[0]?.toLocaleUpperCase('de')||'R');face.setAttribute('aria-hidden','true');
    const text=el(spec.link&&person?'a':'span','account-name',label);
    if(text.tagName==='A')text.href=new URL('clan.html?profil='+encodeURIComponent(spec.id),Raben.config.siteUrl).href;
    node.append(face,text);if(spec.suffix)node.append(el('span','',spec.suffix));if(ctx.rankLabels?.get(spec.id))node.append(el('span','rp-rank',ctx.rankLabels.get(spec.id)));for(const office of ctx.officeLabels?.get(spec.id)||[])node.append(el('span','clan-office',office));
    if(path){const epoch=ctx.epoch;Promise.resolve().then(()=>picture(ctx,path)).then(url=>{
      if(!url||!valid(ctx,epoch)||!node.isConnected||node.dataset.identityKey!==key)return;
      const img=el('img','');img.src=url;img.alt='';img.loading='lazy';face.replaceChildren(img);
    });}
  };
  const person=(ctx,id,options={})=>{
    const node=el('span','account-person'+(options.large?' account-person-large':''));node.dataset.accountId=id||'';
    specs.set(node,{id,fallback:options.fallback||'Ehemaliges Clanmitglied',prefix:options.prefix||'',suffix:options.suffix||'',link:options.link!==false});
    ctx.identityNodes||=new Set();ctx.identityNodes.add(node);paint(ctx,node);return node;
  };
  const load=async(ctx,people=null)=>{
    if(ctx.public||ctx.disposed)return;
    const epoch=ctx.epoch;await ctx.authorize();if(!valid(ctx,epoch))return;
    const [members,profiles]=await Promise.all([
      people?Promise.resolve(people):check(Raben.client().from('raben_memberships').select('user_id,display_name,status').eq('status','active')),
      check(Raben.client().from('raben_profiles').select('user_id,display_name,avatar_path,revision'))
    ]);
    if(!valid(ctx,epoch))return;const cores=new Map(profiles.map(p=>[p.user_id,p]));
    ctx.identities=new Map(members.filter(m=>!m.status||m.status==='active').map(m=>[m.user_id,{...m,...(cores.get(m.user_id)||{})}]));
    if(window.RabenExpansion)await RabenExpansion.rankLabels(ctx);if(!valid(ctx,epoch))return;
    ctx.names||=new Map();ctx.names.clear();ctx.identities.forEach(p=>ctx.names.set(p.user_id,p.display_name));
    const own=ctx.identities.get(ctx.actor.user_id);if(own)ctx.actor={...ctx.actor,display_name:own.display_name,avatar_path:own.avatar_path||null};
    const used=new Set([...ctx.identities.values()].map(p=>p.avatar_path).filter(Boolean));
    for(const [path,entry] of ctx.identityImages||[])if(!used.has(path)){if(entry.url){URL.revokeObjectURL(entry.url);ctx.urls?.delete(entry.url);}ctx.identityImages.delete(path);}
    for(const node of ctx.identityNodes||[]){if(node.isConnected)paint(ctx,node);else ctx.identityNodes.delete(node);}
  };
  const changed=profile=>window.dispatchEvent(new CustomEvent('raben-identity-updated',{detail:{user_id:profile.user_id}}));
  // Generate the small account portrait locally; private profile originals are untouched.
  const thumbnails=new WeakMap();
  const thumbnail=async file=>{
    await RabenMedia.validateFile(file,false);
    if(thumbnails.has(file))return thumbnails.get(file);
    const result=(async()=>{
      if(!window.createImageBitmap)return file;
      let bitmap;
      try{
        bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
        const context=canvas.getContext('2d');if(!context||!canvas.toBlob)return file;
        const size=Math.min(bitmap.width,bitmap.height);if(!size)throw new Error('invalid_image');
        context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));
        if(!blob)return file;const ext=blob.type==='image/webp'?'webp':'png';
        return new File([blob],'kontobild.'+ext,{type:blob.type||'image/png'});
      }catch(_){throw new Error('invalid_image');}finally{bitmap?.close?.();}
    })();thumbnails.set(file,result);return result;
  };
  window.RabenIdentity={load,person,name,release,releaseImages,changed,thumbnail};
})();
