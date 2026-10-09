(() => {
  'use strict';
  const {el,check}=Raben,expansion=window.RabenExpansion,B='raben-clan-info-media';
  if(!expansion)return;
  const sections=[['body','Über unseren Clan'],['rules','Interne Regeln und Absprachen'],['playtimes','Spielzeiten und Organisation'],['contact','Clanführung und Ansprechpartner']];
  const positions=[['left','Links · Text fließt rechts vorbei'],['right','Rechts · Text fließt links vorbei'],['center','Zentriert · eigener Absatz'],['wide','Über die ganze Breite']];
  const live=(ctx,e)=>!ctx.disposed&&ctx.epoch===e;
  const note=text=>el('p','field-note',text);
  const button=(text,fn)=>{const b=el('button','button outline small-button',text);b.type='button';b.addEventListener('click',fn);return b;};
  const field=(label,type,value,options=[])=>expansion.field(label,type,value,options);
  const loader=ctx=>{const cache=new Map(),epoch=ctx.epoch;return path=>{
    if(!path)return Promise.resolve('');
    if(!cache.has(path))cache.set(path,(async()=>{await ctx.authorize();if(!live(ctx,epoch))return '';const blob=await check(Raben.client().storage.from(B).download(path));if(!live(ctx,epoch))return '';const url=URL.createObjectURL(blob);ctx.urls.add(url);return url;})());
    return cache.get(path);
  };};
  const renderInfo=(host,values,pictures,load,ctx,preview=false)=>{
    const epoch=ctx.epoch;host.replaceChildren();host.append(el('h3','',values.title||'Claninfos'));
    for(const [key,label] of sections){
      const article=el('article','hub-card clan-info-section');article.dataset.infoSection=key;article.append(el('h4','',label));
      const flow=el('div','clan-info-flow'),paragraphs=(values[key]||'Die Clanführung ergänzt diese Angaben.').split(/\n\s*\n/),images=pictures.filter(p=>p.section===key);article.append(flow);host.append(article);const layout=values.layout||{};flow.style.setProperty('--info-columns',String(layout.columns||1));flow.style.setProperty('--info-column-gap',(layout.gap??24)+'px');flow.style.setProperty('--info-image-spacing',(layout.imageSpacing??16)+'px');
      for(let n=0;n<=paragraphs.length;n++){
        for(const picture of images.filter(p=>Math.min(paragraphs.length,Number(p.paragraph)||0)===n)){
          const figure=el('figure','clan-info-image');figure.dataset.position=picture.position;figure.dataset.infoBlock='image:'+picture.id;figure.style.setProperty('--info-image-width',Math.max(15,Math.min(100,Number(picture.width)||40))+'%');
          const image=el('img','');image.alt=picture.title||'Bild in den Claninfos';image.loading='lazy';figure.append(image);if(picture.title)figure.append(el('figcaption','field-note',picture.title));
          if(!preview&&picture.imagePath&&window.RabenGallery)figure.append(RabenGallery.opener(ctx,{bucket:B,path:picture.imagePath,title:picture.title},'Bild öffnen'));
          flow.append(figure);if(picture._url)image.src=picture._url;else RabenQol.observe(ctx,figure,()=>load(picture.previewPath||picture.imagePath).then(url=>{if(live(ctx,epoch)&&figure.isConnected&&url)image.src=url;}).catch(()=>{if(figure.isConnected)figure.append(note('Das Bild ist momentan nicht verfügbar.'));}));
        }
        if(n<paragraphs.length){const p=el('p','hub-body',paragraphs[n]);p.dataset.infoBlock='text:'+n;flow.append(p);}
      }
      const order=layout.order?.[key]||[],nodes=new Map([...flow.children].map(n=>[n.dataset.infoBlock,n]));for(const id of order)if(nodes.has(id)){flow.append(nodes.get(id));nodes.delete(id);}for(const node of nodes.values())flow.append(node);
    }
  };
  const clanInfo=async ctx=>{
    const epoch=ctx.epoch,row=await check(Raben.client().from('raben_clan_information').select('*').eq('id',1).single());if(!live(ctx,epoch))return;
    const load=loader(ctx),view=el('section','clan-info-view');ctx.list.append(view);renderInfo(view,row,row.images||[],load,ctx);
    if(ctx.actor.role!=='admin')return;
    const f=el('form','settings-form clan-info-editor'),fields={},items=[],imageList=el('div','clan-info-image-editor'),preview=el('section','clan-info-preview'),progress=RabenMedia.progressControls();let revision=row.revision,busy=false,draft;const layout={columns:row.layout?.columns||1,gap:row.layout?.gap??24,imageSpacing:row.layout?.imageSpacing??16,order:structuredClone(row.layout?.order||{})};
    f.append(el('h3','','Claninfos bearbeiten'),note('Bilder lassen sich in jedem Abschnitt links, rechts, zentriert oder über die volle Breite einsetzen. Der Text fließt automatisch um seitliche Bilder. Leerzeilen trennen die Textabsätze.'));
    for(const [key,label] of [['title','Clanname'],...sections]){const x=field(label,key==='title'?'text':'textarea',row[key]||'');x.input.maxLength=key==='title'?120:['playtimes','contact'].includes(key)?10000:20000;if(key==='title')x.input.required=true;fields[key]=x.input;f.append(x.wrap);}
    const layoutControls={columns:field('Vorlage / Spalten','select',layout.columns,[['1','Einspaltig'],['2','Zwei Spalten'],['3','Drei Spalten']]),gap:field('Abstand zwischen Spalten in Pixel','range',layout.gap),imageSpacing:field('Bildabstand in Pixel','range',layout.imageSpacing)};for(const [key,x] of Object.entries(layoutControls)){if(key!=='columns'){x.input.min=0;x.input.max=48;x.input.step=1;}f.append(x.wrap);}const readLayout=()=>({...layout,columns:Number(layoutControls.columns.input.value),gap:Number(layoutControls.gap.input.value),imageSpacing:Number(layoutControls.imageSpacing.input.value)});const values=()=>({...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()])),layout:readLayout()});
    const readPicture=item=>({id:item.saved.id,section:item.inputs.section.value,imagePath:item.saved.imagePath,previewPath:item.saved.previewPath||null,position:item.inputs.position.value,width:Number(item.inputs.width.value),paragraph:Number(item.inputs.paragraph.value),title:item.inputs.title.value.trim(),...(item.url?{_url:item.url}:{})});
    const redraw=()=>{renderInfo(preview,values(),items.filter(i=>!i.removed&&(i.saved.imagePath||i.url)).map(readPicture),load,ctx,true);
      for(const article of preview.querySelectorAll('[data-info-section]')){const key=article.dataset.infoSection,flow=article.querySelector('.clan-info-flow');let dragging='';const move=(id,target,before=true)=>{const nodes=[...flow.children],source=nodes.find(n=>n.dataset.infoBlock===id),destination=nodes.find(n=>n.dataset.infoBlock===target);if(!source||!destination||source===destination)return;flow.insertBefore(source,before?destination:destination.nextSibling);layout.order[key]=[...flow.children].map(n=>n.dataset.infoBlock);ctx.dirty=true;redraw();};
       for(const node of [...flow.children]){node.draggable=true;node.classList.add('clan-info-draggable');node.addEventListener('dragstart',event=>{dragging=node.dataset.infoBlock;event.dataTransfer?.setData('text/plain',dragging);});node.addEventListener('dragover',event=>event.preventDefault());node.addEventListener('drop',event=>{event.preventDefault();move(dragging||event.dataTransfer?.getData('text/plain'),node.dataset.infoBlock);});const controls=el('span','block-order-controls');controls.append(button('↑',()=>{const previous=node.previousElementSibling;if(previous)move(node.dataset.infoBlock,previous.dataset.infoBlock);}),button('↓',()=>{const next=node.nextElementSibling;if(next)move(node.dataset.infoBlock,next.dataset.infoBlock,false);}));controls.firstChild.setAttribute('aria-label','Block nach oben verschieben');controls.lastChild.setAttribute('aria-label','Block nach unten verschieben');node.append(controls);}
      }
    };
    const addImage=(saved={})=>{
      if(items.filter(i=>!i.removed).length>=24){ctx.report('In den Claninfos sind höchstens 24 Bilder möglich.',true);return;}
      const card=el('fieldset','clan-info-image-fields'),inputs={},item={saved:{id:crypto.randomUUID(),section:'body',position:'left',width:40,paragraph:0,title:'',...saved},inputs,removed:false,url:''};card.append(el('legend','','Bild und Position'));card.dataset.clanImage=item.saved.id;
      for(const [key,label,type,choices] of [['section','Bild in diesem Abschnitt','select',sections],['position','Bildposition','select',positions],['width','Bildbreite in Prozent','range'],['paragraph','Bild nach Absatz · 0 = vor dem Text','number'],['title','Bildunterschrift · optional','text']]){
        const x=field(label,type,item.saved[key],choices);inputs[key]=x.input;x.input.dataset.imageField=key;if(['paragraph','section'].includes(key))x.input.addEventListener('change',()=>{delete layout.order[item.saved.section];delete layout.order[inputs.section.value];});if(key==='width'){x.input.min=15;x.input.max=100;x.input.step=1;const output=el('output','field-note',x.input.value+' %');x.wrap.append(output);x.input.addEventListener('input',()=>output.textContent=x.input.value+' %');}if(key==='paragraph'){x.input.min=0;x.input.max=2000;x.input.step=1;x.input.required=true;}if(key==='title')x.input.maxLength=120;card.append(x.wrap);
      }
      const file=field(saved.imagePath?'Bild ersetzen':'Bild hochladen','file');file.input.accept='image/jpeg,image/png,image/webp';file.input.required=!saved.imagePath;item.file=file.input;card.append(file.wrap,note('JPG, PNG oder WebP · bis 50 MB. Die Vorschau zeigt Position, Bildbreite und Textfluss.'));
      file.input.addEventListener('change',async()=>{const chosen=file.input.files?.[0],attempt=Symbol();item.request=attempt;if(!chosen)return;try{await RabenMedia.validateFile(chosen,false);if(!live(ctx,epoch)||item.request!==attempt||item.removed)return;if(item.url){URL.revokeObjectURL(item.url);ctx.urls.delete(item.url);}item.url=URL.createObjectURL(chosen);ctx.urls.add(item.url);redraw();}catch(error){ctx.report(RabenMedia.errorMessage(error),true);}});
      card.append(button('Bild entfernen',()=>{if(busy)return;item.removed=true;card.remove();ctx.dirty=true;redraw();}));items.push(item);imageList.append(card);redraw();
    };
    f.append(imageList,button('Bild hinzufügen',()=>{if(busy)return;addImage();ctx.dirty=true;}),el('h4','','Vorschau der Claninfos'),preview,progress.wrap);
    const save=el('button','button small-button','Claninfos speichern');save.type='submit';f.append(save,note('Die Bilder sind nur im Clan sichtbar. Die öffentliche Website hat ihre eigenen Inhalte.'));
    f.addEventListener('input',()=>{ctx.dirty=true;redraw();});f.addEventListener('change',()=>{ctx.dirty=true;redraw();});ctx.list.append(f);for(const image of row.images||[])addImage(image);redraw();draft=await RabenQol.draft(ctx,f,'claninfo:1',revision);
    f.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;save.disabled=true;const controls=[...f.querySelectorAll('input,select,textarea')];controls.forEach(i=>i.disabled=true);
      try{
        const actor=await ctx.authorize();if(actor?.role!=='admin')throw {code:'42501'};const pictures=[];
        for(const item of items.filter(i=>!i.removed)){
          const picture=readPicture(item);delete picture._url;
          if(item.file.files?.[0]){const uploaded=await RabenPictures.upload(ctx,item.file.files[0],progress,B);picture.imagePath=uploaded.imagePath;picture.previewPath=uploaded.mediumPath||uploaded.thumbPath||null;}
          if(!picture.imagePath)throw new Error('Bitte wähle für jedes hinzugefügte Bild eine Datei aus.');pictures.push(picture);
        }
        if(!live(ctx,epoch)||!f.isConnected)return;const changed={...values(),images:pictures},rows=await check(Raben.client().from('raben_clan_information').update(changed).eq('id',1).eq('revision',revision).select('revision'));
        if(!rows.length)throw new Error('Inzwischen geändert. Aktualisiere die Claninfos, bevor du speicherst.');revision=rows[0].revision;items.filter(i=>!i.removed).forEach((item,n)=>{item.saved=pictures[n];item.file.value='';item.file.required=false;});await draft?.clear();ctx.dirty=false;renderInfo(view,changed,pictures,load,ctx);redraw();ctx.report('Claninfos gespeichert. Bilder und Bildpositionen sind übernommen.');
      }catch(error){if(live(ctx,epoch))ctx.report(error.message||Raben.errorMessage(error),true);}finally{busy=false;save.disabled=false;controls.forEach(i=>i.disabled=false);}
    });
  };
  const siteMusic=async ctx=>{
    if(ctx.actor.role!=='admin')throw {code:'42501'};const epoch=ctx.epoch,row=await check(Raben.client().from('raben_site_content').select('content,revision').eq('id',1).single());if(!live(ctx,epoch))return;
    const saved=row.content.homeSpotify||{},f=el('form','settings-form'),enabled=field('Begleitmusik auf der Startseite anzeigen','checkbox',saved.enabled===true),url=field('Spotify-Link · Song oder Playlist','url',saved.id?'https://open.spotify.com/'+saved.type+'/'+saved.id:''),title=field('Titel des Musikplayers','text',saved.title||'Musik aus dem Norden'),autoplay=field('Nach Freigabe auf dem Gerät automatisch starten','checkbox',saved.autoplay!==false),save=el('button','button small-button','Startseiten-Musik speichern');let revision=row.revision,content=row.content;url.input.maxLength=1000;title.input.maxLength=120;save.type='submit';
    f.append(el('h3','','Spotify als Begleitmusik'),enabled.wrap,url.wrap,title.wrap,autoplay.wrap,note('Der Player bleibt sichtbar und lässt sich pausieren. Besucher können Autostart auf ihrem Gerät freigeben. Falls der Browser ihn blockiert, lässt sich die Musik direkt im Player starten.'),save);ctx.list.append(f);
    f.addEventListener('input',()=>ctx.dirty=true);f.addEventListener('change',()=>ctx.dirty=true);
    f.addEventListener('submit',async event=>{event.preventDefault();if(save.disabled)return;save.disabled=true;try{await ctx.authorize();const link=RabenMedia.spotifyLink(url.input.value);if(enabled.input.checked&&!link)throw new Error('Bitte füge einen gültigen Spotify-Link zu einem Song oder einer Playlist ein.');const homeSpotify=link?{...link,title:title.input.value.trim()||'Begleitmusik',enabled:enabled.input.checked,autoplay:autoplay.input.checked}:null,updated={...content,homeSpotify},rows=await check(Raben.client().from('raben_site_content').update({content:updated}).eq('id',1).eq('revision',revision).select('revision'));if(!rows.length)throw new Error('Inzwischen geändert. Bitte aktualisiere den Bereich.');if(!live(ctx,epoch))return;revision=rows[0].revision;content=updated;ctx.dirty=false;ctx.report('Spotify-Begleitmusik für die Startseite gespeichert.');}catch(error){if(live(ctx,epoch))ctx.report(error.message||Raben.errorMessage(error),true);}finally{save.disabled=false;}});
  };
  Object.assign(expansion.labels,{siteMusic:'Startseiten-Musik'});Object.assign(expansion.handlers,{clanInfo,siteMusic});
  window.RabenClanPresentation={clanInfo,siteMusic,renderInfo};
})();
