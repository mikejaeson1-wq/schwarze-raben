# Schwarze Raben

Website und geschütztes Clanportal für das Conan Exiles Roleplay-Projekt **Schwarze Raben**, mit nordischem Dorf im Schnee.

- [Website](https://mikejaeson1-wq.github.io/schwarze-raben/)
- [Clanbereich](https://mikejaeson1-wq.github.io/schwarze-raben/clan.html)
- [Verwaltung](https://mikejaeson1-wq.github.io/schwarze-raben/admin.html)
- [Mobile Admin-App](https://mikejaeson1-wq.github.io/schwarze-raben/app/)
- [App installieren / QR-Code](https://mikejaeson1-wq.github.io/schwarze-raben/app/install.html)

Admins können Texte und Bilder ändern, öffentliche Infos und interne Beiträge hinzufügen, Schneefall und Glutpartikel einstellen und Mitglieder freigeben. Anmeldung ausschließlich über Discord. Neue Nutzer warten auf die Freigabe eines Admins. Interne Inhalte sind durch Supabase Row Level Security geschützt und stehen nicht in diesem öffentlichen Repository.

Statische HTML-, CSS- und JavaScript-Dateien ohne Build, veröffentlicht über GitHub Pages. Supabase speichert die gemeinsamen Inhalte, Bilder und Clanrechte. `config.js` enthält ausschließlich öffentliche Projektangaben; geheime Schlüssel gehören ausschließlich zum Backend.

**Raben Admin** ist eine installierbare Web-App für Android und iPhone. Der QR-Code öffnet die Installationsanleitung. Nach dem Hinzufügen zum Startbildschirm die App über ihr Symbol öffnen und mit Discord anmelden. Ausschließlich aktive Admins erhalten die Verwaltungsoberfläche; normale Clanmitglieder bleiben gesperrt. Die App nutzt dieselben Inhalte und Rechte wie die Website. Internet wird zum Verwalten benötigt. Der Service Worker speichert ausschließlich öffentliche Oberflächendateien, keine Mitgliederdaten, internen Beiträge oder OAuth-Rückkehradressen.

Bedienung und technische Einrichtung: [ANLEITUNG.md](ANLEITUNG.md).
