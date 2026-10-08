(() => {
  "use strict";
  const {el,status,check} = Raben;
  let loading = false, epoch = 0, identity = null, hubIdentity = null;
  let accountContext=null;
  const gate = document.getElementById("gate");
  const lock = () => {
    if(accountContext){accountContext.editor?.replaceChildren();accountContext.disposed=true;RabenIdentity.release(accountContext);accountContext=null;}
    epoch++; identity = null; hubIdentity = null; window.RabenHub?.lock();
    gate.hidden = false; document.getElementById("member-content").hidden = true;
    document.getElementById("clan-posts").replaceChildren(); document.getElementById("roster").replaceChildren();
    document.getElementById("account").replaceChildren();["account","admin-link"].forEach(id => {document.getElementById(id).hidden = true;});
  };
  const load = async () => {
    if (loading) return;
    loading = true; const ownEpoch = epoch;
    try {
      if (!Raben.configured()) {status("portal-status","Die Discord-Anmeldung wird noch eingerichtet."); return;}
      const member = await Raben.member();
      if (epoch !== ownEpoch) return;
      if (Raben.finishAdminSignIn()) return;
      identity = member;
      document.getElementById("logout").hidden = !member;
      document.getElementById("discord-login").hidden = !!member;
      document.getElementById("check-access").hidden = !member;
      if (!member || member.status !== "active") {
        lock(); identity = member;
        document.getElementById("gate-title").textContent = !member ? "Mit Discord zu den Raben." : member.status === "blocked" ? "Dein Zugang ist gesperrt." : "Deine Anfrage liegt bei den Admins.";
        document.getElementById("gate-text").textContent = !member ? "Melde dich mit deinem Discord-Konto an. Zugang erhalten ausschließlich freigegebene Clanmitglieder." : member.status === "blocked" ? "Bitte kläre deinen Zugang mit der Clanführung." : "Du bist mit Discord angemeldet. Sobald ein Admin dich als Clanmitglied freigibt, kannst du diesen Bereich betreten.";
        status("portal-status",""); return;
      }
      const sb = Raben.client();
      const [posts, roster] = await Promise.all([
        check(sb.from("raben_clan_posts").select("id,title,body,category,event_date,created_at,created_by,audience,speaker_name").order("created_at",{ascending:false})),
        check(sb.from("raben_memberships").select("user_id,display_name,role").eq("status","active").order("display_name"))
      ]);
      if (epoch !== ownEpoch) return;
      if(!accountContext)accountContext={actor:member,epoch:0,disposed:false,public:false,urls:new Set(),authorize:async()=>{
        const current=await Raben.member();if(!current||current.status!=='active'||current.user_id!==accountContext?.actor.user_id){lock();throw {code:'42501'};}return current;
      }};
      accountContext.editor ||=document.createElement('div');if(!accountContext.editor.isConnected)document.getElementById('clan-posts').before(accountContext.editor);accountContext.report=(text,error=false)=>status('portal-status',text,error);accountContext.actor=member;await RabenIdentity.load(accountContext,roster);if(epoch!==ownEpoch)return;
      const root = document.getElementById("clan-posts");if(window.RabenExpansion&&root.querySelector(".clan-discussion[open]")){const ids=new Set(posts.map(p=>p.id));for(const card of root.querySelectorAll('[data-post-id]'))if(!ids.has(card.dataset.postId))card.remove();}else root.replaceChildren();
      if (!posts.length) {const empty = el("article","clan-post"); empty.append(el("p","eyebrow","Der erste Aushang kommt noch"),el("h2","","Willkommen im Clanbereich."),el("p","post-body","Hier erscheinen die internen Informationen, Termine und Aushänge eurer Admins.")); root.append(empty);}
      posts.forEach(post => {
        if(root.querySelector('[data-post-id="'+post.id+'"]'))return;
        const article = el("article","clan-post");article.dataset.postId=post.id;article.id="post-"+post.id;
        const category = {info:"Clan-Information",aushang:"Interner Aushang",termin:"Clan-Termin"}[post.category] || "Clan-Information";
        const meta = el("p","post-meta",category + (post.event_date ? " · " + new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(post.event_date+"T12:00:00Z")) : ""));
        const by=el('p','field-note');by.append(RabenIdentity.person(accountContext,post.created_by,{prefix:'Veröffentlicht von '}));
        article.append(meta,el("h2","",post.title),by,el("p","post-body",post.body)); root.append(article);window.RabenExpansion?.marker(post,article);window.RabenExpansion?.comments(accountContext,'post',post.id,article,post.created_by);
      });
      const list = document.getElementById("roster"); list.replaceChildren();
      roster.forEach(person => {const li = el("li","");li.append(RabenIdentity.person(accountContext,person.user_id));if(person.role === "admin") li.append(el("small","","Admin"));list.append(li);});
      document.getElementById("account").replaceChildren(RabenIdentity.person(accountContext,member.user_id));
      document.getElementById("account").hidden = false;
      document.getElementById("admin-link").hidden = member.role !== "admin";
      gate.hidden = true; document.getElementById("member-content").hidden = false; status("portal-status","");
      const hubKey=member.user_id+":"+member.role;
      if(window.RabenHub && hubIdentity!==hubKey){hubIdentity=hubKey;await RabenHub.mountMember(document.getElementById("clan-community"),member);}
    } catch(error) {lock(); status("portal-status",Raben.errorMessage(error),true);} finally {loading = false;}
  };
  document.getElementById("discord-login").addEventListener("click",async () => {try {await Raben.signIn();} catch(error) {status("portal-status",Raben.errorMessage(error),true);}});
  document.getElementById("check-access").addEventListener("click",load);
  document.getElementById("logout").addEventListener("click",async () => {
    lock(); document.getElementById("logout").hidden = true;
    try {await Raben.signOut(); location.replace("clan.html");} catch(error) {status("portal-status",Raben.errorMessage(error),true);}
  });
  window.addEventListener("raben-lock",lock);
  window.addEventListener("focus",load);
  window.addEventListener("raben-identity-updated",()=>{setTimeout(load,0);});
  setInterval(() => {if(!document.hidden) load();},30000);
  if (Raben.configured()) Raben.client().auth.onAuthStateChange(event => {
    if(event === "SIGNED_OUT") lock();
    if(["SIGNED_IN","SIGNED_OUT","TOKEN_REFRESHED"].includes(event)) setTimeout(load,0);
  });
  load();
})();
