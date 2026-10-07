(() => {
  'use strict';
  const {el,check}=Raben;
  const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  const mediaNames={image:'Bild',youtube:'YouTube',mp3:'MP3'};
  const states={draft:'Entwurf',clan:'Clanintern',review:'Zur Freigabe',public:'Öffentlich',archived:'Archiviert'};
  const uploads=new WeakMap();
  const btn=(text,fn,style='button outline small-button')=>{const b=el('button',style,text);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
  const message=text=>el('p','field-note',text);
  const authorize=async ctx=>{
    if(ctx.public)throw {code:'42501'};
    if(ctx.authorize)return ctx.authorize();
    const actor=await Raben.member();
    if(!actor||actor.status!=='active'||(ctx.admin&&actor.role!=='admin')||(ctx.actor&&actor.user_id!==ctx.actor.user_id))throw {code:'42501'};
    return actor;
  };
  const youtubeId=value=>{
    try{
      const u=new URL(String(value).trim());
      if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
      let id='';
      if(['youtu.be','www.youtu.be'].includes(u.hostname))id=u.pathname.slice(1);
      else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)){
        if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
        else if(/^\/(shorts|embed|live)\//.test(u.pathname))id=u.pathname.split('/')[2];
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
    }catch(_){return '';}
  };
  const publicAsset=(path,audio=false)=>{
    if(!(audio?/^[a-f0-9-]{36}\.mp3$/:/^[a-f0-9-]{36}\.(jpg|png|webp)$/).test(path||''))return '';
    return Raben.client().storage.from('raben-public').getPublicUrl(path).data.publicUrl;
  };
  const validateFile=async(file,audio)=>{
    if(!file||file.size===0)throw new Error('file_required');
    if(audio){
      if(!/\.mp3$/i.test(file.name||'')||file.size>20971520)throw new Error('invalid_mp3');
      const h=new Uint8Array(await file.slice(0,4).arrayBuffer());
      if(!(h[0]===73&&h[1]===68&&h[2]===51)&&!(h[0]===255&&(h[1]&224)===224))throw new Error('invalid_mp3');
      return {type:'audio/mpeg',extension:'mp3'};
    }
    const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    if(!extension||file.size>8388608)throw new Error('invalid_image');
    return {type:file.type,extension};
  };
  const progressControls=()=>{
    const wrap=el('div','media-upload-progress'),label=message(''),progress=document.createElement('progress'),cancel=btn('Upload abbrechen');
    wrap.hidden=true;progress.max=100;progress.value=0;progress.setAttribute('aria-label','Uploadfortschritt');wrap.append(label,progress,cancel);
    return {wrap,label,progress,cancel};
  };
  const upload=async(ctx,file,owner,controls=null,audio=false,targetPath=null,bucket='raben-media')=>{
    const actor=await authorize(ctx),format=await validateFile(file,audio);
    if(ctx.disposed)throw {code:'42501'};
    if(!window.tus?.Upload)throw new Error('upload_unavailable');
    if(targetPath&&(actor.role!=='admin'||!['raben-media','raben-public'].includes(bucket)))throw {code:'42501'};
    const prefix=owner||actor.user_id;
    let saved=uploads.get(file);
    if(!saved||saved.prefix!==prefix||(targetPath&&saved.path!==targetPath)||saved.bucket!==bucket){saved={prefix,bucket,path:targetPath||prefix+'/'+crypto.randomUUID()+'.'+format.extension,transfer:null};uploads.set(file,saved);}
    if(saved.complete)return saved.path;
    const {data,error}=await Raben.client().auth.getSession();
    if(error||!data.session?.access_token)throw {code:'42501'};
    ctx.transfers ||=new Set();
    const endpoint=new URL(Raben.config.supabaseUrl);endpoint.hostname=endpoint.hostname.replace('.supabase.co','.storage.supabase.co');
    if(controls){controls.wrap.hidden=false;controls.label.textContent='Upload wird vorbereitet …';controls.cancel.disabled=false;}
    await new Promise((resolve,reject)=>{
      const done=()=>{ctx.transfers.delete(saved.transfer);if(controls)controls.cancel.disabled=true;};
      if(!saved.transfer){
        saved.transfer=new tus.Upload(file,{
          endpoint:endpoint.origin+'/storage/v1/upload/resumable',
          headers:{authorization:'Bearer '+data.session.access_token,apikey:Raben.config.supabasePublishableKey},
          metadata:{bucketName:bucket,objectName:saved.path,contentType:format.type,cacheControl:'0'},
          chunkSize:6*1024*1024,retryDelays:[0,1500,3000,5000],uploadDataDuringCreation:true,
          storeFingerprintForResuming:false,removeFingerprintOnSuccess:true,
          onBeforeRequest:async request=>{
            await authorize(ctx);if(ctx.disposed)throw {code:'42501'};
            const session=await Raben.client().auth.getSession();
            if(session.error||!session.data.session)throw {code:'42501'};
            request.setHeader('Authorization','Bearer '+session.data.session.access_token);
          }
        });
      }
      // Retry reuses only this in-memory upload, never credentials in a file cache.
      saved.transfer.options.onProgress=(loaded,total)=>{
        if(!controls||ctx.disposed)return;
        const percent=Math.round(loaded/Math.max(1,total)*100);controls.progress.value=percent;
        controls.label.textContent=percent+' % · '+bytes(loaded)+' / '+bytes(total);
      };
      saved.transfer.options.onSuccess=()=>{saved.complete=true;done();if(controls){controls.progress.value=100;controls.label.textContent='Datei hochgeladen.';}resolve();};
      saved.transfer.options.onError=()=>{done();if(controls)controls.label.textContent='Upload unterbrochen. Mit „Speichern“ erneut versuchen.';reject(new Error('upload_interrupted'));};
      saved.transfer.cancel=()=>{saved.transfer.abort().catch(()=>{});done();if(controls)controls.label.textContent='Upload pausiert. Mit „Speichern“ fortsetzen.';reject(new Error('upload_interrupted'));};
      if(controls)controls.cancel.onclick=saved.transfer.cancel;
      ctx.transfers.add(saved.transfer);saved.transfer.start();
    });
    await authorize(ctx);return saved.path;
  };
  const publish=async(ctx,details)=>{
    const actor=await authorize(ctx);if(actor.role!=='admin')throw {code:'42501'};
    const data={...details};
    for(const [privateKey,publicKey] of [['imagePath','publicImage'],['audioPath','publicAudio']]){
      if(!data[privateKey]||data[publicKey])continue;
      const path=crypto.randomUUID()+'.'+data[privateKey].split('.').pop();
      await check(Raben.client().storage.from('raben-media').copy(data[privateKey],path,{destinationBucket:'raben-public'}));
      data[publicKey]=path;
    }
    return data;
  };
  const editSource=(ctx,row,grid,inputs)=>{
    const details=row?.details||{},ytWrap=el('label','form-field full','YouTube-Link'),yt=document.createElement('input');
    yt.type='url';yt.placeholder='https://youtu.be/…';yt.value=details.youtubeId?'https://www.youtube.com/watch?v='+details.youtubeId:'';yt.maxLength=1000;ytWrap.append(yt);
    const audioWrap=el('label','form-field full','MP3-Datei · maximal 20 MB'),audio=document.createElement('input');audio.type='file';audio.accept='.mp3,audio/mpeg';audioWrap.append(audio);
    const existing=message(details.fileName?'Aktuelle Datei: '+details.fileName:''),controls=progressControls();
    const coverWrap=inputs.image?.parentNode;if(coverWrap)coverWrap.firstChild.textContent='Bild oder optionales Cover · JPG, PNG, WebP · maximal 8 MB';
    grid.append(ytWrap,audioWrap,existing,controls.wrap);
    const toggle=()=>{const type=inputs.mediaType.value;ytWrap.hidden=type!=='youtube';audioWrap.hidden=type!=='mp3';existing.hidden=type!=='mp3'||!details.fileName;};
    inputs.mediaType.addEventListener('change',toggle);toggle();
    let removeCover=false;
    if(details.imagePath){const remove=btn('Cover entfernen',()=>{removeCover=true;remove.disabled=true;remove.textContent='Cover wird beim Speichern entfernt';grid.dispatchEvent(new Event('change',{bubbles:true}));});grid.append(remove);}
    return {controls,committed:data=>{audio.value='';Object.assign(details,data);existing.textContent=data.fileName?'Aktuelle Datei: '+data.fileName:'';removeCover=false;},collect:async data=>{
      if(removeCover){delete data.imagePath;delete data.publicImage;}
      const type=data.mediaType;
      if(type!=='youtube')delete data.youtubeId;
      if(type!=='mp3'){delete data.audioPath;delete data.publicAudio;delete data.fileName;}
      if(type==='youtube'){const id=youtubeId(yt.value);if(!id)throw new Error('invalid_youtube');data.youtubeId=id;}
      if(type==='mp3'){
        if(audio.files?.[0]){data.audioPath=await upload(ctx,audio.files[0],row?.created_by,controls,true);data.fileName=audio.files[0].name.slice(0,255);delete data.publicAudio;}
        else if(!data.audioPath)throw new Error('audio_file_required');
      }
      if(type==='image'&&!data.imagePath&&!inputs.image?.files?.[0])throw new Error('image_required');
      return data;
    }};
  };
  const releasePlayers=ctx=>{
    for(const player of ctx.players||[]){if(player.tagName==='AUDIO'){player.pause?.();player.removeAttribute('src');player.load?.();}else player.remove();}
    ctx.players?.clear();ctx.urls?.forEach(url=>URL.revokeObjectURL(url));ctx.urls?.clear();
  };
  const release=ctx=>{releasePlayers(ctx);for(const transfer of ctx.transfers||[])transfer.cancel?.();ctx.transfers?.clear();};
  const render=async(ctx,row,host)=>{
    await Promise.resolve();
    const d=row.details||{};if(row.kind!=='media'||d.mediaType==='image')return;
    const epoch=ctx.epoch,wrap=el('div','media-player');ctx.players ||=new Set();ctx.urls ||=new Set();
    if(d.mediaType==='youtube'&&/^[A-Za-z0-9_-]{11}$/.test(d.youtubeId||'')){
      wrap.append(message('YouTube wird erst durch einen Klick geladen.'));
      const load=btn('Video laden',async()=>{
        load.disabled=true;
        try{
          if(!ctx.public)await authorize(ctx);
          if(ctx.disposed||ctx.epoch!==epoch||!host.isConnected)return;
          const iframe=document.createElement('iframe'),url=new URL('https://www.youtube-nocookie.com/embed/'+d.youtubeId);
          url.searchParams.set('playsinline','1');url.searchParams.set('autoplay','0');url.searchParams.set('rel','0');
          iframe.src=url.href;iframe.title=row.title+' · YouTube';iframe.className='media-video';
          iframe.setAttribute('allow','fullscreen; encrypted-media; picture-in-picture');iframe.setAttribute('allowfullscreen','');
          iframe.referrerPolicy='strict-origin-when-cross-origin';ctx.players.add(iframe);wrap.replaceChildren(iframe);
        }catch(_){wrap.append(message('Bitte prüfe deinen Clan-Zugang.'));load.disabled=false;}
      });wrap.append(load);
    }else if(d.mediaType==='mp3'){
      const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.setAttribute('aria-label',row.title);audio.className='media-audio';
      if(ctx.public){const url=publicAsset(d.publicAudio,true);if(!url)return;audio.src=url;wrap.append(audio);}
      else{
        const load=btn('Aufnahme laden',async()=>{
          load.disabled=true;
          try{
            await authorize(ctx);const blob=await check(Raben.client().storage.from('raben-media').download(d.audioPath));await authorize(ctx);
            if(ctx.disposed||ctx.epoch!==epoch||!host.isConnected)return;
            const url=URL.createObjectURL(blob);ctx.urls.add(url);audio.src=url;wrap.replaceChildren(audio,message('Wiedergabe über den Player starten.'));
          }catch(_){wrap.append(message('Die Aufnahme konnte nicht geladen werden. Prüfe deinen Zugang und versuche es erneut.'));load.disabled=false;}
        });wrap.append(load,message('Die interne Aufnahme wird erst auf Wunsch geladen.'));
        audio.addEventListener('play',()=>authorize(ctx).catch(()=>release(ctx)));
      }
      audio.addEventListener('error',()=>{if(!ctx.disposed)wrap.append(message('Diese Audiodatei kann gerade nicht abgespielt werden.'));});ctx.players.add(audio);
    }else return;
    if(!ctx.disposed&&epoch===ctx.epoch&&host.isConnected)host.append(wrap);
  };
  const loadRows=async(ctx,ids)=>{
    const filtered=ids.filter(id=>UUID.test(id));if(!filtered.length)return [];
    if(!ctx.public)await authorize(ctx);
    let q=Raben.client().from('raben_records').select('id,kind,title,body,details,visibility,created_by,revision').in('id',filtered);
    // Anonymous clients must not select the private creator column.
    if(ctx.public)q=Raben.client().from('raben_records').select('id,kind,title,body,details,visibility').in('id',filtered).eq('visibility','public');
    return check(q);
  };
  const references=async(ctx,ids,host)=>{
    const epoch=ctx.epoch,rows=await loadRows(ctx,Array.isArray(ids)?ids:[]);if(ctx.disposed||ctx.epoch!==epoch||!host.isConnected)return;
    const byId=new Map(rows.map(row=>[row.id,row]));
    for(const id of ids||[]){
      const row=byId.get(id);if(!row||row.kind!=='media')continue;
      const card=el('article','media-attachment');card.append(el('p','eyebrow',mediaNames[row.details?.mediaType]||'Medium'),el('h4','',row.title));
      if(row.body)card.append(el('p','hub-body',row.body));host.append(card);
      if(row.details?.imagePath||row.details?.publicImage){
        let src=publicAsset(row.details.publicImage);
        if(!src&&!ctx.public){try{const blob=await check(Raben.client().storage.from('raben-media').download(row.details.imagePath));if(ctx.disposed||ctx.epoch!==epoch)return;src=URL.createObjectURL(blob);ctx.urls ||=new Set();ctx.urls.add(src);}catch(_){}}
        if(src&&ctx.epoch===epoch&&card.isConnected){const image=document.createElement('img');image.src=src;image.alt=row.title;image.loading='lazy';image.className='hub-image';card.prepend(image);}
      }
      await render(ctx,row,card);
    }
    if(rows.length<(ids||[]).length)host.append(message('Einige Anhänge sind derzeit nicht verfügbar.'));
  };
  const relations=async(ctx,ids,host)=>{
    const epoch=ctx.epoch,rows=await loadRows(ctx,Array.isArray(ids)?ids:[]);if(ctx.disposed||ctx.epoch!==epoch||!host.isConnected)return;
    if(!rows.length)return;const wrap=el('div','media-related');wrap.append(message('Dazu gehört:'));
    for(const id of ids){const row=rows.find(r=>r.id===id);if(!row)continue;
      const a=el('a','hub-related-link',row.title),url=new URL(ctx.public?'entdecken.html':ctx.admin?'admin.html':'clan.html',Raben.config.siteUrl);url.searchParams.set('eintrag',row.id);a.href=url.href;wrap.append(a);
    }host.append(wrap);
  };
  const picker=(ctx,selected,label,{media=false,publicOnly=false,exclude=null}={})=>{
    let ids=Array.isArray(selected)?selected.filter(id=>UUID.test(id)):[],rows=[],offset=0;const names=new Map();
    const wrap=el('div','reference-picker full'),heading=el('h4','',label),chosen=el('ol','reference-order'),controls=el('div','reference-controls');
    const search=document.createElement('input');search.type='search';search.placeholder='Titel suchen';search.setAttribute('aria-label',label+' durchsuchen');
    const select=document.createElement('select');select.setAttribute('aria-label',label+' auswählen');
    const status=message('Auswahl wird geladen …'),add=btn('Hinzufügen'),more=btn('Weitere Einträge laden');
    wrap.append(heading,chosen,controls,status);controls.append(search,select,add,more);
    const changed=()=>wrap.dispatchEvent(new Event('change',{bubbles:true}));
    const drawChosen=()=>{
      chosen.replaceChildren();ids.forEach((id,index)=>{
        const item=el('li','reference-item'),text=el('span','',names.get(id)||'Nicht mehr verfügbar');
        const up=btn('↑',()=>{[ids[index-1],ids[index]]=[ids[index],ids[index-1]];drawChosen();changed();}),down=btn('↓',()=>{[ids[index+1],ids[index]]=[ids[index],ids[index+1]];drawChosen();changed();}),remove=btn('Entfernen',()=>{ids=ids.filter(value=>value!==id);drawChosen();changed();});
        up.disabled=index===0;down.disabled=index===ids.length-1;up.setAttribute('aria-label','Anhang nach oben');down.setAttribute('aria-label','Anhang nach unten');item.append(text,up,down,remove);chosen.append(item);
      });
    };
    const drawOptions=()=>{
      select.replaceChildren(el('option','','Bitte auswählen'));select.firstChild.value='';
      rows.filter(row=>row.id!==exclude&&!ids.includes(row.id)&&(row.title||'').toLowerCase().includes(search.value.toLowerCase())).forEach(row=>{const option=el('option','',row.title+' · '+(mediaNames[row.details?.mediaType]||row.kind)+' · '+states[row.visibility]);option.value=row.id;select.append(option);});
    };
    const load=async()=>{
      more.disabled=true;
      try{
        await authorize(ctx);let q=Raben.client().from('raben_records').select('id,kind,title,details,visibility').order('updated_at',{ascending:false});
        if(media)q=q.eq('kind','media');if(publicOnly)q=q.eq('visibility','public');
        const batch=await check(q.range(offset,offset+99));if(ctx.disposed||!wrap.isConnected)return;
        rows=rows.concat(batch);offset+=batch.length;batch.forEach(row=>names.set(row.id,row.title));
        if(ids.some(id=>!names.has(id))){const old=await loadRows(ctx,ids.filter(id=>!names.has(id)));old.forEach(row=>names.set(row.id,row.title));}
        drawChosen();drawOptions();status.textContent=publicOnly?'Hier stehen bereits öffentlich freigegebene Medien zur Auswahl.':'Die Reihenfolge entspricht der Anzeige im Beitrag. Öffentliche Beiträge brauchen öffentlich freigegebene Verknüpfungen.';more.hidden=batch.length<100;
      }catch(_){status.textContent='Die Auswahl konnte nicht geladen werden. Deine bisherigen Anhänge bleiben erhalten.';}finally{more.disabled=false;}
    };
    add.addEventListener('click',()=>{if(!select.value||ids.includes(select.value)||ids.length>=20)return;ids.push(select.value);drawChosen();drawOptions();changed();});search.addEventListener('input',drawOptions);more.addEventListener('click',load);
    drawChosen();Promise.resolve().then(load);return {wrap,read:()=>[...ids]};
  };
  const bytes=value=>{const n=Number(value)||0;return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';};
  const usage=async(ctx,row,host)=>{
    await authorize(ctx);const epoch=ctx.epoch;
    const [media,related]=await Promise.all([
      check(Raben.client().from('raben_records').select('id,kind,title,visibility').contains('details->mediaIds',[row.id]).limit(100)),
      check(Raben.client().from('raben_records').select('id,kind,title,visibility').contains('details->relatedIds',[row.id]).limit(100))
    ]);
    if(ctx.disposed||epoch!==ctx.epoch)return;host.replaceChildren();const rows=[...new Map([...media,...related].map(r=>[r.id,r])).values()];
    host.append(message(rows.length?'In diesen für dich sichtbaren Beiträgen verwendet:':'In keinem für dich sichtbaren Beitrag angehängt.'));
    rows.forEach(r=>{const a=el('a','hub-related-link',r.title+' · '+states[r.visibility]);const u=new URL(ctx.admin?'admin.html':'clan.html',Raben.config.siteUrl);u.searchParams.set('eintrag',r.id);a.href=u.href;host.append(a);});
    if(ctx.admin){const site=await check(Raben.client().from('raben_site_content').select('content').eq('id',1).single());if(JSON.stringify(site.content).includes(row.id))host.append(message('Außerdem in den zusätzlichen Informationen auf der Startseite verwendet.'));}
  };
  const uploadOriginal=async(ctx,file,path,bucket,controls)=>{
    if(!(bucket==='raben-media'?/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/:/^[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/).test(path||''))throw new Error('invalid_media_path');
    const format=await validateFile(file,path.endsWith('.mp3'));if(!path.endsWith('.'+format.extension))throw new Error('invalid_media_path');
    return upload(ctx,file,path.split('/')[0],controls,path.endsWith('.mp3'),path,bucket);
  };
  window.RabenMedia={uploadOriginal,youtubeId,publicAsset,validateFile,upload,publish,editSource,progressControls,release,releasePlayers,render,references,relations,picker,bytes,usage,UUID};
})();
