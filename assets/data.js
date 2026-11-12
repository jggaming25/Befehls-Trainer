/* ==========================================================================
   Befehlstrainer – Daten
   Befehlskatalog und Übungssituationen nach dem Muster des Digitalen Befehls
   (DVN FIS). Die Platzhalter x.xx entsprechen den Feldern des Befehlsvordrucks.
   ========================================================================== */

const SIGNALS = [
  "Esig 60A",
  "Esig 70A",
  "Esig 80A",
  "Esig 90A",
  "ASig 62B",
  "ASig 72B",
  "ASig 82B",
  "ASig 92B",
  "Bksig 48",
  "EOA 12,4",
  "Signal Ne 1",
];

const STATIONS = ["Musterstadt", "Talheim", "Nordheim", "Südheim"];

const BFT = [
  "Bft Musterstadt Nord",
  "Bft Talheim Süd",
  "Bft Nordheim West",
  "Bft Südheim Ost",
];

const BUES = ["BÜ km 8,7", "BÜ km 12,4", "BÜ km 15,1", "BÜ km 21,6"];

const KMS = ["km 8,7", "km 12,4", "km 15,1", "km 21,6", "km 27,3"];

const DIRECTIONS = [
  "Richtung Musterstadt",
  "Richtung Talheim",
  "Richtung Nordheim",
  "Richtung Südheim",
];

const TRACKS = ["Gleis 1", "Gleis 2", "Gleis 3"];

const SPEEDS = [
  "20 km/h",
  "30 km/h",
  "40 km/h",
  "50 km/h",
  "60 km/h",
  "80 km/h",
  "100 km/h",
];

const REASONS = [
  "10 – Gleis kann besetzt sein",
  "11 – Personen im Gleis",
  "17 – Auf der Strecke ruht die Arbeit",
  "19 – Bahnübergang nicht ausreichend gesichert",
  "22 – Bauarbeiten",
  "23 – Unbefahrbare Stelle im gesperrten Gleis",
  "25 – Arbeitsstelle nicht benachrichtigt",
  "26 – Niedrigere Geschwindigkeit gegenüber La",
  "29 – Mängel am Oberbau",
  "30 – Verdacht auf Oberleitungsschäden",
  "31 – Verdacht auf Unwetterschäden",
  "33 – PZB-Streckeneinrichtung gestört",
  "34 – Weichen außer Abhängigkeit",
];

/* --------------------------------------------------------------------------
   Befehlskatalog
   fields:    Eingabefelder des Befehls (Auswahlfelder)
   measures:  zusätzliche Anweisungen / anzukreuzende Maßnahmen
   -------------------------------------------------------------------------- */
