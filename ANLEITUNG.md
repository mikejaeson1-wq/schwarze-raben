# Schwarze Raben – Website, Discord-Login und Clan-Verwaltung

Die öffentliche Website wird über GitHub Pages bereitgestellt. Supabase speichert Inhalte und Mitgliederrechte und übernimmt die Discord-Anmeldung. Die Website benötigt keinen eigenen kostenpflichtigen Server.

## Enthalten

- **index.html:** öffentliche Clanvorstellung mit Dorf, Infoboard und ergänzbaren Informationen.
- **clan.html:** eigene Oberfläche für den geschlossenen Clanbereich.
- **admin.html:** Verwaltung für freigegebene Admins.
- **Bilder:** Startseiten-Hintergrund und Dorfbild austauschen; JPG, PNG, WebP bis 8 MB.
- **Effekte:** Schneefall, Glutpartikel oder keine Animation; Stärke und Geschwindigkeit einstellen.
- **Inhalte:** Clanangaben, Dorfname, Geschichte, Charaktervorstellungen, öffentliche Aushänge, RP-Hinweise und zusätzliche Infos bearbeiten.
- **Geschlossene Beiträge:** Informationen, Aushänge und Termine nur für Clanmitglieder.
- **Rechte:** Discord-Nutzer freigeben, zu Admins machen oder sperren.

Die HTML-Oberflächen und der Programmcode sind auf GitHub öffentlich. Interne Texte werden erst nach Anmeldung und Freigabe aus der geschützten Datenbank geladen. Sie stehen nicht im Repository und werden nicht als lokale Datenkopie gespeichert.

## Stand der Einrichtung

Die Website ist seit dem 7. Oktober 2026 veröffentlicht: **https://mikejaeson1-wq.github.io/schwarze-raben/**. Discord-Provider und Rückkehradresse sind eingerichtet, das verantwortliche Discord-Konto ist als erster Admin freigegeben. Die Anwendung ist auf Inhaltsbearbeitung und Datenbank-Zugriffsrechte geprüft. Sie nutzt das vorhandene kostenlose Supabase-Projekt mit aktiver Discord-Anmeldung. Eigene Tabellen mit dem Präfix `raben_` und das nicht öffentlich angebotene Schema `raben_private` halten die Clanrechte getrennt von anderen Anwendungen. Die Rückkehradresse `https://mikejaeson1-wq.github.io/schwarze-raben/clan.html` steht unter den erlaubten Supabase-Redirects. Die vorhandene Site URL des RP-Planers bleibt erhalten.

`config.js` enthält die öffentlichen Projektangaben. Solange Supabase-URL und öffentlicher Schlüssel leer sind, funktioniert die öffentliche Ausgangsseite; Anmeldung und Verwaltung zeigen einen Einrichtungshinweis. Das ist kein Demo-Login und es gibt keinen automatisch offenen Adminzugang.

## Kosten

GitHub Pages ist mit GitHub Free für öffentliche Repositories nutzbar. Supabase hat einen Free-Tarif mit 500 MB Datenbank, 1 GB Dateispeicher und begrenztem Datenverkehr. Free-Projekte können nach einer Woche ohne Aktivität pausieren. Für einen kleinen Clan ist dieser Tarif ein geeigneter Ausgangspunkt; bleibt bei der Einrichtung ausdrücklich im Free-Tarif.

Aktuelle offizielle Quellen:

- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://supabase.com/pricing

## 1. Supabase-Anbindung

1. Diese Website nutzt das vorhandene Free-Projekt **mikejaeson1-wq's Project** (`zszsayplgifdvmjowupy`). Für einen späteren Umzug kann ein neues Free-Projekt verwendet werden.
2. Im SQL Editor zuerst **supabase/schema.sql** ausführen.
3. Anschließend **supabase/seed.sql** ausführen. Die Ausgangsinhalte sind öffentlich und enthalten keine erfundene Clan-Lore.
4. Die **Projekt-URL** und den **öffentlichen Publishable Key** aus den Projekteinstellungen in `config.js` eintragen. Ein alter `anon`-Key wird ebenfalls unterstützt.
5. **Niemals** einen Secret-Key, Service-Role-Key, Discord Client Secret oder ein Datenbankpasswort in diese Datei oder ins GitHub-Repository schreiben.

Beispiel für die öffentlichen Angaben:

