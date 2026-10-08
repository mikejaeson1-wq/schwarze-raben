(() => {
  "use strict";
  const config = window.RABEN_CONFIG || {};
  const adminReturnKey = "schwarze-raben-admin-return";
  const applicationReturnKey = "schwarze-raben-application-return";
  const adminReturnLifetime = 15 * 60 * 1000;
  let client = null;
  const configured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl || "") && !!config.supabasePublishableKey;
  const getClient = () => {
    if (!configured()) throw new Error("Die Anmeldung wird noch eingerichtet. Bitte versuche es später erneut.");
    if (!window.supabase?.createClient) throw new Error("Die Anmeldung konnte nicht geladen werden. Bitte lade die Seite erneut.");
    if (!client) client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "schwarze-raben-session"}
    });
    return client;
  };
  const el = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  };
  const status = (id, message, error = false) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message; node.classList.toggle("is-error", error); node.hidden = !message;
  };
  const check = async result => { const value = await result; if (value.error) throw value.error; return value.data; };
  const member = async () => {
    const sb = getClient();
    const {data, error} = await sb.auth.getUser();
    if (error || !data.user) return null;
    const rows = await check(sb.rpc("raben_request_membership"));
    const membership=Array.isArray(rows)?rows[0]:rows;
    if(!membership||membership.status!=="active")return membership;
    const [profile]=await check(sb.from("raben_profiles").select("display_name,avatar_path").eq("user_id",membership.user_id).limit(1));
    return profile?{...membership,discord_name:membership.display_name,display_name:profile.display_name,avatar_path:profile.avatar_path}:membership;
  };
  const signIn = async (destination = "clan") => {
    // Reuse the configured Discord/PKCE callback for all entry points.
    const destinations = {clan: "clan.html", "admin-app": "clan.html", application: "clan.html"};
    if (!Object.hasOwn(destinations, destination)) throw new Error("Unbekanntes Anmeldeziel.");
    const redirect = new URL(destinations[destination], config.siteUrl);
    if (redirect.origin !== window.location.origin || window.location.protocol !== "https:") throw new Error("Die Discord-Anmeldung ist auf der veröffentlichten Website verfügbar.");
    window.sessionStorage.removeItem(adminReturnKey);
    window.sessionStorage.removeItem(applicationReturnKey);
    if (destination !== "clan") window.sessionStorage.setItem(destination === "admin-app" ? adminReturnKey : applicationReturnKey, String(Date.now() + adminReturnLifetime));
    try {
      const {error} = await getClient().auth.signInWithOAuth({provider: "discord", options: {redirectTo: redirect.href}});
      if (error) throw error;
    } catch (error) { window.sessionStorage.removeItem(adminReturnKey); window.sessionStorage.removeItem(applicationReturnKey); throw error; }
  };
  const finishAdminSignIn = () => {
    // A short-lived, tab-local intent flag. It conveys no credentials or rights.
    let expires, path;
    try {
      const admin = window.sessionStorage.getItem(adminReturnKey);
      expires = Number(admin || window.sessionStorage.getItem(applicationReturnKey));
      path = admin ? "app/" : "bewerben.html";
      window.sessionStorage.removeItem(adminReturnKey); window.sessionStorage.removeItem(applicationReturnKey);
    }
    catch (_) { return false; }
    const now = Date.now();
    if (!Number.isFinite(expires) || expires <= now || expires > now + adminReturnLifetime) return false;
    const target = new URL(path, config.siteUrl);
    if (target.origin !== window.location.origin) return false;
    window.location.replace(target.href);
    return true;
  };
  const signOut = async () => {
    window.sessionStorage.removeItem(adminReturnKey); window.sessionStorage.removeItem(applicationReturnKey);
    window.dispatchEvent(new Event("raben-lock"));
    const {error} = await getClient().auth.signOut({scope: "local"});
    if (error) throw error;
  };
  const imageUrl = value => {
    if (!value) return "";
    try {
      const url = new URL(value);
      const backend = new URL(config.supabaseUrl);
      return url.protocol === "https:" && url.origin === backend.origin && url.pathname.startsWith("/storage/v1/object/public/raben-public/") ? url.href : "";
    } catch (_) { return ""; }
  };
  const applyImages = (data, scope = document.documentElement) => {
    [["--hero-image", data.heroImage], ["--village-image", data.villageImage]].forEach(([key, value]) => {
      const url = imageUrl(value);
      if (url) scope.style.setProperty(key, "url(" + JSON.stringify(url) + ")"); else scope.style.removeProperty(key);
    });
  };
  const errorMessage = error => {
    if (error?.message?.includes("last_admin")) return "Der letzte Admin kann nicht gesperrt oder herabgestuft werden.";
    if (error?.code === "42501" || error?.status === 403) return "Dafür fehlen dir die Rechte. Prüfe deinen Zugang oder melde dich erneut an.";
    if (error?.message?.includes("Discord identity required")) return "Bitte melde dich mit deinem Discord-Konto an.";
    if (error?.message?.includes("noch eingerichtet") || error?.message?.includes("veröffentlichten Website")) return error.message;
    return "Das hat gerade nicht funktioniert. Deine Eingaben bleiben erhalten. Bitte versuche es erneut.";
  };
  window.Raben = {config, configured, client: getClient, el, status, check, member, signIn, finishAdminSignIn, signOut, imageUrl, applyImages, errorMessage};
})();
