(() => {
  'use strict';
  const {el,check}=Raben, expansion=window.RabenExpansion;
  if(!expansion)return;
  const {field,button}=expansion;
  const note=text=>el('p','field-note',text);
  const card=(title,body='')=>{const c=el('article','hub-card');c.append(el('h3','',title));if(body)c.append(el('p','hub-body',body));return c;};
  const current=(ctx,epoch)=>!ctx.disposed&&ctx.epoch===epoch;
  const subscriptions=[['posts','Interne Aushänge'],['event','Kalenderänderungen'],['reply','Antworten'],['mention','Erwähnungen'],['gallery','Dorfgalerie'],['chronicle','Chronik'],['character','Charakterbuch'],['task','Aufträge'],['project','Bauprojekte'],['knowledge','Wissen'],['poll','Abstimmungen'],['journal','Tagebuch'],['trade','Handel'],['media','Medien'],['requests','RP-Gesuche'],['plots','Plotgruppen']];
  const fonts={default:null,system:'"Segoe UI", system-ui, sans-serif',serif:'Georgia, "Times New Roman", serif',arial:'Arial, sans-serif',verdana:'Verdana, sans-serif',monospace:'Consolas, "Courier New", monospace',fraktur:'RabenFraktur, Georgia, serif',medieval:'RabenMedieval, Georgia, serif',palatino:'"Palatino Linotype", Palatino, serif',trebuchet:'"Trebuchet MS", sans-serif',tahoma:'Tahoma, sans-serif',times:'"Times New Roman", serif'};
  const fontChoices=[['default','Website-Standard'],['system','Systemschrift'],['serif','Georgia'],['arial','Arial'],['verdana','Verdana'],['monospace','Consolas'],['fraktur','Altdeutsch · Fraktur'],['medieval','MedievalSharp · Mittelalter'],['palatino','Palatino'],['trebuchet','Trebuchet'],['tahoma','Tahoma'],['times','Times New Roman']];
  const styleDefaults={heading_font:'default',heading_size:26,heading_color:'#eed8b3',heading_effect:'none',heading_from:'#f6dfb3',heading_to:'#c89148',text_effect:'none',text_from:'#f0eee8',text_to:'#8cd5cb'};
  const personalVars=['--sans','--serif','--personal-color','--personal-heading-font','--personal-heading-color','--personal-heading-size','--personal-heading-gradient','--personal-text-gradient'];
  const effectClasses=['personal-heading-gradient','personal-heading-shadow','personal-heading-glow','personal-text-gradient','personal-text-shadow','personal-text-glow'];
  const defaults={subscriptions:['posts','event','reply','mention'],font_family:'default',font_color:'#f0eee8',font_size:16};
  const cache=new Map();let generation=0;
  const appearance=values=>{
    const style=document.documentElement.style;if(!style)return;
    const family=fonts[values.font_family],reading={...styleDefaults,...values.reading_style},heading=fonts[reading.heading_font];
    if(family)style.setProperty('--sans',family);else style.removeProperty('--sans');
    if(heading){style.setProperty('--serif',heading);style.setProperty('--personal-heading-font',heading);}else{style.removeProperty('--serif');style.removeProperty('--personal-heading-font');}
    style.setProperty('--personal-color',/^#[\da-f]{6}$/i.test(values.font_color||'')?values.font_color:defaults.font_color);
    const color=(value,fallback)=>/^#[\da-f]{6}$/i.test(value||'')?value:fallback;
    style.setProperty('--personal-heading-color',color(reading.heading_color,styleDefaults.heading_color));style.setProperty('--personal-heading-size',Math.max(18,Math.min(48,Number(reading.heading_size)||26))+'px');
    style.setProperty('--personal-heading-gradient','linear-gradient(110deg,'+color(reading.heading_from,styleDefaults.heading_from)+','+color(reading.heading_to,styleDefaults.heading_to)+')');style.setProperty('--personal-text-gradient','linear-gradient(110deg,'+color(reading.text_from,styleDefaults.text_from)+','+color(reading.text_to,styleDefaults.text_to)+')');
    effectClasses.forEach(name=>document.body.classList.remove(name));for(const scope of ['heading','text'])if(['gradient','shadow','glow'].includes(reading[scope+'_effect']))document.body.classList.add('personal-'+scope+'-'+reading[scope+'_effect']);
    style.fontSize=(Math.max(14,Math.min(24,Number(values.font_size)||16)))+'px';document.body.classList.add('personal-appearance');
  };
  const resetAppearance=()=>{
    generation++;cache.clear();for(const name of personalVars)document.documentElement.style?.removeProperty(name);effectClasses.forEach(name=>document.body.classList.remove(name));
    if(document.documentElement.style)document.documentElement.style.fontSize='';document.body.classList.remove('personal-appearance');
  };
  const load=async ctx=>{
    if(ctx.public||ctx.disposed||ctx.actor?.status!=='active')return;
    const uid=ctx.actor.user_id,epoch=ctx.epoch,ownGeneration=generation;let entry=cache.get(uid);
    if(!entry||Date.now()-entry.time>30000){const rows=await check(Raben.client().from('raben_preferences').select('font_family,font_color,font_size,reading_style').eq('user_id',uid));if(!current(ctx,epoch)||ownGeneration!==generation)return;entry={time:Date.now(),values:{...defaults,...rows[0]}};cache.set(uid,entry);}
    if(current(ctx,epoch)&&ownGeneration===generation)appearance(entry.values);
  };
  // Keep save actions visible, prevent duplicate submissions and preserve failed edits.
  const form=(ctx,title,saveLabel,onSave)=>{
    const f=el('form','hub-editor settings-form'),message=el('p','status-message');message.hidden=true;message.setAttribute('role','status');
    const controls=()=>{const bar=el('div','hub-inline-actions settings-actions'),save=el('button','button small-button',saveLabel);save.type='submit';bar.append(save);return bar;};
    f.append(el('h3','',title),controls(),message);f.addEventListener('input',()=>ctx.dirty=true);f.addEventListener('change',()=>ctx.dirty=true);
    f.addEventListener('submit',async event=>{
      event.preventDefault();if(f.dataset.saving==='true')return;const epoch=ctx.epoch;f.dataset.saving='true';const buttons=[...f.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
      const report=(text,error=false)=>{if(!current(ctx,epoch))return;message.textContent=text;message.hidden=!text;message.classList.toggle('is-error',error);ctx.report(text,error);};
      try{report('Wird gespeichert …');await ctx.authorize();if(!current(ctx,epoch))return;const result=await onSave(epoch);if(current(ctx,epoch)){ctx.dirty=false;report(result||'Gespeichert.');}}
      catch(error){report(errorMessage(error),true);}finally{delete f.dataset.saving;buttons.forEach(b=>b.disabled=false);}
    });f.finish=()=>f.append(controls());return f;
  };
  const errorMessage=error=>{
    const text=error.message||'';
    if(text.includes('webhook_url'))return 'Bitte eine gültige Discord-Webhook-Adresse eintragen.';
    if(text.includes('webhook_required'))return 'Zum Aktivieren zunächst eine Discord-Webhook-Adresse hinterlegen.';
    if(text.includes('invalid_clan_assignment'))return 'Bitte einen aktiven Clanaccount und passende Ränge oder Ämter auswählen.';
    if(text.includes('assigned_rank_category'))return 'Die Art eines vergebenen Rangs oder Amts kann erst nach Entfernen der Zuordnungen geändert werden.';
    if(text.includes('conflict'))return 'Diese Angaben wurden inzwischen geändert. Bitte aktualisieren und erneut bearbeiten.';
    return Raben.errorMessage(error);
  };
  const settings=async ctx=>{
    const epoch=ctx.epoch,rows=await check(Raben.client().from('raben_preferences').select('*').eq('user_id',ctx.actor.user_id));if(!current(ctx,epoch))return;
    const prefs={...defaults,...rows[0]},readingValues={...styleDefaults,...prefs.reading_style},inputs=[],visual={};let family,color,size;
    const f=form(ctx,'Meine persönlichen Einstellungen','Einstellungen speichern',async ownEpoch=>{
      const saved=await check(Raben.client().rpc('raben_save_reading_preferences',{p_subscriptions:inputs.filter(([,input])=>input.checked).map(([key])=>key),p_font_family:family.input.value,p_font_color:color.input.value,p_font_size:Number(size.input.value),p_style:Object.fromEntries(Object.entries(visual).map(([key,input])=>[key,key==='heading_size'?Number(input.value):input.value]))}));
      if(current(ctx,ownEpoch)){cache.set(ctx.actor.user_id,{time:Date.now(),values:saved});appearance(saved);}return 'Deine Einstellungen sind gespeichert.';
    });f.append(note('Diese Einstellungen gehören zu deinem Konto. Jedes angenommene Clanmitglied kann sie für sich ändern.'));
    const reading=el('fieldset','settings-fields');reading.append(el('legend','','Schrift und Lesbarkeit'));
    family=field('Schriftart','select',prefs.font_family,fontChoices);color=field('Schriftfarbe','color',prefs.font_color);size=field('Schriftgröße in Pixeln','number',prefs.font_size);size.input.min=14;size.input.max=24;size.input.step=1;size.input.required=true;
    const preview=el('div','settings-preview');preview.append(el('h4','','Deine Lesevorschau'),el('p','','Unter schwarzen Flügeln. So erscheinen Texte nur für dich.'));
    const gradientFields=[];
    const updatePreview=()=>{
      preview.style.fontFamily=fonts[family.input.value]||fonts.system;preview.style.color=color.input.value;preview.style.fontSize=Math.max(14,Math.min(24,Number(size.input.value)||16))+'px';
      for(const [scope,node] of [['heading',preview.querySelector('h4')],['text',preview.querySelector('p')]]){const effect=visual[scope+'_effect']?.value||'none',base=scope==='heading'?visual.heading_color?.value||readingValues.heading_color:color.input.value;node.style.fontFamily=scope==='heading'?fonts[visual.heading_font?.value]||'Georgia, serif':'inherit';node.style.fontSize=scope==='heading'?(visual.heading_size?.value||26)+'px':'inherit';node.style.color=effect==='gradient'?'transparent':base;node.style.setProperty('-webkit-text-fill-color',effect==='gradient'?'transparent':base);node.style.backgroundImage=effect==='gradient'?'linear-gradient(110deg,'+visual[scope+'_from'].value+','+visual[scope+'_to'].value+')':'none';node.style.backgroundClip='text';node.style.textShadow=effect==='glow'?'0 0 .5em '+base:effect==='shadow'?'0 2px 3px #000':'none';}
      gradientFields.forEach(([scope,wrap])=>wrap.hidden=visual[scope+'_effect'].value!=='gradient');
    };
    [family,color,size].forEach(x=>{x.input.addEventListener('input',updatePreview);x.input.addEventListener('change',updatePreview);reading.append(x.wrap);});
    const effects=[['none','Ohne Effekt'],['gradient','Farbverlauf'],['shadow','Schatten'],['glow','Leuchten']];
    for(const scope of ['heading','text']){const group=el('fieldset','settings-fields reading-group');group.append(el('legend','',scope==='heading'?'Überschriften':'Fließtext · Effekte'));const definitions=scope==='heading'?[['heading_font','Schriftart der Überschriften','select',fontChoices],['heading_size','Größe der Überschriften in Pixeln','number'],['heading_color','Farbe der Überschriften','color'],['heading_effect','Effekt der Überschriften','select',effects],['heading_from','Überschriften · Verlauf von','color'],['heading_to','Überschriften · Verlauf bis','color']]:[['text_effect','Effekt des Fließtexts','select',effects],['text_from','Fließtext · Verlauf von','color'],['text_to','Fließtext · Verlauf bis','color']];for(const [key,label,type,options] of definitions){const x=field(label,type,readingValues[key],options);if(type==='number'){x.input.min=18;x.input.max=48;x.input.step=1;x.input.required=true;}visual[key]=x.input;group.append(x.wrap);if(key.endsWith('_from')||key.endsWith('_to'))gradientFields.push([scope,x.wrap]);x.input.addEventListener('input',updatePreview);x.input.addEventListener('change',updatePreview);}reading.append(group);}
    const standard=el('button','button outline small-button','Standard-Schrift wählen');standard.type='button';standard.addEventListener('click',()=>{family.input.value=defaults.font_family;color.input.value=defaults.font_color;size.input.value=defaults.font_size;Object.entries(visual).forEach(([key,input])=>input.value=styleDefaults[key]);ctx.dirty=true;updatePreview();});reading.append(preview,standard,note('Die Vorschau ändert sich sofort. Speichern übernimmt die Auswahl auch auf deinen anderen Geräten.'));updatePreview();f.append(reading);
    const notices=el('fieldset','settings-fields settings-subscriptions');notices.append(el('legend','','Welche Hinweise möchtest du auf der Website erhalten?'));subscriptions.forEach(([key,label])=>{const x=field(label,'checkbox',prefs.subscriptions.includes(key));inputs.push([key,x.input]);notices.append(x.wrap);});f.append(notices);
    const motion=field('Animationen auf diesem Gerät deaktivieren','checkbox',localStorage.getItem('raben-reduced-motion')==='1');motion.input.addEventListener('change',()=>{try{localStorage.setItem('raben-reduced-motion',motion.input.checked?'1':'0');}catch(_){}document.documentElement.classList.toggle('reduce-motion',motion.input.checked);window.dispatchEvent(new Event('raben-motion-changed'));});
    const autoplay=field('Auf diesem Gerät YouTube-Videos automatisch laden und stumm starten','checkbox',localStorage.getItem('raben-youtube-autoplay')==='1');autoplay.input.addEventListener('change',()=>{try{localStorage.setItem('raben-youtube-autoplay',autoplay.input.checked?'1':'0');}catch(_){} });
    const spotify=field('Auf diesem Gerät Spotify automatisch laden und starten','checkbox',window.RabenSpotify?.preference()||false);spotify.input.addEventListener('change',()=>window.RabenSpotify?.setAutoplay(spotify.input.checked));
    f.append(motion.wrap,autoplay.wrap,spotify.wrap,note('Spotify kann einen ersten Klick im Player benötigen. Die Autostart-Auswahl gilt auch für die Begleitmusik der Startseite.'),note('Discord-Meldungen für Aushänge, Termine und Abstimmungen laufen über den Webhook im Bereich „Discord-Webhook“. Deine Auswahl hier betrifft deine persönlichen Hinweise auf dieser Website.'));f.finish();ctx.list.append(f);
  };
  const clanInfo=async ctx=>{
    const epoch=ctx.epoch,row=await check(Raben.client().from('raben_clan_information').select('*').eq('id',1).single());if(!current(ctx,epoch))return;
    const sections=[['body','Über unseren Clan'],['rules','Interne Regeln und Absprachen'],['playtimes','Spielzeiten und Organisation'],['contact','Clanführung und Ansprechpartner']],views=[];
    const draw=values=>{views.forEach(c=>c.remove());views.length=0;views.push(card(values.title));sections.forEach(([key,label])=>views.push(card(label,values[key]||'Die Clanführung ergänzt diese Angaben.')));ctx.list.prepend(...views);};draw(row);
    if(ctx.actor.role==='admin'){
      const fields={};let revision=row.revision;
      const f=form(ctx,'Claninfos bearbeiten','Claninfos speichern',async ownEpoch=>{
        const values=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]));
        const updated=await check(Raben.client().from('raben_clan_information').update(values).eq('id',1).eq('revision',revision).select('revision'));if(!updated.length)throw new Error('clan_info_conflict');revision=updated[0].revision;if(current(ctx,ownEpoch))draw(values);return 'Claninfos gespeichert. Alle aktiven Clanmitglieder können sie lesen.';
      });
      [['title','Clanname'],...sections].forEach(([key,label])=>{const x=field(label,key==='title'?'text':'textarea',row[key]);x.input.maxLength=key==='title'?120:key==='playtimes'||key==='contact'?10000:20000;if(key==='title')x.input.required=true;fields[key]=x.input;f.append(x.wrap);});
      f.append(note('Diese Angaben sind für den Clan sichtbar. Die öffentliche Website hat eigene bearbeitbare Texte.'),button(ctx,'Öffentliche Vorstellung bearbeiten',()=>ctx.navigate('publicSettings')),button(ctx,'Clanränge & Ämter vergeben',()=>ctx.navigate('access')),button(ctx,'Clanwappen ändern',()=>ctx.navigate('emblem')));f.finish();ctx.list.append(f);
    }
  };
  const access=async ctx=>{
    if(ctx.actor.role!=='admin')throw {code:'42501'};
    const epoch=ctx.epoch,[allRanks,assigned,offices,permissions]=await Promise.all([check(Raben.client().from('raben_ranks').select('*').order('sort_order')),check(Raben.client().from('raben_member_ranks').select('*')),check(Raben.client().from('raben_member_offices').select('*')),check(Raben.client().from('raben_permissions').select('*'))]);if(!current(ctx,epoch))return;
    const ranks=allRanks.filter(r=>r.category!=='office'),jobs=allRanks.filter(r=>r.category==='office');
    ctx.list.append(card('RP-Rang und Verwaltung getrennt','Clanränge und Ämter beschreiben die Rolle im Clan. Jarl steht für den Clan-Owner. Website-Admins, Kalenderpflege und Inhaltsrechte werden separat vergeben. Ein Rangname allein ändert keine Website-Berechtigung.'));
    const manageRank=row=>{
      if(ctx.dirty&&!confirm('Ungespeicherte Eingaben verwerfen?'))return;
      const fields={};const f=form(ctx,row?'Rang oder Amt bearbeiten':'Rang oder Amt hinzufügen','Rang oder Amt speichern',async()=>{
        const values={label:fields.label.value.trim(),description:fields.description.value.trim(),sort_order:Number(fields.sort_order.value)||0,category:fields.category.value},query=Raben.client().from('raben_ranks');const rows=await check(row?query.update(values).eq('id',row.id).select('id'):query.insert(values).select('id'));if(!rows.length)throw new Error('rank_conflict');ctx.dirty=false;await expansion.mount(ctx);return 'Rang oder Amt gespeichert.';
      });[['label','Name','text'],['description','Beschreibung','textarea'],['sort_order','Reihenfolge','number'],['category','Art','select']].forEach(([key,label,type])=>{const x=field(label,type,row?.[key]??(key==='category'?'rank':key==='sort_order'?allRanks.length:''),[['rank','Clanrang'],['office','Besonderes Amt']]);x.input.maxLength=key==='description'?1000:60;if(key==='label')x.input.required=true;fields[key]=x.input;f.append(x.wrap);});f.finish();ctx.editor.replaceChildren(f);
    };
    const directory=card('Clanränge und besondere Ämter');for(const [heading,entries] of [['Clanränge',ranks],['Ämter · mehrere pro Mitglied möglich',jobs]]){directory.append(el('h4','',heading));entries.forEach(row=>{const line=el('div','rank-directory-entry');line.append(note(row.label+' · '+row.description),button(ctx,'Bearbeiten',()=>manageRank(row)),button(ctx,'Entfernen',async()=>{if(!confirm('Diesen Rang oder dieses Amt samt Zuordnungen entfernen?'))return;await check(Raben.client().from('raben_ranks').delete().eq('id',row.id));await expansion.mount(ctx);}));directory.append(line);});}directory.append(button(ctx,'Rang oder Amt hinzufügen',()=>manageRank(null)));ctx.list.append(directory);
    for(const person of ctx.identities?.values()||[]){
      const f=form(ctx,person.display_name,'Zuordnung speichern',async ownEpoch=>{
        await check(Raben.client().rpc('raben_assign_clan_roles',{p_user:person.user_id,p_rank:rank.input.value||null,p_offices:jobInputs.filter(x=>x.checked).map(x=>x.value),p_calendar:calendar.input.checked,p_content:content.input.checked}));
        if(current(ctx,ownEpoch)){await RabenIdentity.load(ctx);window.dispatchEvent(new CustomEvent('raben-identity-updated',{detail:{user_id:person.user_id}}));}return 'Clanrang, Ämter und zusätzliche Website-Rechte gespeichert.';
      });f.dataset.memberId=person.user_id;f.append(RabenIdentity.person(ctx,person.user_id),note('Website-Rolle: '+(person.role==='admin'?'Admin':'Mitglied')));
      const rank=field('Clanrang','select',assigned.find(a=>a.user_id===person.user_id)?.rank_id||'',[['','Kein Clanrang'],...ranks.map(r=>[r.id,r.label])]);f.append(rank.wrap);const officeGroup=el('fieldset','settings-fields');officeGroup.append(el('legend','','Besondere Ämter'));const jobInputs=[];
      jobs.forEach(job=>{const x=field(job.label,'checkbox',offices.some(o=>o.user_id===person.user_id&&o.office_id===job.id));x.input.value=job.id;jobInputs.push(x.input);officeGroup.append(x.wrap);});f.append(officeGroup);
      const calendar=field('Kalender verwalten','checkbox',permissions.some(p=>p.user_id===person.user_id&&p.permission==='calendar')),content=field('Claninhalte bearbeiten','checkbox',permissions.some(p=>p.user_id===person.user_id&&p.permission==='content'));f.append(calendar.wrap,content.wrap);f.finish();ctx.list.append(f);
    }
  };
  const webhook=async ctx=>{
    if(ctx.actor.role!=='admin')throw {code:'42501'};
    const epoch=ctx.epoch;let state=await check(Raben.client().rpc('raben_discord_status'));if(!current(ctx,epoch))return;
    const summary=card('Discord-Meldungen per Webhook'),summaryText=note(''),history=card('Letzte Discord-Meldungen');summary.append(summaryText);ctx.list.append(summary);
    const url=field('Discord-Webhook-Adresse · leer lassen, um die gespeicherte Adresse zu behalten','password'),enabled=field('Automatische Meldungen an Discord aktivieren','checkbox',state.enabled),inputs=[];url.input.maxLength=2048;url.input.autocomplete='new-password';
    const draw=()=>{summaryText.textContent=(state.configured?'Deine Webhook-Adresse ist geschützt gespeichert.':'Noch kein Webhook hinterlegt.')+' '+(state.enabled?'Versand aktiviert.':'Versand ausgeschaltet.')+(state.pending?' '+state.pending+' Meldungen warten.':'')+(state.updated_at?' Zuletzt gespeichert: '+new Date(state.updated_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'');url.input.placeholder=state.configured?'Adresse gespeichert · nur zum Wechseln neu einfügen':'https://discord.com/api/webhooks/…';history.replaceChildren(el('h3','','Letzte Discord-Meldungen'));(state.recent||[]).forEach(row=>history.append(note(row.title+' · '+({pending:'wartet auf Versand',sending:'wird gesendet',sent:'gesendet',failed:'fehlgeschlagen',cancelled:'durch geänderte Einstellungen verworfen'}[row.status]||row.status)+(row.status_code?' · HTTP '+row.status_code:''))));if(!state.recent?.length)history.append(note('Noch keine Meldungen.'));};
    const saveConnection=async ownEpoch=>{const saved=await check(Raben.client().rpc('raben_save_discord_webhook',{p_url:url.input.value.trim()||null,p_enabled:enabled.input.checked,p_scopes:inputs.filter(([,input])=>input.checked).map(([scope])=>scope),p_clear:false}));if(current(ctx,ownEpoch)){state=saved;url.input.value='';ctx.dirty=false;draw();}return saved;};
    const refresh=async()=>{const next=await check(Raben.client().rpc('raben_discord_status'));if(current(ctx,epoch)){state=next;draw();}};
    const poll=(count=0)=>{setTimeout(async()=>{if(!current(ctx,epoch))return;try{await refresh();if(state.pending&&count<5)poll(count+1);}catch(_){}},count?15000:1500);};
    const f=form(ctx,'Discord-Webhook einrichten','Webhook speichern',async ownEpoch=>{await saveConnection(ownEpoch);return 'Webhook gespeichert. Die Adresse bleibt auch nach dem Neuladen hinterlegt.';});
    f.append(note('In Discord: Kanal bearbeiten → Integrationen → Webhooks → Neuer Webhook → Webhook-URL kopieren. Die gespeicherte Adresse wird anschließend nicht erneut angezeigt. Das Feld darf beim nächsten Speichern leer bleiben.'),url.wrap,enabled.wrap);
    [['posts','Hinweise und Aushänge'],['event','Neue oder geänderte Termine'],['poll','Neue oder geänderte Abstimmungen']].forEach(([scope,label])=>{const x=field(label,'checkbox',(state.scopes||['posts','event','poll']).includes(scope));inputs.push([scope,x.input]);f.append(x.wrap);});
    f.append(note('Meldungen enthalten Titel, Terminangaben und einen Link zur Website. Persönliche Profile und Plotgruppen bleiben auf der Website. Es gibt keine automatischen @everyone-Pings. Unverändertes Speichern lässt wartende Meldungen bestehen.'));
    f.append(button(ctx,'Verbindung prüfen',async ownEpoch=>{await saveConnection(ownEpoch);if(!state.configured){ctx.report('Bitte zuerst eine Webhook-Adresse eintragen.',true);return;}const result=await check(Raben.client().rpc('raben_discord_check'));await refresh();ctx.report(result.ok?'Discord bestätigt die gespeicherte Verbindung.':result.status===404?'Discord kennt diesen Webhook nicht mehr. Bitte eine neue Webhook-Adresse hinterlegen.':'Die Verbindung wurde nicht bestätigt.'+(result.status?' Discord antwortet mit HTTP '+result.status+'.':' Bitte erneut prüfen.'),!result.ok);}),button(ctx,'Testnachricht senden',async ownEpoch=>{await saveConnection(ownEpoch);if(!state.configured||!state.enabled){ctx.report('Bitte eine Webhook-Adresse speichern und den Versand aktivieren.',true);return;}await check(Raben.client().rpc('raben_discord_test'));await refresh();poll();ctx.report('Testnachricht eingereiht. Der Versandstatus aktualisiert sich automatisch.');}),button(ctx,'Status aktualisieren',refresh),button(ctx,'Gespeicherten Webhook entfernen',async()=>{if(!confirm('Den hinterlegten Webhook entfernen und den Versand stoppen?'))return;state=await check(Raben.client().rpc('raben_save_discord_webhook',{p_url:null,p_enabled:false,p_scopes:[],p_clear:true}));enabled.input.checked=false;url.input.value='';ctx.dirty=false;draw();ctx.report('Webhook entfernt.');}));f.finish();ctx.list.append(f,history);draw();if(state.pending)poll();
  };
  const rankLabels=async ctx=>{
    const [ranks,assigned,offices]=await Promise.all([check(Raben.client().from('raben_ranks').select('id,label,category')),check(Raben.client().from('raben_member_ranks').select('user_id,rank_id')),check(Raben.client().from('raben_member_offices').select('user_id,office_id'))]);ctx.rankLabels=new Map(assigned.map(a=>[a.user_id,ranks.find(r=>r.id===a.rank_id)?.label||'']));ctx.officeLabels=new Map();offices.forEach(o=>{const name=ranks.find(r=>r.id===o.office_id)?.label;if(name){const entries=ctx.officeLabels.get(o.user_id)||[];entries.push(name);ctx.officeLabels.set(o.user_id,entries);}});
  };
  Object.assign(expansion.labels,{settings:'Meine Einstellungen',clanInfo:'Claninfos',access:'Clanränge & Ämter',publicSettings:'Öffentliche Texte',webhook:'Discord-Webhook',emblem:'Clanwappen'});Object.assign(expansion.handlers,{settings,clanInfo,access,webhook,emblem:ctx=>window.RabenBranding.editor(ctx)});expansion.rankLabels=rankLabels;
  window.RabenSettings={load,appearance,resetAppearance,errorMessage,fonts,fontChoices};window.addEventListener('raben-lock',resetAppearance);
})();