const COMMANDS = [
  {
    nr: "1",
    title: "Vorbeifahrt am EOA / am Signal",
    short: "Vorbeifahrt am Signal",
    description:
      "Genehmigung, an einem Halt zeigenden oder gestörten Signal bzw. an einem EOA vorbeizufahren.",
    template:
      "110 darf am Halt zeigenden / gestörten Signal (111) in (112) vorbeifahren. 113 darf zusätzlich an allen Signalen bis (114) vorbeifahren.",
    fields: [
      { id: "signal", label: "111 Signal / EOA", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "stelle", label: "112 Zugmeldestelle", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
      { id: "bis", label: "114 bis Signal", options: SIGNALS, placeholder: "Signal wählen" },
    ],
    measures: [
      { id: "sicht", label: "×25 – ist vom Fahren auf Sicht befreit" },
    ],
  },
  {
    nr: "2",
    title: "Weiterfahren nach TR / nach Vorbeifahrt",
    short: "Weiterfahren nach TR",
    description:
      "Weiterfahrt nach einer ETCS-Zwangsbremsung (TR) oder nach einer Vorbeifahrt an einer Halt gebietenden Stelle.",
    template:
      "2.10 darf in SR weiterfahren, wenn keine ETCS-Fahrterlaubnis empfangen wurde. ×25 ist vom Fahren auf Sicht befreit.",
    fields: [
      {
        id: "mode",
        label: "Weiterfahren nach",
        options: ["TR – Zwangsbremsung", "Vorbeifahrt am Signal"],
        placeholder: "Anlass wählen",
      },
    ],
    measures: [
      { id: "sr", label: "in SR weiterfahren, wenn keine ETCS-Fahrterlaubnis empfangen wurde" },
      { id: "sicht", label: "×25 – ist vom Fahren auf Sicht befreit" },
    ],
  },
  {
    nr: "3",
    title: "Verbleiben im Stillstand",
    short: "Verbleiben im Stillstand",
    description:
      "Der Zug muss an der aktuellen Stelle stehen bleiben; vorhandene ETCS-Fahrterlaubnis wird gelöscht.",
    template:
      "3.10 Verbleiben im Stillstand. 3.15 „Fahrt beenden“ durchführen. 3.20 Vorhandene ETCS-Fahrterlaubnis löschen.",
    fields: [
      { id: "ort", label: "Standort", options: STATIONS, placeholder: "Standort wählen" },
    ],
    measures: [
      { id: "fahrtBeenden", label: "„Fahrt beenden“ durchführen" },
      { id: "maLoeschen", label: "Vorhandene ETCS-Fahrterlaubnis löschen" },
    ],
  },
  {
    nr: "5",
    title: "Fahren mit Geschwindigkeitsbegrenzung",
    short: "Geschwindigkeitsbegrenzung",
    description:
      "Fahrt mit einer angeordneten Höchstgeschwindigkeit zwischen zwei Signalen bzw. Zugmeldestellen.",
    template:
      "x.41 Geschwindigkeitsbegrenzung x.42 km/h zwischen/in x.47 von x.43 bis x.48 – Grund x.96.",
    fields: [
      { id: "speed", label: "x.42 Höchstgeschwindigkeit", options: SPEEDS, placeholder: "km/h wählen" },
      { id: "von", label: "x.47 Von (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "bis", label: "x.48 Bis (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "grund", label: "x.96 Grund", options: REASONS, placeholder: "Grund wählen" },
    ],
    measures: [],
  },
  {
    nr: "6",
    title: "Fahren nach Sicht",
    short: "Fahren nach Sicht",
    description:
      "Der Triebfahrzeugführer muss den folgenden Abschnitt auf Sicht befahren und die Strecke prüfen.",
    template:
      "6.40 Fahren auf Sicht von x.47 bis x.48. x.90 Strecke aus folgendem Grund prüfen: x.91.",
    fields: [
      { id: "von", label: "x.47 Von (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "bis", label: "x.48 Bis (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "grund", label: "x.91 Grund", options: REASONS, placeholder: "Grund wählen" },
    ],
    measures: [],
  },
  {
    nr: "7",
    title: "Start in SR",
    short: "Start in SR",
    description:
      "Genehmigung, nach dem Vorbereiten einer Fahrt in der ETCS-Betriebsart SR zu starten.",
    template:
      "7.10 darf in SR starten. 7.20 darf vorbeifahren am EOA / Signal (7.21). ×25 ist vom Fahren auf Sicht befreit.",
    fields: [
      { id: "eoa", label: "7.21 Signal / EOA", options: SIGNALS, placeholder: "Signal / EOA wählen" },
    ],
    measures: [
      { id: "sicht", label: "×25 – ist vom Fahren auf Sicht befreit" },
    ],
  },
  {
    nr: "8",
    title: "BÜ sichern",
    short: "BÜ sichern",
    description:
      "Anweisung, einen Bahnübergang zu sichern und gegebenenfalls davor zu halten.",
    template:
      "8.40 Information über einen oder mehrere defekte Bahnübergänge. 8.50 muss halten vor BÜ und darf weiterfahren, wenn BÜ gesichert ist.",
    fields: [
      {
        id: "bue",
        label: "8.51 Bahnübergang",
        options: BUES,
        placeholder: "Bahnübergang wählen",
      },
      { id: "speed", label: "x.42 Höchstgeschwindigkeit", options: SPEEDS, placeholder: "km/h wählen" },
    ],
    measures: [
      { id: "sichern", label: "8.50 – halten vor BÜ und weiterfahren, wenn BÜ gesichert ist" },
    ],
  },
  {
    nr: "9",
    title: "Fahren mit eingeschränkter Fahrstromversorgung",
    short: "Eingeschränkter Fahrstrom",
    description:
      "Fahrt in einem Abschnitt mit eingeschränkter Fahrstromversorgung, z. B. mit gesenktem Stromabnehmer.",
    template:
      "9.40 Eingeschränkte Fahrstromversorgung zwischen x.47 und x.48. 9.70 Fahren mit gesenktem Stromabnehmer.",
    fields: [
      { id: "von", label: "x.47 Von (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
      { id: "bis", label: "x.48 Bis (Signal)", options: SIGNALS, placeholder: "Signal wählen" },
    ],
    measures: [
      { id: "pantograph", label: "9.70 – Fahren mit gesenktem Stromabnehmer" },
      { id: "hauptschalter", label: "9.75 – Fahren mit ausgeschaltetem Hauptschalter" },
    ],
  },
  {
    nr: "21",
    title: "Einfahrt / Weiterfahrt",
    short: "Einfahrt / Weiterfahrt",
    description:
      "Einfahrt in einen Bahnhof, Bahnhofsteil, Abzweig oder eine Überleitstelle bzw. Weiterfahrt dort.",
    template:
      "21.10 darf in/auf der 21.11 einfahren / weiterfahren.",
    fields: [
      { id: "stelle", label: "21.11 Zugmeldestelle", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
      {
        id: "gleis",
        label: "21.12 Gleis",
        options: TRACKS,
        placeholder: "Gleis wählen",
      },
      {
        id: "art",
        label: "21.13 Fahrt",
        options: ["einfahren", "weiterfahren"],
        placeholder: "Art wählen",
      },
    ],
    measures: [],
  },
  {
    nr: "22",
    title: "Ausfahrt aus dem Bf / Bft",
    short: "Ausfahrt aus dem Bf / Bft",
    description:
      "Genehmigung zur Ausfahrt aus einem Bahnhof oder Bahnhofsteil, wenn kein Hauptsignal die Ausfahrt zulässt.",
    template: "22.10 darf aus dem 22.11 Bf / 22.12 Bft ausfahren.",
    fields: [
      {
        id: "bf",
        label: "22.11 Bf / Bft",
        options: [...BFT, ...STATIONS.map((s) => `Bf ${s}`)],
        placeholder: "Bahnhof / Bahnhofsteil wählen",
      },
      {
        id: "richtung",
        label: "Ausfahrt Richtung",
        options: DIRECTIONS,
        placeholder: "Richtung wählen",
      },
    ],
    measures: [],
  },
  {
    nr: "23",
    title: "Fahren auf dem Gegengleis",
    short: "Fahren auf dem Gegengleis",
    description:
      "Genehmigung, einen Streckenabschnitt auf dem Gegengleis zu befahren.",
    template: "23.10 fährt auf dem Gegengleis von 23.11 bis 23.12.",
    fields: [
      { id: "von", label: "23.11 Von (Zugmeldestelle)", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
      { id: "bis", label: "23.12 Bis (Zugmeldestelle)", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
    ],
    measures: [],
  },
  {
    nr: "24",
    title: "Rückfahrende Fahrten",
    short: "Rückfahrende Fahrten",
    description:
      "Anweisung für Sperrfahrten oder nicht gekuppelte Schiebetriebfahrzeuge, die zurückkehren.",
    template:
      "24.11 fährt / schiebt nach 24.12 und kehrt zurück 24.15 / 24.16.",
    fields: [
      { id: "stelle", label: "24.12 Zugmeldestelle", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
      { id: "km", label: "24.15 km", options: KMS, placeholder: "km wählen" },
    ],
    measures: [],
  },
  {
    nr: "25",
    title: "Weiterfahren sowie Ein- und Ausfahren vom Gegengleis",
    short: "Weiterfahren vom Gegengleis",
    description:
      "Weiterfahrt vom Gegengleis bzw. Ein- und Ausfahrt in einen Bahnhof vom Gegengleis.",
    template:
      "25.30 darf vom Gegengleis ab 25.31 km in den 25.32 Bf / 25.33 Bft ein- und ausfahren.",
    fields: [
      {
        id: "ab",
        label: "25.31 ab km",
        options: KMS,
        placeholder: "km wählen",
      },
      {
        id: "ziel",
        label: "25.32 Bf / 25.33 Bft",
        options: BFT,
        placeholder: "Ziel wählen",
      },
    ],
    measures: [],
  },
  {
    nr: "26",
    title: "Halten auf dem Gegengleis",
    short: "Halten auf dem Gegengleis",
    description:
      "Der Zug muss auf dem Gegengleis vor einem Signal Ne 1 oder in Höhe eines Signals halten.",
    template:
      "26.10 muss auf dem Gegengleis halten vor Signal Ne 1 / in Höhe des 26.13 Signals.",
    fields: [
      {
        id: "ort",
        label: "Halteort",
        options: ["vor Signal Ne 1", "in Höhe des Esig 70A", "in Höhe des ASig 62B"],
        placeholder: "Halteort wählen",
      },
      { id: "km", label: "26.14 km", options: KMS, placeholder: "km wählen" },
    ],
    measures: [],
  },
  {
    nr: "27",
    title: "LZB abschalten",
    short: "LZB abschalten",
    description:
      "Anweisung, die LZB in einem bestimmten Abschnitt abzuschalten.",
    template: "27.10 muss die LZB von 27.11 bis 27.12 abschalten.",
    fields: [
      { id: "von", label: "27.11 Von (Zugmeldestelle)", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
      { id: "bis", label: "27.12 Bis (Zugmeldestelle)", options: STATIONS, placeholder: "Zugmeldestelle wählen" },
    ],
    measures: [],
  },
  {
    nr: "28",
    title: "ETCS-Stufe / ETCS-Betriebsmodus wechseln",
    short: "ETCS-Stufe wechseln",
    description:
      "Anweisung, einen bestimmten ETCS-Level bzw. eine bestimmte ETCS-Betriebsart zu wählen.",
    template:
      "28.10 muss ETCS-Level 28.11 wählen. 28.20 muss ETCS-Betriebsart 28.21 wählen.",
    fields: [
      {
        id: "level",
        label: "28.11 ETCS-Level",
        options: ["ETCS Level 1", "ETCS Level 2", "ETCS Level 3"],
        placeholder: "Level wählen",
      },
      {
        id: "mode",
        label: "28.21 ETCS-Betriebsart",
        options: ["Betriebsart SR", "Betriebsart OS", "Betriebsart FS", "Betriebsart TR"],
        placeholder: "Betriebsart wählen",
      },
    ],
    measures: [],
  },
];

/* --------------------------------------------------------------------------
   Übungssituationen
   command:      richtiger Befehl
   fieldPoints:  richtige Angaben und ihre Bewertung
   measurePoints:richtige Zusatzmaßnahmen (Punkte, falsche Auswahl kostet 1 P.)
   -------------------------------------------------------------------------- */
const SCENARIOS = [
  {
    id: "s1",
    command: "1",
    title: "Halt zeigendes Einfahrsignal",
    subtitle: "Bf Musterstadt · Esig 60A",
    train: "RE 4711",
    time: "08:12",
    facts: ["Hp0 am Esig 60A", "Signalstörung bestätigt", "Block bis ASig 62B geprüft"],
    situation:
      "Der Regionalexpress RE 4711 steht vor dem Einfahrsignal 60A des Bahnhofs Musterstadt. Das Signal zeigt Hp0; die Signalstörung ist durch den Fahrdienstleiter bestätigt. Der Block bis zum Ausfahrsignal 62B wurde geprüft und ist frei. Der Fahrdienstleiter erteilt die Vorbeifahrt und befreit den Triebfahrzeugführer vom Fahren auf Sicht.",
    task:
      "Stelle den passenden Befehl aus: Vorbeifahrt am Halt zeigenden Signal 60A, Weiterfahrt bis zum Ausfahrsignal 62B, Befreiung vom Fahren auf Sicht.",
    fieldPoints: {
      signal: { correct: "Esig 60A", points: 2 },
      stelle: { correct: "Musterstadt", points: 1 },
      bis: { correct: "ASig 62B", points: 1 },
    },
    measurePoints: {
      sicht: { correct: true, points: 2 },
    },
    explanation:
      "Ein Halt zeigendes oder gestörtes Signal wird mit Befehl 1 überfahren. Signal und Zugmeldestelle müssen eindeutig benannt werden. Die Befreiung vom Fahren auf Sicht (×25) darf nur angekreuzt werden, wenn der Block nachweislich frei ist – hier ist das der Fall.",
    scene: {
      track: "single",
      train: { x: 250, label: "RE 4711", dir: 1 },
      signals: [
        { x: 590, label: "60A", aspect: "halt", km: "km 8,2", name: "Esig 60A" },
        { x: 865, label: "62B", aspect: "langsam", km: "km 8,9", name: "ASig 62B" },
      ],
      platform: { x: 770, name: "Musterstadt" },
      callouts: [
        { x: 78, y: 62, text: "Esig 60A zeigt Hp0", sub: "Halt · Signalstörung bestätigt", tone: "red", to: [590, 250] },
        { x: 690, y: 150, text: "Weiterfahrt bis 62B", sub: "Block geprüft und frei", tone: "green", to: [865, 280] },
      ],
      badge: "Befehlsstelle Musterstadt · 08:12",
    },
  },
  {
    id: "s2",
    command: "5",
    title: "Geschwindigkeitsbegrenzung nach Oberbaumangel",
    subtitle: "Musterstadt – Talheim",
    train: "IC 2045",
    time: "09:40",
    facts: ["Oberbaumangel", "50 km/h", "Esig 60A bis Esig 70A"],
    situation:
      "Zwischen dem Einfahrsignal 60A in Musterstadt und dem Einfahrsignal 70A in Talheim wurde bei einer Streckenprüfung ein Oberbaumangel festgestellt. Der Fahrdienstleiter ordnet für den Abschnitt eine Höchstgeschwindigkeit von 50 km/h an. Langsamfahrsignale sind nicht aufgestellt; die Einschränkung gilt bis zum Esig 70A.",
    task:
      "Stelle den Befehl mit Höchstgeschwindigkeit, Gültigkeitsbereich und Grund aus.",
    fieldPoints: {
      speed: { correct: "50 km/h", points: 2 },
      von: { correct: "Esig 60A", points: 1 },
      bis: { correct: "Esig 70A", points: 1 },
      grund: { correct: "29 – Mängel am Oberbau", points: 2 },
    },
    measurePoints: {},
    explanation:
      "Mit Befehl 5 wird eine Geschwindigkeitsbegrenzung angeordnet. Entscheidend sind der genaue Gültigkeitsbereich (von Signal 60A bis Signal 70A) und der Grund nach dem Grundkatalog – hier Nummer 29 „Mängel am Oberbau“.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 205, label: "IC 2045", dir: 1 },
      signals: [
        { x: 120, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 845, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      speedBoard: { x: 500, speed: "50" },
      callouts: [
        { x: 320, y: 68, text: "Höchstgeschwindigkeit 50 km/h", sub: "Grund 29 · Mängel am Oberbau", tone: "amber", to: [500, 268] },
        { x: 640, y: 176, text: "Gültig bis Esig 70A", sub: "Talheim · km 14,8", tone: "blue", to: [845, 300] },
      ],
      badge: "Streckenprüfung · Oberbaumangel",
    },
  },
  {
    id: "s3",
    command: "6",
    title: "Personen im Gleis",
    subtitle: "Freie Strecke Musterstadt – Talheim",
    train: "RB 3388",
    time: "10:05",
    facts: ["Personen im Gleis", "Sichtweite unter 50 m", "Esig 60A bis Esig 70A"],
    situation:
      "Zwischen Musterstadt und Talheim wurden Personen im Gleis gemeldet. Der Fahrdienstleiter ordnet deshalb das Fahren auf Sicht zwischen dem Einfahrsignal 60A und dem Einfahrsignal 70A an. Der Triebfahrzeugführer muss die Strecke prüfen und das Ergebnis an den Fahrdienstleiter melden.",
    task:
      "Stelle den Befehl für das Fahren auf Sicht mit Bereich und Prüfungsgrund aus.",
    fieldPoints: {
      von: { correct: "Esig 60A", points: 2 },
      bis: { correct: "Esig 70A", points: 2 },
      grund: { correct: "11 – Personen im Gleis", points: 2 },
    },
    measurePoints: {},
    explanation:
      "Befehl 6 ordnet das Fahren auf Sicht an. Der Bereich wird über die Signale 60A und 70A abgegrenzt; als Grund wird Nummer 11 „Personen im Gleis“ angegeben. Auf Sicht darf höchstens 40 km/h gefahren werden – die konkrete Geschwindigkeit richtet sich nach den Sichtverhältnissen.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 175, label: "RB 3388", dir: 1 },
      signals: [
        { x: 110, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 840, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      people: { x: 575 },
      fog: true,
      callouts: [
        { x: 360, y: 74, text: "Personen im Gleis", sub: "Fahren auf Sicht anordnen", tone: "red", to: [575, 316] },
        { x: 655, y: 178, text: "Strecke prüfen", sub: "Ergebnis an Fdl melden", tone: "amber", to: [840, 300] },
      ],
      badge: "Sichtweite unter 50 m · Nebel",
    },
  },
  {
    id: "s4",
    command: "8",
    title: "Bahnübergang technisch gestört",
    subtitle: "BÜ km 12,4 · Musterstadt – Talheim",
    train: "RE 4720",
    time: "11:20",
    facts: ["Schranken offen", "Technische Störung", "BÜ km 12,4"],
    situation:
      "Der Bahnübergang bei km 12,4 ist technisch gestört; die Schranken sind offen und die Sicherung ist ausgefallen. Der Fahrdienstleiter ordnet an, den BÜ zu sichern. Der Zug muss vor dem Bahnübergang halten und darf erst weiterfahren, wenn die Sicherung hergestellt ist. Die Geschwindigkeit wird auf 20 km/h begrenzt.",
    task:
      "Stelle den Befehl zum Sichern des Bahnübergangs aus.",
    fieldPoints: {
      bue: { correct: "BÜ km 12,4", points: 2 },
      speed: { correct: "20 km/h", points: 2 },
    },
    measurePoints: {
      sichern: { correct: true, points: 2 },
    },
    explanation:
      "Befehl 8 benennt den betroffenen Bahnübergang und die Höchstgeschwindigkeit. Die Maßnahme „halten vor BÜ und weiterfahren, wenn BÜ gesichert ist“ ist Pflicht, weil die technische Sicherung ausgefallen ist. Erst nach hergestellter Sicherung darf der BÜ befahren werden.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 185, label: "RE 4720", dir: 1 },
      crossing: { x: 610, km: "km 12,4" },
      callouts: [
        { x: 300, y: 62, text: "BÜ km 12,4 gestört", sub: "Schranken offen · Sicherung ausgefallen", tone: "red", to: [610, 300] },
        { x: 690, y: 176, text: "20 km/h", sub: "Halten und BÜ sichern", tone: "amber", to: [650, 340] },
      ],
      badge: "Bahnübergang · technische Störung",
    },
  },
  {
    id: "s5",
    command: "22",
    title: "Ausfahrt ohne Hauptsignal",
    subtitle: "Bft Musterstadt Nord · Richtung Talheim",
    train: "RB 3391",
    time: "12:02",
    facts: ["Kein Hauptsignal", "Bft Musterstadt Nord", "Richtung Talheim"],
    situation:
      "Der Zug steht im Bahnhofsteil Musterstadt Nord. Von diesem Bahnhofsteil führt kein Hauptsignal, das eine Ausfahrt zulässt. Der Fahrdienstleiter erteilt die Genehmigung, aus dem Bft Musterstadt Nord in Richtung Talheim auszufahren.",
    task:
      "Stelle den Befehl für die Ausfahrt aus dem Bahnhofsteil aus.",
    fieldPoints: {
      bf: { correct: "Bft Musterstadt Nord", points: 3 },
      richtung: { correct: "Richtung Talheim", points: 3 },
    },
    measurePoints: {},
    explanation:
      "Befehl 22 wird verwendet, wenn die Ausfahrt aus einem Bahnhof oder Bahnhofsteil nicht durch ein Hauptsignal zugelassen wird. Bahnhofsteil und Ausfahrrichtung müssen eindeutig benannt sein.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 410, label: "RB 3391", dir: 1 },
      platform: { x: 300, name: "Musterstadt Nord" },
      missingSignal: { x: 640, label: "kein Hauptsignal" },
      callouts: [
        { x: 515, y: 64, text: "Ausfahrt ohne Hauptsignal", sub: "Bft Musterstadt Nord", tone: "amber", to: [640, 285] },
        { x: 690, y: 180, text: "Richtung Talheim", sub: "Ausfahrt genehmigen", tone: "blue", to: [800, 330] },
      ],
      badge: "Bahnhofsteil ohne Ausfahrsignal",
    },
  },
  {
    id: "s6",
    command: "23",
    title: "Fahren auf dem Gegengleis",
    subtitle: "Musterstadt – Talheim",
    train: "ICE 1202",
    time: "13:18",
    facts: ["Regelgleis gesperrt", "Gegengleis befahren", "Musterstadt bis Talheim"],
    situation:
      "Das Regelgleis zwischen Musterstadt und Talheim ist wegen Bauarbeiten gesperrt. Der Zug soll deshalb auf dem Gegengleis von Musterstadt bis Talheim fahren. Der Fahrdienstleiter erteilt die entsprechende Genehmigung.",
    task:
      "Stelle den Befehl zum Befahren des Gegengleises aus.",
    fieldPoints: {
      von: { correct: "Musterstadt", points: 3 },
      bis: { correct: "Talheim", points: 3 },
    },
    measurePoints: {},
    explanation:
      "Befehl 23 genehmigt die Fahrt auf dem Gegengleis. Die beiden Zugmeldestellen begrenzen den Abschnitt eindeutig. Achtung: Das Befahren des Gegengleises ist nicht mit dem Weiterfahren vom Gegengleis (Befehl 25) zu verwechseln.",
    scene: {
      track: "double",
      electrified: true,
      train: { x: 430, label: "ICE 1202", dir: 1, track: "left" },
      trackLabels: true,
      cones: { x: 640, track: "right" },
      callouts: [
        { x: 150, y: 66, text: "Gegengleis befahren", sub: "Regelgleis gesperrt · Bauarbeiten", tone: "red", to: [430, 250] },
        { x: 640, y: 176, text: "Musterstadt → Talheim", sub: "Befehl 23 · Gegengleis", tone: "blue", to: [720, 250] },
      ],
      badge: "Zweigleisige Strecke · Regelgleis gesperrt",
    },
  },
  {
    id: "s7",
    command: "26",
    title: "Halten auf dem Gegengleis",
    subtitle: "Gegengleis bei Talheim",
    train: "ICE 1203",
    time: "14:06",
    facts: ["Gegengleis", "Signal Ne 1", "km 12,4"],
    situation:
      "Der Zug fährt auf dem Gegengleis in Richtung Talheim. Wegen Bauarbeiten muss er auf dem Gegengleis vor dem Signal Ne 1 bei km 12,4 anhalten. Der Fahrdienstleiter ordnet das Halten ausdrücklich an.",
    task:
      "Stelle den Befehl zum Halten auf dem Gegengleis aus.",
    fieldPoints: {
      ort: { correct: "vor Signal Ne 1", points: 3 },
      km: { correct: "km 12,4", points: 3 },
    },
    measurePoints: {},
    explanation:
      "Befehl 26 legt fest, wo der Zug auf dem Gegengleis zu halten hat – hier vor Signal Ne 1 bei km 12,4. Der Halteort muss eindeutig beschrieben sein, damit der Triebfahrzeugführer ihn sicher zuordnen kann.",
    scene: {
      track: "double",
      electrified: true,
      train: { x: 330, label: "ICE 1203", dir: 1, track: "left" },
      trackLabels: true,
      ne1: { x: 700, km: "km 12,4" },
      callouts: [
        { x: 215, y: 62, text: "Halt auf dem Gegengleis", sub: "vor Signal Ne 1 · km 12,4", tone: "red", to: [700, 290] },
        { x: 670, y: 172, text: "Bauarbeiten", sub: "Halteort exakt angeben", tone: "amber", to: [760, 340] },
      ],
      badge: "Gegengleis · Bauarbeiten",
    },
  },
  {
    id: "s8",
    command: "27",
    title: "LZB-Streckeneinrichtung gestört",
    subtitle: "Musterstadt – Talheim",
    train: "ICE 1204",
    time: "14:48",
    facts: ["LZB-Störung", "Abschnitt Musterstadt–Talheim", "LZB abschalten"],
    situation:
      "Die LZB-Streckeneinrichtung zwischen Musterstadt und Talheim ist gestört. Der Fahrdienstleiter ordnet an, die LZB in diesem Abschnitt abzuschalten, damit der Zug signalgeführt weiterfahren kann. Der Abschnitt reicht von Musterstadt bis Talheim.",
    task:
      "Stelle den Befehl zum Abschalten der LZB aus.",
    fieldPoints: {
      von: { correct: "Musterstadt", points: 3 },
      bis: { correct: "Talheim", points: 3 },
    },
    measurePoints: {},
    explanation:
      "Befehl 27 beauftragt das Abschalten der LZB. Der Gültigkeitsbereich wird über die Zugmeldestellen Musterstadt und Talheim festgelegt. Nach dem Abschalten fährt der Zug signalgeführt weiter.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 260, label: "ICE 1204", dir: 1 },
      lzb: true,
      signals: [
        { x: 120, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 840, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      callouts: [
        { x: 330, y: 66, text: "LZB-Streckeneinrichtung gestört", sub: "Abschnitt Musterstadt – Talheim", tone: "red", to: [560, 262] },
        { x: 660, y: 178, text: "Signalgeführte Weiterfahrt", sub: "LZB abschalten", tone: "amber", to: [840, 300] },
      ],
      badge: "LZB-Störung · Abschnittsstörung",
    },
  },
  {
    id: "s9",
    command: "28",
    title: "ETCS-Betriebsart wechseln",
    subtitle: "Bf Musterstadt · ETCS-Fahrzeuggerät",
    train: "ICE 1205",
    time: "15:32",
    facts: ["Keine ETCS-Fahrterlaubnis", "Level 2 aktiv", "Wechsel auf Level 1 / OS"],
    situation:
      "Das ETCS-Fahrzeuggerät des ICE 1205 empfängt im Bereich Musterstadt keine gültige Fahrterlaubnis. Der Fahrdienstleiter ordnet an, auf ETCS Level 1 zu wechseln und die Betriebsart OS (On Sight) zu wählen, damit der Zug auf Sicht weiterfahren kann.",
    task:
      "Stelle den Befehl zum Wechsel von ETCS-Level und Betriebsart aus.",
    fieldPoints: {
      level: { correct: "ETCS Level 1", points: 3 },
      mode: { correct: "Betriebsart OS", points: 3 },
    },
    measurePoints: {},
    explanation:
      "Befehl 28 enthält zwei getrennte Anweisungen: den ETCS-Level und die ETCS-Betriebsart. Hier lautet der Auftrag Level 1 und Betriebsart OS (On Sight). Beides muss exakt angegeben werden – ein falscher Level oder eine falsche Betriebsart macht den Befehl unbrauchbar.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 300, label: "ICE 1205", dir: 1 },
      etcs: { level: "Level 2", mode: "FS", message: "Keine gültige Fahrterlaubnis" },
      callouts: [
        { x: 250, y: 232, text: "ETCS: keine Fahrterlaubnis", sub: "Wechsel auf Level 1 · OS anordnen", tone: "red", to: [650, 120] },
      ],
      badge: "ETCS-Störung · Fahrzeuggerät",
    },
  },
  {
    id: "s10",
    command: "7",
    title: "Start in SR nach Zwangsbremsung",
    subtitle: "Freie Strecke vor EOA 12,4",
    train: "ICE 1206",
    time: "16:10",
    facts: ["ETCS-Zwangsbremsung (TR)", "Keine Fahrterlaubnis", "Bereich hinter EOA frei"],
    situation:
      "Der Zug steht nach einer ETCS-Zwangsbremsung (TR) auf freier Strecke vor dem EOA 12,4. Eine neue ETCS-Fahrterlaubnis ist nicht verfügbar. Der Fahrdienstleister erteilt die Zustimmung zum Starten in der Betriebsart SR und befreit den Triebfahrzeugführer vom Fahren auf Sicht, weil der Bereich hinter dem EOA frei ist.",
    task:
      "Stelle den Befehl für den Start in SR am EOA 12,4 aus.",
    fieldPoints: {
      eoa: { correct: "EOA 12,4", points: 3 },
    },
    measurePoints: {
      sicht: { correct: true, points: 3 },
    },
    explanation:
      "Befehl 7 erlaubt das Starten in der ETCS-Betriebsart SR. Das EOA muss benannt werden; die Befreiung vom Fahren auf Sicht (×25) ist nur zulässig, wenn der Bereich dahinter nachweislich frei ist. Genau das ist hier vom Fahrdienstleiter bestätigt worden.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 260, label: "ICE 1206", dir: 1 },
      eoa: { x: 690, label: "EOA 12,4" },
      etcs: { level: "Level 2", mode: "TR", message: "Keine Fahrterlaubnis" },
      callouts: [
        { x: 260, y: 228, text: "Zwangsbremsung (TR)", sub: "Start in SR erforderlich", tone: "red", to: [690, 300] },
        { x: 660, y: 70, text: "EOA 12,4", sub: "Bereich dahinter frei", tone: "green", to: [700, 240] },
      ],
      badge: "ETCS · Betriebsart TR",
    },
  },
  {
    id: "s11",
    command: "9",
    title: "Eingeschränkte Fahrstromversorgung",
    subtitle: "Musterstadt – Talheim",
    train: "RE 4730",
    time: "17:04",
    facts: ["Oberleitung beschädigt", "Stromabnehmer senken", "Esig 60A bis Esig 70A"],
    situation:
      "Die Oberleitung zwischen Musterstadt und Talheim ist beschädigt; die Fahrstromversorgung ist eingeschränkt. Der Fahrdienstleiter ordnet an, im Abschnitt vom Einfahrsignal 60A bis zum Einfahrsignal 70A mit gesenktem Stromabnehmer zu fahren. Der Hauptschalter bleibt eingeschaltet.",
    task:
      "Stelle den Befehl für die Fahrt mit eingeschränkter Fahrstromversorgung aus.",
    fieldPoints: {
      von: { correct: "Esig 60A", points: 2 },
      bis: { correct: "Esig 70A", points: 2 },
    },
    measurePoints: {
      pantograph: { correct: true, points: 2 },
      hauptschalter: { correct: false, points: 0 },
    },
    explanation:
      "Befehl 9 begrenzt den Abschnitt und legt die Maßnahme fest. Hier ist ausdrücklich das Fahren mit gesenktem Stromabnehmer angeordnet – nicht das Ausschalten des Hauptschalters. Die Auswahl der richtigen Zusatzmaßnahme ist Teil der sicheren Auftragsumsetzung.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 250, label: "RE 4730", dir: 1, pantograph: "down" },
      damagedCatenary: true,
      signals: [
        { x: 120, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 840, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      callouts: [
        { x: 315, y: 64, text: "Oberleitung beschädigt", sub: "Fahrstrom eingeschränkt", tone: "red", to: [555, 170] },
        { x: 660, y: 176, text: "Stromabnehmer senken", sub: "Esig 60A bis Esig 70A", tone: "amber", to: [430, 290] },
      ],
      badge: "Fahrstromversorgung gestört",
    },
  },
  {
    id: "s12",
    command: "2",
    title: "Weiterfahren nach TR",
    subtitle: "Freie Strecke Musterstadt – Talheim",
    train: "ICE 1207",
    time: "18:22",
    facts: ["ETCS-Zwangsbremsung", "Keine Fahrterlaubnis", "Weiterfahrt in SR"],
    situation:
      "Der Zug hat auf freier Strecke zwischen Musterstadt und Talheim eine ETCS-Zwangsbremsung (TR) erhalten. Eine neue Fahrterlaubnis liegt nicht vor. Der Fahrdienstleiter erteilt Befehl 2 zum Weiterfahren in SR; der anschließende Abschnitt ist frei, die Befreiung vom Fahren auf Sicht wird erteilt.",
    task:
      "Stelle den Befehl für die Weiterfahrt nach TR aus.",
    fieldPoints: {
      mode: { correct: "TR – Zwangsbremsung", points: 2 },
    },
    measurePoints: {
      sr: { correct: true, points: 2 },
      sicht: { correct: true, points: 2 },
    },
    explanation:
      "Befehl 2 regelt die Weiterfahrt nach einer ETCS-Zwangsbremsung (TR). Die Weiterfahrt erfolgt in SR, solange keine ETCS-Fahrterlaubnis empfangen wurde. Weil der Abschnitt frei ist, darf zusätzlich die Befreiung vom Fahren auf Sicht angekreuzt werden.",
    scene: {
      track: "single",
      electrified: true,
      train: { x: 350, label: "ICE 1207", dir: 1 },
      etcs: { level: "Level 2", mode: "TR", message: "Zwangsbremsung · keine Fahrterlaubnis" },
      callouts: [
        { x: 255, y: 232, text: "ETCS-Zwangsbremsung (TR)", sub: "Weiterfahrt in SR anordnen", tone: "red", to: [640, 120] },
      ],
      badge: "ETCS · TR auf freier Strecke",
    },
  },
];

/* Hilfsfunktionen für die Auswertung */
function getCommand(nr) {
  return COMMANDS.find((c) => c.nr === nr);
}

function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id);
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
