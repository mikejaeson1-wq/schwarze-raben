(() => {
  'use strict';
  const {el,check}=Raben;
  const labels={raben_records:'Clan- und Medienbeitrag',raben_site_content:'Website',raben_clan_posts:'Clan-Info',raben_character_notes:'Geheimnotizen'};
  const operations={baseline:'Bestand',insert:'Erstellt',update:'Geändert',delete:'Gelöscht'};
  const states={draft:'Entwurf',clan:'Clanintern',review:'Zur Freigabe',public:'Öffentlich',archived:'Archiviert'};
  const btn=(label,action,style='button outline small-button')=>{const b=el('button',style,label);b.type='button';if(action)b.addEventListener('click',action);return b;};
  const note=text=>el('p','field-note',text);
  const stamp=value=>value?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'';
  const admin=async ctx=>{const actor=ctx.authorize?await ctx.authorize():await Raben.member();if(!actor||actor.status!=='active'||actor.role!=='admin')throw {code:'42501'};return actor;};
  const action=async(ctx,b,fn)=>{b.disabled=true;try{await admin(ctx);await fn();}catch(error){ctx.report(error?.message?.startsWith('Bitte ')?error.message:error?.message?.includes('conflict')?'Der Inhalt wurde inzwischen geändert. Lade ihn erneut, bevor du die Wiederherstellung wiederholst.':error?.message?.includes('audio_file_missing')?'Die ursprüngliche MP3-Datei fehlt. Stelle sie zuerst aus der Mediensicherung wieder her.':error?.message?.includes('linked_record')?'Ein verknüpfter Eintrag fehlt oder ist noch nicht öffentlich freigegeben. Stelle zuerst die zugehörigen Medien und Beiträge wieder her.':Raben.errorMessage(error),true);}finally{b.disabled=false;}};
  const all=async(table,columns)=>{let rows=[],offset=0;for(;;){const batch=await check(Raben.client().from(table).select(columns).range(offset,offset+499));rows=rows.concat(batch);if(batch.length<500)return rows;offset+=500;}};
  const current=async(source,key)=>{
    const time=['raben_clan_posts','raben_character_notes'].includes(source),column=time?'updated_at':'revision',id=source==='raben_character_notes'?'record_id':'id';
    const rows=await check(Raben.client().from(source).select(column).eq(id,key).limit(1));return rows[0]?String(rows[0][column]):'';
  };
  const preview=(ctx,source,data,host)=>{
    host.replaceChildren();
    if(source==='raben_site_content'){
      const c=data.content||{};host.append(el('h4','',c.name||'Website'),el('p','hub-body',c.beschreibung||''));
      [['Dorf',c.dorfName],['Server im Infobereich',c.serverName],['Dorfbeschreibung',c.dorfBeschreibung],['Clangeschichte',c.geschichte]].forEach(([label,value])=>{if(value)host.append(el('p','hub-body',label+'\n'+value));});
      for(const key of ['aushang','mitglieder','rpHinweise','extraInfos'])for(const item of c[key]||[])host.append(el('p','hub-body',(item.titel||item.name||'')+'\n'+(item.text||item.beschreibung||'')));
      host.append(note('Auch Bilder, Effekte und die übrigen Website-Einstellungen gehören zu dieser Version.'));return;
    }
    host.append(el('h4','',data.title||'Geheimnotizen'),el('p','hub-body',data.body||''));
    if(data.visibility)host.append(note('Damals: '+states[data.visibility]));
    const d=data.details||{};
    [['Beruf oder Rang',d.profession],['Beziehungen',d.relationships],['Geschichte',d.story],['Kategorie',d.category],['Schlagwörter',d.tags],['Ort',d.location],['Datum',d.date],['Materialien',d.materials]].forEach(([label,value])=>{if(value)host.append(el('p','hub-body',label+': '+value));});
    if(d.fileName)host.append(note('MP3-Datei: '+d.fileName));if(d.youtubeId)host.append(note('YouTube-Link: https://youtu.be/'+d.youtubeId));
    if(d.mediaIds?.length)host.append(note(d.mediaIds.length+' Medienanhänge'));if(d.relatedIds?.length)host.append(note(d.relatedIds.length+' Verknüpfungen'));
  };
  const restore=async(ctx,version,b)=>action(ctx,b,async()=>{
    const expected=await current(version.source_table,version.entity_key);
    const prompt=version.source_table==='raben_site_content'?'Diese Website-Version wiederherstellen? Die Inhalte werden sofort öffentlich. Offene Website-Eingaben werden verworfen.':'Diese Inhaltsversion wiederherstellen? Clan- und Medienbeiträge werden als Entwurf gespeichert und anschließend gesondert freigegeben.';
    if(!confirm(prompt))return;
    await check(Raben.client().rpc('raben_restore_version',{p_version:version.id,p_expected:expected}));
    if(ctx.disposed)return;window.dispatchEvent(new CustomEvent('raben-content-restored',{detail:{source:version.source_table}}));
    ctx.report('Version wiederhergestellt'+(version.source_table==='raben_records'?' · als Entwurf.':'.'));
    if(ctx.kind==='history')await mount(ctx,'history');else if(ctx.reload)await ctx.reload();
  });
  const versionCard=(ctx,v)=>{
    const card=el('article','hub-card'),by=note('Version '+v.revision+' · '+stamp(v.changed_at));by.append(RabenIdentity.person(ctx,v.changed_by,{prefix:' · ',fallback:v.actor_name||'System'}));card.append(el('p','eyebrow',labels[v.source_table]+' · '+operations[v.operation]),el('h3','',v.title),by);
    const details=el('details','hub-details'),body=el('div','history-preview');details.append(el('summary','','Vorschau ansehen'),body);let loaded=false;
    details.addEventListener('toggle',()=>{if(details.open&&!loaded){loaded=true;preview(ctx,v.source_table,v.snapshot,body);}});
    const buttons=el('div','hub-inline-actions'),restoreButton=btn('Wiederherstellen');restoreButton.addEventListener('click',()=>restore(ctx,v,restoreButton));
    const remove=btn('Version entfernen',()=>action(ctx,remove,async()=>{
      if(!confirm('Diese gespeicherte Version endgültig entfernen? Sie kann anschließend nicht mehr wiederhergestellt werden. Der aktuelle Beitrag bleibt erhalten.'))return;
      await check(Raben.client().from('raben_content_versions').delete().eq('id',v.id));card.remove();ctx.report('Gespeicherte Version entfernt.');
    }),'button danger small-button');buttons.append(restoreButton,remove);card.append(details,buttons);return card;
  };
  const versions=async(ctx,source=null,key=null,host=ctx.list)=>{
    const epoch=ctx.epoch;host.replaceChildren();
    const form=el('form','hub-filters'),search=document.createElement('input'),actor=document.createElement('input'),select=document.createElement('select');
    search.type='search';search.placeholder='Titel suchen';search.setAttribute('aria-label','Versionen nach Titel filtern');actor.placeholder='Bearbeiter suchen';actor.setAttribute('aria-label','Bearbeiter filtern');
    select.append(el('option','','Alle Inhaltsbereiche'));select.firstChild.value='';Object.entries(labels).forEach(([value,label])=>{const option=el('option','',label);option.value=value;select.append(option);});select.setAttribute('aria-label','Inhaltsbereich');if(source){select.value=source;select.disabled=true;}
    const searchButton=btn('Filtern'),list=el('div','hub-list'),more=btn('Weitere Versionen laden');searchButton.type='submit';form.append(search,actor,select,searchButton);host.append(form,list,more);
    let offset=0,request=0;
    const load=async(reset=false)=>{
      await admin(ctx);const attempt=++request;if(reset){offset=0;list.replaceChildren();}more.disabled=true;
      let q=Raben.client().from('raben_content_versions').select('*').order('changed_at',{ascending:false}).order('id',{ascending:false});
      if(source||select.value)q=q.eq('source_table',source||select.value);if(key)q=q.eq('entity_key',key);
      if(search.value.trim())q=q.ilike('title','%'+search.value.trim()+'%');if(actor.value.trim()){
        const term=actor.value.trim().toLocaleLowerCase('de'),ids=[...ctx.identities.values()].filter(p=>p.display_name.toLocaleLowerCase('de').includes(term)).map(p=>p.user_id);
        q=ids.length?q.in('changed_by',ids):q.ilike('actor_name','%'+actor.value.trim()+'%');
      }
      const rows=await check(q.range(offset,offset+19));if(ctx.disposed||ctx.epoch!==epoch||attempt!==request)return;
      if(!rows.length&&offset===0)list.append(note('Keine passenden Inhaltsversionen.'));rows.forEach(v=>list.append(versionCard(ctx,v)));offset+=rows.length;more.hidden=rows.length<20;more.disabled=false;
    };
    form.addEventListener('submit',e=>{e.preventDefault();action(ctx,searchButton,()=>load(true));});more.addEventListener('click',()=>action(ctx,more,()=>load()));await load(true);
  };
  const view=async(ctx,source,key)=>{
    await admin(ctx);RabenMedia.releasePlayers(ctx);ctx.editor.replaceChildren();const wrap=el('section','hub-editor'),heading=el('h3','','Frühere Inhaltsversionen'),body=el('div','history-content');
    wrap.append(heading,note('Änderungen bleiben nachvollziehbar. Eine Wiederherstellung erzeugt wiederum eine neue Version.'),btn('Schließen',()=>ctx.editor.replaceChildren()),body);ctx.editor.append(wrap);await versions(ctx,source,key,body);wrap.scrollIntoView?.({block:'start'});
  };
  const inventory=async ctx=>{
    await admin(ctx);const [files,records,site]=await Promise.all([check(Raben.client().rpc('raben_storage_inventory')),all('raben_records','id,kind,title,details,visibility'),check(Raben.client().from('raben_site_content').select('content').eq('id',1).single())]);
    const available=new Set(files.map(f=>f.bucket+'/'+f.name)),ids=new Map(records.map(r=>[r.id,r])),missing=[];
    for(const r of records){
      for(const [key,bucket] of [['imagePath','raben-media'],['audioPath','raben-media'],['publicImage','raben-public'],['publicAudio','raben-public']])if(r.details[key]&&!available.has(bucket+'/'+r.details[key]))missing.push({title:r.title,id:r.id,reason:key.includes('Audio')||key==='audioPath'?'Audiodatei fehlt':'Bilddatei fehlt'});
      for(const id of r.details.mediaIds||[])if(!ids.has(id)||(r.visibility==='public'&&ids.get(id).visibility!=='public'))missing.push({title:r.title,id:r.id,reason:'Medienanhang fehlt oder ist nicht öffentlich freigegeben'});
    }
    const siteIds=[...(site.content.rabenInfoMediaIds||[]),...(site.content.extraInfos||[]).flatMap(i=>i.mediaIds||[])];for(const id of siteIds)if(!ids.has(id)||ids.get(id).visibility!=='public')missing.push({title:'Zusätzliche Informationen auf der Startseite',id:null,reason:'Medienanhang fehlt oder ist nicht öffentlich freigegeben'});
    return {files,records,missing,bytes:files.reduce((sum,f)=>sum+Number(f.size||0),0),unused:files.filter(f=>!f.used)};
  };
  const storage=async ctx=>{
    const epoch=ctx.epoch,data=await inventory(ctx);if(ctx.disposed||epoch!==ctx.epoch)return;
    ctx.list.append(el('article','hub-card'));const summary=ctx.list.lastChild;summary.append(el('h3','',RabenMedia.bytes(data.bytes)+' in '+data.files.length+' Clan-Dateien'),note('Gezählt werden die internen und öffentlichen Beitragsdateien. Persönliche Clanprofile und ihre Bilder sind hier nicht enthalten. Bereits verwendete Dateien und Dateien in gespeicherten Versionen werden beim Aufräumen geschützt.'),note('Bilder: bis 50 MB · MP3: bis 20 MB · '+data.unused.length+' unbenutzte Dateien · '+data.missing.length+' Hinweise zu fehlenden Medien.'));
    if(data.missing.length){const card=el('article','hub-card');card.append(el('h3','','Fehlende Medien prüfen'));data.missing.forEach(item=>{const line=el('p','hub-body',item.title+' · '+item.reason);if(item.id){const a=el('a','hub-related-link','Beitrag öffnen'),url=new URL('admin.html',Raben.config.siteUrl);url.searchParams.set('eintrag',item.id);a.href=url.href;line.append(a);}card.append(line);});ctx.list.append(card);}
    const select=document.createElement('select');[['','Alle Dateien'],['unused','Nur unbenutzte Dateien'],['private','Nur private Dateien'],['public','Nur öffentliche Dateien']].forEach(([value,label])=>{const option=el('option','',label);option.value=value;select.append(option);});select.setAttribute('aria-label','Dateien filtern');const list=el('div','hub-list');ctx.list.append(select,list);
    const draw=()=>{
      list.replaceChildren();data.files.filter(f=>!select.value||select.value==='unused'&&!f.used||select.value==='private'&&f.bucket==='raben-media'||select.value==='public'&&f.bucket==='raben-public').forEach(file=>{
        const card=el('article','hub-card'),names=file.records.map(r=>r.title);card.append(el('h4','',names[0]||'Datei ohne aktuellen Beitrag'),note((file.bucket==='raben-media'?'Privat':'Öffentlich')+' · '+RabenMedia.bytes(file.size)+' · '+(file.type==='audio/mpeg'?'MP3':'Bild')),note(names.length?'In Beiträgen: '+names.join(', '):'Keine direkte Verwendung in einem aktuellen Beitrag.'));
        if(file.website)card.append(note('In Website-Einstellungen verwendet.'));if(file.historyCount)card.append(note('In '+file.historyCount+' gespeicherten Versionen benötigt.'));
        const name=el('details','hub-details');name.append(el('summary','','Datei zuordnen'),note(file.name));card.append(name);
        if(!file.used){const remove=btn('Unbenutzte Datei entfernen',()=>action(ctx,remove,async()=>{
          if(!confirm('Diese unbenutzte Datei endgültig aus dem Clan-Speicher entfernen?'))return;
          const deleted=await check(Raben.client().storage.from(file.bucket).remove([file.name]));if(!deleted?.length)throw new Error('Bitte aktualisiere die Liste. Diese Datei wird möglicherweise inzwischen verwendet.');
          ctx.report('Unbenutzte Datei entfernt.');await mount(ctx,'storage');
        }),'button danger small-button');card.append(remove);}else card.append(note('Verwendete Datei · geschützt vor dem Aufräumen.'));list.append(card);
      });if(!list.childNodes.length)list.append(note('Keine Dateien in dieser Auswahl.'));
    };select.addEventListener('change',draw);draw();
  };
  const download=(ctx,name,blob)=>{
    const url=URL.createObjectURL(blob);ctx.urls ||=new Set();ctx.urls.add(url);const a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>{URL.revokeObjectURL(url);ctx.urls.delete(url);},30000);
  };
  const backup=async ctx=>{
    const card=el('article','hub-card');ctx.list.append(card);card.append(el('h3','','Eine Sicherung für eure Inhalte.'),note('Der JSON-Export enthält Website-Inhalte, Clanbeiträge, Geheimnotizen aus dem Charakterbuch, Mitgliederrechte, Bewerbungen und Inhaltsversionen. Die Mediensicherung enthält zusätzlich die zugehörigen Dateien. Persönliche Clanprofile und ihre Bilder sind nicht enthalten. Bewahre diese privaten Sicherungen bei dir auf.'));
    const exportJson=btn('Inhalte als JSON sichern',()=>action(ctx,exportJson,async()=>{const data=await check(Raben.client().rpc('raben_export_content'));await admin(ctx);if(ctx.disposed)return;download(ctx,'schwarze-raben-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));ctx.report('Inhaltssicherung heruntergeladen. MP3-Dateien und Bilder sicherst du zusätzlich über die Mediensicherung.');}),'button');
    const exportZip=btn('Inhalte und Dateien als ZIP sichern'),cancel=btn('Sicherung abbrechen'),progress=note('');cancel.hidden=true;let cancelled=false;
    cancel.addEventListener('click',()=>{cancelled=true;});
    exportZip.addEventListener('click',()=>action(ctx,exportZip,async()=>{
      if(!window.fflate)throw new Error('Bitte lade die Seite erneut. Die ZIP-Funktion fehlt.');
      cancelled=false;cancel.hidden=false;
      try{
        const data=await check(Raben.client().rpc('raben_export_content')),day=new Date().toISOString().slice(0,10);let part=1,total=0,entries={'backup.json':fflate.strToU8(JSON.stringify(data,null,2))};
        const flush=()=>{download(ctx,'schwarze-raben-'+day+'-teil-'+part+'.zip',new Blob([fflate.zipSync(entries,{level:0})],{type:'application/zip'}));part++;total=0;entries={'backup.json':fflate.strToU8(JSON.stringify(data,null,2))};};
        for(let i=0;i<data.files.length;i++){
          await admin(ctx);if(cancelled||ctx.disposed)throw new Error('Bitte starte die Sicherung erneut, um alle Teile zu erhalten.');
          const file=data.files[i];if(!['raben-media','raben-public'].includes(file.bucket)||!(file.bucket==='raben-media'?/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/:/^[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/).test(file.name))throw new Error('Bitte prüfe unter Speicher eine nicht regulär benannte Datei, bevor du die ZIP-Sicherung wiederholst.');progress.textContent='Datei '+(i+1)+' von '+data.files.length+' · '+RabenMedia.bytes(file.size);
          const blob=await check(Raben.client().storage.from(file.bucket).download(file.name));await admin(ctx);if(cancelled||ctx.disposed)throw new Error('Bitte starte die Sicherung erneut, um alle Teile zu erhalten.');
          if(total+blob.size>40*1024*1024&&total)flush();entries['files/'+file.bucket+'/'+file.name]=new Uint8Array(await blob.arrayBuffer());total+=blob.size;
        }
        if(!ctx.disposed){flush();progress.textContent='Sicherung fertig · '+(part-1)+' ZIP-Teil(e). Bewahre alle Teile auf.';ctx.report('Inhalte und Mediendateien gesichert.');}
      }finally{cancel.hidden=true;}
    }));card.append(el('div','hub-inline-actions'));card.lastChild.append(exportJson,exportZip,cancel);card.append(progress,note('Große Sicherungen werden in mehrere ZIP-Dateien aufgeteilt. Für umfangreiche Sicherungen eignet sich ein Computer am besten.'));
    const restoreCard=el('article','hub-card'),fileLabel=el('label','form-field','Inhaltssicherung zur Prüfung auswählen'),file=document.createElement('input');file.type='file';file.accept='.json,application/json';fileLabel.append(file);
    const choices=document.createElement('select');choices.setAttribute('aria-label','Inhalt zur Wiederherstellung auswählen');choices.hidden=true;const body=el('div','history-preview'),restore=btn('Ausgewählten Inhalt wiederherstellen');restore.hidden=true;
    restoreCard.append(el('h3','','Inhalte aus einer Sicherung wiederherstellen.'),note('Wähle eine exportierte JSON-Datei und prüfe einzelne Inhalte vor der Wiederherstellung. Mitgliedsrechte, Discord-Konten, Bewerbungen und Abstimmungen werden dadurch nicht überschrieben. Clan- und Medienbeiträge werden als Entwürfe wiederhergestellt.'),fileLabel,choices,body,restore);ctx.list.append(restoreCard);
    let imported=null,items=[];
    file.addEventListener('change',async()=>{
      try{
        await admin(ctx);const selected=file.files?.[0];if(!selected)return;if(selected.size>10000000)throw new Error('Bitte wähle eine Inhaltssicherung mit maximal 10 MB.');
        const parsed=JSON.parse(await selected.text());if(parsed.application!=='schwarze-raben'||parsed.schemaVersion!==1)throw new Error('Bitte wähle eine JSON-Inhaltssicherung der Schwarzen Raben.');
        if(ctx.disposed)return;imported=parsed;items=[];
        if(parsed.siteContent?.id===1)items.push({source:'raben_site_content',key:'1',data:parsed.siteContent,title:'Website-Inhalte'});
        for(const [name,source] of [['records','raben_records'],['posts','raben_clan_posts'],['notes','raben_character_notes']])for(const item of parsed[name]||[]){const key=item.id||item.record_id;if(RabenMedia.UUID.test(key||''))items.push({source,key,data:item,title:item.title||'Geheimnotizen'});}
        choices.replaceChildren(el('option','','Bitte Inhalt auswählen'));choices.firstChild.value='';items.forEach((item,index)=>{const option=el('option','',item.title+' · '+labels[item.source]);option.value=String(index);choices.append(option);});choices.hidden=false;restore.hidden=true;body.replaceChildren();fillMediaTargets();ctx.report(items.length+' Inhalte zur Prüfung geladen. Es wurde noch nichts wiederhergestellt.');
      }catch(error){ctx.report(error.message?.startsWith('Bitte ')?error.message:'Diese Datei konnte nicht als Inhaltssicherung gelesen werden.',true);}
    });
    choices.addEventListener('change',()=>{const item=choices.value===''?null:items[Number(choices.value)];restore.hidden=!item;if(item)preview(ctx,item.source,item.data,body);else body.replaceChildren();});
    restore.addEventListener('click',()=>action(ctx,restore,async()=>{
      const item=items[Number(choices.value)];if(!item||!imported)return;const expected=await current(item.source,item.key);
      if(!confirm(item.source==='raben_site_content'?'Diese Website-Inhalte aus der Sicherung sofort öffentlich wiederherstellen? Offene Website-Eingaben werden verworfen.':'Diesen geprüften Inhalt aus der Sicherung wiederherstellen? Clan- und Medienbeiträge werden zunächst Entwürfe.'))return;
      // Send only the reviewed item, not every private entry back to the server.
      const collection={raben_site_content:'siteContent',raben_records:'records',raben_clan_posts:'posts',raben_character_notes:'notes'}[item.source],payload={application:'schwarze-raben',schemaVersion:1};payload[collection]=collection==='siteContent'?item.data:[item.data];
      await check(Raben.client().rpc('raben_restore_backup_item',{p_backup:payload,p_source:item.source,p_key:item.key,p_expected:expected}));if(ctx.disposed)return;window.dispatchEvent(new CustomEvent('raben-content-restored',{detail:{source:item.source}}));ctx.report('Geprüften Inhalt wiederhergestellt'+(item.source==='raben_records'?' · als Entwurf.':'.'));
    }));
    const mediaCard=el('article','hub-card');mediaCard.append(el('h3','','Mediendatei aus einem ZIP-Teil wiederherstellen.'),note('Entpacke die Mediensicherung bei dir. Wähle „backup.json“, danach die passende Originaldatei aus dem Ordner „files“. Bestehende Dateien werden dabei nicht überschrieben.'));
    const mediaLabel=el('label','form-field','Originaldatei auswählen'),mediaFile=document.createElement('input');mediaFile.type='file';mediaFile.accept='.mp3,image/jpeg,image/png,image/webp';mediaLabel.append(mediaFile);const target=document.createElement('select');target.setAttribute('aria-label','Datei aus dem Sicherungsverzeichnis auswählen');const mediaRestore=btn('Fehlende Originaldatei hochladen'),uploadProgress=RabenMedia.progressControls();mediaCard.append(mediaLabel,target,mediaRestore,uploadProgress.wrap);ctx.list.append(mediaCard);
    const fillMediaTargets=()=>{target.replaceChildren(el('option','','Datei aus Sicherung auswählen'));target.firstChild.value='';(imported?.files||[]).filter(f=>['raben-media','raben-public'].includes(f.bucket)).forEach(f=>{const o=el('option','',(f.records?.[0]?.title||f.name)+' · '+(f.bucket==='raben-media'?'Privat':'Öffentlich')+' · '+RabenMedia.bytes(f.size));o.value=f.bucket+'/'+f.name;target.append(o);});};
    mediaRestore.addEventListener('click',()=>action(ctx,mediaRestore,async()=>{
      const selected=mediaFile.files?.[0],value=target.value,slash=value.indexOf('/'),bucket=value.slice(0,slash),name=value.slice(slash+1);if(!selected||!name)throw new Error('Bitte wähle eine Originaldatei und den passenden Eintrag aus der Sicherung.');
      if(!['raben-media','raben-public'].includes(bucket)||!(bucket==='raben-media'?/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/:/^[a-f0-9-]{36}\.(jpg|png|webp|mp3)$/).test(name))throw new Error('Bitte wähle eine gültige Originaldatei aus der Sicherung.');
      const format=await RabenMedia.validateFile(selected,name.endsWith('.mp3'));if(!name.endsWith('.'+format.extension))throw new Error('Bitte wähle dieselbe Dateiart wie in der Sicherung.');
      if(!confirm(bucket==='raben-public'?'Diese früher öffentliche Datei wieder öffentlich bereitstellen? Vorhandene Dateien werden nicht ersetzt.':'Diese fehlende private Originaldatei wieder hochladen? Vorhandene Dateien werden nicht ersetzt.'))return;
      await RabenMedia.uploadOriginal(ctx,selected,name,bucket,uploadProgress);ctx.report('Originaldatei wiederhergestellt. Du kannst nun den zugehörigen Medienbeitrag wiederherstellen.');
    }));
  };
  const mount=async(ctx,kind)=>{
    await admin(ctx);const epoch=++ctx.epoch;ctx.list.replaceChildren();ctx.editor.replaceChildren();ctx.more.hidden=true;
    if(kind==='history')await versions(ctx);else if(kind==='storage')await storage(ctx);else if(kind==='backup')await backup(ctx);
    if(!ctx.disposed&&ctx.epoch===epoch)ctx.report('');
  };
  const dashboard=async(ctx,host)=>{
    const epoch=ctx.epoch,data=await inventory(ctx);if(ctx.disposed||ctx.epoch!==epoch||!host.isConnected)return;
    [['Clan-Speicher',RabenMedia.bytes(data.bytes)],['Unbenutzte Dateien',data.unused.length],['Medien prüfen',data.missing.length]].forEach(([label,value])=>{const b=btn('',()=>ctx.navigate('storage'),'hub-stat');b.append(el('strong','',String(value)),el('span','',label));host.append(b);});
  };
  window.RabenHistory={mount,view,dashboard,inventory,preview};
})();
