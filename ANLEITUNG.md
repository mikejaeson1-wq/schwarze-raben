# Schwarze Raben – Website, Discord-Login und Clan-Verwaltung

Die öffentliche Website wird über GitHub Pages bereitgestellt. Supabase speichert Inhalte und Mitgliederrechte und übernimmt die Discord-Anmeldung. Die Website benötigt keinen eigenen kostenpflichtigen Server.

## Enthalten

- **index.html:** öffentliche Clanvorstellung mit Dorf, Infoboard und ergänzbaren Informationen.
- **entdecken.html:** Galerie, Dorfplan, Chronik, Handel, öffentliche Termine und freigegebene Charaktere.
- **bewerben.html:** private Clanbewerbung mit Discord-Anmeldung.
- **clan.html:** geschlossener Clanbereich mit RP-Kalender, Charakterbuch, Aufträgen, Bauprojekten, Wissen, Abstimmungen, Tagebuch und Handel.
- **admin.html:** Verwaltung für freigegebene Admins.
- **app/:** installierbare mobile Admin-App mit Discord-Anmeldung, eigenem App-Symbol und QR-Code zur Installationsanleitung.
- **Bilder:** Startseiten-Hintergrund und Dorfbild austauschen; JPG, PNG, WebP bis 50 MB.
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
3. Anschließend **supabase/seed.sql** ausführen. Die Ausgangsinhalte sind öffentlich und enthalten keine erfundene Clan-Lore. In einem neuen Projekt danach die Dateien unter **supabase/migrations/** in zeitlicher Reihenfolge einmalig ausführen. Auf dem bestehenden Projekt ist das Gesamtupdate bereits angewendet; dort diese Dateien nicht erneut ausführen.
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

## 6. Mobile Admin-App installieren

- Installation und QR-Code: https://mikejaeson1-wq.github.io/schwarze-raben/app/install.html
- App öffnen: https://mikejaeson1-wq.github.io/schwarze-raben/app/
- QR-Code herunterladen: https://mikejaeson1-wq.github.io/schwarze-raben/app/qr.png

Den QR-Code mit der Handykamera scannen und die Installationsseite im Browser öffnen. Der Code installiert die App nicht automatisch; die Installation muss auf dem Handy bestätigt werden.

**Android:** Die Seite in Chrome öffnen und **App installieren** wählen, sobald der Button erscheint. Alternativ über das Browsermenü **App installieren** oder **Zum Startbildschirm hinzufügen** wählen. Danach das Symbol **Raben Admin** öffnen und in der App mit Discord anmelden.

**iPhone:** Die Seite in Safari öffnen, **Teilen → Zu Home-Bildschirm hinzufügen** wählen und **Als Web-App öffnen** aktivieren, falls diese Option angezeigt wird. Mit **Hinzufügen** bestätigen. Danach das Symbol **Raben Admin** öffnen und dort mit Discord anmelden. Bei abweichendem Safari-Layout ist Teilen im Seitenmenü erreichbar.

Die App öffnet nach der Freigabe direkt den **RP-Hub** mit Bewerbungen, Freigaben, anstehenden Terminen und Clan-Aufträgen. Über die sechs Reiter sind RP-Hub, Dorfangaben, öffentliche Informationen, Bilder und Effekte, geschlossene Beiträge sowie Mitgliederrechte erreichbar. Alle Änderungen landen in derselben Datenbank wie die Website. Für die Verwaltung sind eine Internetverbindung und ein aktives Admin-Konto erforderlich. Eine normale Clanmitgliedschaft reicht nicht aus.

Die Installation ist öffentlich zugänglich; sie erteilt keine Adminrechte. Adminrechte prüft die Anwendung vor dem Laden der Verwaltung und vor jeder Änderung erneut. Die Datenbank erzwingt diese Rechte zusätzlich. Entzogene Rechte sperren die Oberfläche und entfernen die geladenen internen Listen und Beitragsentwürfe.

Die App verwendet den bereits erlaubten Discord-Callback **clan.html** mit PKCE. Ein kurzlebiger Rückkehrhinweis im selben Browser-Tab führt anschließend zur festen Adresse **app/**, bevor Clan-Daten geladen werden. Der Hinweis enthält keine Zugangsdaten und vergibt keine Rechte. Eine weitere Discord-Anwendung oder zusätzliche Supabase-Rückkehradresse ist dafür nicht nötig.

Der Service Worker hat den Bereich **app/** als Geltungsbereich. Er legt ausschließlich öffentliche Programm- und Gestaltungsdateien ab. Supabase-API-Antworten, Mitgliederlisten, interne Beiträge, authentifizierte Requests und Navigationsadressen mit Anmeldecodes werden nicht gecacht. Ohne Internet erscheint beim Öffnen ein Verbindungshinweis; Änderungen werden nicht offline gespeichert oder später automatisch versendet. Beim Installieren möglichst zuerst das App-Symbol anlegen und danach innerhalb der App anmelden, damit die Sitzung im richtigen Browser-Kontext liegt.

Die App wird wie die Website über GitHub Pages aktualisiert. Stylesheets und Scripte werden mit einem Dateihash als Versionshinweis geladen. Dadurch erhalten auch bereits benutzte Browser die aktuellen Dateien beim erneuten Öffnen. Die Cache-Liste des Service Workers erlaubt ausschließlich die exakt hinterlegten öffentlichen Dateiversionen; andere Query-Adressen werden nicht gespeichert. Bei späteren Codeänderungen die betroffenen Dateihashes in HTML und Cache-Liste erneuern und die Cache-Version in **app/sw.js** erhöhen.

Offizielle Hinweise zur Installation:

- https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## 7. Das Gesamtupdate benutzen

In der Desktop-Verwaltung **Gemeinschaft & Freigaben** öffnen, in der Handy-App **RP-Hub**. Die Unterreiter verwalten alle neuen Bereiche. **Neu erstellen** öffnet das passende Formular; **Bearbeiten** hält den vorhandenen Eintrag und seine Version fest. Bei einem Konflikt bleiben die Eingaben stehen. Diese vor dem Neuladen sichern.

| Bereich | Bedienung |
| --- | --- |
| Übersicht | Zeigt wartende Bewerbungen, Freigaben, kommende Termine und Clan-Aufträge. Die Karten öffnen den passenden Bereich. |
| Bewerbungen | Konzept, RP-Wünsche und Spielzeiten prüfen; Rückmeldung schreiben; annehmen oder ablehnen. Annehmen schaltet den Clan-Zugang frei. Ablehnen entzieht eine bereits erteilte Mitgliedschaft nicht; dafür Mitgliederrechte verwenden. |
| Freigaben | Eingereichte Einträge bearbeiten und ihre Sichtbarkeit nach Prüfung ändern. Öffentlich freigegebene Texte und Bilder sehen alle Besucher. |
| Dorfgalerie | Eigene Aufnahmen mit Titel, Beschreibung und Datum hochladen. Öffentliche Galerieeinträge benötigen ein Bild. |
| Dorfplan | Eine Karte als Galerieaufnahme hochladen, veröffentlichen und **Als Dorfplankarte verwenden** wählen. Unter Dorfplan Orte mit Koordinaten von 0 bis 100 Prozent ergänzen. Die Karte und Orte müssen öffentlich freigegeben sein. |
| Chronik | Datierten Ereigniseintrag erstellen und veröffentlichen. Tagebuchberichte können mit **Für Chronik übernehmen** kopiert, redigiert und gesondert veröffentlicht werden. |
| Handel & Diplomatie | Angebot, Gesuch oder diplomatische Anfrage mit RP-Kontakt und optionalem Gültigkeitsdatum erstellen. Mitglieder reichen eigene Beiträge ein; Admins veröffentlichen sie. |
| RP-Kalender | Datum und Uhrzeit gelten in **Europe/Berlin**. Ort und Anmeldestatus angeben. Mitglieder sagen **Dabei**, **Vielleicht** oder **Absage**; Zusagen sind im Clan sichtbar. Vergangene Termine über die entsprechende Option anzeigen. |
| Charakterbuch | Mitglieder erstellen und bearbeiten ihre eigenen Steckbriefe mit Beruf, Geschichte, Beziehungen und Bild. **Geheimnotizen** speichert getrennte Inhalte ausschließlich für Besitzer und Admins. Admins können Steckbriefe öffentlich freigeben. |
| Auftragsbrett | Admins und Mitglieder erstellen Aufträge. Ein Mitglied übernimmt den Auftrag, markiert ihn als erledigt oder löst die Übernahme. Pro Auftrag gibt es eine zuständige Person; Admins können die Übernahme ebenfalls verwalten. |
| Bauprojekte | Admins pflegen Verantwortliche, Materialbedarf und vorhandene Bestände sowie Fortschritt in Prozent. Diese Angaben werden manuell aktualisiert. |
| Wissensarchiv | Admins und Mitglieder ergänzen eigene Wissenseinträge mit Kategorie und Schlagwörtern. Die deutsche Volltextsuche durchsucht Titel, Text und Schlagwörter. |
| Abstimmungen | Admins legen zwei bis acht unterschiedliche Antworten und optional einen letzten Abstimmungstag fest. Mitglieder haben eine Stimme und können sie bis zum Ende ändern. Sichtbar sind Gesamtergebnisse; eigene Stimmen sehen die jeweiligen Mitglieder, Admins können die einzelnen Stimmen einsehen. Nach der ersten Stimme lassen sich die Antwortmöglichkeiten nicht verändern. Zum Schließen **Abstimmung offen** deaktivieren. |
| RP-Tagebuch | Mitglieder berichten von ihren Erlebnissen. Admins können ausgewählte Berichte für die Chronik übernehmen. Die Kopie wird vor einer öffentlichen Veröffentlichung separat bearbeitet und freigegeben. |

**Sichtbarkeit:** Entwürfe, Einträge zur Freigabe und archivierte Einträge sind nur für ihre Besitzer und Admins sichtbar. **Clanintern** lesen aktive Clanmitglieder. **Öffentlich** lesen alle Besucher; nur Admins können diese Sichtbarkeit setzen. **Archivierte Einträge anzeigen** blendet das eigene oder für Admins das gesamte Archiv ein. Keine Geheimnotizen in einen öffentlichen Steckbrief schreiben.

Neue Bilder landen zunächst im privaten Bucket **raben-media**. Die Oberfläche lädt sie nur über eine authentifizierte Anfrage. Erst eine Admin-Veröffentlichung erzeugt eine gesonderte öffentliche Bildkopie im Bucket **raben-public**. Bereits veröffentlichte Bilder bleiben dort, auch wenn ein Eintrag später archiviert oder gelöscht wird; die ursprüngliche Veröffentlichung lässt sich damit nicht vollständig zurücknehmen. Ungenutzte Dateien können durch den Projektverantwortlichen im Storage entfernt werden.

Die neuen Bereiche beginnen ohne erfundene Dorfnamen, Termine, Mitgliedergeschichten oder Abstimmungen. Eure eigenen Einträge werden über die Verwaltung ergänzt.

## Prüfung

Lokal wurden die SQL-Dateien in einer PostgreSQL-Testumgebung mit nachgebildeten Supabase-Auth- und Storage-Schemas ausgeführt. Geprüft wurden öffentliche Leserechte, Discord-Identitätsprüfung, wartende Nutzer, Mitglieder, Admins, unerlaubte Rechteerhöhung, Bild-Upload-Rechte, Schutz des letzten Admins und Zugriffsentzug nach Sperrung.

Zusätzlich wurden JavaScript-Syntax, HTML-Verweise, sicheres Einsetzen von Texten, öffentliches Nachladen von Inhalten, Reiterbedienung und die Admin-Bearbeitung mit Speicherung geprüft. Die veröffentlichte Startseite und der geschlossene Clan-Eingang wurden im Browser geprüft. Die Weiterleitung erreicht Discord mit der richtigen Supabase-Callback- und Clan-Rückkehradresse. Die Live-Datenbank verweigert Gästen den Zugriff auf Mitgliederdaten und interne Beiträge; Abfragen mit den Datenbankrechten eines nicht freigegebenen Nutzers bleiben gesperrt. Die Admin-Freigabe des verifizierten Discord-Kontos und die Mitgliedschaftsfunktion wurden ebenfalls auf der Live-Datenbank geprüft. Ein vollständiger Login mit anschließender Admin-Bearbeitung wurde noch nicht im Browser durchgeführt.

Für die mobile App wurden zusätzlich Gäste, wartende Nutzer, aktive Clanmitglieder und gesperrte Nutzer auf gesperrten Admin-Zugang ohne Inhaltsabfragen geprüft. Eine Admin-Bearbeitung mit Speicherung sowie das Sperren und Leeren der Oberfläche nach Rechteentzug wurden mit dem tatsächlichen Frontend-Code getestet. Der feste Discord-Rückweg, Ablauf und einmaliger Verbrauch des Rückkehrhinweises, Installationsmanifest, Bildgrößen, HTML-Verweise und Cache-Regeln sind geprüft. Der QR-Code wurde nach der Erstellung mit einem unabhängigen Decoder ausgelesen und stimmt mit der veröffentlichten Installationsadresse überein. Eine Installation und vollständige Discord-Anmeldung auf einem tatsächlichen Android-Handy oder iPhone wurde noch nicht durchgeführt.

Für das Gesamtupdate wurden zusätzlich die tatsächlichen Datenbankregeln für Bewerbungsannahme, Eigentumsrechte, private Notizen, erneute Veröffentlichung, doppelte Zusagen und Stimmen, Auftragsübernahmen, geschlossene Abstimmungen, Bildrechte und unmittelbaren Zugriffsentzug geprüft. Der Frontend-Code wurde mit den Abläufen für Zusagen, Bearbeitung, Versionskonflikte, Aufträge, Abstimmungen, Bildfreigabe und Chronik-Übernahme ausgeführt. In der Live-Datenbank sind alle sechs neuen Tabellen durch RLS geschützt; Gäste haben keine Tabellenrechte auf Bewerbungen, Notizen, Zusagen, Übernahmen oder Stimmen. Die neuen öffentlichen RPC-Funktionen laufen als SECURITY INVOKER. In der Live-Datenbank wurden mit den Rechten des bereits verifizierten Admins außerdem Notizen, Zusagen, Stimmen und Auftragsübernahmen in einer zurückgerollten Transaktion erfolgreich ausgeführt; es bleiben keine Testeinträge bestehen.

## Dateien

- `config.js`: öffentliche Projekt-Verbindung.
- `default-content.js`: öffentliche Ausgangsinhalte.
- `app.js`: gemeinsame Supabase-Verbindung und Discord-Anmeldung.
- `public.js`: öffentliche Inhalte.
- `community.js`: neue öffentliche, Mitglieder- und Admin-Funktionen.
- `community-page.js`: Einstieg für Dorfleben und Bewerbungen.
- `clan.js`: geschlossener Clanbereich.
- `admin.js`: Admin-Verwaltung.
- `app/`: mobile Admin-Oberfläche, Installation, QR-Code, Manifest, App-Symbole und Service Worker.
- `effects.js`: Animationen und Bewegungseinstellungen.
- `style.css`, `portal.css`, `community.css`: Gestaltung.
- `assets/`: mitgelieferte Bilder.
- `vendor/`: fest eingebundener Supabase-Client 2.117.2 samt Lizenz; kein externer Script-CDN zur Laufzeit.
- `supabase/`: Schema, öffentliche Ausgangsinhalte und Admin-Freigabe-Hinweise.


## Medien, Geschichten, Versionen und Sicherungen

Das Roadmap-Update ist in der Desktop-Verwaltung und in der installierten Admin-App verfügbar. Öffne dort den **RP-Hub**. Im Clanbereich können Mitglieder eigene Medien, Charaktere und erlaubte Beiträge bearbeiten; **Versionen**, **Speicher** und **Sicherung** bleiben Admins vorbehalten.

### YouTube oder MP3 hinzufügen

1. Öffne **Medien → Neu erstellen** und trage Titel und Beschreibung ein.
2. Wähle **Bild**, **YouTube-Video** oder **MP3-Aufnahme**. Für YouTube einen HTTPS-Videolink einfügen, für MP3 eine echte Datei vom Computer oder Handy auswählen.
3. Bei Video und Audio kannst du zusätzlich ein Cover hochladen. Bilder dürfen bis 50 MB, MP3-Dateien bis 20 MB groß sein.
4. Wähle die Sichtbarkeit und speichere. Mitglieder können einen Entwurf, einen Clanbeitrag oder einen Eintrag zur Freigabe erstellen. Nur Admins können **Öffentlich** wählen.
5. Im Editor eines Charakters, Tagebuchberichts, Chronikeintrags oder anderen Beitrags unter **Medienanhänge** das Medium auswählen und **Hinzufügen** drücken. Mit den Pfeilen die Reihenfolge verändern. Eine Entfernung des Anhangs löscht die Originaldatei nicht.

Der YouTube-Player wird erst mit **Video laden** aktiviert. MP3-Aufnahmen spielen im Audioplayer mit Start, Pause und Zeitregler. Interne Aufnahmen werden erst mit **Aufnahme laden** abgerufen. Es gibt keinen automatischen Ton beim Öffnen einer Seite. Ein YouTube-Link wird in der Website entsprechend dem Beitrag angezeigt; die Erreichbarkeit des Videos selbst hängt weiterhin von dessen YouTube-Einstellungen ab.

Uploads zeigen den Fortschritt. **Upload abbrechen** pausiert den laufenden Vorgang; **Speichern** versucht ihn mit der weiterhin gewählten Datei erneut. Diese Fortsetzung gilt für die geöffnete Seite. Nach dem Schließen oder Neuladen eine Datei erneut auswählen. Die App benötigt eine Internetverbindung; sie speichert keine Clan-Dateien für die Offline-Wiedergabe.

Eine Veröffentlichung legt eine gesonderte Kopie im öffentlichen Speicher an. Bereits veröffentlichte Dateien können außerhalb der Website weitergegeben worden sein. Eine spätere interne Sichtbarkeit macht solche bereits geteilten Kopien nicht rückwirkend geheim. Die Speicherübersicht zeigt öffentliche Kopien und ihre Verwendung an.

### Medien auf der Startseite

Unter **Öffentliche Inhalte** kannst du bereits freigegebene Medien an einzelne **Weitere Informationen** anhängen. Darunter gibt es außerdem die Auswahl **Zusätzliche Medien auf der Startseite**. Diese erscheinen im Abschnitt **Die Raben in Bild und Klang**. Änderungen über **Änderungen speichern** veröffentlichen. Interne Medien stehen dort nicht zur Auswahl.

### Geschichten verbinden und Wissen anheften

- Im Beitragseditor unter **Verknüpfte Charaktere, Ereignisse und Beiträge** einen vorhandenen Eintrag auswählen und hinzufügen. Die Verknüpfung öffnet den zugehörigen Beitrag.
- Einträge, die zu derselben Geschichte gehören, erhalten denselben Namen im Feld **Gemeinsame Geschichte oder Handlungsfaden**. Unter **Geschichten** stehen die dazugehörigen Beiträge; ein Klick auf den Geschichtenknopf an einem Beitrag filtert direkt danach.
- Das Wissensarchiv lässt sich zusätzlich nach Kategorie filtern. Admins können **Im Wissensarchiv anheften** aktivieren. Angeheftete Einträge stehen zuerst. Mitglieder ändern den Anheftstatus nicht.
- Öffentlich verknüpfte Einträge und Medien müssen ihrerseits öffentlich freigegeben sein. Geheimnotizen sind keine verknüpfbaren oder öffentlichen Beiträge.

### Frühere Versionen wiederherstellen

**Versionen** zeigt Zeitpunkt, Bearbeiter, Inhaltsbereich und gespeicherte Fassungen. Suche nach Titel oder Bearbeiter; über **Vorschau ansehen** den Inhalt prüfen. **Wiederherstellen** speichert die gewählte Fassung als neue Version. Gleichzeitige Änderungen eines anderen Admins werden erkannt und nicht still überschrieben.

Clan- und Medienbeiträge werden dabei zunächst **Entwürfe**. Prüfe sie und gib sie anschließend im jeweiligen Bereich erneut frei. Die Wiederherstellung von Website-Inhalten verändert die öffentliche Startseite direkt; die Bestätigung weist darauf hin. Geheimnotizen und ältere interne Clan-Infos bleiben intern.

Die Versionen erfassen Änderungen ab diesem Update. Für zuvor bestehende Inhalte gibt es eine Ausgangsversion mit der Kennzeichnung **Bestand vor dem Update**. Einträge zu Mitgliedsrechten oder Discord-Anmeldedaten werden dadurch nicht zu öffentlich einsehbaren Inhalten.

**Version entfernen** verwirft eine ausgewählte frühere Fassung nach Bestätigung. Das entfernt nicht den aktuellen Beitrag. Dateien, die nur diese Fassung benötigte, lassen sich danach gegebenenfalls unter **Speicher** aufräumen. Entfernte gespeicherte Fassungen können ohne separate Sicherung nicht wiederhergestellt werden.

### Dateiverwendung und Speicher

**Speicher** zählt die privaten und öffentlichen Clan-Dateien und zeigt ihre Verwendung in Beiträgen, Website-Einstellungen und gespeicherten Versionen. Die Übersicht meldet fehlende Bild- oder Audiodateien und nicht mehr verfügbare Medienanhänge. **Verwendung ansehen** an einem Medienbeitrag zeigt die verknüpften Beiträge.

Dateien mit Verwendung können nicht über das Aufräumen entfernt werden. Unbenutzte Dateien lassen sich einzeln nach Bestätigung löschen. Soll ein Medienbeitrag gelöscht werden, zuerst seine Anhänge aus den zugehörigen Beiträgen oder Startseiteninformationen entfernen. Die Speicherzahl bezieht sich auf diese beiden Clan-Buckets; andere Anwendungen im selben Supabase-Projekt sind darin nicht enthalten.

### Sicherung herunterladen und Inhalte zurückholen

1. Unter **Sicherung** mit **Inhalte als JSON sichern** eine Inhaltssicherung herunterladen. Sie umfasst Website und Clanbeiträge, Geheimnotizen, Bewerbungen, Mitgliederinformationen, Interaktionen und Inhaltsversionen. Bewahre diese Datei privat auf.
2. Mit **Inhalte und Dateien als ZIP sichern** zusätzlich die tatsächlichen Bilder und MP3-Dateien herunterladen. Größere Sicherungen werden in Teile von ungefähr 40 MB aufgeteilt. **Alle ZIP-Teile aufbewahren.** Jeder Teil enthält `backup.json`; die Dateien liegen unter `files/raben-media/` beziehungsweise `files/raben-public/`. Die Browserfreigabe für mehrere Downloads kann dafür nötig sein.
3. Die JSON-Datei beziehungsweise `backup.json` unter **Inhaltssicherung zur Prüfung auswählen** öffnen. Einen einzelnen Inhalt wählen, die Vorschau prüfen und gezielt wiederherstellen. Vorhandene fremde Änderungen werden dabei geprüft; andere Inhalte werden nicht gelöscht.
4. Falls eine Originaldatei fehlt, den passenden ZIP-Teil entpacken. In der Datei-Wiederherstellung zuerst den Eintrag aus der Sicherung auswählen und dann die dazugehörige Datei vom Gerät hochladen. Bestehende Dateien werden nicht überschrieben. Die Rückkehr einer zuvor öffentlichen Datei benötigt eine ausdrückliche öffentliche Bestätigung.
5. Bei fehlenden verknüpften Medien zuerst diese Medienbeiträge und Originaldateien wiederherstellen. Danach Charaktere, Tagebuch oder Chronik und zuletzt die öffentlichen Website-Verknüpfungen wiederherstellen und bei Bedarf wieder freigeben.

Der Inhaltsimport ist für die Wiederherstellung im bestehenden Clan-Projekt gedacht. Er verändert keine Discord-Konten, Mitgliedsrechte, Bewerbungsentscheidungen, Stimmen oder Teilnehmerzusagen. Diese Daten sind im Export zur Sicherung enthalten, ihre Wiederherstellung benötigt eine gezielte technische Prüfung. Für einen Umzug in ein neues Supabase-Projekt muss insbesondere die Zuordnung der Discord-Mitglieder geprüft werden. Geheimschlüssel und Discord-Anmeldedaten sind kein Bestandteil des Exports.

Für umfangreiche Mediensicherungen am besten einen Computer verwenden. Wird eine Sicherung unterbrochen oder eine Datei fehlt, zeigt die Verwaltung einen Fehler; eine unvollständige Sicherung wird nicht als vollständig bestätigt. Eine reine JSON-Datei ersetzt nicht die separate Sicherung der eigentlichen MP3- und Bilddateien.

### Technische Einrichtung dieses Updates

Bestehende Installation: Zusätzlich die Migration `supabase/migrations/20261007205601_media_history_roadmap.sql` anwenden. Das veröffentlichte Clan-Projekt ist bereits aktualisiert. Bei einer neuen Installation zuerst `schema.sql` und `seed.sql`, anschließend die Gemeinschafts-Migration und danach diese Medien-Migration einrichten. Alle Tabellen und Funktionen gehören zum Namensraum `raben_`; andere Anwendungen werden nicht geändert.

Die zusätzlichen Browser-Bibliotheken liegen lokal und fest versioniert im Repository. Die Admin-App aktualisiert ihre öffentlichen Oberflächendateien über den Service Worker. Interne Daten, Audiodateien, Bilder aus dem geschützten Speicher, Sicherungen und Discord-Rückkehradressen werden weiterhin nicht in dessen Cache aufgenommen. Falls die App nach dem Update noch offen war, einmal schließen und erneut öffnen.

### Uploads und große Hintergrundbilder

Bilder, Cover und Hintergrundbilder dürfen bis **50 MB** groß sein, MP3-Dateien weiterhin bis **20 MB**. Auch die Hintergrundbilder werden in fortsetzbaren Abschnitten übertragen. Der Fortschritt zeigt die übertragenen Bytes; bei 100 % wird noch die erfolgreiche Speicherung bestätigt.

Wenn eine Verbindung abbricht, bleiben die gewählte Datei und die Eingaben auf der geöffneten Seite erhalten. Im Medienformular erneut **Speichern** anklicken; bei einem Hintergrundbild **Upload erneut versuchen**. Mit **Upload abbrechen** lässt sich die Übertragung pausieren. Nach dem Schließen oder Neuladen muss die Datei erneut ausgewählt werden. Fehlende Anmeldung, fehlende Rechte, Dateigröße und Format werden getrennt gemeldet.

Für bestehende eigene Installationen außerdem `supabase/migrations/20261008081126_repair_uploads_and_large_images.sql` anwenden. Das veröffentlichte Clan-Projekt ist bereits aktualisiert. Bei einer Neueinrichtung diese Migration nach der Medien-Migration anwenden.


## Persönliche Clanprofile

1. Mit Discord im **Clanbereich** anmelden. Ein Admin muss die Mitgliedschaft angenommen beziehungsweise auf **aktiv** gesetzt haben.
2. Im ersten Reiter **Clanprofile** auf **Mein Profil erstellen** klicken. Der Profilname ist für aktive Clanmitglieder sichtbar; er kann später geändert werden.
3. **Profilbild hinzufügen**, **Charakter hinzufügen** oder **Infokarte hinzufügen** wählen. Mehrere Charaktere und Infokarten sind möglich, beispielsweise für Herkunft und Beruf, RP-Vorlieben oder Spielzeiten.
4. Pro Eintrag die Sichtbarkeit wählen: **Nur du** (Standard), **Ganzer Clan** oder **Ausgewählte Mitglieder**. Bei gezielter Freigabe mindestens eine, höchstens 20 aktive Personen markieren. Das zugehörige Bild erhält automatisch dieselben Rechte.
5. Speichern. Zum Ändern oder Entfernen den eigenen Eintrag über **Bearbeiten** beziehungsweise **Löschen** öffnen. Eine neue Freigabe ersetzt die vorige. Das gilt auch für das Profilbild.

Andere Profile sind über die Übersicht, die Suche oder einen Namen in der Mitgliederliste erreichbar. Andere Mitglieder sehen ausschließlich ihre freigegebenen Angaben, ohne Zähler versteckter Inhalte. Nur der Profilbesitzer bearbeitet sein Profil; andere Clanadmins haben keinen Sonderzugriff. Die Admin-Oberfläche und mobile Admin-App bieten denselben Reiter mit denselben Profilrechten. Normale Mitglieder verwenden weiterhin den Clanbereich.

Bilder werden als JPG, PNG oder WebP bis **50 MB** im eigenen privaten Profilspeicher hochgeladen. Fortsetzbare Uploads verwenden denselben reparierten Uploadablauf wie die Medienverwaltung. Bilder werden authentifiziert abgerufen; es entstehen keine öffentlichen Kopien. Bei Logout werden Profilansichten und lokale Bildadressen entfernt. Freigaben werden serverseitig bei jedem Abruf geprüft; geöffnete Profilansichten werden ohne laufende Bearbeitung regelmäßig sowie beim Zurückkehren zum Fenster aktualisiert. Schon gelesene Inhalte können von Empfängern behalten werden.

**Charakterbuch und Profil sind getrennte Bereiche.** Bereits vorhandene Charakterbucheinträge behalten ihre bisherige Sichtbarkeit; dort können Besitzer und Admins Entwürfe und Geheimnotizen lesen. Für Angaben, die ausschließlich bei dir oder bestimmten Mitgliedern bleiben sollen, die neuen persönlichen Profile verwenden.

**Sicherungen:** Persönliche Profile und Profilbilder sind nicht Bestandteil der allgemeinen Admin-Sicherungen, Inhaltsversionen oder Speicherübersichten. Ein eigener Profil-Export für Mitglieder ist als nächster Ausbau in der [neuen Roadmap](https://mikejaeson1-wq.github.io/schwarze-raben/roadmap.html) vorgesehen.

### Einrichtung und Prüfung des Profilupdates

Bei einer eigenen bestehenden Installation zusätzlich `supabase/migrations/20261008094929_private_clan_profiles.sql` nach der Upload-Migration anwenden. Für eine neue Installation zuerst `schema.sql` und `seed.sql`, dann sämtliche Migrationen in Dateireihenfolge. Das veröffentlichte Clan-Projekt ist bereits aktualisiert.

Die Migration ergänzt ausschließlich eigene Tabellen und einen privaten Bucket: `raben_profiles`, `raben_profile_items`, `raben_profile_grants` und `raben-profile-media`. Alle Tabellen verwenden RLS und Besitzerrechte. Die neuen RPC- und Bildprüffunktionen laufen als **SECURITY INVOKER**. Restriktive Storage-Regeln schützen Profilbilder auch gegen fremde allgemeine Freigaberichtlinien; Dateien lassen sich nicht überschreiben oder verschieben, solange sie als Profilbilder gespeichert sind. Verwendete Bilder sind vor Löschung geschützt.

Prüfung: `npm test --prefix tests`. Die tatsächliche Migration wird in PostgreSQL mit Besitzer, ausgewähltem Mitglied, unbeteiligtem Mitglied, Admin, wartendem, gesperrtem und anonymem Konto geprüft. Tests decken Profil- und Bildrechte, Freigabeentzug, Besitzer- und Empfängersperre, Versionskonflikte, fehlende Admin-Sonderrechte und den Ausschluss aus Sicherungen ab. UI-Tests prüfen Profilanlage, mehrere Einträge, sichere Standardwerte, Empfängerauswahl, private Bild-Uploads, unveränderte Portraits beim Bearbeiten, aktualisierte Freigaben und Logout.