```js
window.RABEN_CONFIG = Object.freeze({
  supabaseUrl: "https://EUER-PROJEKT.supabase.co",
  supabasePublishableKey: "EUER-OEFFENTLICHER-SCHLUESSEL",
  siteUrl: "https://mikejaeson1-wq.github.io/schwarze-raben/"
});
```

Die SQL-Dateien legen eigene `raben_`-Tabellen an und werden einmalig ausgeführt. Bereits eingerichtete Tabellen nicht erneut anlegen. Bei späteren Änderungen neue Migrationen verwenden, nicht bereits angelegte Tabellen löschen.

## 2. Discord-Anwendung und Anmeldung

Die vorhandene Discord-Anmeldung wird wiederverwendet. Eine weitere Discord-Anwendung ist dafür nicht nötig. Die folgenden Schritte gelten für einen späteren Umzug in ein neues Projekt:

1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine Anwendung namens **Schwarze Raben** anlegen.
2. Im Bereich **OAuth2** diese Redirect-URL eintragen:
   `https://EUER-PROJEKT.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → Sign In / Providers → Discord** öffnen und Discord aktivieren.
4. Discord **Client ID** und **Client Secret** ausschließlich dort im Supabase-Formular eintragen. Das Secret nicht in Chatnachrichten oder GitHub-Dateien veröffentlichen.
5. Bei einem neuen Projekt unter den Supabase-URL-Einstellungen die öffentliche Website als Site URL eintragen. Bei einem gemeinsam verwendeten Projekt die vorhandene Site URL beibehalten und nur die Rückkehradresse ergänzen:
   `https://mikejaeson1-wq.github.io/schwarze-raben/`
6. Als erlaubte Rückkehradresse exakt diese URL ergänzen:
   `https://mikejaeson1-wq.github.io/schwarze-raben/clan.html`
7. Die Clanwebsite bietet ausschließlich Discord als Anmeldung an. Nicht benötigte Anbieter in einem neuen Projekt deaktiviert lassen; bei einem gemeinsam verwendeten Projekt keine Anbieter anderer Anwendungen abschalten.

Die Website verwendet Discord OAuth mit PKCE. Nutzer geben ihr Discord-Passwort bei Discord ein, nicht auf der Clan-Website. Es ist kein Discord-Bot erforderlich. Der Zugang wird durch Clan-Admins freigegeben; die Seite prüft keine Discord-Serverrollen automatisch.

Offizielle Anleitung: https://supabase.com/docs/guides/auth/social-login/auth-discord

## 3. Ersten Admin festlegen

Es wird **nicht** automatisch der erste Besucher Admin. Dafür muss die tatsächliche Discord-Nutzer-ID der verantwortlichen Person in der Datenbank eingetragen werden.

1. In Discord den Entwicklermodus aktivieren und am eigenen Profil **Nutzer-ID kopieren** wählen. Gesucht ist eine lange Zahl, kein Anzeigename.
2. Im Supabase SQL Editor ausführen, mit der eigenen ID:

```sql
insert into raben_private.admin_allowlist(discord_id)
values ('DEINE_TATSAECHLICHE_DISCORD_NUTZER_ID');
```

3. Danach auf **clan.html** mit genau diesem Discord-Konto anmelden. Das Konto erhält Adminrechte und der Verwaltungslink erscheint.
4. Weitere Nutzer starten im Status **Wartend**. Unter **Verwaltung → Mitglieder & Rechte** können Admins sie als Clanmitglied oder Admin freigeben.

Die Admin-ID in dieser Allowlist bleibt als verantwortliches Konto zugangsberechtigt. Eine Entfernung dieser Sonderfreigabe erfolgt durch den Projektverantwortlichen in Supabase. Andere Admins werden über die Mitgliederverwaltung verwaltet. Die Website verhindert, dass der letzte aktive Admin herabgestuft oder gesperrt wird.

## 4. Auf GitHub veröffentlichen

Das veröffentlichte Repository ist **mikejaeson1-wq/schwarze-raben**: https://github.com/mikejaeson1-wq/schwarze-raben. Die folgenden Schritte beschreiben die Einrichtung für einen späteren Umzug. Keine Dateien in bestehende BluePulse- oder RP-Planer-Repositories kopieren.

