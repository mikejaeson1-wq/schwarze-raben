(() => {
  "use strict";
  const button = document.getElementById("install-app");
  const message = document.getElementById("install-status");
  let prompt = null;
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const showMessage = text => { if (message) { message.textContent = text; message.hidden = false; } };
  const installed = () => {
    if (!standalone()) return;
    document.querySelectorAll("[data-install-link]").forEach(link => { link.hidden = true; });
    if (button) button.hidden = true;
    showMessage("Du nutzt Raben Admin bereits als App. Öffne die Verwaltung und melde dich mit Discord an.");
  };
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); prompt = event;
    if (button && !standalone()) { button.hidden = false; button.disabled = false; }
  });
  if (button) button.addEventListener("click", async () => {
    if (!prompt) return;
    button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      prompt = null; button.hidden = true;
      showMessage(choice.outcome === "accepted" ? "Installation bestätigt. Öffne danach das Symbol „Raben Admin“ und melde dich mit Discord an." : "Du kannst die Installation später über das Browsermenü starten.");
    } catch (_) { button.hidden = true; prompt = null; showMessage("Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“."); }
    finally { button.disabled = false; }
  });
  window.addEventListener("appinstalled", () => {
    prompt = null; if (button) button.hidden = true;
    showMessage("Raben Admin wurde installiert. Öffne die App jetzt über ihr Symbol auf dem Startbildschirm.");
  });
  installed();
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href, {scope: "./"})
      .catch(() => { showMessage("Öffnen funktioniert. Falls die Installation nicht angeboten wird, lade diese Seite erneut und folge der Anleitung für dein Handy."); });
  }
})();
