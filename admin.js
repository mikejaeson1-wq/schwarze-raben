(() => {
  "use strict";
  const {el,status,check} = Raben;
  const mobileApp = document.body.dataset.adminApp === "true";
  const asset = path => (mobileApp ? "../" : "") + path;
  let postPreviewInstalled=false;let draft = null, revision = null, currentAdmin = null, editingPost = null, dirty = false, busy = false, epoch = 0;
  const effects = RabenEffects.create(document.getElementById("preview-canvas"), {type:"none"});
  let siteMediaPicker=null;const infoPickers=new WeakMap();
  let imageUploadContext=null;const imageUploads=new WeakMap();
  let accountContext=null;
  const loadAccounts=async(people=null)=>{
    if(!window.RabenIdentity)return null;
    if(!accountContext)accountContext={admin:true,public:false,actor:currentAdmin,epoch:0,disposed:false,urls:new Set(),authorize:ensureAdmin};
    accountContext.actor=currentAdmin;await RabenIdentity.load(accountContext,people);return accountContext;
  };
  const paintAccount=()=>{
    const node=document.getElementById('account');if(accountContext)node.replaceChildren(RabenIdentity.person(accountContext,currentAdmin.user_id,{suffix:' · Admin'}));
  };
  const mediaContext=()=>({admin:true,public:false,actor:currentAdmin,epoch,disposed:false,authorize:ensureAdmin});
  const listSchemas = {
    mitglieder: {title:"Öffentliche Charaktervorstellungen", item:"Charakter", fields:[['name','Name'],['rolle','Rolle'],['beschreibung','Beschreibung','textarea']]},
    aushang: {title:"Öffentliche Aushänge", item:"Aushang", fields:[['titel','Titel'],['datum','Datum','date'],['text','Text','textarea']]},
    rpHinweise: {title:"RP-Hinweise", item:"RP-Hinweis", fields:[['titel','Titel'],['text','Text','textarea']]},
    extraInfos: {title:"Weitere Informationen", item:"Information", fields:[['titel','Titel'],['text','Text','textarea']]}
  };
  const message = (value,error=false) => status("admin-status",value,error);
  const markDirty = () => {dirty = true; document.querySelectorAll("[data-save-note]").forEach(n => n.textContent = "Noch nicht gespeichert");};
  const lock = () => {
    if(accountContext){accountContext.disposed=true;window.RabenIdentity?.release(accountContext);accountContext=null;}
    if(imageUploadContext){imageUploadContext.disposed=true;window.RabenMedia?.release(imageUploadContext);imageUploadContext=null;}
    epoch++; currentAdmin = null; draft = null; revision = null; window.RabenHub?.lock();
    document.getElementById("admin-content").hidden = true; document.getElementById("admin-gate").hidden = false;
    document.getElementById("account").hidden = true;document.getElementById('account').replaceChildren(); effects.update({type:"none"});
    document.getElementById("internal-posts").replaceChildren(); document.getElementById("member-manager").replaceChildren();
    document.getElementById("site-media-picker")?.replaceChildren();siteMediaPicker=null;
    document.getElementById("public-lists").replaceChildren(); document.querySelectorAll("#clan-form input, #clan-form textarea").forEach(n => n.value = "");
    document.getElementById("post-form").reset(); dirty = false;
    document.querySelectorAll('[data-image]').forEach(input=>{input.value='';const controls=imageUploads.get(input);if(controls)controls.wrap.hidden=true;});
    const badge=document.getElementById("pending-count"); if(badge) badge.hidden=true;
  };
  const ensureAdmin = async () => {
    const member = await Raben.member();
    if (!member || member.status !== "active" || member.role !== "admin" || currentAdmin&&member.user_id!==currentAdmin.user_id) {lock(); throw new Error("Admin access required");}
    currentAdmin=member;
    return member;
  };
  const field = (key,label,type,value="") => {
    const wrapper = el("label","form-field" + (type === "textarea" ? " full" : ""),label);
    const input = document.createElement(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.type = type || "text";
    input.dataset.field = key; input.value = value;
    input.maxLength = type === "textarea" ? 20000 : 1000;
    input.addEventListener("input",markDirty); wrapper.append(input); return wrapper;
  };
  const addListItem = (key,item={}) => {
    const schema = listSchemas[key]; const card = el("article","repeat-card"); card.dataset.listItem = key;
    const head = el("div","repeat-card-header"); head.append(el("h3","",schema.item));
    const remove = el("button","button danger small-button","Entfernen"); remove.type="button";
    remove.addEventListener("click",() => {card.remove(); markDirty();}); head.append(remove);
    const grid = el("div","form-grid"); schema.fields.forEach(([name,label,type]) => grid.append(field(name,label,type,item[name] || "")));
    if(key==="extraInfos"&&window.RabenMedia){const picker=RabenMedia.picker(mediaContext(),item.mediaIds||[],"Medien in dieser Information",{media:true,publicOnly:true});infoPickers.set(card,picker);picker.wrap.addEventListener("change",markDirty);grid.append(picker.wrap);}
    card.append(head,grid); document.getElementById("list-"+key).append(card);
  };
  const buildLists = () => {
    const root = document.getElementById("public-lists"); root.replaceChildren();
    Object.entries(listSchemas).forEach(([key,schema]) => {
      const section = el("section"); section.style.marginTop = "35px";
      section.append(el("h3","panel-title",schema.title));
      const add = el("button","button outline small-button",schema.item+" hinzufügen"); add.type="button";
      add.addEventListener("click",() => {addListItem(key); markDirty();}); section.append(add);
      const list = el("div","repeat-list"); list.id="list-"+key; section.append(list); root.append(section);
      (Array.isArray(draft[key]) ? draft[key] : []).forEach(item => addListItem(key,item));
    });
  };
  const readEffects = () => ({type:document.getElementById("effect-type").value,intensity:Number(document.getElementById("effect-intensity").value),speed:Number(document.getElementById("effect-speed").value)});
  const updatePreview = () => {
    effects.update(readEffects());
    document.getElementById("intensity-value").textContent = document.getElementById("effect-intensity").value+" %";
    document.getElementById("speed-value").textContent = Number(document.getElementById("effect-speed").value).toLocaleString("de-DE")+"×";
    if (draft) Raben.applyImages(draft,document.getElementById("effect-preview"));
  };
  const populate = () => {
    document.querySelectorAll("#clan-form [name]").forEach(input => {input.value = typeof draft[input.name] === "string" ? draft[input.name] : "";});
    buildLists();
    const mediaHost=document.getElementById("site-media-picker");if(mediaHost&&window.RabenMedia){mediaHost.replaceChildren();siteMediaPicker=RabenMedia.picker(mediaContext(),draft.rabenInfoMediaIds||[],"Zusätzliche Medien auf der Startseite",{media:true,publicOnly:true});mediaHost.append(siteMediaPicker.wrap);siteMediaPicker.wrap.addEventListener("change",markDirty);}
    document.getElementById("hero-preview").src = Raben.imageUrl(draft.heroImage) || asset("assets/nord-dorf.webp");
    document.getElementById("village-preview").src = Raben.imageUrl(draft.villageImage) || asset("assets/raben-langhaus.webp");
    const settings = RabenEffects.normalize(draft.effects);
    document.getElementById("effect-type").value = settings.type; document.getElementById("effect-intensity").value = settings.intensity; document.getElementById("effect-speed").value = settings.speed;
    updatePreview(); dirty = false;
    document.querySelectorAll("[data-save-note]").forEach(n => n.textContent = "");
  };
  const collect = () => {
    const content = {...draft};
    document.querySelectorAll("#clan-form [name]").forEach(input => {content[input.name] = input.value.trim();});
    if (!content.name) throw new Error("Bitte trage einen Clannamen ein.");
    if (content.discordLink) {
      let url; try {url = new URL(content.discordLink);} catch(_) {throw new Error("Bitte trage einen gültigen Discord-Einladungslink ein.");}
      if(url.protocol !== "https:" || !["discord.gg","discord.com","www.discord.com"].includes(url.hostname) || (url.hostname !== "discord.gg" && !url.pathname.startsWith("/invite/"))) throw new Error("Bitte verwende einen Discord-Einladungslink über discord.gg oder discord.com/invite.");
    }
    Object.keys(listSchemas).forEach(key => {
      content[key] = [...document.querySelectorAll('[data-list-item="'+key+'"]')].map(card => {
        const item={}; card.querySelectorAll("[data-field]").forEach(input => {item[input.dataset.field] = input.value.trim();});if(key==="extraInfos")item.mediaIds=infoPickers.get(card)?.read()||[]; return item;
      }).filter(item => item.name || item.titel);
    });
    if(siteMediaPicker)content.rabenInfoMediaIds=siteMediaPicker.read();
    content.effects = readEffects(); return content;
  };
  const savePublic = async () => {
    if (busy || !draft) return;
    const ownEpoch = epoch;
    try {
      const content = collect(); busy=true; document.querySelectorAll("[data-save-public]").forEach(b => b.disabled=true);
      await ensureAdmin();
      const rows = await check(Raben.client().from("raben_site_content").update({content}).eq("id",1).eq("revision",revision).select("revision,content"));
      if (epoch !== ownEpoch) return;
      if (!rows.length) throw new Error("content_conflict");
      revision=rows[0].revision; draft=rows[0].content; dirty=false;
      document.querySelectorAll("[data-save-note]").forEach(n => n.textContent="Gespeichert"); message("Gespeichert. Die Änderungen sind auf eurer Website sichtbar.");
    } catch(error) {
      const msg = error.message === "content_conflict" ? "Ein anderer Admin hat die Website inzwischen geändert. Deine Eingaben bleiben hier erhalten. Lade die Seite neu, bevor du erneut speicherst." : error.message?.startsWith("Bitte ") ? error.message : Raben.errorMessage(error);
      message(msg,true);
    } finally {busy=false; document.querySelectorAll("[data-save-public]").forEach(b => b.disabled=false);}
  };
  const upload = async input => {
    if (!draft || busy || !input.files?.length) return;
    const file=input.files[0], key=input.dataset.image, ownEpoch=epoch;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 50*1024*1024) {message("Bitte wähle ein JPG-, PNG- oder WebP-Bild mit maximal 50 MB.",true); input.value=""; return;}
    let controls=imageUploads.get(input);
    if(!controls&&window.RabenMedia){controls=RabenMedia.progressControls();controls.retry=el('button','button outline small-button','Upload erneut versuchen');controls.retry.type='button';controls.retry.hidden=true;controls.retry.addEventListener('click',()=>upload(input));controls.wrap.append(controls.retry);input.closest('.image-editor').append(controls.wrap);imageUploads.set(input,controls);}
    let completed=false;
    try {
      busy=true; input.disabled=true; message("Das Bild wird hochgeladen …");
      await ensureAdmin();
      if(!window.RabenMedia)throw new Error('upload_unavailable');
      imageUploadContext=mediaContext();controls.retry.hidden=true;
      const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
      if(controls.file!==file){controls.file=file;controls.path=crypto.randomUUID()+"."+ext;}
      const path=controls.path;
      let variants=null;if(window.RabenPictures)variants=await RabenPictures.background(imageUploadContext,file,controls,path);else await RabenMedia.upload(imageUploadContext,file,currentAdmin.user_id,controls,false,path,'raben-public');
      if(epoch !== ownEpoch || !draft) return;
      const {data}=Raben.client().storage.from("raben-public").getPublicUrl(path);
      draft[key]=data.publicUrl;if(variants){draft[key+'Small']=variants.small;draft[key+'Medium']=variants.medium;}else{delete draft[key+'Small'];delete draft[key+'Medium'];}
      document.getElementById(key === "heroImage" ? "hero-preview" : "village-preview").src=data.publicUrl;
      updatePreview(); markDirty();completed=true;message("Bild hochgeladen. Mit „Änderungen speichern“ übernimmst du es auf die Website.");
    } catch(error) {if(epoch===ownEpoch){message(window.RabenMedia?.errorMessage(error)||Raben.errorMessage(error),true);if(controls){controls.wrap.hidden=false;controls.retry.hidden=false;}}} finally {imageUploadContext=null;busy=false;input.disabled=false;if(completed)input.value="";}
  };
  const loadMembers = async () => {
    const ownEpoch=epoch; await ensureAdmin();
    const members=await check(Raben.client().from("raben_memberships").select("user_id,discord_id,display_name,status,role,updated_at").order("created_at",{ascending:false}));
    await loadAccounts(members);
    if(ownEpoch !== epoch) return;
    const root=document.getElementById("member-manager"); root.replaceChildren();
    const badge=document.getElementById("pending-count");
    if(badge) {const count=members.filter(member=>member.status === "pending").length; badge.textContent=count+" wartend"; badge.hidden=count === 0;}
    if(!members.length) root.append(el("p","field-note","Es gibt noch keine Zugangsanfragen."));
    members.forEach(member => {
      const row=el("article","member-row"), info=el("div");
      const heading=el('h3','');heading.append(accountContext?RabenIdentity.person(accountContext,member.user_id,{fallback:member.display_name,link:member.status==='active'}):el('span','',member.display_name));
      info.append(heading,el("p","","Discord-ID: "+member.discord_id));
      const actions=el("div","member-actions"), select=document.createElement("select");
      select.setAttribute("aria-label","Rechte für "+(accountContext?RabenIdentity.name(accountContext,member.user_id,member.display_name):member.display_name));
      [['pending','Wartend'],['member','Clanmitglied'],['admin','Admin'],['blocked','Gesperrt']].forEach(([value,label]) => {const option=el("option","",label); option.value=value; select.append(option);});
      select.value=member.status === "active" ? member.role : member.status;
      const save=el("button","button small-button","Übernehmen");
      save.addEventListener("click",async () => {
        try {
          save.disabled=true; await ensureAdmin();
          const value=select.value, change={status:['member','admin'].includes(value)?'active':value,role:value==='admin'?'admin':'member'};
          const result=await check(Raben.client().from("raben_memberships").update(change).eq("user_id",member.user_id).eq("updated_at",member.updated_at).select("user_id"));
          if(!result.length) throw new Error("membership_conflict");
          message("Mitgliederrechte gespeichert.");
          await ensureAdmin(); await loadMembers();
        } catch(error) {message(error.message==='membership_conflict'?"Die Rechte wurden zwischenzeitlich geändert. Bitte aktualisiere die Liste.":Raben.errorMessage(error),true);} finally {save.disabled=false;}
      });
      actions.append(select,save); row.append(info,actions); root.append(row);
    });
  };
  let postSpeaker=null,postAudience=null;
  const loadPosts = async () => {
    const ownEpoch=epoch; await ensureAdmin();
    const posts=await check(Raben.client().from("raben_clan_posts").select("id,title,body,category,event_date,updated_at,created_by,audience,speaker_id,speaker_name").order("created_at",{ascending:false}));
    if(!accountContext)await loadAccounts();
    if(window.RabenDiscordChannels&&!postPreviewInstalled){postPreviewInstalled=true;const form=document.getElementById('post-form');RabenDiscordChannels.editorPreview({...accountContext,report:message},form,()=>({kind:'posts',title:form.querySelector('[name="title"]').value}));}
    if(window.RabenExpansion&&!postAudience){const form=document.getElementById('post-form');postAudience=RabenExpansion.field('RP-Ebene','select','ooc',[['ic','IC'],['ooc','OOC'],['mixed','IC / OOC']]);form.append(postAudience.wrap);postSpeaker=await RabenExpansion.characters(accountContext,form);}
    if(ownEpoch !== epoch) return;
    const root=document.getElementById("internal-posts"); root.replaceChildren();
    posts.forEach(post => {
      const card=el("article","repeat-card"),head=el("div","repeat-card-header"); head.append(el("h3","",post.title));
      const buttons=el("div","member-actions");
      const edit=el("button","button outline small-button","Bearbeiten");
      edit.addEventListener("click",() => {
        editingPost=post;if(postAudience)postAudience.input.value=post.audience||'ooc';if(postSpeaker){if(post.speaker_id&&!Array.from(postSpeaker.input.options).some(o=>o.value===post.speaker_id)){const o=el('option','',post.speaker_name||'Bisheriger Charakter');o.value=post.speaker_id;postSpeaker.input.append(o);}postSpeaker.input.value=post.speaker_id||'';}
        const form=document.getElementById("post-form");
        ["title","body","category","event_date"].forEach(key => {form.elements[key].value=post[key] || "";});
        document.getElementById("post-save").textContent="Beitrag speichern"; document.getElementById("post-cancel").hidden=false; form.elements.title.focus();
      });
      const remove=el("button","button danger small-button","Löschen");
      remove.addEventListener("click",async () => {
        if(!confirm('„'+post.title+'“ aus dem geschlossenen Clanbereich löschen?')) return;
        try {await ensureAdmin(); const rows=await check(Raben.client().from("raben_clan_posts").delete().eq("id",post.id).eq("updated_at",post.updated_at).select("id")); if(!rows.length) throw new Error("post_conflict"); await loadPosts(); message("Beitrag gelöscht.");}
        catch(error) {message(error.message==='post_conflict'?"Der Beitrag wurde inzwischen geändert. Bitte lade die Beitragsliste neu.":Raben.errorMessage(error),true);}
      });
      buttons.append(edit,remove); head.append(buttons); card.append(head);if(accountContext){const by=el('p','field-note');by.append(RabenIdentity.person(accountContext,post.created_by,{prefix:'Veröffentlicht von '}));card.append(by);}card.append(el("p","field-note",post.body.slice(0,200))); root.append(card);
    });
  };
  const resetPost = () => {editingPost=null; document.getElementById("post-form").reset(); document.getElementById("post-save").textContent="Beitrag veröffentlichen"; document.getElementById("post-cancel").hidden=true;};
  document.getElementById("post-form").addEventListener("submit",async event => {
    event.preventDefault(); const form=event.currentTarget,button=document.getElementById("post-save");
    const content={title:form.querySelector('[name="title"]').value.trim(),body:form.elements.body.value.trim(),category:form.elements.category.value,event_date:form.elements.event_date.value || null};
    if(postAudience){content.audience=postAudience.input.value;content.speaker_id=postSpeaker?.input.value||null;}
    if(!content.title) return;
    try {button.disabled=true; await ensureAdmin();
      const query=editingPost ? Raben.client().from("raben_clan_posts").update(content).eq("id",editingPost.id).eq("updated_at",editingPost.updated_at) : Raben.client().from("raben_clan_posts").insert(content);
      const rows=await check(query.select("id")); if(!rows.length) throw new Error("post_conflict");
      resetPost(); await loadPosts(); message("Beitrag im geschlossenen Clanbereich gespeichert.");
    } catch(error) {message(error.message==='post_conflict'?"Der Beitrag wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte lade die Beitragsliste neu.":Raben.errorMessage(error),true);} finally {button.disabled=false;}
  });
  document.getElementById("post-cancel").addEventListener("click",resetPost);
  document.getElementById("refresh-members").addEventListener("click",() => loadMembers().catch(error => message(Raben.errorMessage(error),true)));
  document.querySelectorAll("#clan-form [name]").forEach(input => input.addEventListener("input",markDirty));
  document.querySelectorAll("[data-save-public]").forEach(button => button.addEventListener("click",savePublic));
  document.querySelectorAll("[data-image]").forEach(input => input.addEventListener("change",() => upload(input)));
  document.querySelectorAll("[data-reset-image]").forEach(button => button.addEventListener("click",() => {
    if(!draft) return; const key=button.dataset.resetImage; draft[key]="";delete draft[key+"Small"];delete draft[key+"Medium"];
    document.getElementById(key === "heroImage" ? "hero-preview" : "village-preview").src=asset(key === "heroImage"?"assets/nord-dorf.webp":"assets/raben-langhaus.webp");
    updatePreview(); markDirty();
  }));
  ["effect-type","effect-intensity","effect-speed"].forEach(id => document.getElementById(id).addEventListener("input",() => {updatePreview(); markDirty();}));
  const tabs=[...document.querySelectorAll("[data-editor-tab]")];
  const openTab = selected => {
    tabs.forEach(tab => {const active=tab===selected; tab.setAttribute("aria-selected",String(active)); tab.tabIndex=active?0:-1; document.getElementById(tab.getAttribute("aria-controls")).hidden=!active;});
    if(selected.dataset.editorTab === "design") requestAnimationFrame(updatePreview);
  };
  tabs.forEach((tab,index) => {
    tab.addEventListener("click",() => openTab(tab));
    tab.addEventListener("keydown",event => {
      const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:['ArrowDown','ArrowRight'].includes(event.key)?(index+1)%tabs.length:['ArrowUp','ArrowLeft'].includes(event.key)?(index+tabs.length-1)%tabs.length:null;
      if(target !== null) {event.preventDefault(); openTab(tabs[target]); tabs[target].focus();}
    });
  });
  window.addEventListener("raben-content-restored",async event=>{
    if(!currentAdmin)return;
    try{await ensureAdmin();if(event.detail.source==="raben_site_content"){const record=await check(Raben.client().from("raben_site_content").select("content,revision").eq("id",1).single());draft={...window.CLAN_DEFAULT,...record.content};revision=record.revision;populate();}if(event.detail.source==="raben_clan_posts")await loadPosts();}catch(error){message(Raben.errorMessage(error),true);}
  });
  window.addEventListener("raben-map-updated",event=>{if(draft && revision===event.detail.previousRevision){draft.rabenMapImage=event.detail.image;revision=event.detail.revision;}});
  window.addEventListener("beforeunload",event => {if(dirty) {event.preventDefault(); event.returnValue="";}});
  window.addEventListener("raben-lock",lock);
  document.getElementById("logout").addEventListener("click",async () => {lock(); try {await Raben.signOut(); location.replace(mobileApp ? "./" : "clan.html");} catch(error) {message(Raben.errorMessage(error),true);}});
  const auditAccess = async () => {if(currentAdmin) {try {await ensureAdmin();await loadAccounts();paintAccount();} catch(error) {lock();message("Deine Admin-Rechte sind nicht mehr aktiv. Bitte prüfe deinen Zugang.",true);}}};
  window.addEventListener('raben-identity-updated',auditAccess);
  window.addEventListener("focus",auditAccess); setInterval(() => {if(!document.hidden) auditAccess();},30000);
  const init = async () => {
    try {
      if(!Raben.configured()) {message("Die Verwaltung wird noch eingerichtet."); return;}
      const member=await Raben.member();
      document.getElementById("logout").hidden=!member;
      if(!member || member.status !== "active" || member.role !== "admin") {
        if(mobileApp) document.getElementById("admin-gate-text").textContent=!member
          ? "Melde dich mit Discord an. Nur freigegebene Admins können diese App nutzen."
          : member.status === "blocked" ? "Dein Zugang ist gesperrt. Bitte wende dich an die Clanführung."
          : "Dieses Discord-Konto hat keine Admin-Freigabe. Bitte wende dich an die Clanführung oder melde dich mit deinem Admin-Konto an.";
        return;
      }
      const sb=Raben.client(); const record=await check(sb.from("raben_site_content").select("content,revision").eq("id",1).single());
      draft={...window.CLAN_DEFAULT,...record.content}; revision=record.revision; currentAdmin=member; populate();
      document.getElementById("account").textContent=member.display_name+" · Admin"; document.getElementById("account").hidden=false; document.getElementById("logout").hidden=false;
      document.getElementById("admin-gate").hidden=true; document.getElementById("admin-content").hidden=false;
      await Promise.all([loadMembers(),loadPosts(),window.RabenHub?.mountAdmin(document.getElementById("hub-admin"),member)]);
      paintAccount();
      sb.auth.onAuthStateChange(event => {if(event==='SIGNED_OUT') lock();});
    } catch(error) {lock(); message(Raben.errorMessage(error),true);}
  };
  init();
})();
