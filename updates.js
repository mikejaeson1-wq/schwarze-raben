(() => {
  'use strict';
  const roadmap=[
  [
    "Privatchat",
    "Antworten auf einzelne Nachrichten",
    "Nachrichten direkt zitieren und vom Zitat zum ursprünglichen Eintrag springen.",
    "Als Nächstes"
  ],
  [
    "Privatchat",
    "Freiwillige Tippanzeige",
    "Pro Gespräch entscheiden, ob während der Eingabe eine kurzlebige Tippanzeige erscheint.",
    "Danach"
  ],
  [
    "Privatchat",
    "Wichtige Nachrichten persönlich merken",
    "Eigene Lesezeichen im Gespräch setzen und in einer persönlichen Merkliste wiederfinden.",
    "Als Nächstes"
  ],
  [
    "Privatchat",
    "Private Chatentwürfe geräteübergreifend",
    "Optional eigene ungesendete Texte im Konto sichern und vor dem Gerätewechsel wieder aufnehmen.",
    "Danach"
  ],
  [
    "Anhänge",
    "Eigene Aufbewahrungszeiten für Dateien",
    "Ablaufende Chat-Anhänge erkennen und eine bewusste Löschfrist für neu geteilte Dateien wählen.",
    "Später"
  ],
  [
    "Galerie",
    "Albumsicherungen geprüft wieder einlesen",
    "Sicherungen auf Prüfsummen und Dateitypen prüfen und ausgewählte eigene Bilder als neues Album übernehmen.",
    "Danach"
  ],
  [
    "Galerie",
    "Bildauswahlen vor dem Export bilanzieren",
    "Gesamtgröße und einzelne Dateien vor einer Albumsicherung anzeigen und große Sicherungen in Teile aufteilen.",
    "Als Nächstes"
  ],
  [
    "Barrierefreiheit",
    "Dekorative Bilder ausdrücklich markieren",
    "Bewusst dekorative Bilder unabhängig von noch fehlenden Beschreibungen kennzeichnen und gemeinsam prüfen.",
    "Danach"
  ],
  [
    "Texte",
    "Markdown mit Tastaturwerkzeugen bearbeiten",
    "Ausgewählte Textstellen per Werkzeugleiste formatieren und die Vorschau gezielt anspringen.",
    "Als Nächstes"
  ],
  [
    "Kalender",
    "Zeitumstellungen deutlicher prüfen",
    "Nicht vorhandene und doppelte Uhrzeiten bei Sommer- und Winterzeit vor dem Speichern erläutern.",
    "Als Nächstes"
  ],
  [
    "Reservierungen",
    "Kapazitäten über eine Woche vergleichen",
    "Belegung und freie Einheiten mehrerer Ressourcen in einer gemeinsamen Wochenansicht zeigen.",
    "Danach"
  ],
  [
    "Terminfindung",
    "Persönliche Besetzungsfilter speichern",
    "Spieldauer, Mindestbesetzung und gewünschte Personen für wiederkehrende Planungen als eigene Ansicht speichern.",
    "Danach"
  ],
  [
    "Kalender",
    "Serienänderungen mit genauer Textdifferenz",
    "Neben den betroffenen Zuordnungen auch alte und neue Uhrzeiten und Dauer pro Termin gegenüberstellen.",
    "Danach"
  ],
  [
    "Mitbearbeitung",
    "Einladungshinweise mit Ablaufwarnung",
    "Neue Einladungen und bald endende Mitbearbeitungen als persönliche Hinweise bündeln.",
    "Als Nächstes"
  ],
  [
    "Materialplanung",
    "Frühere Rezeptvarianten wiederherstellen",
    "Auch für alternative Materiallisten eine begrenzte Historie mit Vergleich und Wiederherstellung anbieten.",
    "Danach"
  ],
  [
    "Lager",
    "Bestandsbeobachtung feiner steuern",
    "Hinweise einzelner Materialien zeitweise pausieren und nach einer bewussten Prüfung erneut aktivieren.",
    "Danach"
  ],
  [
    "Discord",
    "Eigene Meldungsvorlagen prüfen",
    "Wiederkehrende Ankündigungsformate als Vorlagen speichern und vor jeder Freigabe auf fehlende Angaben prüfen.",
    "Später"
  ],
  [
    "Bedienung",
    "Neue Inhalte ohne Ansichtswechsel melden",
    "Neue oder geänderte Einträge mit einem dezenten Hinweis ankündigen und auf Wunsch gezielt übernehmen.",
    "Als Nächstes"
  ],
  [
    "Uploads",
    "Laufende Übertragungen zentral verwalten",
    "Aktive Uploads, Fortschritt und sichere Wiederholungen in einer gemeinsamen Geräteübersicht anzeigen.",
    "Danach"
  ],
  [
    "Navigation",
    "Schneller zwischen Clanbereichen wechseln",
    "Eine per Tastatur erreichbare Bereichssuche mit eigenen Favoriten anbieten.",
    "Als Nächstes"
  ]
].map(([area,title,body,priority],i)=>({number:i+1,area,title,body,priority,status:'Geplant'}));
  const releases=[
{
  "version": "2026.10.15.2",
  "date": "15. Oktober 2026",
  "title": "20-Punkte-Update · Privatchat, Planung und stabile Clanansichten",
  "items": [
    "Fehlerbehebung: Hintergrundprüfungen bauen Clanansichten nicht mehr alle 30 Sekunden neu auf. Unveränderte Aushänge, geöffnete Diskussionen, Eingaben und Player bleiben bestehen; vorübergehende Verbindungsfehler sperren eine bereits geöffnete Ansicht nicht pauschal.",
    "Chat-Extras: Emoji-Auswahl, acht Emoji-Reaktionen, sichtbare Korrekturhinweise und Lesestatus. Private Anhänge erhalten einen eigenen geschützten Speicherbereich; normale Clanadmins erhalten keinen Lesezugriff.",
    "Punkt 1 · Bereits hochgeladene, noch nicht zugeordnete Bilder im passenden Entwurf erneut auswählen. Eine eigene Übersicht zeigt offene Uploads, gespeicherte Entwürfe und verwendete Dateien.",
    "Punkt 2 · Sichere Markdown-Vorschau für Texte mit Überschriften, Listen, Links, Hervorhebungen und Code. HTML und externe Bilder werden nicht ausgeführt.",
    "Punkt 3 · Eigene Gespräche nach Suchwort und Zeitraum filtern; ältere Treffer nachladen.",
    "Punkt 4 · Eigene Nachrichten korrigieren oder innerhalb von 15 Minuten zurückziehen. Zurückgezogene Nachrichten bleiben als Hinweis sichtbar; ihre Anhänge sind nicht mehr über das Gespräch abrufbar.",
    "Punkt 5 · Bis zu vier geschützte Anhänge pro Nachricht, jeweils bis 10 MiB. Dateityp, Inhaltssignatur und Größe werden vor dem Upload geprüft; Zugriff und Zuordnung werden serverseitig kontrolliert.",
    "Punkt 6 · Gespräche persönlich archivieren und Hinweise je Kontakt stummschalten.",
    "Punkt 7 · Erwähnungen, Chats, Kalender und Clanmeldungen getrennt einstellen. Ruhezeiten gelten für Desktop-Hinweise. Geräte müssen ausdrücklich aktiviert werden; Chattexte bleiben auf dem Sperrbildschirm verborgen.",
    "Punkt 8 · Albumcover festlegen und eigene Bildauswahlen benennen, speichern, laden und löschen.",
    "Punkt 9 · Eigene Alben oder Bildauswahlen als ZIP mit Reihenfolge, Beschreibungen und SHA-256-Prüfsummen sichern.",
    "Punkt 10 · Fehlende oder auffällig kurze Bildbeschreibungen gemeinsam prüfen und im Rahmen der eigenen Berechtigungen verbessern.",
    "Punkt 11 · Identische Bilder beim Theme-Import anhand ihrer Prüfsumme erkennen. Vorhandene eigene oder identische importierte Dateien ausschließlich nach bewusster Auswahl wiederverwenden.",
    "Punkt 12 · Persönliche Anzeige-Zeitzone speichern. Die gemeinsame Planung und Kalenderserien bleiben eindeutig auf Europe/Berlin bezogen.",
    "Punkt 13 · Vor Termin- und Serienänderungen die betroffenen Teilnahmen, Erinnerungen und Reservierungen prüfen und das Speichern ausdrücklich freigeben.",
    "Punkt 14 · Teilbare Ressourcenkapazitäten und benötigte Einheiten buchen. Freie Kapazität einschließlich Aufbau und Abbau prüfen; gleichzeitige Buchungen werden an der Ressource serialisiert.",
    "Punkt 15 · Gemeinsame Zeitfenster nach Mindestdauer, Besetzung und gewünschten Personen filtern. Personen müssen den gesamten vorgeschlagenen Zeitraum abdecken.",
    "Punkt 16 · Neue Mitbearbeitungen als Einladung senden. Zugriff beginnt nach Annahme; Ablehnen, Verlassen, Ablauf und Widerruf sind möglich. Bestehende Freigaben bleiben angenommen.",
    "Punkt 17 · Alternative Materiallisten als Rezeptvarianten mit Verschnitt und Ausgabegrößen anlegen und mit zusätzlicher Projektreserve vergleichen.",
    "Punkt 18 · Persönliche Mindestbestände beobachten. Bei Unterschreitung erscheint ein Clan-Hinweis; erneute Warnungen folgen nach zwischenzeitlicher Auffüllung.",
    "Punkt 19 · Geprüfte Discord-Meldungen für einen Zeitpunkt vormerken und die Planung bis zum Versand ändern. Geänderte Quellen müssen erneut freigegeben werden.",
    "Punkt 20 · Einen vor dem Kopieren prüfbaren Diagnosebericht mit technischen Statuswerten erzeugen. Texte, Nutzerkennungen, Webadressen und Zugangsdaten sind ausgeschlossen.",
    "Spotify: echter Lautstärkeregler über den optionalen Premium-Webplayer vorbereitet. Der Betreiber muss eine Spotify-App mit Client-ID einrichten; anschließend verbindet jedes freigeschaltete Premium-Konto seinen eigenen Player. Der bisherige Embed-Player bleibt nutzbar."
  ],
  "note": "Desktop-Benachrichtigungen benötigen eine Browserfreigabe. Dateiprüfungen ersetzen keinen Virenscanner. Spotify-Embeds bieten keine externe Lautstärkeschnittstelle; die Premium-Anbindung benötigt eine eingerichtete Spotify-App."
},
{
  "version": "2026.10.15.1",
  "date": "15. Oktober 2026",
  "title": "Gesamtupdate · 20 Verbesserungen und Privatchat",
  "items": [
    "Privatchat: freigeschaltete Clanmitglieder können Direktnachrichten mit Verlauf und Lesestatus austauschen. Der Verlauf aktualisiert sich regelmäßig; weitere Nachrichten lassen sich nachladen. Beteiligtenprüfung und Blockierungen gelten serverseitig, auch für normale Clanadmins. Wiederholtes Senden nach einem Verbindungsfehler erzeugt keine doppelte Nachricht.",
    "Punkt 1 · Eingaben in Text- und Zahlenfeldern lassen sich vor dem Speichern schrittweise rückgängig machen und wiederholen. Die Bearbeitungshistorie bleibt ausschließlich im geöffneten Tab.",
    "Punkt 2 · Bannerfokus mit Maus, Touch oder Pfeiltasten verschieben. Handy und Desktop haben getrennte Ausschnitte, Höhen und Vergrößerungen.",
    "Punkt 3 · Mehrere Charakterbilder auswählen, gemeinsam in ein Album verschieben und die Auswahl vor dem Entfernen kontrollieren.",
    "Punkt 4 · Eigene Alternativtexte für Profilbilder, Galerie-, Beitrags- und Claninfo-Bilder pflegen; sichtbare Bildunterschriften bleiben unabhängig.",
    "Punkt 5 · Sparsame, ausgewogene oder detailreiche Bildvorschauen auf dem eigenen Gerät wählen. Bei Charakter-Galeriebildern wird die gespeicherte Dateigröße der gewählten Vorschau angezeigt.",
    "Punkt 6 · Eigene Theme-Vorlagen gezielt mit Bildern exportieren, Importdateien vorab prüfen und ausgewählte Designs in das eigene Konto übernehmen.",
    "Punkt 7 · Bei konkurrierenden Textänderungen bisherigen Text, eigenen Entwurf und gespeicherte Fassung absatzweise vergleichen und zusammenführen. Erneutes Speichern bleibt ausdrücklich erforderlich.",
    "Punkt 8 · Mitbearbeitung wahlweise auf Änderungsvorschläge beschränken. Die besitzende Person kann Vorschläge prüfen, übernehmen oder ablehnen; direkte Textänderungen bleiben in diesem Modus gesperrt.",
    "Punkt 9 · Offene Terminfindungen ohne Kandidaten erstellen. Mitglieder ergänzen eigene Zeitfenster; die Auswertung ermittelt Überschneidungen und zählt Personen nur einmal.",
    "Punkt 10 · Einzelne Termine einer Serie mit eigenem Datum, Uhrzeit und Dauer verschieben. Teilnahmen bleiben am ursprünglichen Serientermin zugeordnet; Kalenderexport, Abos, Erinnerungen und Reservierungen berücksichtigen die Änderung.",
    "Punkt 11 · Aufbau- und Abbauzeiten je Reservierung speichern. Zeitpuffer werden bei Überschneidungen und späteren Terminänderungen serverseitig berücksichtigt.",
    "Punkt 12 · Geräte selbst benennen und auf ausdrücklichen Wunsch eine Testbenachrichtigung anstoßen. Der Prüfstatus unterscheidet Warteschlange, Versand, Annahme durch den Push-Dienst und Fehler.",
    "Punkt 13 · Neue Kalender-Abos können ein Ablaufdatum erhalten. Auf Wunsch erscheint bis zu drei Tage vorher ein persönlicher Clan-Hinweis; abgelaufene Links liefern keine Kalenderdaten mehr.",
    "Punkt 14 · Charakter-Zeitleisten nach Typ, Zeitraum und Handlungsfaden filtern und persönliche Ansichten speichern.",
    "Punkt 15 · Welt-, Dorf- und Gebäudekarten mit Zoom, Ziehen und Zwei-Finger-Gesten bedienen sowie zum Ausgangsausschnitt zurückkehren.",
    "Punkt 16 · Materialvorlagen behalten bis zu 30 frühere Versionen. Der Bedarf wird auf frei wählbare Bündel-, Kisten- oder andere Ausgabegrößen aufgerundet.",
    "Punkt 17 · Erfüllte Handelsanfragen optional mit einer geprüften Ein- oder Auslagerung verbinden. Menge, Einheit, Bestandsrevision und einmalige Buchung werden serverseitig geprüft.",
    "Punkt 18 · Kategorien und Discord-Kanäle können eine zusätzliche Versandfreigabe verlangen. Wartende Meldungen einzeln ansehen, freigeben, pausieren, fortsetzen oder verwerfen.",
    "Punkt 19 · Dialoge passen sich kleinen Displays an; größere Touch-Ziele, begrenzte Dialoghöhen und Fokuswiederherstellung erleichtern die Bedienung.",
    "Punkt 20 · Langsame Verbindungen, Offline-Zustände und unterbrochene Anfragen werden früher angezeigt. Schreibvorgänge werden nicht automatisch wiederholt; Eingaben bleiben im geöffneten Formular erhalten.",
    "Fehlerbehebung: Albumänderungen bleiben auch bei einer vollständig belegten Charaktergalerie mit zwölf Bildern möglich. Bestehende Profile, Freigaben, Medien und Termine werden durch das Update nicht neu angelegt."
  ],
  "note": "Private Nachrichten sind nicht Ende-zu-Ende verschlüsselt. Die Annahme einer Testbenachrichtigung durch den Push-Dienst bestätigt noch nicht deren Anzeige auf dem Gerät."
},
{
  "version": "2026.10.09.3",
  "date": "09. Oktober 2026",
  "title": "20-Punkte-Update · Gestaltung, Zusammenarbeit und Organisation",
  "items": [
    "Alle 20 Punkte der vorherigen Roadmap sind umgesetzt: Bannerzuschnitt, Drag-and-drop in Claninfos, Alben, Diashow und eigene Theme-Vorlagen.",
    "Banner und Charakterprofile haben voneinander unabhängige Transparenzregler für das Hintergrundbild und die vordere Textbox, jeweils von 0 bis 100 %. Bannerhöhe, Zoom und Bildfokus sind in der Vorschau einstellbar.",
    "Claninfos unterstützen verschiebbare Bilder und Absätze, Bildabstände sowie ein-, zwei- und dreispaltige Vorlagen. Pfeilschaltflächen bieten eine Alternative zum Ziehen.",
    "Charakterbilder können benannte Alben bekommen. Bildreihenfolgen lassen sich per Drag-and-drop oder Pfeilen ändern; die Großansicht berücksichtigt das ausgewählte Album.",
    "Die Galerie bietet Diashow mit einstellbarem Abstand, Vollbild und einen getrennten Animationsschalter. Diashows pausieren beim Verlassen des Fensters.",
    "Eigene Theme-Vorlagen lassen sich speichern, duplizieren und auf weitere eigene Charaktere anwenden. Die Farbprüfung zeigt Text- und Überschriftenkontrast.",
    "Private Textentwürfe werden auf dem eigenen Konto gesichert und können wieder übernommen werden. Die letzten 30 Profilfassungen lassen sich vergleichen und wiederherstellen, während die aktuellen Freigaben erhalten bleiben.",
    "Besitzer können ausgewählten Mitgliedern befristete Mitbearbeitungsrechte für genau einen Profil- oder Claneintrag geben und wieder entziehen. Mitbearbeiter ändern Texte; Bilder und Freigaben verwaltet weiterhin der Besitzer.",
    "Gemeinsame Terminfindung sammelt Zusagen zu Zeitfenstern und zeigt die besten Überschneidungen. Persönliche Kalender-Abos aktualisieren sich im Kalenderprogramm und sind widerrufbar.",
    "Erinnerungen je RP-Termin erlauben eigene Vorlaufzeiten und auf Wunsch Gerätebenachrichtigungen nach ausdrücklicher Aktivierung des Geräts. Serverdienste prüfen Mitgliedschaft und Terminfreigabe erneut.",
    "Spielorte und Ressourcen lassen sich für Termine reservieren. Überschneidungen werden auch bei gleichzeitigen Buchungen erkannt; Zeitänderungen prüfen bestehende Reservierungen.",
    "Charakter-Zeitleisten verbinden freigegebene Tagebucheinträge, Ereignisse und Plots. Zusätzliche Welt-, Dorf- und Gebäudekarten haben einzeln schaltbare Themenebenen.",
    "Materialrezepte speichern wiederverwendbare Vorlagen und berechnen Gesamtbedarf und Fehlmengen anhand des Lagers. Handelsangebote und Gesuche haben Mengen, Tauschbedingungen, Anfragen und einen protokollierten Abschlussstatus.",
    "Discord-Kategorien können auf mehrere zusätzliche Kanäle verteilt werden. Eine Meldungsvorschau zeigt den vorgesehenen Inhalt ohne Versand; geheime Webhook-Adressen bleiben im Backend.",
    "Listen laden weitere Einträge an, ohne bereits geladene Karten und Musikplayer neu aufzubauen. Geschützte Bildvorschauen werden bei Bedarf geladen; laufende Vorgänge und Formularfehler sind deutlicher erkennbar.",
    "Unter Featurewünsche & Fehler können Mitglieder Vorschläge einreichen, ihre Unterstützung markieren und den Bearbeitungsstatus verfolgen. Die neue Roadmap enthält wieder genau 20 künftige Verbesserungen."
  ]
},
    {version:'2026.10.09.2',date:'09. Oktober 2026',title:'Profile, Claninfos, Galerie und Begleitmusik',items:[
      'Banner-Hintergründe im eigenen Clanprofil sind von 0 bis 100 % transparent einstellbar. Die Vorschau zeigt die Änderung sofort.',
      'Admins können Bilder in die Claninfos einsetzen, ihren Abschnitt, ihre Position, Breite und Stelle zwischen Textabsätzen wählen.',
      'Profilbilder und Charaktergalerien öffnen sich mit Bildzähler, sichtbaren Pfeilen, Tastatursteuerung und animiertem Bildwechsel. Auf dem Handy funktioniert auch Wischen.',
      'Spotify-Songs und Playlists verwenden einen steuerbaren Player mit einer speicherbaren Autostart-Auswahl für das jeweilige Gerät.',
      'Unter „Startseiten-Musik“ lässt sich ein Spotify-Song oder eine Playlist als sichtbare, pausierbare Begleitmusik für die Startseite hinterlegen.',
      'Patchnotes und eine neue Roadmap mit 20 geplanten Verbesserungen sind im Clanbereich erreichbar.'
    ]},
    {version:'Stand 09.10.2026, morgens',date:'09. Oktober 2026',title:'Schriften, Themes und Bildreaktionen',items:[
      'Getrennte Schriftarten, Größen, Farben und Effekte für Überschriften und Texte, einschließlich Altdeutsch/Fraktur.',
      'Profilbanner, sechs Charakter-Themes und eigene Themes mit geschützten Hintergrundbildern.',
      'Likes und Kommentare für freigegebene Profilbilder; öffentliche Bilder bieten Besuchern Likes.',
      'Eigene Bildtitel über Rechtsklick oder die ⋯-Schaltfläche und eine separate Großbildansicht.',
      'Spotify-Einbettungen, YouTube-Autoplay-Auswahl, austauschbares Clanwappen sowie überarbeitetes Speichern und Prüfen des Discord-Webhooks.'
    ]},
    {version:'Gesamtupdate vom 08.10.2026',date:'08. Oktober 2026',title:'Clanstart und RP-Organisation',items:[
      'Persönlicher Clanstart, mobile Bereichsauswahl, geschützte Suche und Hinweise.',
      'RP-Gesuche, Plotgruppen, Kommentare, Reaktionen, Charakterdossiers und bestätigte Beziehungen.',
      'Kalenderserien, Wartelisten, ICS-Export, Lagerbewegungen und gezielte Kalender- und Inhaltsrechte.',
      'Bearbeitbare Claninfos, Clanränge und Ämter sowie geprüfte Sicherungen und automatische Website-Tests.'
    ]}
  ];
  const el=(tag,classes='',text='')=>{const n=document.createElement(tag);n.className=classes;n.textContent=text;return n;};
  const roadmapList=()=>{const list=el('ol','roadmap-grid');for(const item of roadmap){const card=el('li','hub-card');card.dataset.roadmapStatus='planned';card.append(el('p','eyebrow','Punkt '+item.number+' · '+item.area),el('h3','',item.title),el('p','hub-body',item.body),el('p','field-note',item.status+' · '+item.priority));list.append(card);}return list;};
  const renderRoadmap=(host,ctx=null)=>{host.replaceChildren(el('p','field-note','Alle 20 Punkte sind Vorschläge für kommende Updates. Die Reihenfolge ist eine Orientierung und kein fester Veröffentlichungstermin.'),roadmapList());if(ctx)window.RabenCommunityPlus?.roadmapSupport(ctx,host.querySelector('ol')).catch(error=>ctx.report(error.message||Raben.errorMessage(error),true));};
  const patchnotes=ctx=>{for(const release of releases){const card=el('article','hub-card patchnote');card.append(el('p','eyebrow',release.date+' · '+release.version),el('h3','',release.title));const list=el('ul','patchnote-list');release.items.forEach(text=>list.append(el('li','',text)));card.append(list);if(release===releases[0])card.append(el('p','field-note',release.note||'Spotify-Autostart hängt von den Wiedergaberegeln deines Browsers ab. Der Player bleibt auch manuell bedienbar.'));ctx.list.append(card);}};
  if(window.RabenExpansion){Object.assign(RabenExpansion.labels,{patchnotes:'Patchnotes',futureRoadmap:'Neue Roadmap'});Object.assign(RabenExpansion.handlers,{patchnotes,futureRoadmap:ctx=>renderRoadmap(ctx.list,ctx)});}
  const publicHost=document.querySelector('[data-public-roadmap]');if(publicHost)renderRoadmap(publicHost);
  window.RabenUpdates={roadmapVersion:'20261015v2',roadmap,releases,renderRoadmap,patchnotes};
})();
