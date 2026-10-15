(() => {
  'use strict';
  const roadmap=[
  [
    "Bearbeitung",
    "Entwürfe mit offenen Bilduploads wieder aufnehmen",
    "Begonnene Bearbeitungen inklusive noch nicht zugeordneter Uploads gezielt fortsetzen und verwaiste Dateien leichter erkennen.",
    "Als Nächstes"
  ],
  [
    "Texte",
    "Sichere Markdown-Vorschau",
    "Formatierungen, Listen und Verweise schon während der Eingabe prüfen und einheitlich barrierearm darstellen.",
    "Danach"
  ],
  [
    "Privatchat",
    "Eigene Unterhaltungen durchsuchen",
    "Nachrichten im eigenen Gesprächsverlauf nach Suchwort und Zeitraum finden.",
    "Als Nächstes"
  ],
  [
    "Privatchat",
    "Nachrichten korrigieren und zurückziehen",
    "Eigene Nachrichten mit sichtbarem Bearbeitungshinweis ändern oder innerhalb einer festgelegten Frist zurückziehen.",
    "Als Nächstes"
  ],
  [
    "Privatchat",
    "Geschützte Anhänge senden",
    "Bilder und Dateien mit Größenanzeige, Prüfung und Zugriff ausschließlich für die Gesprächspartner teilen.",
    "Danach"
  ],
  [
    "Privatchat",
    "Gespräche archivieren und stummschalten",
    "Unterhaltungen für sich ordnen und Hinweise pro Kontakt einstellen.",
    "Danach"
  ],
  [
    "Hinweise",
    "Benachrichtigungen feiner einstellen",
    "Erwähnungen, Chats, Kalender und Projektmeldungen getrennt abonnieren und Ruhezeiten festlegen.",
    "Danach"
  ],
  [
    "Galerie",
    "Albumcover und gespeicherte Bildauswahlen",
    "Alben mit einem eigenen Titelbild versehen und wiederkehrende Mehrfachauswahlen speichern.",
    "Danach"
  ],
  [
    "Galerie",
    "Eigene Alben gesammelt exportieren",
    "Ausgewählte eigene Bilder mit Beschreibungen und Reihenfolge als überprüfbare Sicherung herunterladen.",
    "Danach"
  ],
  [
    "Barrierefreiheit",
    "Bildbeschreibungen gemeinsam prüfen",
    "Fehlende oder wenig aussagekräftige Alternativtexte übersichtlich anzeigen und gezielt verbessern.",
    "Als Nächstes"
  ],
  [
    "Themes",
    "Importierte Bilder platzsparend verwalten",
    "Doppelte Bilddateien beim Theme-Import erkennen und nur nach bewusster Auswahl zusammenführen.",
    "Später"
  ],
  [
    "Kalender",
    "Persönliche Anzeige-Zeitzone",
    "Termine auf Wunsch in einer eigenen Zeitzone sehen, während die gemeinsame Planung eindeutig bleibt.",
    "Danach"
  ],
  [
    "Kalender",
    "Auswirkungen von Serienänderungen vorab sehen",
    "Betroffene Teilnahmen, Erinnerungen und Reservierungen vor größeren Serienänderungen gemeinsam prüfen.",
    "Als Nächstes"
  ],
  [
    "Ressourcen",
    "Teilbare Kapazitäten reservieren",
    "Mehrere Einheiten derselben Ressource buchen und die verfügbare Restmenge pro Zeitraum anzeigen.",
    "Später"
  ],
  [
    "Terminfindung",
    "Mindestbesetzung und Spieldauer berücksichtigen",
    "Gemeinsame Zeitfenster nach benötigter Dauer, Teilnehmerzahl und gewünschten Personen filtern.",
    "Als Nächstes"
  ],
  [
    "Zusammenarbeit",
    "Einladungen zur Mitbearbeitung annehmen",
    "Mitbearbeitung zunächst als Einladung senden und erst nach Annahme aktivieren.",
    "Danach"
  ],
  [
    "Materialplanung",
    "Rezeptvarianten und Verschnitt berechnen",
    "Alternative Materialien, Reservebedarf und unterschiedliche Ausgabegrößen pro Bauvorhaben vergleichen.",
    "Später"
  ],
  [
    "Lager",
    "Persönliche Hinweise bei niedrigen Beständen",
    "Für ausgewählte Materialien Mindestmengen festlegen und bei Unterschreitung einen Clan-Hinweis erhalten.",
    "Danach"
  ],
  [
    "Discord",
    "Freigegebene Meldungen zeitlich planen",
    "Geprüfte Ankündigungen für einen gewünschten Zeitpunkt vormerken und bis dahin nachvollziehbar bearbeiten.",
    "Später"
  ],
  [
    "Stabilität",
    "Datensparsame Fehlerdiagnose zum Kopieren",
    "Bei Fehlern einen prüfbaren Diagnosebericht ohne Nachrichteninhalte, Zugangsdaten oder geheime Links erzeugen.",
    "Als Nächstes"
  ]
].map(([area,title,body,priority],i)=>({number:i+1,area,title,body,priority,status:'Geplant'}));
  const releases=[
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
  window.RabenUpdates={roadmapVersion:'20261015v1',roadmap,releases,renderRoadmap,patchnotes};
})();
