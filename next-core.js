(() => {
  'use strict';
  const {el,check}=Raben;
  const note=text=>el('p','field-note',text);
  const field=(...args)=>RabenExpansion.field(...args);
  const clean=ctx=>!ctx.disposed;
  const number=value=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(value);
  const download=(ctx,name,blob)=>{const url=URL.createObjectURL(blob);ctx.urls.add(url);const a=el('a','');a.download=name;a.href=url;document.body.append(a);a.click();a.remove();};

  // Undo is tab-memory only. File inputs, credentials, recipients and publication choices are excluded.
  const histories=new Map();
  const editable=form=>[...form.querySelectorAll('input,textarea')].filter(i=>!i.readOnly&&!i.disabled&&!i.closest('[data-undo-ignore]')&&(i.tagName==='TEXTAREA'||['text','search','email','url','number','date','time','datetime-local','range','color'].includes(i.type)));
  function attachHistory(form){
    if(histories.has(form)||form.dataset.noUndo!==undefined)return;
    const bar=el('div','edit-history'),undo=el('button','button outline small-button','↶ Rückgängig'),redo=el('button','button outline small-button','↷ Wiederholen');
    undo.type=redo.type='button';undo.setAttribute('aria-label','Letzte Eingabe rückgängig machen');redo.setAttribute('aria-label','Zurückgenommene Eingabe wiederholen');bar.append(undo,redo);form.prepend(bar);
    let back=[],ahead=[],prior=new Map(editable(form).map(i=>[i,i.value])),applying=false,last=0,lastTarget=null;
    const update=()=>{undo.disabled=!back.length;redo.disabled=!ahead.length;};
    const capture=event=>{if(applying)return;const inputs=editable(form),now=new Map(inputs.map(i=>[i,i.value]));if(!inputs.some(i=>prior.has(i)&&prior.get(i)!==i.value)){prior=now;return;}
      if(Date.now()-last>450||lastTarget!==event.target){back.push(new Map(inputs.map(i=>[i,prior.has(i)?prior.get(i):i.value])));if(back.length>60)back.shift();}last=Date.now();lastTarget=event.target;ahead=[];prior=now;update();};
    const restore=(from,to)=>{if(!from.length)return;applying=true;to.push(new Map(editable(form).map(i=>[i,i.value])));const state=from.pop();for(const [input,value] of state)if(input.isConnected){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}prior=new Map(editable(form).map(i=>[i,i.value]));applying=false;last=0;update();};
    const baseline=event=>{if(editable(form).includes(event.target)&&!prior.has(event.target))prior.set(event.target,event.target.value);};form.addEventListener('beforeinput',baseline);form.addEventListener('focusin',baseline);form.addEventListener('input',capture);form.addEventListener('change',capture);undo.addEventListener('click',()=>restore(back,ahead));redo.addEventListener('click',()=>restore(ahead,back));
    form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&['z','y'].includes(event.key.toLowerCase())&&editable(form).includes(event.target)){event.preventDefault();const forward=event.key.toLowerCase()==='y'||event.shiftKey;restore(forward?ahead:back,forward?back:ahead);}});
    histories.set(form,()=>{back=[];ahead=[];prior.clear();});update();
  }
  let focusState=null;
  const scopeKey=node=>{const card=node.closest('article');return (card?.dataset.recordId||card?.dataset.profileItem||card?.dataset.profileImage||card?.dataset.postId||card?.querySelector('h3,h4,h5')?.textContent||'')+'|'+(node.closest('form')?.querySelector('h3,h4')?.textContent||'');};
  const focusKey=node=>node.id||node.name||[...node.closest('label')?.childNodes||[]].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
  document.addEventListener('focusin',event=>{const node=event.target;if(node.matches?.('input,textarea,select,button'))focusState={node,key:focusKey(node),scope:scopeKey(node),start:node.selectionStart,end:node.selectionEnd};});
  document.addEventListener('input',event=>{if(focusState?.node===event.target){focusState.start=event.target.selectionStart;focusState.end=event.target.selectionEnd;}});
  const enhance=()=>{
    for(const [form,dispose] of histories)if(!form.isConnected){dispose();histories.delete(form);}
    for(const form of document.querySelectorAll('form'))attachHistory(form);
    for(const dialog of document.querySelectorAll('dialog')){if(dialog.getAttribute('aria-modal')!=='true')dialog.setAttribute('aria-modal','true');if(!dialog.classList.contains('next-dialog'))dialog.classList.add('next-dialog');}
    for(const map of document.querySelectorAll('.qol-map,.village-map'))attachMap(map);
    if(focusState?.key&&!focusState.node.isConnected&&(!document.activeElement||document.activeElement===document.body)){
      const match=[...document.querySelectorAll('input,textarea,select,button')].find(n=>focusKey(n)===focusState.key&&scopeKey(n)===focusState.scope&&!n.closest('[hidden]'));
      if(match){match.focus?.({preventScroll:true});if(typeof focusState.start==='number')try{match.setSelectionRange(focusState.start,focusState.end);}catch(_){}focusState.node=match;}
    }
  };
  let scheduled=false;
  if(window.MutationObserver)new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;enhance();});}}).observe(document.body,{childList:true,subtree:true});

  const mapSet=new WeakSet();
  function attachMap(map){
    if(mapSet.has(map))return;mapSet.add(map);
    const viewport=el('div','next-map-viewport'),controls=el('div','hub-inline-actions'),stage=el('div','next-map-stage'),legacy=map.closest('.village-viewport');if(legacy){const old=legacy.previousElementSibling;if(old?.classList.contains('hub-inline-actions'))old.remove();legacy.before(controls,viewport);}else map.before(controls,viewport);viewport.append(stage);stage.append(map);legacy?.remove();map.style.maxWidth='none';map.style.width='100%';
    let scale=1,x=0,y=0,points=new Map(),gesture=null;
    const draw=()=>{const w=viewport.clientWidth||500,h=viewport.clientHeight||350;x=Math.max(-w*(scale-1),Math.min(0,x));y=Math.max(-h*(scale-1),Math.min(0,y));stage.style.transform=`translate(${x}px,${y}px) scale(${scale})`;viewport.setAttribute('aria-label','Karte · Zoom '+Math.round(scale*100)+' Prozent · Pfeiltasten verschieben den Ausschnitt');};
    const zoom=(value,cx=(viewport.clientWidth||500)/2,cy=(viewport.clientHeight||350)/2)=>{const next=Math.max(1,Math.min(5,value));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;draw();};
    for(const [label,action] of [['Vergrößern',()=>zoom(scale*1.25)],['Verkleinern',()=>zoom(scale/1.25)],['Ausgangsausschnitt',()=>{scale=1;x=y=0;draw();}]]){const b=el('button','button outline small-button',label);b.type='button';b.addEventListener('click',action);controls.append(b);}
    viewport.tabIndex=0;viewport.addEventListener('keydown',e=>{const delta={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];if(delta){e.preventDefault();e.stopPropagation();x+=delta[0];y+=delta[1];draw();}});
    const metrics=()=>{const a=[...points.values()];return a.length>1?{cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}:{cx:a[0]?.x||0,cy:a[0]?.y||0,d:0};};
    viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;viewport.setPointerCapture?.(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture={...metrics(),scale,x,y};});
    viewport.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const m=metrics();if(points.size>1&&gesture.d){const rect=viewport.getBoundingClientRect();scale=Math.max(1,Math.min(5,gesture.scale*m.d/gesture.d));x=m.cx-rect.left-(gesture.cx-rect.left-gesture.x)*scale/gesture.scale;y=m.cy-rect.top-(gesture.cy-rect.top-gesture.y)*scale/gesture.scale;}else{x=gesture.x+m.cx-gesture.cx;y=gesture.y+m.cy-gesture.cy;}draw();});
    const end=e=>{points.delete(e.pointerId);gesture={...metrics(),scale,x,y};};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);draw();
  }

  // A timeout never automatically replays a mutation. Explicit retry keeps the same chat client_id.
  let connection=null,pendingCount=0,recoveryContext=null;
  const connectionMessage=(message,error=false)=>{if(!connection){connection=el('div','connection-state');connection.setAttribute('role','status');connection.setAttribute('aria-live','polite');document.body.append(connection);}connection.textContent=message;connection.hidden=!message;connection.classList.toggle('is-error',error);
    if(message&&error){const retry=el('button','button outline small-button','Verbindung sicher erneut prüfen');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{await check(Raben.client().from('raben_records').select('id').limit(1));connectionMessage('Verbindung wieder erreichbar. Ungespeicherte Formulare kannst du weiter bearbeiten.');const ctx=recoveryContext;if(ctx&&!ctx.disposed&&!ctx.dirty){const reload=el('button','button outline small-button','Bereich erneut laden');reload.type='button';reload.addEventListener('click',()=>{if(!ctx.disposed&&!ctx.dirty){ctx.navigate(ctx.kind);connectionMessage('');}});connection.append(reload);}}catch(_){connectionMessage('Die Verbindung ist weiterhin unterbrochen. Deine offenen Eingaben bleiben erhalten.',true);}});connection.append(retry);}
  };
  async function networkFetch(input,init={}){
    const controller=new AbortController(),abort=()=>controller.abort();const inherited=init.signal||(typeof Request!=='undefined'&&input instanceof Request?input.signal:null);if(inherited?.aborted)controller.abort();else inherited?.addEventListener('abort',abort,{once:true});
    const slow=setTimeout(()=>connectionMessage('Die Verbindung braucht länger. Deine Eingaben bleiben im geöffneten Formular erhalten.'),5000),timeout=setTimeout(()=>controller.abort(),25000);pendingCount++;
    try{const response=await fetch(input,{...init,signal:controller.signal});if(response.status>=500)connectionMessage('Der Dienst ist vorübergehend nicht erreichbar. Du kannst den Vorgang erneut anstoßen.',true);else if(pendingCount===1)connectionMessage('');return response;}
    catch(error){connectionMessage(navigator.onLine===false?'Du bist offline. Lass ungespeicherte Formulare geöffnet.':'Verbindung unterbrochen. Prüfe vor erneutem Speichern, ob die Änderung bereits übernommen wurde.',true);throw error;}
    finally{pendingCount--;clearTimeout(slow);clearTimeout(timeout);inherited?.removeEventListener('abort',abort);}
  }
  window.addEventListener('offline',()=>connectionMessage('Du bist offline. Ungespeicherte Eingaben bleiben im geöffneten Formular erhalten.',true));window.addEventListener('online',()=>{connectionMessage('Verbindung wieder vorhanden. Du kannst fehlgeschlagene Vorgänge erneut versuchen.');setTimeout(()=>{if(!pendingCount)connectionMessage('');},7000);});

  async function describe(ctx,type,id,host,canWrite=false){
    if(ctx.public)return;const epoch=ctx.epoch;const rows=await check(Raben.client().from('raben_image_descriptions').select('alt_text').eq('parent_type',type).eq('parent_id',id).limit(1));if(!RabenQol.live(ctx,epoch)||!host.isConnected)return;
    const text=rows[0]?.alt_text;const targets=()=>[...host.querySelectorAll(type==='clan'?'img':'img.hub-image,img.profile-avatar,img.lightbox-image')].filter(image=>type==='gallery'||!image.closest('.character-gallery'));const apply=()=>{if(text!==undefined){host.dataset.imageAlt=text;for(const image of targets())image.alt=text;}};apply();if(text!==undefined&&window.MutationObserver){const observer=new MutationObserver(()=>{apply();observer.disconnect();});if(!host.querySelector('img')){observer.observe(host,{childList:true,subtree:true});ctx.lazyObservers??=new Set();ctx.lazyObservers.add(observer);}}
    if(canWrite){const details=el('details','image-description-editor'),f=el('form','qol-grid'),alt=field('Alternativtext · beschreibt den Bildinhalt für Screenreader','textarea',text||'');alt.input.maxLength=1000;details.append(el('summary','','Bildbeschreibung bearbeiten'));f.append(alt.wrap,note('Die sichtbare Bildunterschrift bleibt davon unabhängig. Ein bewusst leerer Alternativtext kennzeichnet ein dekoratives Bild.'));
      RabenQol.submit(ctx,f,'Bildbeschreibung speichern',async()=>{await check(Raben.client().rpc('raben_save_image_description',{p_type:type,p_id:id,p_text:alt.input.value}));host.dataset.imageAlt=alt.input.value;for(const image of targets())image.alt=alt.input.value;ctx.report('Bildbeschreibung gespeichert.');});details.append(f);host.append(details);}
  }

  const split=value=>String(value||'').split(/\n\s*\n/);
  function mergeParagraphs(base,mine,theirs){
    const a=split(base),b=split(mine),c=split(theirs),count=Math.max(a.length,b.length,c.length);return Array.from({length:count},(_,i)=>({base:a[i]??'',mine:b[i]??'',theirs:c[i]??'',conflict:(b[i]??'')!==(c[i]??'')&&(b[i]??'')!==(a[i]??'')&&(c[i]??'')!==(a[i]??''),value:(b[i]??'')===(a[i]??'')?(c[i]??''):(b[i]??'')}));
  }
  async function conflict(ctx,type,row,title,body,onRevision){
    const table=type==='profile'?'raben_profile_items':'raben_records',rows=await check(Raben.client().from(table).select('id,title,body,revision').eq('id',row.id).limit(1)),current=rows[0];if(!current)throw new Error('Der Eintrag ist nicht mehr für dich freigegeben.');
    const parts=mergeParagraphs(row.body,body.value,current.body),dialog=el('dialog','next-dialog merge-dialog'),form=el('form',''),choices=[];form.dataset.noUndo='';dialog.setAttribute('aria-label','Gleichzeitige Textänderungen zusammenführen');dialog.append(el('h3','','Textänderungen gemeinsam auflösen'),note('Vergleiche deinen Entwurf mit dem zuletzt gespeicherten Text. Die Zusammenführung wird erst beim erneuten Speichern übernommen.'));const newTitle=field('Zusammengeführter Titel','text',title.value===row.title?current.title:title.value);form.append(newTitle.wrap);
    parts.forEach((part,index)=>{const area=el('section','merge-paragraph'),output=field('Zusammengeführter Absatz '+(index+1),'textarea',part.value);area.append(el('h4','','Absatz '+(index+1)+(part.conflict?' · beide geändert':'')),el('p','merge-original','Bisher: '+part.base),el('p','merge-remote','Gespeichert: '+part.theirs),el('p','merge-mine','Dein Text: '+part.mine),output.wrap);for(const [label,value] of [['Meinen Absatz verwenden',part.mine],['Gespeicherten Absatz verwenden',part.theirs]]){const b=el('button','button outline small-button',label);b.type='button';b.addEventListener('click',()=>output.input.value=value);area.append(b);}choices.push(output.input);form.append(area);});
    const apply=el('button','button','Zusammenführung in meinen Entwurf übernehmen');apply.type='submit';const cancel=el('button','button outline','Abbrechen');cancel.type='button';cancel.addEventListener('click',()=>{dialog.close();dialog.remove();title.focus();});form.append(apply,cancel);dialog.append(form);form.addEventListener('submit',e=>{e.preventDefault();title.value=newTitle.input.value;body.value=choices.map(i=>i.value).join('\n\n');row.title=current.title;row.body=current.body;row.revision=current.revision;onRevision?.(current.revision);ctx.dirty=true;body.dispatchEvent(new Event('input',{bubbles:true}));dialog.close();dialog.remove();body.focus();});dialog.addEventListener('cancel',()=>{dialog.remove();title.focus();});document.body.append(dialog);dialog.showModal();newTitle.input.focus();
  }

  const picturePreferences=()=>{try{return localStorage.getItem('raben-preview-quality')||'balanced';}catch(_){return 'balanced';}};
  function previewPath(original,small,medium){const quality=picturePreferences();return quality==='detail'?original:quality==='economy'?(small||medium||original):(medium||small||original);}
  function qualityChooser(host){const f=field('Bildvorschauen auf diesem Gerät','select',picturePreferences(),[['economy','Sparsam · kleine Vorschau'],['balanced','Ausgewogen'],['detail','Detailreich · Originaldatei']]);f.input.addEventListener('change',()=>{try{localStorage.setItem('raben-preview-quality',f.input.value);}catch(_){}host.append(note('Auswahl gespeichert. Sie gilt ab dem nächsten Öffnen eines Bereichs. Die Originaldatei bleibt in der Großansicht verfügbar.'));});host.prepend(f.wrap);}

