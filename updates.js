(() => {
  'use strict';
  const roadmap=[
    ['Profilgestaltung','Banner zuschneiden und Bildfokus wählen','Bannerhöhe, Ausschnitt und sichtbaren Bildmittelpunkt direkt in einer Vorschau einstellen.','Als Nächstes'],
    ['Claninfos','Bilder und Text per Drag-and-drop anordnen','Absätze und Bilder verschieben, Bildabstände einstellen und mehrspaltige Vorlagen für längere Claninfos nutzen.','Als Nächstes'],
    ['Galerie','Eigene Alben und Bildreihenfolgen','Charakterbilder in benannte Alben ordnen und ihre Reihenfolge per Drag-and-drop ändern.','Als Nächstes'],
    ['Galerie','Diashow und Vollbildmodus','Freigegebene Bilder mit einstellbarem Zeitabstand als Diashow zeigen; Vollbild und Animation separat steuern.','Als Nächstes'],
    ['Profile','Eigene Themes als Vorlagen speichern','Persönliche Gestaltungen speichern, duplizieren und gezielt für weitere Charaktere übernehmen.','Als Nächstes'],
    ['Bearbeitung','Private Entwürfe automatisch sichern','Ungespeicherte Texte geschützt zwischenspeichern und nach einem Verbindungsabbruch auf dem eigenen Konto wieder aufnehmen.','Als Nächstes'],
    ['Profile','Eigene Profilversionen und Rückgängig','Frühere Fassungen eigener Charaktere und Infokarten vergleichen und wiederherstellen; die bisherigen Freigaben bleiben geschützt.','Danach'],
    ['Zusammenarbeit','Gezielte Mitbearbeitung von Einträgen','Ausgewählten Mitgliedern Bearbeitungsrechte für einen konkreten Eintrag geben, ohne ihnen allgemeine Adminrechte zu gewähren.','Danach'],
    ['Kalender','Gemeinsame Terminfindung','Verfügbare Spielzeiten für einen RP-Abend sammeln und die Überschneidungen übersichtlich anzeigen.','Danach'],
    ['Kalender','Abonnierbare Kalender mit Widerruf','Zusätzlich zum ICS-Export persönliche Kalenderfeeds anbieten, deren Zugang sich jederzeit wieder entziehen lässt.','Danach'],
    ['Hinweise','Erinnerungen je RP-Termin','Eigene Vorlaufzeiten für ausgewählte Termine festlegen und auf Wunsch Gerätebenachrichtigungen erhalten.','Danach'],
    ['Organisation','Orte und Ressourcen reservieren','Für Termine Spielorte oder gemeinsame Ressourcen buchen und zeitliche Überschneidungen erkennen.','Danach'],
    ['Geschichten','Persönliche Charakter-Zeitleisten','Freigegebene Tagebucheinträge, Plots und Ereignisse in einer Zeitleiste des jeweiligen Charakters zusammenführen.','Danach'],
    ['Dorfplan','Mehrere Karten und Kartenebenen','Zwischen Weltkarte, Dorfplan und Gebäudeansichten wechseln; Orte nach Themen ein- und ausblenden.','Später'],
    ['Lager','Rezepte und Materialplanung','Materiallisten für wiederkehrende Bauvorhaben als Vorlagen speichern und benötigte Mengen berechnen.','Später'],
    ['Handel','Angebote, Gesuche und Abschlussstatus','Handelseinträge um Mengen, Tauschbedingungen, Anfragen und einen nachvollziehbaren Abschluss erweitern.','Später'],
    ['Discord','Meldungsvorschau und mehrere Kanäle','Ankündigungen vor dem Versand ansehen und unterschiedliche Kategorien gezielt an ausgewählte Clan-Kanäle senden.','Später'],
    ['Mobil','Schnellere Seiten und Ladeanzeigen','Große Listen schrittweise laden, Bildvorschauen nach Bedarf nachladen und laufende Vorgänge auf kleinen Displays klarer anzeigen.','Als Nächstes'],
    ['Bedienung','Kontrast- und Tastaturprüfung','Gespeicherte Themefarben auf Lesbarkeit prüfen und Formularfehler, Fokusführung und Screenreader-Beschriftungen verbessern.','Als Nächstes'],
    ['Weiterentwicklung','Featurewünsche und Fehlerberichte','Im Clan Vorschläge einreichen, unterstützte Roadmap-Punkte markieren und Fehler mit einem sichtbaren Bearbeitungsstatus verfolgen.','Als Nächstes']
  ].map(([area,title,body,priority],i)=>({number:i+1,area,title,body,priority,status:'Geplant'}));
  const releases=[
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
  const renderRoadmap=host=>{host.replaceChildren(el('p','field-note','Alle 20 Punkte sind Vorschläge für kommende Updates. Die Reihenfolge ist eine Orientierung und kein fester Veröffentlichungstermin.'),roadmapList());};
  const patchnotes=ctx=>{for(const release of releases){const card=el('article','hub-card patchnote');card.append(el('p','eyebrow',release.date+' · '+release.version),el('h3','',release.title));const list=el('ul','patchnote-list');release.items.forEach(text=>list.append(el('li','',text)));card.append(list);if(release===releases[0])card.append(el('p','field-note','Spotify-Autostart hängt von den Wiedergaberegeln deines Browsers ab. Der Player bleibt auch manuell bedienbar.'));ctx.list.append(card);}};
  if(window.RabenExpansion){Object.assign(RabenExpansion.labels,{patchnotes:'Patchnotes',futureRoadmap:'Neue Roadmap'});Object.assign(RabenExpansion.handlers,{patchnotes,futureRoadmap:ctx=>renderRoadmap(ctx.list)});}
  const publicHost=document.querySelector('[data-public-roadmap]');if(publicHost)renderRoadmap(publicHost);
  window.RabenUpdates={roadmap,releases,renderRoadmap,patchnotes};
})();
