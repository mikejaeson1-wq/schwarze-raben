(() => {
  "use strict";
  const {el,status,check} = Raben;
  const mobileApp = document.body.dataset.adminApp === "true";
  const asset = path => (mobileApp ? "../" : "") + path;
  let draft = null, revision = null, currentAdmin = null, editingPost = null, dirty = false, busy = false, epoch = 0;
  const effects = RabenEffects.create(document.getElementById("preview-canvas"), {type:"none"});
  const listSchemas = {
    mitglieder: {title:"Öffentliche Charaktervorstellungen", item:"Charakter", fields:[['name','Name'],['rolle','Rolle'],['beschreibung','Beschreibung','textarea']]},
    aushang: {title:"Öffentliche Aushänge", item:"Aushang", fields:[['titel','Titel'],['datum','Datum','date'],['text','Text','textarea']]},
    rpHinweise: {title:"RP-Hinweise", item:"RP-Hinweis", fields:[['titel','Titel'],['text','Text','textarea']]},
    extraInfos: {title:"Weitere Informationen", item:"Information", fields:[['titel','Titel'],['text','Text','textarea']]}
  };
  const message = (value,error=false) => status("admin-status",value,error);
  const markDirty = () => {dirty = true; document.querySelectorAll("[data-save-note]").forEach(n => n.textContent = "Noch nicht gespeichert");};
  const lock = () => {
    epoch++; currentAdmin = null; draft = null; revision = null; window.RabenHub?.lock();
    document.getElementById("admin-content").hidden = true; document.getElementById("admin-gate").hidden = false;
    document.getElementById("account").hidden = true; effects.update({type:"none"});
    document.getElementById("internal-posts").replaceChildren(); document.getElementById("member-manager").replaceChildren();
    document.getElementById("public-lists").replaceChildren(); document.querySelectorAll("#clan-form input, #clan-form textarea").forEach(n => n.value = "");
    document.getElementById("post-form").reset(); dirty = false;
    const badge=document.getElementById("pending-count"); if(badge) badge.hidden=true;
  };
  const ensureAdmin = async () => {
    const member = await Raben.member();
    if (!member || member.status !== "active" || member.role !== "admin") {lock(); throw new Error("Admin access required");}
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
        const item={}; card.querySelectorAll("[data-field]").forEach(input => {item[input.dataset.field] = input.value.trim();}); return item;
      }).filter(item => item.name || item.titel);
    });
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
    if(!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8388608) {message("Bitte wähle ein JPG-, PNG- oder WebP-Bild mit maximal 8 MB.",true); input.value=""; return;}
    try {
      busy=true; input.disabled=true; message("Das Bild wird hochgeladen …");
      await ensureAdmin();
      const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
      const path=crypto.randomUUID()+"."+ext;
      await check(Raben.client().storage.from("raben-public").upload(path,file,{contentType:file.type,upsert:false}));
      if(epoch !== ownEpoch || !draft) return;
      const {data}=Raben.client().storage.from("raben-public").getPublicUrl(path);
      draft[key]=data.publicUrl;
      document.getElementById(key === "heroImage" ? "hero-preview" : "village-preview").src=data.publicUrl;
      updatePreview(); markDirty(); message("Bild hochgeladen. Mit „Änderungen speichern“ übernimmst du es auf die Website.");
    } catch(error) {message(Raben.errorMessage(error),true);} finally {busy=false; input.disabled=false; input.value="";}
  };
  const loadMembers = async () => {
    const ownEpoch=epoch; await ensureAdmin();
    const members=await check(Raben.client().from("raben_memberships").select("user_id,discord_id,display_name,status,role,updated_at").order("created_at",{ascending:false}));
    if(ownEpoch !== epoch) return;
    const root=document.getElementById("member-manager"); root.replaceChildren();
    const badge=document.getElementById("pending-count");
    if(badge) {const count=members.filter(member=>member.status === "pending").length; badge.textContent=count+" wartend"; badge.hidden=count === 0;}
    if(!members.length) root.append(el("p","field-note","Es gibt noch keine Zugangsanfragen."));
    members.forEach(member => {
      const row=el("article","member-row"), info=el("div");
      info.append(el("h3","",member.display_name),el("p","","Discord-ID: "+member.discord_id));
      const actions=el("div","member-actions"), select=document.createElement("select");
      select.setAttribute("aria-label","Rechte für "+member.display_name);
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
  const loadPosts = async () => {
    const ownEpoch=epoch; await ensureAdmin();
    const posts=await check(Raben.client().from("raben_clan_posts").select("id,title,body,category,event_date,updated_at").order("created_at",{ascending:false}));
    if(ownEpoch !== epoch) return;
    const root=document.getElementById("internal-posts"); root.replaceChildren();
    posts.forEach(post => {
      const card=el("article","repeat-card"),head=el("div","repeat-card-header"); head.append(el("h3","",post.title));
      const buttons=el("div","member-actions");
      const edit=el("button","button outline small-button","Bearbeiten");
      edit.addEventListener("click",() => {
        editingPost=post;
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
      buttons.append(edit,remove); head.append(buttons); card.append(head,el("p","field-note",post.body.slice(0,200))); root.append(card);
    });
  };
  const resetPost = () => {editingPost=null; document.getElementById("post-form").reset(); document.getElementById("post-save").textContent="Beitrag veröffentlichen"; document.getElementById("post-cancel").hidden=true;};
  document.getElementById("post-form").addEventListener("submit",async event => {
    event.preventDefault(); const form=event.currentTarget,button=document.getElementById("post-save");
    const content={title:form.elements.title.value.trim(),body:form.elements.body.value.trim(),category:form.elements.category.value,event_date:form.elements.event_date.value || null};
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
    if(!draft) return; const key=button.dataset.resetImage; draft[key]="";
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
  window.addEventListener("raben-map-updated",event=>{if(draft && revision===event.detail.previousRevision){draft.rabenMapImage=event.detail.image;revision=event.detail.revision;}});
  window.addEventListener("beforeunload",event => {if(dirty) {event.preventDefault(); event.returnValue="";}});
  window.addEventListener("raben-lock",lock);
  document.getElementById("logout").addEventListener("click",async () => {lock(); try {await Raben.signOut(); location.replace(mobileApp ? "./" : "clan.html");} catch(error) {message(Raben.errorMessage(error),true);}});
  const auditAccess = async () => {if(currentAdmin) {try {await ensureAdmin();} catch(error) {message("Deine Admin-Rechte sind nicht mehr aktiv. Bitte prüfe deinen Zugang.",true);}}};
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
      sb.auth.onAuthStateChange(event => {if(event==='SIGNED_OUT') lock();});
    } catch(error) {lock(); message(Raben.errorMessage(error),true);}
  };
  init();
})();
