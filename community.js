(() => {
  "use strict";
  const {el,check}=Raben;
  const definitions={
    gallery:{label:"Dorfgalerie",singular:"Dorfaufnahme",public:true,fields:[['date','Aufnahmedatum','date']],image:true},
    place:{label:"Dorfplan",singular:"Ort",public:true,fields:[['category','Art des Ortes'],['x','Position von links (%)','number'],['y','Position von oben (%)','number']]},
    chronicle:{label:"Chronik",singular:"Chronikeintrag",public:true,fields:[['date','Datum des Ereignisses','date']],image:true},
    trade:{label:"Handel & Diplomatie",singular:"Angebot oder Anfrage",public:true,member:true,fields:[['category','Art','select',['Handelsangebot','Gesuch','Diplomatie']],['contact','RP-Ansprechperson'],['expires','Gültig bis','date']],image:true},
    event:{label:"RP-Kalender",singular:"Termin",public:true,fields:[['date','Datum (Berlin)','date',true],['time','Uhrzeit (Berlin)','time'],['location','Treffpunkt'],['registrationOpen','Anmeldung offen','checkbox']]},
    character:{label:"Charakterbuch",singular:"Charakter",public:true,member:true,fields:[['profession','Beruf oder Rang'],['relationships','Beziehungen','textarea']],image:true},
    task:{label:"Auftragsbrett",singular:"Auftrag",member:true,fields:[['category','Art des Auftrags'],['dueDate','Erledigen bis','date']]},
    project:{label:"Bauprojekte",singular:"Bauprojekt",fields:[['responsible','Verantwortliche'],['materials','Materialbedarf und vorhandene Bestände','textarea'],['progress','Fortschritt (%)','number']]},
    knowledge:{label:"Wissensarchiv",singular:"Wissenseintrag",member:true,fields:[['category','Kategorie'],['tags','Schlagwörter, durch Kommas getrennt']]},
    poll:{label:"Abstimmungen",singular:"Abstimmung",fields:[['options','Antworten – eine je Zeile, 2 bis 8','options',true],['endDate','Letzter Abstimmungstag (Berlin)','date'],['open','Abstimmung offen','checkbox']]},
    journal:{label:"RP-Tagebuch",singular:"Tagebucheintrag",member:true,fields:[['date','Datum des Erlebnisses','date']]}
  };
  const scopes=new Set(),applicationRoots=new Set(); let sequence=0,applicationEpoch=0;
  const memberKinds=['event','character','task','project','knowledge','poll','journal','trade'];
  const publicKinds=['gallery','place','chronicle','trade','event','character'];
  const visibilityNames={draft:'Entwurf',clan:'Clanintern',review:'Zur Freigabe',public:'Öffentlich',archived:'Archiviert'};
  const route=path=>new URL(path,Raben.config.siteUrl).href;
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  const formatDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(value+'T12:00:00Z')):'';
  const failure=error=>{
    const m=error?.message||'';
    if(m.includes('notes_conflict'))return 'Die Geheimnotizen wurden inzwischen geändert. Deine Eingaben bleiben erhalten. Schließe die Bearbeitung und lade die aktuellen Notizen erneut.';
    if(m.includes('conflict'))return 'Der Eintrag wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Schließe die Bearbeitung und lade den aktuellen Eintrag erneut.';
    if(m.includes('poll_has_votes'))return 'Die Antworten können nach der ersten Stimme nicht mehr geändert werden. Lege dafür eine neue Abstimmung an.';
    if(m.includes('poll_closed'))return 'Diese Abstimmung ist bereits geschlossen.';
    if(m.includes('registration_closed'))return 'Für diesen Termin ist die Anmeldung geschlossen.';
    if(m.includes('applicant_blocked'))return 'Dieses Konto ist gesperrt. Prüfe zuerst seine Mitgliederrechte.';
    if(error?.code==='23505')return 'Dieser Auftrag wurde bereits übernommen. Aktualisiere die Liste.';
    if(error?.code==='23514'||m.includes('invalid_')||m.includes('_required'))return 'Bitte prüfe die Angaben. Datum, Bild und Antwortmöglichkeiten müssen zum Eintrag passen.';
    if(error?.code==='42501')return 'Dein Zugang erlaubt diese Änderung nicht mehr. Prüfe deine Freigabe.';
    return Raben.errorMessage(error);
  };
  const button=(label,handler,classes='button outline small-button')=>{const b=el('button',classes,label);b.type='button';if(handler)b.addEventListener('click',handler);return b;};
  const link=(label,path,classes='button outline small-button')=>{const a=el('a',classes,label);a.href=route(path);return a;};
  const field=(label,type='text',value='',options=[])=>{
    const wrap=el('label','form-field',label),input=document.createElement(['textarea','options'].includes(type)?'textarea':type==='select'?'select':'input');
    if(input.tagName==='INPUT')input.type=type;
    if(type==='select')options.forEach(option=>{const o=el('option','',Array.isArray(option)?option[1]:option);o.value=Array.isArray(option)?option[0]:option;input.append(o);});
    if(type==='checkbox')input.checked=value!==false;else input.value=type==='options'?(value||[]).join('\n'):value??'';
    input.maxLength=type==='textarea'?20000:1000;
    wrap.append(input);return {wrap,input};
  };
  const note=(text,classes='field-note')=>el('p',classes,text);
  const clearScope=ctx=>{
    ctx.epoch++;ctx.disposed=true;ctx.dirty=false;
    ctx.urls.forEach(url=>URL.revokeObjectURL(url));ctx.urls.clear();ctx.records=[];ctx.names.clear();
    ctx.root.replaceChildren();ctx.root.append(note('Dein Zugang ist nicht mehr aktiv. Bitte melde dich erneut an.','status-message'));
    scopes.delete(ctx);
  };
  const ensure=async ctx=>{
    if(ctx.public)return null;
    const actor=await Raben.member();
    if(!actor||actor.status!=='active'||(ctx.admin&&actor.role!=='admin')||actor.user_id!==ctx.actor.user_id){clearScope(ctx);throw {code:'42501'};}
    ctx.actor=actor;return actor;
  };
  const inform=(ctx,text,error=false)=>{if(ctx.disposed)return;ctx.status.textContent=text;ctx.status.hidden=!text;ctx.status.classList.toggle('is-error',error);};
  const run=async(ctx,b,action)=>{b.disabled=true;const epoch=ctx.epoch;try{await ensure(ctx);if(ctx.disposed)return;await action();}catch(error){if(epoch===ctx.epoch)inform(ctx,failure(error),true);}finally{b.disabled=false;}};
  const canEdit=(ctx,row)=>!ctx.public&&(ctx.admin||ctx.actor.role==='admin'||(definitions[row.kind]?.member&&row.created_by===ctx.actor.user_id));
  const discard=ctx=>!ctx.dirty||confirm('Ungespeicherte Eingaben verwerfen?');
  const publicImage=path=>/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path||'')?Raben.client().storage.from('raben-public').getPublicUrl(path).data.publicUrl:'';
  const paintImage=async(ctx,row,card)=>{
    const epoch=ctx.epoch;await Promise.resolve();let src=publicImage(row.details?.publicImage);
    if(!src&&!ctx.public&&row.details?.imagePath){
      try{const blob=await check(Raben.client().storage.from('raben-media').download(row.details.imagePath));if(ctx.disposed||epoch!==ctx.epoch)return;src=URL.createObjectURL(blob);ctx.urls.add(src);}catch(_){return;}
    }
    if(!src||ctx.disposed||epoch!==ctx.epoch||!card.isConnected)return;
    const img=document.createElement('img');img.src=src;img.alt=row.title;img.loading='lazy';img.className='hub-image';card.prepend(img);
  };
  const upload=async(ctx,file,owner)=>{
    await ensure(ctx);
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8388608)throw new Error('invalid_image');
    const path=(owner||ctx.actor.user_id)+'/'+crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
    await check(Raben.client().storage.from('raben-media').upload(path,file,{contentType:file.type,cacheControl:'0',upsert:false}));return path;
  };
  const publishImage=async(ctx,details)=>{
    if(!details.imagePath||details.publicImage)return details;
    await ensure(ctx);
    if(ctx.actor.role!=='admin')throw {code:'42501'};
    const blob=await check(Raben.client().storage.from('raben-media').download(details.imagePath));
    const path=crypto.randomUUID()+'.'+details.imagePath.split('.').pop();
    await check(Raben.client().storage.from('raben-public').upload(path,blob,{contentType:blob.type||({'jpg':'image/jpeg','png':'image/png','webp':'image/webp'}[path.split('.').pop()]),upsert:false}));
    return {...details,publicImage:path};
  };
  const loadNames=async ctx=>{
    const people=await check(Raben.client().from('raben_memberships').select('user_id,display_name').eq('status','active'));
    if(!ctx.disposed)people.forEach(p=>ctx.names.set(p.user_id,p.display_name));
  };
  const openNotes=async(ctx,row)=>{
    if(!discard(ctx))return;await ensure(ctx);const epoch=ctx.epoch;
    const rows=await check(Raben.client().from('raben_character_notes').select('body,updated_at').eq('record_id',row.id));if(epoch!==ctx.epoch)return;
    const existing=rows[0]||null;ctx.editor.replaceChildren();
    const form=el('form','hub-editor'),f=field('Geheime Hintergrundnotizen','textarea',existing?.body||'');f.input.maxLength=20000;
    form.append(el('h3','',row.title+' · Geheimnotizen'),note('Nur du und die Clan-Admins können diese Notizen lesen. Sie werden nicht veröffentlicht.'),f.wrap);
    const actions=el('div','editor-actions'),save=button('Notizen speichern',null,'button'),close=button('Schließen',()=>{if(discard(ctx)){ctx.editor.replaceChildren();ctx.dirty=false;}});save.type='submit';actions.append(save,close);form.append(actions);
    form.addEventListener('input',()=>{ctx.dirty=true;});
    form.addEventListener('submit',event=>{event.preventDefault();run(ctx,save,async()=>{await check(Raben.client().rpc('raben_save_character_notes',{p_record:row.id,p_body:f.input.value,p_expected:existing?.updated_at||null}));ctx.dirty=false;ctx.editor.replaceChildren();inform(ctx,'Geheimnotizen gespeichert.');});});
    ctx.editor.append(form);f.input.focus();
  };
  const openEditor=(ctx,kind,row=null,preset=null)=>{
    if(!discard(ctx))return;ctx.editor.replaceChildren();ctx.dirty=false;let current=row;
    const schema=definitions[kind],form=el('form','hub-editor'),grid=el('div','form-grid'),inputs={};
    const title=field(kind==='character'?'Charaktername':'Titel','text',row?.title||preset?.title||'');title.input.required=true;title.input.maxLength=200;
    const body=field(kind==='character'?'Steckbrief und Geschichte':'Beschreibung','textarea',row?.body||preset?.body||'');body.input.maxLength=30000;body.wrap.classList.add('full');
    inputs.title=title.input;inputs.body=body.input;grid.append(title.wrap,body.wrap);
    const details={...(row?.details||preset?.details||{})};
    schema.fields.forEach(([key,label,type,opts])=>{
      const f=field(label,type||'text',details[key]??(type==='checkbox'?true:key==='progress'?0:key==='x'||key==='y'?50:''),Array.isArray(opts)?opts:[]);
      f.input.dataset.hubField=key;if(opts===true)f.input.required=true;
      if(type==='number'){f.input.min='0';f.input.max='100';f.input.step=key==='progress'?'1':'0.1';}
      if(type==='textarea'||type==='options')f.wrap.classList.add('full');
      inputs[key]=f.input;grid.append(f.wrap);
    });
    const admin=ctx.actor.role==='admin',choices=admin?[['draft','Entwurf'],['clan','Clanintern'],['review','Zur Freigabe'],...(schema.public?[['public','Öffentlich']]:[]),['archived','Archiviert']]:[['draft','Mein Entwurf'],['clan','Im Clan teilen'],['review',schema.public?'Öffentliche Freigabe anfragen':'Admin-Prüfung anfragen'],['archived','Archivieren']];
    const visibility=field('Sichtbarkeit','select',row?.visibility==='public'&&!admin?'review':row?.visibility||'clan',choices);inputs.visibility=visibility.input;grid.append(visibility.wrap);
    if(schema.image){const f=field('Bild, optional (JPG, PNG, WebP · maximal 8 MB)','file');f.input.accept='image/jpeg,image/png,image/webp';inputs.image=f.input;grid.append(f.wrap);}
    if(kind==='place')form.append(note('Die Position wird als Prozentwert auf eurem Dorfplan gespeichert. Einen Kartenhintergrund legst du über eine öffentliche Dorfaufnahme fest.'));
    if(kind==='character')form.append(note('Geheimnotizen bearbeitest du nach dem Speichern separat. Eine öffentliche Freigabe umfasst nur Steckbrief, Beruf, Beziehungen und ein freigegebenes Bild.'));
    if(schema.public)form.append(note(admin?'„Öffentlich“ macht diesen Eintrag für alle Besucher sichtbar. Prüfe den gesamten Text vor der Veröffentlichung.':'Eine öffentliche Veröffentlichung benötigt eine Admin-Freigabe. Änderungen an einem veröffentlichten Steckbrief werden erneut geprüft.'));
    const actions=el('div','editor-actions'),save=button('Speichern',null,'button'),close=button('Schließen',()=>{if(discard(ctx)){ctx.editor.replaceChildren();ctx.dirty=false;}});save.type='submit';actions.append(save,close);
    form.prepend(el('h3','',schema.singular+(row?' bearbeiten':' erstellen')));form.append(grid,actions);
    form.addEventListener('input',()=>{ctx.dirty=true;});form.addEventListener('change',()=>{ctx.dirty=true;});
    form.addEventListener('submit',event=>{event.preventDefault();run(ctx,save,async()=>{
      let data={};schema.fields.forEach(([key,,type])=>{const input=inputs[key];if(type==='checkbox')data[key]=input.checked;else if(type==='number')data[key]=Number(input.value);else if(type==='options')data[key]=input.value.split('\n').map(s=>s.trim()).filter(Boolean);else if(input.value.trim())data[key]=input.value.trim();});
      ['imagePath','publicImage','sourceId'].forEach(key=>{if(details[key])data[key]=details[key];});
      if(inputs.image?.files?.[0]){data.imagePath=await upload(ctx,inputs.image.files[0],current?.created_by);delete data.publicImage;details.imagePath=data.imagePath;delete details.publicImage;inputs.image.value='';}
      if(inputs.visibility.value==='public')data=await publishImage(ctx,data);
      const payload={title:inputs.title.value.trim(),body:inputs.body.value.trim(),details:data,visibility:inputs.visibility.value};
      const result=current?await check(Raben.client().from('raben_records').update(payload).eq('id',current.id).eq('revision',current.revision).select('id,kind,title,body,details,visibility,created_by,revision,updated_at')):await check(Raben.client().from('raben_records').insert({...payload,kind}).select('id,kind,title,body,details,visibility,created_by,revision,updated_at'));
      if(!result.length)throw new Error('record_conflict');if(ctx.disposed)return;
      current=result[0];Object.assign(details,current.details);ctx.dirty=false;await loadList(ctx,true);inform(ctx,'Gespeichert · '+visibilityNames[current.visibility]+'.');
    });});
    ctx.editor.append(form);title.input.focus();
  };
  const removeRecord=(ctx,row,b)=>run(ctx,b,async()=>{
    if(!confirm('„'+row.title+'“ einschließlich zugehöriger Zusagen, Stimmen oder Notizen löschen?'))return;
    const rows=await check(Raben.client().from('raben_records').delete().eq('id',row.id).eq('revision',row.revision).select('id'));
    if(!rows.length)throw new Error('record_conflict');await loadList(ctx,true);inform(ctx,'Eintrag gelöscht.');
  });
  const setMap=async(ctx,row,b)=>run(ctx,b,async()=>{
    if(!confirm('Dieses öffentliche Bild als Hintergrund des Dorfplans verwenden?'))return;
    const rec=await check(Raben.client().from('raben_site_content').select('content,revision').eq('id',1).single());
    const content={...rec.content,rabenMapImage:publicImage(row.details.publicImage)};
    const rows=await check(Raben.client().from('raben_site_content').update({content}).eq('id',1).eq('revision',rec.revision).select('revision'));
    if(!rows.length)throw new Error('content_conflict');window.dispatchEvent(new CustomEvent('raben-map-updated',{detail:{previousRevision:rec.revision,revision:rows[0].revision,image:content.rabenMapImage}}));inform(ctx,'Dorfplan-Hintergrund gespeichert.');
  });
  const responses=async(ctx,row,card)=>{
    if(ctx.public){card.append(link('Im Clanbereich anmelden','clan.html'));return;}
    const epoch=ctx.epoch,items=await check(Raben.client().from('raben_event_responses').select('user_id,choice').eq('record_id',row.id));if(epoch!==ctx.epoch)return;
    const mine=items.find(p=>p.user_id===ctx.actor.user_id),area=el('div','hub-interactions'),actions=el('div','hub-inline-actions');
    const closed=row.details.registrationOpen===false||row.details.date<today();
    [['yes','Dabei'],['maybe','Vielleicht'],['no','Absage']].forEach(([choice,label])=>{const b=button(label,()=>run(ctx,b,async()=>{await check(Raben.client().rpc('raben_event_respond',{p_record:row.id,p_choice:choice}));await loadList(ctx,true);inform(ctx,'Deine Rückmeldung wurde gespeichert.');}));b.disabled=closed;b.classList.toggle('is-selected',mine?.choice===choice);b.setAttribute('aria-pressed',String(mine?.choice===choice));actions.append(b);});
    area.append(note(closed?'Anmeldung geschlossen.':'Deine Teilnahme'),actions);
    const counts=el('p','field-note',items.filter(p=>p.choice==='yes').length+' dabei · '+items.filter(p=>p.choice==='maybe').length+' vielleicht · '+items.filter(p=>p.choice==='no').length+' abgesagt');area.append(counts);
    if(items.length){const detail=el('details','hub-details');detail.append(el('summary','','Zusagen ansehen'));items.forEach(p=>detail.append(note((ctx.names.get(p.user_id)||'Clanmitglied')+' · '+({yes:'Dabei',maybe:'Vielleicht',no:'Absage'}[p.choice]))));area.append(detail);}
    card.append(area);
  };
  const claim=async(ctx,row,card)=>{
    const epoch=ctx.epoch,items=await check(Raben.client().from('raben_task_claims').select('user_id,state').eq('record_id',row.id));if(epoch!==ctx.epoch)return;
    const assignment=items[0],actions=el('div','hub-inline-actions');
    if(!assignment){const b=button('Auftrag übernehmen',()=>run(ctx,b,async()=>{await check(Raben.client().from('raben_task_claims').insert({record_id:row.id}));await loadList(ctx,true);inform(ctx,'Du hast den Auftrag übernommen.');}));actions.append(b);}
    else{
      card.append(note((assignment.state==='done'?'Erledigt von ':'Übernommen von ')+(ctx.names.get(assignment.user_id)||'Clanmitglied'),'hub-assignment'));
      if(assignment.user_id===ctx.actor.user_id||ctx.actor.role==='admin'){
        const state=assignment.state==='done'?'claimed':'done',done=button(state==='done'?'Als erledigt markieren':'Wieder öffnen',()=>run(ctx,done,async()=>{await check(Raben.client().from('raben_task_claims').update({state}).eq('record_id',row.id));await loadList(ctx,true);}));
        const release=button('Übernahme lösen',()=>run(ctx,release,async()=>{if(!confirm('Übernahme dieses Auftrags lösen?'))return;await check(Raben.client().from('raben_task_claims').delete().eq('record_id',row.id));await loadList(ctx,true);}));actions.append(done,release);
      }
    }card.append(actions);
  };
  const poll=async(ctx,row,card)=>{
    const epoch=ctx.epoch,[result,votes]=await Promise.all([check(Raben.client().rpc('raben_poll_results',{p_record:row.id})),check(Raben.client().from('raben_poll_votes').select('option_index').eq('record_id',row.id).eq('user_id',ctx.actor.user_id))]);if(epoch!==ctx.epoch)return;
    const closed=row.details.open===false||(row.details.endDate&&row.details.endDate<today());
    card.append(note((closed?'Abgeschlossen':'Eine Stimme pro Mitglied')+' · '+result.total+' Stimmen'+(row.details.endDate?' · bis '+formatDate(row.details.endDate):'')));
    row.details.options.forEach((option,index)=>{
      const count=Number(result.counts?.[index]||0),line=el('div','hub-poll-option'),b=button(option,()=>run(ctx,b,async()=>{await check(Raben.client().rpc('raben_poll_vote',{p_record:row.id,p_option:index}));await loadList(ctx,true);inform(ctx,'Deine Stimme wurde gespeichert.');}));b.disabled=closed;b.classList.toggle('is-selected',votes[0]?.option_index===index);b.setAttribute('aria-pressed',String(votes[0]?.option_index===index));
      const progress=document.createElement('progress');progress.max=Math.max(1,result.total);progress.value=count;progress.setAttribute('aria-label',option+': '+count+' Stimmen');line.append(b,progress,el('span','field-note',String(count)));card.append(line);
    });
  };
  const renderCard=(ctx,row)=>{
    const d=row.details||{},card=el('article','hub-card');card.dataset.recordId=row.id;
    const head=el('div','hub-card-head');head.append(el('p','eyebrow',definitions[row.kind].singular));if(!ctx.public)head.append(el('span','hub-badge',visibilityNames[row.visibility]));
    card.append(head,el('h3','',row.title));
    const meta=[];if(d.date)meta.push(formatDate(d.date));if(d.time)meta.push(d.time+' Uhr · Berlin');if(d.location)meta.push(d.location);if(d.profession)meta.push(d.profession);if(d.category)meta.push(d.category);if(d.dueDate)meta.push('Bis '+formatDate(d.dueDate));if(d.expires)meta.push('Gültig bis '+formatDate(d.expires));
    if(meta.length)card.append(note(meta.join(' · '),'hub-meta'));
    if(row.body)card.append(el('p','hub-body',row.body));
    if(d.relationships)card.append(el('p','hub-body','Beziehungen: '+d.relationships));if(d.contact)card.append(note('RP-Kontakt: '+d.contact));if(d.tags)card.append(note('Schlagwörter: '+d.tags));
    if(row.kind==='project'){
      if(d.responsible)card.append(note('Verantwortlich: '+d.responsible));if(d.materials)card.append(el('p','hub-body','Materialien und Bestände\n'+d.materials));
      const progress=document.createElement('progress');progress.max=100;progress.value=d.progress||0;progress.setAttribute('aria-label','Baufortschritt');card.append(note('Fortschritt: '+(d.progress||0)+' %'),progress);
    }
    if(!ctx.public)card.append(note('Eingetragen von '+(ctx.names.get(row.created_by)||'Clanmitglied')));
    const actions=el('div','hub-inline-actions');
    if(canEdit(ctx,row)){
      actions.append(button('Bearbeiten',()=>openEditor(ctx,row.kind,row)));const remove=button('Löschen',()=>removeRecord(ctx,row,remove),'button danger small-button');actions.append(remove);
      if(row.kind==='character')actions.append(button('Geheimnotizen',()=>openNotes(ctx,row).catch(error=>inform(ctx,failure(error),true))));
      if(ctx.admin&&row.kind==='journal')actions.append(button('Für Chronik übernehmen',()=>{if(discard(ctx)){ctx.dirty=false;selectKind(ctx,'chronicle');openEditor(ctx,'chronicle',null,{title:row.title,body:row.body,details:{date:d.date||today(),sourceId:row.id}});}}));
      if(ctx.actor.role==='admin'&&row.kind==='gallery'&&row.visibility==='public'&&d.publicImage){const map=button('Als Dorfplankarte verwenden',()=>setMap(ctx,row,map));actions.append(map);}
    }
    if(actions.childNodes.length)card.append(actions);
    if(definitions[row.kind].image)paintImage(ctx,row,card).catch(()=>{});
    if(!ctx.public&&['clan','public'].includes(row.visibility)){
      if(row.kind==='event')responses(ctx,row,card).catch(error=>inform(ctx,failure(error),true));
      if(row.kind==='task')claim(ctx,row,card).catch(error=>inform(ctx,failure(error),true));
      if(row.kind==='poll')poll(ctx,row,card).catch(error=>inform(ctx,failure(error),true));
    }else if(ctx.public&&row.kind==='event')card.append(link('Clanbereich öffnen','clan.html'));
    return card;
  };
  const drawMap=async(ctx,rows)=>{
    const epoch=ctx.epoch,map=el('div','hub-map'),background=await check(Raben.client().from('raben_site_content').select('content').eq('id',1).single());if(epoch!==ctx.epoch)return;
    const src=Raben.imageUrl(background.content.rabenMapImage);
    if(src){const img=document.createElement('img');img.src=src;img.alt='Dorfplan der Schwarzen Raben';map.append(img);}else map.classList.add('without-background');
    const selection=el('p','hub-map-selection','Wähle einen Ort auf der Karte.');
    rows.forEach((row,index)=>{const marker=button(String(index+1),()=>{selection.textContent=row.title+(row.body?' · '+row.body:'');},'hub-map-pin');marker.style.left=row.details.x+'%';marker.style.top=row.details.y+'%';marker.setAttribute('aria-label',row.title);map.append(marker);});
    ctx.list.prepend(selection);ctx.list.prepend(map);
    if(!src)ctx.list.prepend(note(ctx.admin?'Noch keine Dorfplankarte gewählt. Lade unter „Dorfgalerie“ eine Karte hoch, veröffentliche sie und wähle „Als Dorfplankarte verwenden“.':'Die Karte des Dorfes wird noch ergänzt. Die eingetragenen Orte findest du darunter.'));
  };
  const loadList=async(ctx,reset=false)=>{
    if(ctx.disposed)return;if(reset)ctx.offset=0;const epoch=++ctx.epoch;
    ctx.refresh.disabled=true;inform(ctx,'Wird geladen …');
    try{
      await ensure(ctx);if(epoch!==ctx.epoch||ctx.disposed)return;
      let q=Raben.client().from('raben_records').select(ctx.public?'id,kind,title,body,details,visibility,updated_at':'id,kind,title,body,details,visibility,created_by,revision,updated_at',{count:'exact'});
      if(ctx.kind==='review')q=q.eq('visibility','review');else q=q.eq('kind',ctx.kind);
      if(ctx.public)q=q.eq('visibility','public');else if(!ctx.archive.checked)q=q.neq('visibility','archived');
      if(ctx.search.value.trim())q=q.textSearch('search',ctx.search.value.trim(),{config:'german',type:'websearch'});
      q=['event','chronicle'].includes(ctx.kind)?q.order('details->>date',{ascending:ctx.kind==='event'&&!ctx.past.checked,nullsFirst:false}):q.order('updated_at',{ascending:false});
      if(ctx.kind==='event')q=ctx.past.checked?q.lt('details->>date',today()):q.gte('details->>date',today());
      const result=await q.range(ctx.offset,ctx.offset+11);if(result.error)throw result.error;if(epoch!==ctx.epoch||ctx.disposed)return;
      ctx.records=reset?result.data:ctx.records.concat(result.data);ctx.list.replaceChildren();
      ctx.urls.forEach(url=>URL.revokeObjectURL(url));ctx.urls.clear();
      if(!ctx.records.length)ctx.list.append(note(ctx.public?'Hier erscheinen die ersten freigegebenen '+definitions[ctx.kind]?.label.toLowerCase()+'.':ctx.kind==='review'?'Es warten keine Einträge auf Freigabe.':'Noch keine passenden Einträge.','hub-empty'));
      ctx.records.forEach(row=>ctx.list.append(renderCard(ctx,row)));ctx.more.hidden=ctx.records.length>=Number(result.count||0);
      if(ctx.kind==='place')await drawMap(ctx,ctx.records);
      inform(ctx,'');
    }catch(error){if(epoch===ctx.epoch)inform(ctx,failure(error),true);}finally{ctx.refresh.disabled=false;}
  };
  const applications=async ctx=>{
    await ensure(ctx);const epoch=++ctx.epoch;ctx.list.replaceChildren();ctx.editor.replaceChildren();
    const result=await Raben.client().from('raben_applications').select('user_id,character_name,concept,rp_preferences,availability,status,feedback,revision,created_at',{count:'exact'}).order('created_at',{ascending:false}).range(ctx.offset,ctx.offset+11);if(result.error)throw result.error;if(epoch!==ctx.epoch)return;const rows=ctx.offset===0?result.data:(ctx.applications||[]).concat(result.data);ctx.applications=rows;
    if(!rows.length)ctx.list.append(note('Noch keine Bewerbungen eingegangen.','hub-empty'));
    rows.forEach(row=>{
      const card=el('article','hub-card');card.append(el('p','eyebrow',({waiting:'Wartet auf Entscheidung',approved:'Angenommen',rejected:'Abgelehnt'}[row.status])),el('h3','',row.character_name),el('p','hub-body',row.concept));
      if(row.rp_preferences)card.append(el('p','hub-body','RP-Wünsche\n'+row.rp_preferences));if(row.availability)card.append(note('Spielzeiten: '+row.availability));
      const feedback=field('Rückmeldung an die bewerbende Person','textarea',row.feedback);feedback.input.maxLength=4000;const actions=el('div','hub-inline-actions');card.append(feedback.wrap);
      [['approved','Annehmen & Clan-Zugang freigeben'],['rejected','Ablehnen']].forEach(([status,label])=>{const b=button(label,()=>run(ctx,b,async()=>{const changed=await check(Raben.client().from('raben_applications').update({status,feedback:feedback.input.value.trim()}).eq('user_id',row.user_id).eq('revision',row.revision).select('user_id'));if(!changed.length)throw new Error('application_conflict');ctx.offset=0;await applications(ctx);inform(ctx,status==='approved'?'Bewerbung angenommen. Der Clan-Zugang ist freigegeben.':'Entscheidung gespeichert.');}));if(status==='approved'&&row.status==='approved'){b.disabled=true;b.textContent='Bereits angenommen';}actions.append(b);});card.append(actions);ctx.list.append(card);
    });ctx.more.hidden=rows.length>=Number(result.count||0);inform(ctx,'');
  };
  const dashboard=async ctx=>{
    await ensure(ctx);const epoch=++ctx.epoch;ctx.list.replaceChildren();ctx.editor.replaceChildren();ctx.more.hidden=true;
    const specs=[['applications','Bewerbungen',()=>Raben.client().from('raben_applications').select('user_id',{count:'exact',head:true}).eq('status','waiting')],['review','Einträge zur Freigabe',()=>Raben.client().from('raben_records').select('id',{count:'exact',head:true}).eq('visibility','review')],['event','Anstehende Termine',()=>Raben.client().from('raben_records').select('id',{count:'exact',head:true}).eq('kind','event').in('visibility',['clan','public']).gte('details->>date',today())],['task','Clan-Aufträge',()=>Raben.client().from('raben_records').select('id',{count:'exact',head:true}).eq('kind','task').eq('visibility','clan')]];
    const result=await Promise.all(specs.map(async([key,label,query])=>{const r=await query();if(r.error)throw r.error;return {key,label,count:r.count};}));if(epoch!==ctx.epoch)return;
    const grid=el('div','hub-dashboard');result.forEach(item=>{const b=button('',()=>selectKind(ctx,item.key),'hub-stat');b.append(el('strong','',String(item.count)),el('span','',item.label));grid.append(b);});ctx.list.append(grid,el('article','hub-card'));
    const intro=ctx.list.lastChild;intro.append(el('h3','','Euer Dorfleben verwalten.'),note('Wähle einen Bereich, um Inhalte anzulegen oder zu bearbeiten. Mitglieder erstellen eigene Charaktere, Aufträge, Wissenseinträge, Handelsanfragen und Tagebuchberichte. „Öffentlich“ wird ausschließlich durch Admins freigegeben.'),note('Für den Dorfplan zuerst eine Karte in der Galerie veröffentlichen und als Dorfplankarte festlegen. Danach Orte mit Positionen ergänzen.'));inform(ctx,'');
  };
  const selectKind=(ctx,kind)=>{
    if(!discard(ctx))return;ctx.kind=kind;ctx.offset=0;ctx.dirty=false;ctx.editor.replaceChildren();ctx.records=[];
    ctx.tabs.forEach(tab=>{const active=tab.dataset.kind===kind;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
    if(kind==='applications')ctx.applications=[];
    const special=['dashboard','applications','review'].includes(kind);
    ctx.create.hidden=special||ctx.public||(!definitions[kind]?.member&&ctx.actor.role!=='admin');ctx.searchWrap.hidden=special;ctx.archiveWrap.hidden=ctx.public||special;ctx.pastWrap.hidden=kind!=='event';
    ctx.heading.textContent=definitions[kind]?.label||({dashboard:'Alles im Blick',applications:'Bewerbungen',review:'Einträge zur Freigabe'}[kind]);
    ctx.panel.setAttribute('aria-labelledby','hub-tab-'+ctx.uid+'-'+kind);
    ctx.list.classList.toggle('hub-gallery',kind==='gallery');ctx.list.classList.toggle('hub-characters',kind==='character');ctx.list.classList.toggle('hub-chronicle',kind==='chronicle');
    const action=kind==='dashboard'?dashboard(ctx):kind==='applications'?applications(ctx):loadList(ctx,true);action.catch(error=>inform(ctx,failure(error),true));
  };
  const mount=async(root,actor,mode)=>{
    if(!root)return;for(const old of scopes)if(old.root===root){clearScope(old);break;}
    const ctx={root,actor,admin:mode==='admin',public:mode==='public',epoch:0,disposed:false,dirty:false,offset:0,records:[],urls:new Set(),names:new Map(),tabs:[]};
    if(!ctx.public){const checked=await Raben.member();if(!checked||checked.status!=='active'||(ctx.admin&&checked.role!=='admin'))return;ctx.actor=checked;}
    scopes.add(ctx);root.replaceChildren();root.classList.add('hub');
    ctx.status=el('p','status-message');ctx.status.setAttribute('role','status');ctx.status.hidden=true;
    const tabs=el('div','hub-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Gemeinschaftsbereiche');
    const kinds=ctx.public?publicKinds:ctx.admin?['dashboard','applications','review',...Object.keys(definitions)]:memberKinds;
    const uid=++sequence;ctx.uid=uid;
    kinds.forEach((kind,index)=>{const b=button(definitions[kind]?.label||({dashboard:'Übersicht',applications:'Bewerbungen',review:'Freigaben'}[kind]),()=>selectKind(ctx,kind),'hub-tab');b.dataset.kind=kind;b.setAttribute('role','tab');b.setAttribute('aria-controls','hub-panel-'+uid);b.setAttribute('aria-selected',String(index===0));b.tabIndex=index===0?0:-1;b.id='hub-tab-'+uid+'-'+kind;ctx.tabs.push(b);tabs.append(b);});
    ctx.tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{const n=event.key==='Home'?0:event.key==='End'?ctx.tabs.length-1:event.key==='ArrowRight'?(index+1)%ctx.tabs.length:event.key==='ArrowLeft'?(index+ctx.tabs.length-1)%ctx.tabs.length:null;if(n!==null){event.preventDefault();ctx.tabs[n].click();ctx.tabs[n].focus();}}));
    const panel=el('div','hub-panel');ctx.panel=panel;panel.id='hub-panel-'+uid;panel.setAttribute('role','tabpanel');panel.tabIndex=0;
    ctx.heading=el('h2','');ctx.create=button('Neu erstellen',()=>openEditor(ctx,ctx.kind),'button small-button');ctx.refresh=button('Aktualisieren',()=>{const f=ctx.kind==='applications'?(ctx.offset=0,applications(ctx)):ctx.kind==='dashboard'?dashboard(ctx):loadList(ctx,true);f.catch(error=>inform(ctx,failure(error),true));});
    const bar=el('div','hub-toolbar'),titles=el('div','hub-title-row');titles.append(ctx.heading,ctx.create,ctx.refresh);bar.append(titles);
    const sf=field('Suchen','search');ctx.search=sf.input;ctx.searchWrap=sf.wrap;ctx.search.placeholder='Titel, Text oder Schlagwörter';const searchForm=el('form','hub-search');searchForm.append(sf.wrap,button('Suchen',null));searchForm.lastChild.type='submit';searchForm.addEventListener('submit',event=>{event.preventDefault();loadList(ctx,true);});bar.append(searchForm);
    const af=field('Archivierte Einträge anzeigen','checkbox',false);ctx.archive=af.input;ctx.archiveWrap=af.wrap;ctx.archive.addEventListener('change',()=>loadList(ctx,true));
    const pf=field('Vergangene Termine anzeigen','checkbox',false);ctx.past=pf.input;ctx.pastWrap=pf.wrap;ctx.past.addEventListener('change',()=>loadList(ctx,true));bar.append(af.wrap,pf.wrap);
    ctx.editor=el('div','hub-editor-host');ctx.list=el('div','hub-list');ctx.more=button('Weitere laden',()=>{ctx.offset=ctx.kind==='applications'?(ctx.applications||[]).length:ctx.records.length;const f=ctx.kind==='applications'?applications(ctx):loadList(ctx,false);f.catch(error=>inform(ctx,failure(error),true));});ctx.more.hidden=true;
    panel.append(bar,ctx.status,ctx.editor,ctx.list,ctx.more);root.append(tabs,panel);
    if(!ctx.public)await loadNames(ctx);if(ctx.disposed)return;
    selectKind(ctx,kinds[0]);return ctx;
  };
  const mountApplication=async root=>{
    const epoch=++applicationEpoch;applicationRoots.add(root);let actor=await Raben.member();if(epoch!==applicationEpoch)return;root.replaceChildren();root.classList.add('hub');
    if(actor)root.append(button('Abmelden',async()=>{await Raben.signOut();location.replace(route('bewerben.html'));},'text-button'));
    if(!actor){root.append(el('h2','','Mit Discord bewerben.'),note('Melde dich mit Discord an und stelle uns deinen Charakter und deine RP-Vorstellungen vor. Deine Bewerbung sehen ausschließlich du und die Clan-Admins.'));const login=button('Mit Discord anmelden',async()=>{login.disabled=true;try{await Raben.signIn('application');}catch(error){root.append(note(failure(error),'status-message'));login.disabled=false;}},'button');root.append(login);return;}
    if(actor.status==='active'){root.append(el('h2','','Du gehörst bereits zu den Raben.'),note('Dein Clan-Zugang ist freigegeben.'),link('Zum Clanbereich','clan.html'));return;}
    if(actor.status==='blocked'){root.append(el('h2','','Dein Zugang ist gesperrt.'),note('Bitte kläre deinen Zugang mit der Clanführung.'));return;}
    const [existing]=await check(Raben.client().from('raben_applications').select('character_name,concept,rp_preferences,availability,status,feedback,revision').eq('user_id',actor.user_id));
    const fresh=await Raben.member();if(epoch!==applicationEpoch)return;if(!fresh||fresh.user_id!==actor.user_id){root.replaceChildren();return;}if(fresh.status!=='pending'){await mountApplication(root);return;}
    root.append(el('h2','','Deine Bewerbung.'));
    if(existing){root.append(note(({waiting:'Deine Bewerbung wartet auf eine Entscheidung.',approved:'Deine Bewerbung wurde angenommen.',rejected:'Deine Bewerbung wurde abgelehnt. Du kannst sie überarbeiten und erneut einreichen.'}[existing.status]),'hub-badge'));if(existing.feedback)root.append(el('p','hub-body','Rückmeldung der Clanführung\n'+existing.feedback));}
    const form=el('form','hub-editor'),fields={};[['character_name','Charaktername','text',100],['concept','Charakterkonzept und Hintergrund','textarea',10000],['rp_preferences','Was für RP suchst du?','textarea',4000],['availability','Übliche Spielzeiten','text',1000]].forEach(([key,label,type,max])=>{const f=field(label,type,existing?.[key]||'');f.input.maxLength=max;f.input.required=['character_name','concept'].includes(key);if(key==='concept')f.input.minLength=10;fields[key]=f.input;form.append(f.wrap);});
    let current=existing,dirty=false;const status=el('p','status-message');status.hidden=true;status.setAttribute('role','status');const save=button(existing?'Überarbeiten & erneut einreichen':'Bewerbung einreichen',null,'button');save.type='submit';form.append(note('Die Bewerbung ist privat. Eine Annahme schaltet deinen Clan-Zugang frei; öffentliche Charaktervorstellungen werden später gesondert freigegeben.'),save,status);
    form.addEventListener('input',()=>{dirty=true;});window.addEventListener('beforeunload',event=>{if(dirty&&form.isConnected){event.preventDefault();event.returnValue='';}});
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
      const fresh=await Raben.member();if(!fresh||fresh.user_id!==actor.user_id||fresh.status!=='pending')throw {code:'42501'};
      const payload={};Object.entries(fields).forEach(([key,input])=>{payload[key]=input.value.trim();});
      const rows=current?await check(Raben.client().from('raben_applications').update(payload).eq('user_id',actor.user_id).eq('revision',current.revision).select('revision')):await check(Raben.client().from('raben_applications').insert(payload).select('revision'));
      if(epoch!==applicationEpoch)return;if(!rows.length)throw new Error('application_conflict');current=rows[0];dirty=false;status.textContent='Bewerbung eingereicht. Die Clanführung erhält sie in ihrer Verwaltung.';status.classList.remove('is-error');
    }catch(error){status.textContent=failure(error);status.classList.add('is-error');}finally{status.hidden=false;save.disabled=false;}});
    root.append(form,button('Entscheidung aktualisieren',()=>{if(!dirty||confirm('Ungespeicherte Eingaben verwerfen?'))mountApplication(root).catch(error=>{status.textContent=failure(error);status.hidden=false;});}));
  };
  const audit=async()=>{for(const ctx of [...scopes])if(!ctx.public&&!ctx.disposed){try{await ensure(ctx);}catch(_){}}};
  window.addEventListener('focus',audit);window.addEventListener('visibilitychange',()=>{if(!document.hidden)audit();});setInterval(()=>{if(!document.hidden)audit();},30000);
  window.addEventListener('beforeunload',event=>{if([...scopes].some(ctx=>ctx.dirty)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('raben-lock',()=>{applicationEpoch++;for(const root of applicationRoots){root.replaceChildren();root.append(note('Du bist abgemeldet. Lade die Seite neu, um dich wieder anzumelden.'));}for(const ctx of [...scopes])if(!ctx.public)clearScope(ctx);});
  window.RabenHub={mountMember:(root,actor)=>mount(root,actor,'member'),mountAdmin:(root,actor)=>mount(root,actor,'admin'),mountPublic:root=>mount(root,null,'public'),mountApplication,lock:()=>{for(const ctx of [...scopes])if(!ctx.public)clearScope(ctx);}};
})();
