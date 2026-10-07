# Schwarze Raben – Website, Discord-Login und Clan-Verwaltung

Die öffentliche Website wird über GitHub Pages bereitgestellt. Supabase speichert Inhalte und Mitgliederrechte und übernimmt die Discord-Anmeldung. Die Website benötigt keinen eigenen kostenpflichtigen Server.

## Enthalten

- **index.html:** öffentliche Clanvorstellung mit Dorf, Infoboard und ergänzbaren Informationen.
- **entdecken.html:** Galerie, Dorfplan, Chronik, Handel, öffentliche Termine und freigegebene Charaktere.
- **bewerben.html:** private Clanbewerbung mit Discord-Anmeldung.
- **clan.html:** geschlossener Clanbereich mit RP-Kalender, Charakterbuch, Aufträgen, Bauprojekten, Wissen, Abstimmungen, Tagebuch und Handel.
- **admin.html:** Verwaltung für freigegebene Admins.
- **app/:** installierbare mobile Admin-App mit Discord-Anmeldung, eigenem App-Symbol und QR-Code zur Installationsanleitung.
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

Die App wird wie die Website über GitHub Pages aktualisiert. Änderungen an gecachten Dateien werden bei bestehender Verbindung neu geladen. Bei späteren Änderungen am Service Worker die Cache-Version in **app/sw.js** erhöhen.

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
