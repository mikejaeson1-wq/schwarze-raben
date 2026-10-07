(() => {
  "use strict";
  const login = document.getElementById("app-discord-login");
  login.addEventListener("click", async () => {
    login.disabled = true;
    try { await Raben.signIn("admin-app"); }
    catch (error) { Raben.status("admin-status", Raben.errorMessage(error), true); login.disabled = false; }
  });
  const updateConnection = () => {
    const offline = !navigator.onLine;
    const state = document.getElementById("connection-state");
    state.textContent = offline ? "Offline · Zum Prüfen der Rechte und Speichern ist Internet nötig." : "Online-Verwaltung · Discord-Anmeldung";
    state.classList.toggle("is-offline", offline);
  };
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  updateConnection();
  const requested = new URL(window.location.href).searchParams.get("bereich");
  const allowed = ["website", "inhalte", "design", "clan", "members"];
  const initial = allowed.includes(requested) ? requested : "members";
  document.getElementById("edit-tab-" + initial).click();
  document.querySelectorAll("[data-editor-tab]").forEach(tab => tab.addEventListener("click", () => {
    document.getElementById("verwaltung").scrollIntoView({block: "start", behavior: "instant"});
  }));
})();