const escapeICS=value=>String(value??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const foldICS=line=>{let result='',part='',length=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(length+bytes>75){result+=part+'\r\n';part=' ';length=1;}part+=char;length+=bytes;}return result+part;};
function calendarICS(rows,title='Schwarze Raben',now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Schwarze Raben//Clan Kalender//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escapeICS(title),'BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19700329T020000','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
 const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 for(const row of rows){const d=row.details||{};if(!/^\d{4}-\d\d-\d\d$/.test(d.date||''))continue;const baseTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time||'')?d.time:'20:00',recurring=d.repeat&&d.repeat!=='none'&&d.repeatUntil;
  const emit=(original,date,time,duration,{attending=false,override=false,rule=false}={})=>{
   const uid=row.id+(attending?'-'+original:'')+'@schwarze-raben';lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'SEQUENCE:'+Math.max(0,Number(row.revision)||0));
   if(override)lines.push('RECURRENCE-ID;TZID=Europe/Berlin:'+original.replaceAll('-','')+'T'+baseTime.replace(':','')+'00');
   lines.push('DTSTART;TZID=Europe/Berlin:'+date.replaceAll('-','')+'T'+time.replace(':','')+'00','DURATION:PT'+Math.max(15,Math.min(1440,Number(duration)||120))+'M','SUMMARY:'+escapeICS(row.title),'DESCRIPTION:'+escapeICS(row.body),'LOCATION:'+escapeICS(d.location),'STATUS:'+(d.cancelled?'CANCELLED':'CONFIRMED'));
   if(rule){const frequency=d.repeat==='monthly'?'FREQ=MONTHLY;BYMONTHDAY='+Number(d.date.slice(-2)):'FREQ=WEEKLY;INTERVAL='+(d.repeat==='fortnightly'?2:1);lines.push('RRULE:'+frequency+';UNTIL='+d.repeatUntil.replaceAll('-','')+'T235959Z');if(d.exceptions?.length)lines.push('EXDATE;TZID=Europe/Berlin:'+d.exceptions.map(day=>day.replaceAll('-','')+'T'+baseTime.replace(':','')+'00').join(','));}
   lines.push('END:VEVENT');
  };
  if(Array.isArray(row.attending_dates)){for(const original of row.attending_dates){if(d.exceptions?.includes(original))continue;const c=d.occurrenceChanges?.[original]||{};emit(original,c.date||original,c.time||baseTime,c.duration||d.duration,{attending:true});}}
  else{const c=!recurring?d.occurrenceChanges?.[d.date]||{}:{};emit(d.date,c.date||d.date,c.time||baseTime,c.duration||d.duration,{rule:!!recurring});if(recurring)for(const [original,c]of Object.entries(d.occurrenceChanges||{})){if(d.exceptions?.includes(original))continue;emit(original,c.date,c.time,c.duration,{override:true});}}
 }
 lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';
}

  window.addEventListener('raben-lock',()=>{for(const dispose of histories.values())dispose();histories.clear();focusState=null;recoveryContext=null;for(const dialog of document.querySelectorAll('.next-dialog'))dialog.remove();});
  const altText=async(ctx,type,id)=>{const epoch=ctx.epoch,rows=await check(Raben.client().from('raben_image_descriptions').select('alt_text').eq('parent_type',type).eq('parent_id',id).limit(1));return RabenQol.live(ctx,epoch)?(rows[0]?.alt_text??null):null;};
  const imageInfo=async(ctx,path,host)=>{const epoch=ctx.epoch,bytes=await check(Raben.client().rpc('raben_image_size',{p_bucket:'raben-profile-media',p_path:path}));if(RabenQol.live(ctx,epoch)&&host.isConnected&&bytes!==null)host.append(note('Gewählte Vorschau: '+number(Number(bytes)/1024)+' KiB · Original bleibt separat verfügbar.'));};
  window.RabenNext={calendarICS,altText,imageInfo,note,field,number,download,attachHistory,attachMap,networkFetch,describe,mergeParagraphs,conflict,previewPath,qualityChooser,enhance,useContext:ctx=>{recoveryContext=ctx;}};
  enhance();
})();
