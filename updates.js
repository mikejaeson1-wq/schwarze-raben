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
  "version": "2026.10.15.3",
  "date": "15. Oktober 2026",
  "title": "Kurzanleitung, aktuelle Roadmap und Discord-Vorlagen",
  "extends": "2026.10.15.2",
  "items": [
    "Neue Kurzanleitung für Discord-Anmeldung, Freigabe, eigenes Clanprofil und mehrere Charaktere. Die Anleitung ist vor der Anmeldung und im Clanbereich erreichbar.",
    "Roadmap und Patchnotes lassen sich als formatierten Discord-Text kopieren. Lange Texte werden in nummerierte Teile aufgeteilt; jeder Teil hat eine eigene Kopier-Schaltfläche und eine prüfbare Textvorschau.",
    "Die aktuellen Patchnotes zum Kopieren enthalten auch das vollständige 20-Punkte-Update 2026.10.15.2. Ältere Versionen bleiben einzeln erreichbar.",
    "Die neue Roadmap enthält weiterhin genau 20 geplante Verbesserungen. Die herunterladbare Textfassung zeigt denselben aktuellen Stand wie die Website."
  ],
  "note": "Die Kopierfunktion überträgt den ausgewählten Text in deine Zwischenablage. Du fügst ihn selbst in Discord ein. Spotify-Lautstärke benötigt weiterhin die Einrichtung einer Spotify-App und eine persönliche Premium-Verbindung."
},
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
  const quickGuide=[
  {
    "title": "1 · Mit Discord anmelden",
    "steps": [
      "Öffne den Clanbereich und klicke auf „Mit Discord anmelden“.",
      "Melde dich mit deinem Discord-Konto an und bestätige die Anmeldung. Ein zusätzliches Website-Passwort brauchst du nicht.",
      "Die Clanführung muss deinen Zugang freigeben. Falls eine Bewerbung nötig ist, nutze „Mit Charakterkonzept bewerben“. Nach der Freigabe klicke auf „Status prüfen“ oder öffne den Clanbereich erneut."
    ]
  },
  {
    "title": "2 · Dein eigenes Profil erstellen",
    "steps": [
      "Öffne im Clanbereich „Clanprofile“ und klicke auf „Mein Profil erstellen“. Wenn dein Profil schon besteht, wähle „Mein Profil öffnen“.",
      "Gib deinen Kontonamen ein. Ein rundes Kontobild kannst du optional hochladen. Klicke anschließend auf „Profil erstellen“ bzw. „Konto speichern“.",
      "Öffne danach dein Profil. Über „Kontoname & Bild“ änderst du diese Angaben später; über „Banner gestalten“ passt du deinen Banner an."
    ]
  },
  {
    "title": "3 · Einen oder mehrere Charaktere anlegen",
    "steps": [
      "Öffne dein eigenes Profil. Klicke im Abschnitt „Charaktere“ auf „Charakter hinzufügen“.",
      "Trage den Charakternamen und deine Charakterinfos ein. Bild, zusätzliche Dossierfelder, Galerie und Theme kannst du bei Bedarf ergänzen.",
      "Wähle unter „Wer darf diesen Eintrag sehen?“: „Nur du“, „Ganzer Clan“ oder „Ausgewählte Mitglieder“. Klicke auf „Speichern“.",
      "Für jeden weiteren Charakter wiederholst du „Charakter hinzufügen“. Vorhandene Charaktere änderst du über „Bearbeiten“."
    ]
  },
  {
    "title": "Wer sieht was?",
    "steps": [
      "Dein Kontoname und dein rundes Kontobild sind für aktive Clanmitglieder sichtbar.",
      "Neue Charaktere und Infokarten sind zunächst nur für dich sichtbar. „Ganzer Clan“ bedeutet alle freigegebenen Clanmitglieder. „Ausgewählte Mitglieder“ bedeutet nur die von dir ausgewählten Personen.",
      "Eigene Zusatzinfos, etwa Spielzeiten oder RP-Vorlieben, legst du in deinem Profil über „Infokarte hinzufügen“ an."
    ]
  }
];
  const el=(tag,classes='',text='')=>{const n=document.createElement(tag);n.className=classes;n.textContent=text;return n;};
  const discordText=value=>String(value??'').replace(/@/g,'@\u200b').replace(/\r/g,'');
  // Keep each copied message below the normal Discord message size, including its heading.
  const splitDiscord=(title,blocks,limit=1900)=>{
    if(!Number.isInteger(limit)||limit<160)throw new Error('invalid_discord_limit');
    const safeTitle=discordText(title).slice(0,100),budget=limit-safeTitle.length-55,parts=[];let current='';
    const flush=()=>{if(current.trim())parts.push(current.trim());current='';};
    for(const raw of blocks){let block=discordText(raw).trim();if(!block)continue;
      if(block.length>budget){flush();while(block.length>budget){let end=block.lastIndexOf('\n',budget);if(end<budget/2)end=block.lastIndexOf(' ',budget);if(end<budget/2)end=budget;if(/[\uD800-\uDBFF]/.test(block[end-1]||''))end--;parts.push(block.slice(0,end).trim());block=block.slice(end).trim();}}
      if(current&&current.length+block.length+2>budget)flush();current+=(current?'\n\n':'')+block;
    }flush();return parts.map((body,index)=>'## '+safeTitle+(parts.length>1?' · Teil '+(index+1)+'/'+parts.length:'')+'\n\n'+body);
  };
  const roadmapDiscord=()=>splitDiscord('🐦‍⬛ Schwarze Raben · Neue Roadmap',[
    '**20 kommende Verbesserungen**\nAlle Punkte sind geplant. Die Reihenfolge ist eine Orientierung und kein fester Veröffentlichungstermin.',
    ...roadmap.map(p=>'**'+p.number+' · '+p.title+'**\n'+p.body+'\n*'+p.area+' · '+p.status+' · '+p.priority+'*')
  ]);
  const releaseBundle=release=>{const result=[],seen=new Set();let current=release;while(current&&!seen.has(current.version)){seen.add(current.version);result.push(current);current=releases.find(r=>r.version===current.extends);}return result;};
  const patchnoteBlocks=release=>{
    const blocks=['**'+release.date+' · Version '+release.version+'**\n'+release.title];
    if(release.version==='2026.10.15.2'){
      const groups=[['💬 Privatchat & Benachrichtigungen',[1,4,5,6,7,8]],['🖼️ Profile, Texte & Galerie',[2,3,9,10,11,12]],['📅 Kalender & Zusammenarbeit',[13,14,15,16,17]],['📦 Material, Lager & Discord',[18,19,20]],['🛠️ Stabilität & Musik',[0,21,22]]];
      for(const [title,indices] of groups){indices.forEach((index,n)=>{const item=release.items[index];if(item)blocks.push((n===0?'**'+title+'**\n':'')+'- '+item.replace(/^Punkt \d+ · /,''));});}
    }else for(const item of release.items)blocks.push('- '+item);
    if(release.note)blocks.push('*Hinweis:* '+release.note);return blocks;
  };
  const patchnotesDiscord=(release=releases[0],complete=true)=>splitDiscord('🐦‍⬛ Schwarze Raben · Patchnotes',(complete?releaseBundle(release):[release]).flatMap(patchnoteBlocks));
  const guideDiscord=()=>splitDiscord('🐦‍⬛ Schwarze Raben · Kurzanleitung',['**Clanbereich:** <'+new URL('clan.html',window.Raben?.config?.siteUrl||location.href).href+'>',...quickGuide.map(section=>'**'+section.title+'**\n'+section.steps.map((step,index)=>(index+1)+'. '+step).join('\n'))]);
  const copyPanel=(title,parts)=>{
    const area=el('details','discord-copy-panel'),summary=el('summary','',title+' für Discord kopieren'),intro=el('p','field-note','Die Überschriften und Hervorhebungen sind für Discord vorbereitet. Kopiere die Teile nacheinander und füge jeden als eigene Nachricht ein.'),status=el('p','field-note');status.setAttribute('role','status');status.setAttribute('aria-live','polite');area.dataset.noMarkdown='';area.append(summary,intro,status);
    parts.forEach((part,index)=>{const row=el('section','discord-copy-part'),heading=el('h4','',parts.length>1?'Teil '+(index+1)+' von '+parts.length:'Vollständiger Text'),actions=el('div','hub-inline-actions'),copy=el('button','button outline small-button','Teil '+(index+1)+' kopieren'),show=el('details','discord-text-preview'),label=el('label','form-field','Discord-Text · '+part.length+' Zeichen'),input=el('textarea','discord-copy-text'),select=el('button','button outline small-button','Text markieren');copy.type=select.type='button';input.value=part;input.readOnly=true;input.rows=9;input.spellcheck=false;input.setAttribute('aria-label',title+' · Teil '+(index+1));label.append(input);show.append(el('summary','','Text ansehen / manuell kopieren'),label,select);actions.append(copy);row.append(heading,actions,show);area.append(row);
      const mark=()=>{show.open=true;input.focus();input.select?.();input.setSelectionRange?.(0,input.value.length);};select.addEventListener('click',mark);
      const copied=()=>{status.textContent='Teil '+(index+1)+' von '+parts.length+' kopiert. Jetzt in Discord einfügen.';};
      const manual=()=>{mark();status.textContent='Automatisches Kopieren ist hier nicht verfügbar. Der Text ist markiert: Drücke Strg+C oder nutze auf dem Handy „Kopieren“.';};
      copy.addEventListener('click',()=>{try{if(!navigator.clipboard?.writeText){manual();return;}const result=navigator.clipboard.writeText(part);Promise.resolve(result).then(copied,manual);}catch(_){manual();}});
    });return area;
  };
  const roadmapList=()=>{const list=el('ol','roadmap-grid');for(const item of roadmap){const card=el('li','hub-card');card.dataset.roadmapStatus='planned';card.append(el('p','eyebrow','Punkt '+item.number+' · '+item.area),el('h3','',item.title),el('p','hub-body',item.body),el('p','field-note',item.status+' · '+item.priority));list.append(card);}return list;};
  const renderRoadmap=(host,ctx=null)=>{host.replaceChildren(el('p','field-note','Alle 20 Punkte sind Vorschläge für kommende Updates. Die Reihenfolge ist eine Orientierung und kein fester Veröffentlichungstermin.'),copyPanel('Neue Roadmap',roadmapDiscord()),roadmapList());if(ctx)window.RabenCommunityPlus?.roadmapSupport(ctx,host.querySelector('ol')).catch(error=>ctx.report(error.message||Raben.errorMessage(error),true));};
  const patchnotes=ctx=>{ctx.list.append(el('p','field-note','Aktueller Stand: '+releases[0].version+'. Die Discord-Vorlage enthält auch das vollständige 20-Punkte-Update '+releases[0].extends+'.'),copyPanel('Aktuelle Patchnotes',patchnotesDiscord()));for(const release of releases){const card=el('article','hub-card patchnote');card.append(el('p','eyebrow',release.date+' · '+release.version),el('h3','',release.title));const list=el('ul','patchnote-list');release.items.forEach(text=>list.append(el('li','',text)));card.append(list);if(release.note)card.append(el('p','field-note',release.note));if(release!==releases[0])card.append(copyPanel('Nur Version '+release.version,patchnotesDiscord(release,false)));ctx.list.append(card);}};
  const renderQuickGuide=host=>{host.replaceChildren(el('p','field-note','In wenigen Schritten zu deinem Clanprofil. Du meldest dich mit Discord an; den Clan-Zugang gibt die Clanführung frei.'),copyPanel('Kurzanleitung',guideDiscord()));for(const section of quickGuide){const card=el('article','hub-card quick-guide-card'),list=el('ol','quick-guide-steps');card.append(el('h3','',section.title));for(const step of section.steps)list.append(el('li','',step));card.append(list);host.append(card);}const actions=el('div','hub-inline-actions');for(const [label,path] of [['Zum Clanbereich','clan.html'],['Bewerbung öffnen','bewerben.html']]){const a=el('a','button outline',label);a.href=new URL(path,window.Raben?.config?.siteUrl||location.href).href;actions.append(a);}host.append(actions);};
  if(window.RabenExpansion){Object.assign(RabenExpansion.labels,{patchnotes:'Patchnotes',futureRoadmap:'Neue Roadmap',quickGuide:'Kurzanleitung'});Object.assign(RabenExpansion.handlers,{patchnotes,futureRoadmap:ctx=>renderRoadmap(ctx.list,ctx),quickGuide:ctx=>renderQuickGuide(ctx.list)});}
  const publicHost=document.querySelector('[data-public-roadmap]');if(publicHost)renderRoadmap(publicHost);const guideHost=document.querySelector('[data-quick-guide]');if(guideHost)renderQuickGuide(guideHost);
  window.RabenUpdates={roadmapVersion:'20261015v2',roadmap,releases,quickGuide,renderRoadmap,patchnotes,renderQuickGuide,splitDiscord,roadmapDiscord,patchnotesDiscord,guideDiscord,copyPanel};
})();
