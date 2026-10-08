# Schwarze Raben

Website und geschütztes Clanportal für den Conan Exiles Roleplay-Clan **Schwarze Raben**, mit nordischem Dorf im Schnee.

- [Website](https://mikejaeson1-wq.github.io/schwarze-raben/)
- [Dorfleben: Galerie, Karte, Chronik, Handel und Termine](https://mikejaeson1-wq.github.io/schwarze-raben/entdecken.html)
- [Mit Discord bewerben](https://mikejaeson1-wq.github.io/schwarze-raben/bewerben.html)
- [Clanbereich](https://mikejaeson1-wq.github.io/schwarze-raben/clan.html)
- [Verwaltung](https://mikejaeson1-wq.github.io/schwarze-raben/admin.html)
- [Mobile Admin-App](https://mikejaeson1-wq.github.io/schwarze-raben/app/)
- [App installieren / QR-Code](https://mikejaeson1-wq.github.io/schwarze-raben/app/install.html)

Das Gesamtupdate ergänzt öffentliche Dorfaufnahmen und einen Dorfplan mit Orten, eine Chronik, ausgewählte Charaktervorstellungen, Handel und Diplomatie sowie öffentliche RP-Termine. Bewerbungen mit Charakterkonzept und RP-Wünschen laufen über Discord und bleiben privat.

Im Clanbereich gibt es einen RP-Kalender mit Zusagen, ein selbst bearbeitbares Charakterbuch mit getrennten Geheimnotizen, übernehmbare Aufträge, Bauprojekte mit Materialbedarf und Fortschritt, ein durchsuchbares Wissensarchiv, Abstimmungen mit einer Stimme pro Mitglied und ein RP-Tagebuch. Materialbestände und Baufortschritt werden von Admins manuell gepflegt.

Admins können Texte und Bilder ändern, öffentliche Infos und interne Beiträge hinzufügen, Schneefall und Glutpartikel einstellen und Mitglieder freigeben. Anmeldung ausschließlich über Discord. Neue Nutzer warten auf die Freigabe eines Admins. Eine angenommene Bewerbung aktiviert den Clan-Zugang. Öffentliche Veröffentlichungen brauchen eine gesonderte Admin-Entscheidung; Änderungen eines Mitglieds an einem öffentlichen Steckbrief gehen erneut zur Prüfung. Geheimnotizen lesen nur die Charakterbesitzer und Admins. Interne Inhalte sind durch Supabase Row Level Security geschützt und stehen nicht in diesem öffentlichen Repository.

Statische HTML-, CSS- und JavaScript-Dateien ohne Build, veröffentlicht über GitHub Pages. Supabase speichert die gemeinsamen Inhalte, Bilder und Clanrechte. `config.js` enthält ausschließlich öffentliche Projektangaben; geheime Schlüssel gehören ausschließlich zum Backend.

**Raben Admin** ist eine installierbare Web-App für Android und iPhone. Der QR-Code öffnet die Installationsanleitung. Nach dem Hinzufügen zum Startbildschirm die App über ihr Symbol öffnen und mit Discord anmelden. Ausschließlich aktive Admins erhalten die Verwaltungsoberfläche; normale Clanmitglieder bleiben gesperrt. Die App startet im RP-Hub mit Bewerbungen, Freigaben, anstehenden Terminen und Aufträgen und bietet dieselbe vollständige Inhaltsverwaltung wie die Desktop-Verwaltung. Die App nutzt dieselben Inhalte und Rechte wie die Website. Internet wird zum Verwalten benötigt. Der Service Worker speichert ausschließlich öffentliche Oberflächendateien, keine Mitgliederdaten, internen Beiträge oder OAuth-Rückkehradressen.

Bedienung und technische Einrichtung: [ANLEITUNG.md](ANLEITUNG.md).

Umgesetzter Ausbau: [ROADMAP.md](ROADMAP.md). YouTube-Links, echte MP3-Uploads, Medienanhänge, RP-Verknüpfungen, geschützte Inhaltsversionen und Sicherungen stehen in Website, Clanbereich und Admin-App bereit. Serverangaben werden im bearbeitbaren Infobereich gepflegt.

Medien verwalten: **RP-Hub → Medien**. MP3-Dateien bis 20 MB und Bilder bis 50 MB lassen sich vom Computer oder Handy hochladen. YouTube-Player laden erst auf Wunsch. Beiträge können mehrere geordnete Medienanhänge und Verknüpfungen zu anderen RP-Einträgen erhalten. Das Feld „Gemeinsame Geschichte“ verbindet Einträge; Admins können Wissenseinträge anheften. Unter **Versionen**, **Speicher** und **Sicherung** stehen Vorschau und Wiederherstellung, Dateiverwendung und Aufräumen sowie JSON- und ZIP-Sicherungen bereit. Interne Dateien und Sicherungen werden nicht vom Service Worker gespeichert.

Prüfungen für Rechte und Bedienung: `npm ci --prefix tests` und `npm test --prefix tests`. Die Website benötigt weiterhin keinen Build. Die zusätzlichen lokalen Browser-Bibliotheken sind tus-js-client 4.3.1 und fflate 0.8.3; ihre Lizenzen liegen neben den Dateien in `vendor/`.
