# Roadmap der Schwarzen Raben

Stand: 7. Oktober 2026. Die Schwarzen Raben sind ein Roleplay-Clan in Conan Exiles mit einem nordischen Dorf im Schnee. Serverangaben stehen im bearbeitbaren Infobereich, damit die Website bei einem Serverwechsel weiterverwendet werden kann.

Die vier Ausbauschritte sind umgesetzt. Die Übersicht beschreibt die verfügbaren Funktionen der Website, des Clanbereichs und der Admin-App.

| Schritt | Status | Schwerpunkt | Ergebnis |
| --- | --- | --- | --- |
| Grundlage | Fertig | Öffentliche Website, geschlossener Clanbereich und Admin-App | Discord-Anmeldung, Rollen und Freigaben, bearbeitbare Texte und Bilder, Effekte, Galerie, Dorfkarte, Chronik, Bewerbungen, Kalender, Charaktere, Aufträge, Bauprojekte, Wissen, Abstimmungen und Tagebuch |
| 1 | Fertig | YouTube und echte MP3-Dateien | Videos per Link einbetten und Audiodateien direkt hochladen und abspielen |
| 2 | Fertig | Gemeinsame Medienverwaltung | Bilder, Videos und Audio finden, zuordnen und bequem am Handy verwalten |
| 3 | Fertig | RP-Geschichten verbinden | Charaktere, Tagebucheinträge, Chronik und Ereignisse miteinander verknüpfen |
| 4 | Fertig | Verwaltung und Wiederherstellung | Änderungen nachvollziehen, frühere Inhaltsversionen wiederherstellen und Daten exportieren |

## 1. Medienupdate: YouTube und MP3

### YouTube-Links

- Einen YouTube-Link in der Desktop-Verwaltung oder Admin-App einfügen, zum Beispiel einen normalen Videolink oder einen `youtu.be`-Link.
- Titel, Beschreibung und optional ein vorhandenes Bild als Vorschaubild vergeben.
- Den Videoplayer erst auf Wunsch laden; die Wiedergabe startet durch eine bewusste Aktion.
- Links bearbeiten, ersetzen und entfernen. Ungültige Links werden verständlich angezeigt.
- Videos in Medienbeiträgen, Chronikeinträgen, Charakteren, Tagebuch und zusätzlichen Informationen einbinden.
- Die Sichtbarkeit folgt dem jeweiligen Eintrag: intern oder nach Admin-Freigabe öffentlich. Der Zugriff auf das Video selbst richtet sich nach den YouTube-Einstellungen.

### Echte MP3-Dateien

- Eine `.mp3`-Datei direkt vom Computer oder Handy hochladen, statt lediglich eine externe Audioadresse einzutragen.
- Einen Audioplayer mit Start, Pause und Springen innerhalb der Aufnahme anzeigen.
- Titel, Beschreibung und optional ein Cover aus den vorhandenen Bildern hinzufügen.
- Eigene Lieder, erzählte Sagen oder RP-Aufnahmen zu Medienbeiträgen, Charakteren und Geschichten zuordnen.
- Dateien ersetzen oder entfernen; Uploadfortschritt und verständliche Fehlermeldungen anzeigen.
- MP3-Dateien bis 20 MB und Bilder bis 50 MB hochladen. MP3-Dateien liegen im Medienspeicher und werden nicht ins öffentliche GitHub-Repository geschrieben.

### Sichtbarkeit und Freigaben

Admins verwalten die neuen Medien auch über die bestehende Admin-App. Interne MP3-Dateien bleiben im geschützten Medienspeicher. Ein öffentlicher Beitrag erhält erst nach einer ausdrücklichen Admin-Freigabe eine öffentlich abrufbare Datei. Geheimnotizen behalten ihre getrennten Rechte. Mitglieder dürfen Anhänge nur dort bearbeiten, wo sie bereits ihren eigenen Eintrag bearbeiten dürfen.

Die Medienverwaltung steht auf Computer und Handy bereit. Gäste und gesperrte Mitglieder erhalten keinen Zugriff auf interne Audiodateien; Veröffentlichungen bleiben eine gesonderte Admin-Entscheidung.

## 2. Medien im Alltag verwalten

- Eine gemeinsame Übersicht mit Filtern für Bilder, YouTube-Videos und Audio sowie für öffentliche und interne Einträge.
- Mehrere Medien je Beitrag anordnen und ihre Titel, Beschreibungen und Cover bearbeiten.
- Anzeigen, in welchen Beiträgen eine Datei verwendet wird, bevor sie entfernt wird.
- Speicherverbrauch anzeigen und nicht mehr verwendete Dateien gezielt aufräumen.
- Die Bedienung am Handy für längere Uploads und mehrere Anhänge verbessern.

## 3. RP-Geschichten verbinden

- Aus einem Tagebucheintrag auf beteiligte Charaktere und den passenden RP-Termin verweisen.
- Chronikeinträge mit zugehörigen Bildern, Videos und Aufnahmen verbinden.
- Eine gemeinsame Geschichte über mehrere Einträge verfolgen, etwa eine Reise oder den Bau eines Langhauses.
- Wissenseinträge nach Themen ordnen und häufig benötigte Informationen anheften.

Die vorhandenen Kalender, Charakterbücher und Tagebücher bilden dafür die Grundlage. Interne Geschichten werden weiterhin einzeln zur öffentlichen Chronik freigegeben.

## 4. Verwaltung und Wiederherstellung

- Nachvollziehbar anzeigen, wer einen Inhalt wann geändert hat.
- Frühere Inhaltsversionen ansehen und bei Bedarf wiederherstellen.
- Inhalte exportieren und eine verständliche Anleitung für Sicherung und Wiederherstellung anbieten.
- Freigaben, fehlende Medien und Speicherverbrauch in der Admin-Übersicht zusammenführen.

## Technische Grundlage des Medienupdates

Die vorhandene Website und Admin-App bleiben der Ausgangspunkt. YouTube stellt einen einbettbaren Player bereit; MP3-Dateien lassen sich über den HTML-Audioplayer abspielen. Die Umsetzung verwendet die bestehenden Inhaltsrechte und Admin-Freigaben für Bilder und Clanbeiträge.

- [YouTube: Videos einbetten](https://support.google.com/youtube/answer/171780?hl=de)
- [YouTube: Einbettbarer Player und Parameter](https://developers.google.com/youtube/player_parameters)
- [MDN: HTML-Audioplayer und MP3-Quellen](https://developer.mozilla.org/de/docs/Web/HTML/Reference/Elements/audio)

Zur aktuellen Website: [Schwarze Raben](https://mikejaeson1-wq.github.io/schwarze-raben/). Bedienung und Einrichtung stehen in [ANLEITUNG.md](ANLEITUNG.md).

Die Sicherung umfasst JSON-Inhalte sowie Bilder und MP3-Dateien in ZIP-Teilen. Inhalte lassen sich einzeln nach Vorschau importieren. Clan- und Medienbeiträge werden bei der Wiederherstellung zunächst Entwürfe. Discord-Konten und Mitgliedsrechte werden dabei nicht automatisch übernommen. Die genaue Bedienung steht in [ANLEITUNG.md](ANLEITUNG.md).
