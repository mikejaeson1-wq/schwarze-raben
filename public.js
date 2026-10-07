(() => {
  "use strict";
  let CLAN = window.CLAN_DEFAULT;
  const mediaContext={public:true,epoch:0,disposed:false,urls:new Set(),players:new Set()};
  const effect = window.RabenEffects.create(document.getElementById("schnee"), CLAN.effects);
  const original = {};
  ["mitglieder-inhalt","aushang-inhalt","rp-inhalt"].forEach(id => { original[id] = [...document.getElementById(id).childNodes].map(n => n.cloneNode(true)); });
  function render() {
    mediaContext.epoch++;window.RabenMedia?.releasePlayers(mediaContext);
    Object.entries(original).forEach(([id,nodes]) => document.getElementById(id).replaceChildren(...nodes.map(n => n.cloneNode(true))));
    const text = (value, fallback = "") => typeof value === "string" ? value.trim() || fallback : fallback;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const list = value => Array.isArray(value) ? value : [];
    const name = text(CLAN.name, "Schwarze Raben");
    document.querySelectorAll("[data-clan-name]").forEach(el => { el.textContent = name; });
    document.title = name + " · Conan Exiles Roleplay";
    document.querySelector(".brand").setAttribute("aria-label", name + " – Startseite");
    const title = document.getElementById("hero-title");
    title.replaceChildren(document.createTextNode(name === "Schwarze Raben" ? "Schwarze" : name));
    if (name === "Schwarze Raben") { const second = document.createElement("span"); second.textContent = "Raben"; title.append(second); }
    const description = text(CLAN.beschreibung, "Ein Clan mit nordischem Roleplay in Conan Exiles.");
    setText("hero-description", description);
    document.querySelector('meta[name="description"]').content = name + " – " + description;
    setText("dorf-beschreibung", text(CLAN.dorfBeschreibung, "Unser Dorf liegt im Schnee und ist die Heimat unseres Clans."));
    const villageName = text(CLAN.dorfName);
    setText("dorf-caption", villageName || "Ein Dorf im Schnee"); setText("info-dorf", villageName || "Dorf im Schnee");
    [["info-server", CLAN.serverName], ["info-leitung", CLAN.clanFuehrung]].forEach(([id, value]) => {
      setText(id, text(value, "Noch nicht eingetragen")); document.getElementById(id).classList.toggle("pending", !text(value));
    });
    document.getElementById("saga").hidden = !text(CLAN.geschichte); setText("geschichte", text(CLAN.geschichte));
    ["board-discord", "closing-discord"].forEach(id => { document.getElementById(id).hidden = true; });
    try {
      const discord = new URL(text(CLAN.discordLink));
      if (discord.protocol === "https:" && ["discord.gg", "discord.com", "www.discord.com"].includes(discord.hostname) && (discord.hostname === "discord.gg" || discord.pathname.startsWith("/invite/"))) {
        ["board-discord", "closing-discord"].forEach(id => { const el = document.getElementById(id); el.href = discord.href; el.hidden = false; });
      }
    } catch (_) { /* Ohne Einladungslink wird kein Discord-Button angezeigt. */ }

    const element = (tag, className, content) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (content !== undefined) el.textContent = content;
      return el;
    };
    const members = list(CLAN.mitglieder).filter(item => item && text(item.name));
    if (members.length) {
      const grid = element("div", "member-grid");
      members.forEach(member => {
        const card = element("article", "member-card");
        const initial = element("div", "member-initial", Array.from(text(member.name))[0].toUpperCase());
        initial.setAttribute("aria-hidden", "true");
        card.append(initial, element("h3", "", text(member.name)));
        if (text(member.rolle)) card.append(element("p", "member-role", text(member.rolle)));
        if (text(member.beschreibung)) card.append(element("p", "member-description", text(member.beschreibung)));
        grid.append(card);
      });
      document.getElementById("mitglieder-inhalt").replaceChildren(grid);
    }
    const notices = list(CLAN.aushang).filter(item => item && text(item.titel));
    if (notices.length) {
      const fragment = document.createDocumentFragment();
      notices.forEach(notice => {
        const card = element("article", "notice");
        const date = element("div");
        if (/^\d{4}-\d{2}-\d{2}$/.test(text(notice.datum))) {
          const value = new Date(notice.datum + "T12:00:00Z");
          if (!Number.isNaN(value.getTime()) && value.toISOString().slice(0,10) === notice.datum) {
            const time = element("time", "", new Intl.DateTimeFormat("de-DE", {day:"2-digit", month:"2-digit", year:"numeric", timeZone:"UTC"}).format(value));
            time.dateTime = notice.datum; date.append(time);
          } else date.textContent = text(notice.datum);
        } else date.textContent = text(notice.datum, "Clan-Aushang");
        const content = element("div");
        content.append(element("h3", "", text(notice.titel)), element("p", "", text(notice.text)));
        card.append(date, content); fragment.append(card);
      });
      document.getElementById("aushang-inhalt").replaceChildren(fragment);
    }
    const hints = list(CLAN.rpHinweise).filter(item => item && text(item.titel));
    if (hints.length) {
      const fragment = document.createDocumentFragment();
      hints.forEach((hint, index) => {
        const details = element("details", "rp-details");
        details.open = index === 0;
        details.append(element("summary", "", text(hint.titel)), element("p", "", text(hint.text)));
        fragment.append(details);
      });
      document.getElementById("rp-inhalt").replaceChildren(fragment);
    }


    Raben.applyImages(CLAN);
    effect.update(CLAN.effects);
    const extra = document.getElementById("zusatz-inhalt"); extra.replaceChildren();
    const infos = list(CLAN.extraInfos).filter(v => v && text(v.titel));
    document.getElementById("zusatz-info").hidden = !infos.length;
    infos.forEach(info => { const article = element("article", "extra-info"); article.append(element("h3", "", text(info.titel)), element("p", "", text(info.text))); extra.append(article);if(info.mediaIds?.length&&window.RabenMedia){const host=element("div","media-attachments");article.append(host);RabenMedia.references(mediaContext,info.mediaIds,host).catch(()=>host.append(element("p","field-note","Die Medien sind gerade nicht verfügbar.")));} });
    const siteMedia=document.getElementById("site-media"),siteMediaSection=document.getElementById("site-media-section");if(siteMedia&&siteMediaSection){siteMedia.replaceChildren();const ids=Array.isArray(CLAN.rabenInfoMediaIds)?CLAN.rabenInfoMediaIds:[];siteMediaSection.hidden=!ids.length;if(ids.length&&window.RabenMedia)RabenMedia.references(mediaContext,ids,siteMedia).catch(()=>siteMedia.append(element("p","field-note","Die Medien sind gerade nicht verfügbar.")));}
  }
    const tabs = [...document.querySelectorAll("[data-tab]")];
    const openTab = (key, focus = false) => {
      if (!tabs.some(tab => tab.dataset.tab === key)) return;
      tabs.forEach(tab => {
        const selected = tab.dataset.tab === key;
        tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
        if (selected && focus) tab.focus();
      });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => openTab(tab.dataset.tab));
      tab.addEventListener("keydown", event => {
        let next;
        if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % tabs.length;
        if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); openTab(tabs[next].dataset.tab, true); }
      });
    });
    document.querySelectorAll("[data-open-tab]").forEach(link => link.addEventListener("click", () => openTab(link.dataset.openTab)));

    const menuButton = document.getElementById("menu-toggle");
    const navigation = document.getElementById("hauptnavigation");
    const mobile = window.matchMedia("(max-width: 800px)");
    const toggleMenu = open => {
      navigation.hidden = mobile.matches && !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    };
    const syncMenu = () => { menuButton.hidden = !mobile.matches; toggleMenu(!mobile.matches); };
    syncMenu(); mobile.addEventListener("change", syncMenu);
    menuButton.addEventListener("click", () => toggleMenu(menuButton.getAttribute("aria-expanded") !== "true"));
    navigation.querySelectorAll("a").forEach(link => link.addEventListener("click", () => { if (mobile.matches) toggleMenu(false); }));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && mobile.matches && menuButton.getAttribute("aria-expanded") === "true") { toggleMenu(false); menuButton.focus(); }
    });


  render();
  if (Raben.configured()) Raben.client().from("raben_site_content").select("content").eq("id",1).single().then(({data,error}) => {
    if (!error && data?.content) { CLAN = {...window.CLAN_DEFAULT, ...data.content}; render(); }
  }).catch(() => {});
})();
