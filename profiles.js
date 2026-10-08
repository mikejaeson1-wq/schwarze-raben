(() => {
  'use strict';
  const {el,check}=Raben;
  const BUCKET='raben-profile-media';
  const fields={avatar:'Profilbild',character:'Charakter',info:'Infokarte'};
  const visibilityNames={private:'Nur du',clan:'Ganzer Clan',selected:'Ausgewählte Mitglieder'};
  const explanations={private:'Nur du kannst diesen Eintrag und sein Bild sehen. Auch andere Clanadmins haben keinen Zugriff.',clan:'Alle aktuell freigegebenen Clanmitglieder können diesen Eintrag und sein Bild sehen.',selected:'Nur du und die von dir ausgewählten, aktiven Clanmitglieder können diesen Eintrag und sein Bild sehen.'};
  const live=(ctx,epoch)=>!ctx.disposed&&!ctx.public&&ctx.kind==='profiles'&&ctx.epoch===epoch;
  const note=text=>el('p','field-note',text);
  const button=(text,fn,style='button outline small-button')=>{const b=el('button',style,text);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
  const field=(text,type='text',value='')=>{
    const wrap=el('label','form-field',text),input=document.createElement(type==='textarea'?'textarea':'input');
    if(type!=='textarea')input.type=type;input.value=value;wrap.append(input);return {wrap,input};
  };
  const errorMessage=error=>{
    const message=error?.message||'';
    if(message.includes('conflict')||error?.code==='40001')return 'Das Profil wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Schließe die Bearbeitung und lade den aktuellen Stand.';
    if(message.includes('invalid_profile_recipients'))return 'Wähle mindestens ein aktives Clanmitglied aus, höchstens 20. Aktualisiere die Seite, falls ein Mitglied inzwischen gesperrt wurde.';
    if(message.includes('profile_image_missing'))return 'Das Bild konnte noch nicht bestätigt werden. Deine Eingaben bleiben erhalten. Versuche „Speichern“ erneut.';
    if(message.includes('invalid_profile_image'))return 'Bitte lade das Bild hier als JPG, PNG oder WebP hoch.';
    if(message==='file_required')return 'Bitte wähle ein Profilbild als JPG, PNG oder WebP aus.';
    if(error?.code==='23505')return 'Dieses Profil oder Profilbild existiert bereits. Schließe die Bearbeitung und aktualisiere das Profil.';
    if(error?.code==='42501')return 'Dein Clan-Zugang erlaubt diese Änderung nicht. Du kannst ausschließlich dein eigenes Profil bearbeiten.';
    if(error?.code==='23514')return 'Bitte prüfe Profilname, Titel und Sichtbarkeit.';
    return window.RabenMedia?.errorMessage(error)||Raben.errorMessage(error);
  };
  const act=async(ctx,b,fn)=>{
    const epoch=ctx.epoch;b.disabled=true;
    try{await ctx.authorize();if(!live(ctx,epoch))return;await fn(epoch);}
    catch(error){if(live(ctx,epoch))ctx.report(errorMessage(error),true);}
    finally{b.disabled=false;}
  };
  const discard=ctx=>!ctx.dirty||confirm('Ungespeicherte Profileingaben verwerfen?');
  const cancelTransfers=ctx=>{for(const transfer of ctx.transfers||[])transfer.cancel?.();ctx.transfers?.clear();};
  const closeEditor=ctx=>{
    if(!discard(ctx))return;cancelTransfers(ctx);ctx.dirty=false;ctx.editor.replaceChildren();
  };
  const editStart=(ctx,form)=>{
    if(!discard(ctx))return false;cancelTransfers(ctx);ctx.dirty=false;ctx.editor.replaceChildren(form);
    form.addEventListener('input',()=>{ctx.dirty=true;});form.addEventListener('change',()=>{ctx.dirty=true;});
    form.scrollIntoView?.({block:'start'});return true;
  };
  const image=async(ctx,item,host,avatar=false)=>{
    if(!item.image_path)return;const epoch=ctx.epoch;
    try{
      const blob=await check(Raben.client().storage.from(BUCKET).download(item.image_path));
      if(!live(ctx,epoch)||!host.isConnected)return;
      const url=URL.createObjectURL(blob);ctx.urls.add(url);const img=el('img',avatar?'profile-avatar':'hub-image');
      img.src=url;img.alt=avatar?'Profilbild':item.title;img.loading='lazy';host.prepend(img);
    }catch(_){if(live(ctx,epoch)&&host.isConnected)host.append(note('Das Bild ist gerade nicht verfügbar. Aktualisiere das Profil.'));}
  };
  // Delete only an old, owned file that is no longer attached. The server checks again.
  const tidy=async(ctx,path,epoch)=>{
    if(!path||!live(ctx,epoch))return;
    try{
      const used=await check(Raben.client().from('raben_profile_items').select('id').eq('image_path',path).limit(1));
      if(!used.length&&live(ctx,epoch))await Raben.client().storage.from(BUCKET).remove([path]);
    }catch(_){/* An unused file can remain after a connection failure. */}
  };
  const openName=(ctx,profile=null)=>{
    const form=el('form','hub-editor profile-editor'),name=field('Profilname · für den Clan sichtbar','text',profile?.display_name||ctx.actor.display_name||'');
    name.input.required=true;name.input.maxLength=80;
    const save=button(profile?'Profilname speichern':'Profil erstellen',null,'button small-button');save.type='submit';
    const actions=el('div','hub-inline-actions');actions.append(save,button('Schließen',()=>closeEditor(ctx)));
    form.append(el('h3','',profile?'Deinen Profilnamen ändern.':'Dein Platz unter den Raben.'),note('Dein Profilname ist für alle aktiven Clanmitglieder sichtbar. Für Bilder, Charaktere und Infokarten wählst du die Sichtbarkeit jeweils selbst.'),name.wrap,actions);
    form.addEventListener('submit',event=>{event.preventDefault();act(ctx,save,async epoch=>{
      const saved=await check(Raben.client().rpc('raben_save_profile',{p_name:name.input.value.trim(),p_expected:profile?.revision??null}));
      if(!live(ctx,epoch))return;ctx.dirty=false;ctx.profileId=saved.user_id;await mount(ctx);ctx.report(profile?'Profilname gespeichert.':'Profil erstellt. Ergänze jetzt dein Bild, deine Charaktere und Infos.');
    });});editStart(ctx,form);
  };
  const openItem=async(ctx,profile,kind,item=null)=>{
    const epoch=ctx.epoch;if(profile.user_id!==ctx.actor.user_id)throw {code:'42501'};
    await ctx.authorize();
    const [people,grants]=await Promise.all([
      check(Raben.client().from('raben_memberships').select('user_id,display_name,role,discord_id').eq('status','active').order('display_name').limit(1000)),
      item?check(Raben.client().from('raben_profile_grants').select('grantee_id').eq('item_id',item.id)):Promise.resolve([])
    ]);
    if(!live(ctx,epoch))return;
    const form=el('form','hub-editor profile-editor');form.dataset.profileKind=kind;
    form.append(el('h3','',fields[kind]+(item?' bearbeiten.':' hinzufügen.')));
    const title=field(kind==='character'?'Charaktername':'Überschrift','text',item?.title||''),body=field(kind==='character'?'Charakterinfos · Herkunft, Beruf, Geschichte, Beziehungen':'Deine Infos','textarea',item?.body||'');
    title.input.maxLength=120;title.input.required=true;body.input.maxLength=20000;body.input.rows=7;
    if(kind!=='avatar')form.append(title.wrap,body.wrap);else form.append(note('Das Profilbild hat eine eigene Sichtbarkeit. Dein Profilname bleibt für den Clan sichtbar.'));
    let file,removeImage;const progress=RabenMedia.progressControls();
    if(kind!=='info'){
      file=field(item?.image_path?'Bild ersetzen':'Bild hochladen','file');file.input.accept='image/jpeg,image/png,image/webp';if(kind==='avatar'&&!item?.image_path)file.input.required=true;
      form.append(file.wrap,note('JPG, PNG oder WebP · bis 50 MB. Bei einer Unterbrechung kannst du mit „Speichern“ fortsetzen.'),progress.wrap);
      if(kind==='character'&&item?.image_path){removeImage=field('Bisheriges Bild entfernen','checkbox');removeImage.input.checked=false;form.append(removeImage.wrap);}
    }
    const visibilityWrap=el('label','form-field','Wer darf diesen Eintrag sehen?'),visibility=el('select','');visibility.dataset.profileField='visibility';
    Object.entries(visibilityNames).forEach(([value,text])=>{const option=el('option','',text);option.value=value;visibility.append(option);});visibility.value=item?.visibility||'private';visibilityWrap.append(visibility);
    const help=note(''),recipients=el('fieldset','profile-recipients'),legend=el('legend','','Mitglieder auswählen'),search=field('Mitglieder suchen','search'),chosen=note(''),options=el('div','profile-recipient-options');
    const selected=new Set(grants.map(g=>g.grantee_id)),choices=[],nameCounts=new Map();people.forEach(p=>nameCounts.set(p.display_name,(nameCounts.get(p.display_name)||0)+1));
    people.filter(p=>p.user_id!==ctx.actor.user_id).forEach(person=>{
      const identity=nameCounts.get(person.display_name)>1?' · Discord-ID '+person.discord_id:'';
      const choice=field(person.display_name+identity+(person.role==='admin'?' · Admin':''),'checkbox');choice.input.checked=selected.has(person.user_id);choice.input.value=person.user_id;choice.wrap.dataset.memberName=(person.display_name+identity).toLocaleLowerCase('de');
      choice.input.addEventListener('change',()=>{if(choice.input.checked)selected.add(person.user_id);else selected.delete(person.user_id);drawRecipients();});choices.push(choice);options.append(choice.wrap);
    });
    const activeIds=new Set(people.map(p=>p.user_id));const unavailable=grants.filter(g=>!activeIds.has(g.grantee_id));unavailable.forEach(g=>selected.delete(g.grantee_id));
    const noMatch=note('Kein passendes aktives Mitglied.');noMatch.hidden=true;
    const drawRecipients=()=>{
      const needle=search.input.value.trim().toLocaleLowerCase('de');let count=0;choices.forEach(choice=>{choice.wrap.hidden=!choice.wrap.dataset.memberName.includes(needle);if(!choice.wrap.hidden)count++;});
      noMatch.hidden=!!count;chosen.textContent=selected.size+' von höchstens 20 Mitgliedern ausgewählt.';
    };
    search.input.addEventListener('input',drawRecipients);recipients.append(legend,search.wrap,options,noMatch,chosen);
    if(unavailable.length)recipients.append(note('Eine frühere Freigabe gehört zu einem nicht mehr aktiven Mitglied und wird beim Speichern entfernt.'));
    const toggle=()=>{help.textContent=explanations[visibility.value];recipients.hidden=visibility.value!=='selected';};visibility.addEventListener('change',toggle);toggle();drawRecipients();form.append(visibilityWrap,help,recipients);
    const save=button('Speichern',null,'button small-button');save.type='submit';const actions=el('div','hub-inline-actions');actions.append(save,button('Schließen',()=>closeEditor(ctx)));form.append(actions);
    form.addEventListener('submit',event=>{event.preventDefault();act(ctx,save,async attempt=>{
      const recipients=visibility.value==='selected'?[...selected]:[];
      if(visibility.value==='selected'&&(!recipients.length||recipients.length>20))throw new Error('invalid_profile_recipients');
      let path=removeImage?.input.checked?null:item?.image_path||null;
      const chosenFile=file?.input.files?.[0];if(chosenFile)path=await RabenMedia.upload(ctx,chosenFile,ctx.actor.user_id,progress,false,null,BUCKET);
      if(!live(ctx,attempt)||!form.isConnected)return;if(kind==='avatar'&&!path)throw new Error('file_required');
      await check(Raben.client().rpc('raben_save_profile_item',{p_id:item?.id||null,p_kind:kind,p_title:kind==='avatar'?'Profilbild':title.input.value.trim(),p_body:kind==='avatar'?'':body.input.value.trim(),p_image_path:path,p_visibility:visibility.value,p_recipients:recipients,p_expected:item?.revision??null}));
      if(!live(ctx,attempt))return;ctx.dirty=false;if(item?.image_path&&item.image_path!==path)await tidy(ctx,item.image_path,attempt);
      await mount(ctx);ctx.report(fields[kind]+' gespeichert · '+visibilityNames[visibility.value]+'.');
    });});editStart(ctx,form);
  };
  const itemActions=(ctx,profile,item)=>{
    const actions=el('div','hub-inline-actions'),edit=button('Bearbeiten',()=>act(ctx,edit,()=>openItem(ctx,profile,item.kind,item)));
    const remove=button('Löschen',()=>act(ctx,remove,async epoch=>{
      if(!discard(ctx)||!confirm('„'+item.title+'“ und die zugehörigen Profilfreigaben löschen?'))return;
      const changed=await check(Raben.client().from('raben_profile_items').delete().eq('id',item.id).eq('owner_id',ctx.actor.user_id).eq('revision',item.revision).select('id'));
      if(!changed.length)throw new Error('profile_conflict');if(!live(ctx,epoch))return;ctx.dirty=false;await tidy(ctx,item.image_path,epoch);await mount(ctx);ctx.report('Profileintrag gelöscht.');
    }));actions.append(edit,remove);return actions;
  };
  const showProfile=async(ctx,userId,epoch)=>{
    const [profiles,items]=await Promise.all([
      check(Raben.client().from('raben_profiles').select('user_id,display_name,revision').eq('user_id',userId).limit(1)),
      check(Raben.client().from('raben_profile_items').select('id,owner_id,kind,title,body,image_path,visibility,revision,created_at').eq('owner_id',userId).order('created_at').order('id'))
    ]);
    if(!live(ctx,epoch))return;ctx.profileSnapshot=snapshot(profiles[0],items);ctx.list.replaceChildren();const profile=profiles[0];
    const back=button('Alle Clanprofile',()=>{if(!discard(ctx))return;ctx.profileId=null;mount(ctx).catch(error=>ctx.report(errorMessage(error),true));});ctx.list.append(back);
    if(!profile){ctx.list.append(note('Dieses Profil ist nicht verfügbar. Es kann noch nicht erstellt, gelöscht oder der Clan-Zugang gesperrt worden sein.'));if(userId===ctx.actor.user_id)ctx.list.append(button('Mein Profil erstellen',()=>openName(ctx), 'button small-button'));return;}
    const own=profile.user_id===ctx.actor.user_id,header=el('article','hub-card profile-header'),portrait=el('div','profile-portrait'),intro=el('div','profile-intro');
    portrait.append(el('span','profile-monogram',Array.from(profile.display_name)[0].toLocaleUpperCase('de')));intro.append(el('p','eyebrow',own?'Dein Clanprofil':'Clanprofil'),el('h3','',profile.display_name));header.append(portrait,intro);
    if(own){const edit=button('Profilname ändern',()=>openName(ctx,profile));intro.append(edit,note('Dein Name ist für den Clan sichtbar. Alle anderen Einträge haben eigene Freigaben.'));}else intro.append(note('Hier siehst du die für dich freigegebenen Angaben.'));
    const avatar=items.find(i=>i.kind==='avatar');if(avatar){image(ctx,avatar,portrait,true);if(own){intro.append(el('span','profile-visibility',visibilityNames[avatar.visibility]),itemActions(ctx,profile,avatar));}}
    else if(own){const add=button('Profilbild hinzufügen',()=>act(ctx,add,()=>openItem(ctx,profile,'avatar')));intro.append(add);}
    ctx.list.append(header);
    for(const kind of ['character','info']){
      const section=el('section','profile-section'),title=el('div','hub-title-row');title.append(el('h3','',kind==='character'?'Charaktere':'Infos'));
      if(own){const add=button(kind==='character'?'Charakter hinzufügen':'Infokarte hinzufügen',()=>act(ctx,add,()=>openItem(ctx,profile,kind)));title.append(add);}section.append(title);
      const rows=items.filter(i=>i.kind===kind),grid=el('div','profile-item-grid');
      rows.forEach(item=>{const card=el('article','hub-card profile-item');card.dataset.profileItem=item.id;
        if(own)card.append(el('p','profile-visibility',visibilityNames[item.visibility]));card.append(el('h4','',item.title));if(item.body)card.append(el('p','hub-body',item.body));
        if(own)card.append(itemActions(ctx,profile,item));grid.append(card);if(item.image_path)image(ctx,item,card);
      });
      if(!rows.length)grid.append(note(own?(kind==='character'?'Erstelle einen oder mehrere Charaktere. Jeder hat seine eigene Sichtbarkeit.':'Ergänze zum Beispiel RP-Vorlieben, Spielzeiten oder persönliche Notizen. Neue Einträge sind zunächst nur für dich sichtbar.'):'Keine für dich freigegebenen Angaben.'));section.append(grid);ctx.list.append(section);
    }
    if(own)ctx.list.append(note('Diese Profileinträge sind unabhängig vom bisherigen Charakterbuch. Bereits veröffentlichte Charakterbucheinträge behalten ihre dortige Sichtbarkeit.'));
    ctx.report('');
  };
  const directory=async(ctx,epoch)=>{
    const intro=el('article','hub-card profile-directory-intro');intro.append(el('h3','','Die Gesichter hinter den Raben.'),note('Angenommene Clanmitglieder gestalten ihr eigenes Profil. Profilbilder, Charaktere und Infokarten sind zunächst privat. Du kannst jeden Eintrag für den Clan oder gezielt für einzelne Mitglieder freigeben.'));
    const [own]=await check(Raben.client().from('raben_profiles').select('user_id,display_name,revision').eq('user_id',ctx.actor.user_id).limit(1));
    if(!live(ctx,epoch))return;
    intro.append(button(own?'Mein Profil öffnen':'Mein Profil erstellen',()=>{if(!discard(ctx))return;if(own){ctx.profileId=ctx.actor.user_id;mount(ctx).catch(error=>ctx.report(errorMessage(error),true));}else openName(ctx);},'button small-button'));
    const search=field('Clanprofile suchen','search',ctx.profileSearch||''),find=button('Suchen');find.type='submit';const form=el('form','hub-search');form.append(search.wrap,find);const grid=el('div','profile-directory-grid'),more=button('Weitere Profile laden');more.hidden=true;
    ctx.list.replaceChildren(intro,form,grid,more);let offset=0,request=0;
    const load=async(reset=false)=>{
      await ctx.authorize();if(!live(ctx,epoch))return;const attempt=++request;if(reset){offset=0;grid.replaceChildren();}find.disabled=true;more.disabled=true;
      try{
        let q=Raben.client().from('raben_profiles').select('user_id,display_name',{count:'exact'}).order('display_name').order('user_id');
        const term=search.input.value.trim();ctx.profileSearch=term;if(term)q=q.ilike('display_name','%'+term.replace(/[%_\\]/g,'\\$&')+'%');
        const result=await q.range(offset,offset+23);if(result.error)throw result.error;if(!live(ctx,epoch)||attempt!==request)return;
        if(!result.data.length&&offset===0)grid.append(note(term?'Keine passenden Clanprofile.':'Noch keine Clanprofile erstellt. Sei der erste Rabe.'));
        result.data.forEach(profile=>{
          const b=button('',()=>{if(!discard(ctx))return;ctx.profileId=profile.user_id;mount(ctx).catch(error=>ctx.report(errorMessage(error),true));},'profile-directory-card');
          b.append(el('span','profile-monogram',Array.from(profile.display_name)[0].toLocaleUpperCase('de')),el('strong','',profile.display_name),el('span','field-note',profile.user_id===ctx.actor.user_id?'Dein Profil →':'Profil ansehen →'));grid.append(b);
        });offset+=result.data.length;more.hidden=offset>=Number(result.count||0);ctx.report('');
      }finally{if(live(ctx,epoch)&&attempt===request){find.disabled=false;more.disabled=false;}}
    };
    form.addEventListener('submit',event=>{event.preventDefault();act(ctx,find,()=>load(true));});more.addEventListener('click',()=>act(ctx,more,()=>load()));await load(true);
  };
  const mount=async ctx=>{
    if(ctx.public||ctx.disposed||ctx.kind!=='profiles')return;
    const epoch=++ctx.epoch;RabenMedia.release(ctx);ctx.more.hidden=true;ctx.editor.replaceChildren();ctx.list.replaceChildren();ctx.dirty=false;ctx.report('Profile werden geladen …');
    await ctx.authorize();if(!live(ctx,epoch))return;
    if(ctx.profileId)await showProfile(ctx,ctx.profileId,epoch);else await directory(ctx,epoch);
  };
  const snapshot=(profile,items)=>JSON.stringify([profile?.display_name,profile?.revision,items.map(i=>[i.id,i.revision])]);
  const audit=async ctx=>{
    const epoch=ctx.epoch;if(!live(ctx,epoch)||!ctx.profileId||ctx.editor.childNodes.length||ctx.profileAudit)return;ctx.profileAudit=true;
    try{
      const [profiles,items]=await Promise.all([
        check(Raben.client().from('raben_profiles').select('display_name,revision').eq('user_id',ctx.profileId).limit(1)),
        check(Raben.client().from('raben_profile_items').select('id,revision').eq('owner_id',ctx.profileId).order('created_at').order('id'))
      ]);
      if(live(ctx,epoch)&&!ctx.editor.childNodes.length&&snapshot(profiles[0],items)!==ctx.profileSnapshot)await mount(ctx);
    }catch(error){if(live(ctx,epoch)&&!ctx.editor.childNodes.length){RabenMedia.release(ctx);ctx.epoch++;ctx.list.replaceChildren(note('Das Profil konnte nicht aktualisiert werden. Bitte versuche „Aktualisieren“ erneut.'));ctx.report(errorMessage(error),true);}}
    finally{ctx.profileAudit=false;}
  };
  const release=ctx=>{delete ctx.profileId;delete ctx.profileSearch;delete ctx.profileSnapshot;};
  window.RabenProfiles={mount,release,audit,errorMessage};
})();
