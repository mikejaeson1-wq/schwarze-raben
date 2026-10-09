(() => {
  'use strict';
  const roadmap=[
  [
    "Bearbeitung",
    "Änderungen während der Eingabe rückgängig machen",
    "Absätze und Feldänderungen noch vor dem Speichern schrittweise rückgängig machen und wiederholen.",
    "Als Nächstes"
  ],
  [
    "Profilgestaltung",
    "Bildfokus mit Maus und Touch verschieben",
    "Den Bannerfokus direkt am Bild ziehen und mehrere Ausschnitte für Handy und Desktop speichern.",
    "Als Nächstes"
  ],
  [
    "Galerie",
    "Mehrere Bilder gleichzeitig organisieren",
    "Bilder gemeinsam auswählen, in Alben verschieben und vor dem Entfernen eine Übersicht der Auswahl sehen.",
    "Als Nächstes"
  ],
  [
    "Barrierefreiheit",
    "Eigene Bildbeschreibungen ergänzen",
    "Für Bilder getrennte Alternativtexte pflegen, unabhängig von der sichtbaren Bildunterschrift.",
    "Als Nächstes"
  ],
  [
    "Bilder",
    "Vorschauqualität selbst wählen",
    "Zwischen sparsamen und detailreichen Vorschauen wechseln und die erwartete Dateigröße sehen.",
    "Danach"
  ],
  [
    "Themes",
    "Eigene Theme-Vorlagen gezielt importieren",
    "Exportierte eigene Vorlagen prüfen und einzelne Designs samt Bildern in das eigene Profil übernehmen.",
    "Danach"
  ],
  [
    "Zusammenarbeit",
    "Textkonflikte gemeinsam auflösen",
    "Bei gleichzeitigen Änderungen die Unterschiede markieren und Texte absatzweise zusammenführen.",
    "Als Nächstes"
  ],
  [
    "Mitbearbeitung",
    "Änderungsvorschläge mit Freigabe",
    "Mitbearbeiter können optional Vorschläge einreichen, die der Besitzer vor der Übernahme prüft.",
    "Danach"
  ],
  [
    "Terminfindung",
    "Eigene Zeitfenster vorschlagen",
    "Mitglieder ergänzen freie Zeiträume; die Terminfindung berechnet Überschneidungen auch ohne vorgegebene Kandidaten.",
    "Danach"
  ],
  [
    "Kalender",
    "Einzelne Serientermine verschieben",
    "Für einzelne Termine Datum, Uhrzeit oder Dauer ändern, ohne die gesamte Serie neu anzulegen.",
    "Als Nächstes"
  ],
  [
    "Reservierungen",
    "Aufbau- und Abbauzeiten berücksichtigen",
    "Zusätzliche Puffer vor und nach einer Buchung festlegen und bei Überschneidungen berücksichtigen.",
    "Danach"
  ],
  [
    "Geräte",
    "Geräte benennen und Zustellung prüfen",
    "Geräten eigene Namen geben und auf ausdrücklichen Wunsch eine Testbenachrichtigung auslösen.",
    "Als Nächstes"
  ],
  [
    "Kalender-Abos",
    "Ablaufdatum für Kalenderlinks",
    "Persönliche Abos zusätzlich zeitlich begrenzen und vor ihrem Ablauf auf Wunsch einen Hinweis erhalten.",
    "Danach"
  ],
  [
    "Geschichten",
    "Zeitleisten nach Themen filtern",
    "Ereignisse nach Typ, Zeitraum und Handlungsfaden filtern und einzelne Ansichten speichern.",
    "Danach"
  ],
  [
    "Karten",
    "Zoom und Touch-Gesten für alle Karten",
    "Welt- und Gebäudekarten vergrößern, mit zwei Fingern bewegen und zum Ausgangsausschnitt zurückkehren.",
    "Als Nächstes"
  ],
  [
    "Materialplanung",
    "Rezeptversionen und Verpackungseinheiten",
    "Materialvorlagen versionieren und Bedarf auf Bündel, Kisten oder andere Ausgabegrößen aufrunden.",
    "Später"
  ],
  [
    "Handel",
    "Handelsabschlüsse mit Lagerbuchungen verbinden",
    "Erfüllte Handelsanfragen optional mit geprüften Ein- oder Auslagerungen verknüpfen.",
    "Später"
  ],
  [
    "Discord",
    "Meldungen vor dem Versand gezielt freigeben",
    "Für ausgewählte Kategorien eine zusätzliche Prüfung der wartenden Meldung anbieten und den Versand einzeln pausieren.",
    "Danach"
  ],
  [
    "Bedienung",
    "Dialoge und Fokus auf kleinen Displays verbessern",
    "Lange Dialoge übersichtlicher gliedern, Tastaturfokus nach Teiländerungen erhalten und Touch-Ziele prüfen.",
    "Als Nächstes"
  ],
  [
    "Stabilität",
    "Verbindungsprobleme früher erkennen",
    "Lange Ladezeiten und fehlgeschlagene Vorgänge klar anzeigen und sichere Wiederholungen direkt anbieten.",
    "Als Nächstes"
  ]
].map(([area,title,body,priority],i)=>({number:i+1,area,title,body,priority,status:'Geplant'}));
  const releases=[
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
  const patchnotes=ctx=>{for(const release of releases){const card=el('article','hub-card patchnote');card.append(el('p','eyebrow',release.date+' · '+release.version),el('h3','',release.title));const list=el('ul','patchnote-list');release.items.forEach(text=>list.append(el('li','',text)));card.append(list);if(release===releases[0])card.append(el('p','field-note','Spotify-Autostart hängt von den Wiedergaberegeln deines Browsers ab. Der Player bleibt auch manuell bedienbar.'));ctx.list.append(card);}};
  if(window.RabenExpansion){Object.assign(RabenExpansion.labels,{patchnotes:'Patchnotes',futureRoadmap:'Neue Roadmap'});Object.assign(RabenExpansion.handlers,{patchnotes,futureRoadmap:ctx=>renderRoadmap(ctx.list,ctx)});}
  const publicHost=document.querySelector('[data-public-roadmap]');if(publicHost)renderRoadmap(publicHost);
  window.RabenUpdates={roadmapVersion:'20261009v3',roadmap,releases,renderRoadmap,patchnotes};
})();