1. Ein eigenes öffentliches Repository **schwarze-raben** mit einem initialen README erstellen.
2. Die Dateien und Ordner aus diesem Paket in das Hauptverzeichnis hochladen, einschließlich **assets** und **vendor**. Diese Version besteht aus mehreren zusammengehörenden Dateien.
3. In **Settings → Pages** die Veröffentlichung aus einem Branch wählen.
4. **main** und **/(root)** auswählen und speichern.
5. Die Veröffentlichung abwarten. Die Website-Adresse lautet:
   `https://mikejaeson1-wq.github.io/schwarze-raben/`
6. Die Discord-Rückkehradressen müssen exakt zur tatsächlich veröffentlichten Adresse passen. Bei einem anderen Repository-Namen sowohl `config.js` als auch die Supabase-URL-Einstellungen anpassen.

Die Datei **.nojekyll** sorgt für eine direkte Veröffentlichung der statischen Dateien. Ein zusätzlicher Build ist nicht erforderlich. Die HTML-, CSS- und JavaScript-Dateien liegen öffentlich auf GitHub; die privaten Clan-Inhalte bleiben in Supabase.

## 5. Im Alltag verwalten

1. **Clanbereich** öffnen und mit Discord anmelden.
2. Als Admin **Verwaltung** öffnen.
3. Im passenden Bereich Texte, Listen oder Bilder ändern.
4. Bei öffentlichen Inhalten und Gestaltung **Änderungen speichern** wählen.
5. Interne Beiträge im Bereich **Geschlossene Inhalte** veröffentlichen oder bearbeiten.
6. Unter **Mitglieder & Rechte** Zugangsanfragen freigeben oder Nutzer sperren.

Änderungen werden gemeinsam in Supabase gespeichert und erscheinen auch bei anderen Besuchern. Bei gleichzeitiger Bearbeitung durch mehrere Admins verhindert eine Versionsprüfung das unbemerkte Überschreiben öffentlicher Inhalte. Bei einem Konflikt die eigenen Änderungen sichern, dann die Seite neu laden und die aktuellen Inhalte übernehmen.

Ein neu hochgeladenes Hintergrundbild wird mit **Änderungen speichern** auf der Seite aktiviert. Die Funktion **Original wiederherstellen** setzt das mitgelieferte Motiv wieder ein. Alte hochgeladene Bilder werden nicht automatisch aus dem Speicher gelöscht; der Projektverantwortliche kann ungenutzte Dateien im Storage-Bucket entfernen.

## Prüfung

Lokal wurden die SQL-Dateien in einer PostgreSQL-Testumgebung mit nachgebildeten Supabase-Auth- und Storage-Schemas ausgeführt. Geprüft wurden öffentliche Leserechte, Discord-Identitätsprüfung, wartende Nutzer, Mitglieder, Admins, unerlaubte Rechteerhöhung, Bild-Upload-Rechte, Schutz des letzten Admins und Zugriffsentzug nach Sperrung.

Zusätzlich wurden JavaScript-Syntax, HTML-Verweise, sicheres Einsetzen von Texten, öffentliches Nachladen von Inhalten, Reiterbedienung und die Admin-Bearbeitung mit Speicherung geprüft. Die veröffentlichte Startseite und der geschlossene Clan-Eingang wurden im Browser geprüft. Die Weiterleitung erreicht Discord mit der richtigen Supabase-Callback- und Clan-Rückkehradresse. Die Live-Datenbank verweigert Gästen den Zugriff auf Mitgliederdaten und interne Beiträge; Abfragen mit den Datenbankrechten eines nicht freigegebenen Nutzers bleiben gesperrt. Die Admin-Freigabe des verifizierten Discord-Kontos und die Mitgliedschaftsfunktion wurden ebenfalls auf der Live-Datenbank geprüft. Ein vollständiger Login mit anschließender Admin-Bearbeitung wurde noch nicht im Browser durchgeführt.

## Dateien

- `config.js`: öffentliche Projekt-Verbindung.
- `default-content.js`: öffentliche Ausgangsinhalte.
- `app.js`: gemeinsame Supabase-Verbindung und Discord-Anmeldung.
- `public.js`: öffentliche Inhalte.
- `clan.js`: geschlossener Clanbereich.
- `admin.js`: Admin-Verwaltung.
- `effects.js`: Animationen und Bewegungseinstellungen.
- `style.css`, `portal.css`: Gestaltung.
- `assets/`: mitgelieferte Bilder.
- `vendor/`: fest eingebundener Supabase-Client 2.117.2 samt Lizenz; kein externer Script-CDN zur Laufzeit.
- `supabase/`: Schema, öffentliche Ausgangsinhalte und Admin-Freigabe-Hinweise.
