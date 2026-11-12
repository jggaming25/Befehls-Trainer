/* ==========================================================================
   Befehlstrainer – Situationsgenerator (Teil 1)
   Aus Vorlagen und Zufallswerten entstehen bei jedem Start neue Lagen.
   ========================================================================== */

const STATION_INFO = {
  Musterstadt: {
    esig: "Esig 60A",
    asig: "ASig 62B",
    km: "km 8,2",
    bft: "Bft Musterstadt Nord",
  },
  Talheim: {
    esig: "Esig 70A",
    asig: "ASig 72B",
    km: "km 14,8",
    bft: "Bft Talheim Süd",
  },
  Nordheim: {
    esig: "Esig 80A",
    asig: "ASig 82B",
    km: "km 21,6",
    bft: "Bft Nordheim West",
  },
  Südheim: {
    esig: "Esig 90A",
    asig: "ASig 92B",
    km: "km 27,3",
    bft: "Bft Südheim Ost",
  },
};

const TRAINS = [
  { label: "RE 4711", kind: "Regionalexpress" },
  { label: "RE 4720", kind: "Regionalexpress" },
  { label: "RB 3388", kind: "Regionalbahn" },
  { label: "RB 3391", kind: "Regionalbahn" },
  { label: "IC 2045", kind: "Intercity" },
  { label: "ICE 1202", kind: "ICE" },
  { label: "ICE 1203", kind: "ICE" },
  { label: "ICE 1204", kind: "ICE" },
  { label: "ICE 1205", kind: "ICE" },
  { label: "ICE 1206", kind: "ICE" },
  { label: "ICE 1207", kind: "ICE" },
  { label: "Güterzug 51234", kind: "Güterzug" },
];

const SPECIAL_TRAINS = [
  { label: "Sperrfahrt 9012", kind: "Sperrfahrt" },
  { label: "Schiebetriebfahrzeug 9040", kind: "Schiebetriebfahrzeug" },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pickTrain = () => pick(TRAINS);
const pickSpecial = () => pick(SPECIAL_TRAINS);

function randomTime() {
  return `${String(randInt(5, 22)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}`;
}

function pickPair() {
  const a = randInt(0, STATIONS.length - 1);
  let b = randInt(0, STATIONS.length - 1);
  while (b === a) b = randInt(0, STATIONS.length - 1);
  return [STATIONS[a], STATIONS[b]];
}

function pickOtherStation(station) {
  return pick(STATIONS.filter((s) => s !== station));
}

function radio(train, text) {
  return [{ speaker: "TF", who: train.label, text }];
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function make(nr, data) {
  return { id: newId(`gen-${nr}`), command: nr, ...data };
}

function signalName(label) {
  return label.replace("Esig ", "").replace("ASig ", "");
}

const GENERATORS = {
  /* Befehl 1 – Vorbeifahrt am Signal / EOA */
  "1": () => {
    const station = pick(STATIONS);
    const info = STATION_INFO[station];
    const train = pickTrain();
    const eoa = Math.random() < 0.32;
    const signal = eoa ? "EOA 12,4" : info.esig;
    const bis = info.asig;
    const time = randomTime();
    const scene = {
      track: "single",
      electrified: true,
      train: { x: 250, label: train.label, dir: 1 },
      platform: { x: 780, name: station },
      ...(eoa
        ? { eoa: { x: 690, label: "EOA 12,4" } }
        : {
            signals: [
              { x: 590, label: signalName(info.esig), aspect: "halt", km: info.km, name: info.esig },
              { x: 868, label: signalName(info.asig), aspect: "langsam", name: info.asig },
            ],
          }),
      callouts: [
        {
          x: 66,
          y: 62,
          text: eoa ? "EOA 12,4 – Halt" : `${info.esig} zeigt Hp0`,
          sub: eoa ? "Keine ETCS-Fahrterlaubnis" : "Halt · Störung bestätigt",
          tone: "red",
          to: eoa ? [690, 250] : [590, 250],
        },
        {
          x: 642,
          y: 174,
          text: `Weiterfahrt bis ${bis}`,
          sub: "Block geprüft und frei",
          tone: "green",
          to: [868, 300],
        },
      ],
      badge: `${station} · ${time}`,
    };
    return make("1", {
      title: eoa ? "Vorbeifahrt am EOA" : "Halt zeigendes Einfahrsignal",
      subtitle: eoa ? `${station} · EOA 12,4` : `Bf ${station} · ${info.esig}`,
      train: train.label,
      time,
      facts: eoa
        ? ["EOA 12,4", "Keine Fahrterlaubnis", `Block bis ${bis} frei`]
        : [`Hp0 am ${info.esig}`, "Signalstörung bestätigt", `Block bis ${bis} frei`],
      situation: eoa
        ? `Der ${train.label} steht auf freier Strecke vor dem EOA 12,4. Eine ETCS-Fahrterlaubnis liegt nicht vor. Der Bereich bis zum ${bis} in ${station} ist frei. Der Fahrdienstleister erteilt die Vorbeifahrt am EOA und befreit den Triebfahrzeugführer vom Fahren auf Sicht.`
        : `Der ${train.label} steht vor dem ${info.esig} des Bahnhofs ${station}. Das Signal zeigt Hp0; die Signalstörung ist bestätigt. Der Block bis zum ${bis} wurde geprüft und ist frei. Der Fahrdienstleister erteilt die Vorbeifahrt und befreit den Triebfahrzeugführer vom Fahren auf Sicht.`,
      task: `Ordne die Vorbeifahrt am ${signal} in Richtung ${station} an. Die Weiterfahrt gilt bis ${bis}; die Befreiung vom Fahren auf Sicht ist zu erteilen.`,
      radio: radio(
        train,
        eoa
          ? `Fahrdienstleiter, hier ${train.label}. Ich stehe vor dem EOA 12,4 und habe keine Fahrterlaubnis. Ich bitte um Befehl.`
          : `Fahrdienstleiter, hier ${train.label}. Ich stehe vor dem ${info.esig} in ${station}; das Signal zeigt Halt. Ich bitte um Befehl.`
      ),
      fieldPoints: {
        signal: { correct: signal, points: 2 },
        stelle: { correct: station, points: 1 },
        bis: { correct: bis, points: 1 },
      },
      measurePoints: { sicht: { correct: true, points: 2 } },
      explanation:
        "Ein Halt zeigendes oder gestörtes Signal wird mit Befehl 1 überfahren. Signal, Zugmeldestelle und Weiterfahrt bis zum nächsten Signal müssen eindeutig benannt sein. Die Befreiung vom Fahren auf Sicht (×25) ist nur zulässig, wenn der Block nachweislich frei ist.",
      scene,
    });
  },

  /* Befehl 2 – Weiterfahren nach TR */
  "2": () => {
    const [a, b] = pickPair();
    const train = pickTrain();
    const time = randomTime();
    return make("2", {
      title: "Weiterfahren nach ETCS-Zwangsbremsung",
      subtitle: `Freie Strecke ${a} – ${b}`,
      train: train.label,
      time,
      facts: ["ETCS-Zwangsbremsung (TR)", "Keine Fahrterlaubnis", "Abschnitt frei"],
      situation: `Der ${train.label} hat auf freier Strecke zwischen ${a} und ${b} eine ETCS-Zwangsbremsung (TR) erhalten. Eine neue Fahrterlaubnis liegt nicht vor. Der anschließende Abschnitt ist frei; der Fahrdienstleister erteilt die Weiterfahrt in SR und befreit vom Fahren auf Sicht.`,
      task: "Ordne die Weiterfahrt in SR an. Der Abschnitt ist frei; die Befreiung vom Fahren auf Sicht ist zu erteilen.",
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich habe zwischen ${a} und ${b} eine ETCS-Zwangsbremsung erhalten. Keine Fahrterlaubnis – ich bitte um Befehl.`
      ),
      fieldPoints: { mode: { correct: "TR – Zwangsbremsung", points: 2 } },
      measurePoints: {
        sr: { correct: true, points: 2 },
        sicht: { correct: true, points: 2 },
      },
      explanation:
        "Befehl 2 regelt die Weiterfahrt nach einer ETCS-Zwangsbremsung (TR). Solange keine ETCS-Fahrterlaubnis empfangen wurde, wird die Weiterfahrt in SR angeordnet. Ist der Abschnitt nachweislich frei, kann zusätzlich die Befreiung vom Fahren auf Sicht angekreuzt werden.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 330, label: train.label, dir: 1 },
        etcs: { level: "Level 2", mode: "TR", message: "Zwangsbremsung · keine Fahrterlaubnis" },
        callouts: [
          {
            x: 250,
            y: 232,
            text: "ETCS-Zwangsbremsung (TR)",
            sub: "Weiterfahrt in SR anordnen",
            tone: "red",
            to: [640, 120],
          },
        ],
        badge: `ETCS · TR zwischen ${a} und ${b}`,
      },
    });
  },

  /* Befehl 3 – Verbleiben im Stillstand */
  "3": () => {
    const station = pick(STATIONS);
    const train = pickTrain();
    const time = randomTime();
    return make("3", {
      title: "Verbleiben im Stillstand",
      subtitle: `${station} · unklare Gefahrenmeldung`,
      train: train.label,
      time,
      facts: ["Gefahrenmeldung", "Weiterfahrt gesperrt", "ETCS-Fahrterlaubnis vorhanden"],
      situation: `Wegen einer unklaren Gefahrenmeldung im Bereich ${station} darf der ${train.label} nicht weiterfahren. Der Zug soll an der aktuellen Stelle bleiben; eine vorhandene ETCS-Fahrterlaubnis ist zu löschen und die Fahrt zu beenden.`,
      task: "Ordne an, im Stillstand zu verbleiben, die Fahrt zu beenden und die ETCS-Fahrterlaubnis zu löschen.",
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich stehe in ${station} und habe eine unklare Gefahrenmeldung. Darf ich weiterfahren?`
      ),
      fieldPoints: { ort: { correct: station, points: 2 } },
      measurePoints: {
        fahrtBeenden: { correct: true, points: 2 },
        maLoeschen: { correct: true, points: 2 },
      },
      explanation:
        "Befehl 3 hält den Zug an der aktuellen Stelle. „Fahrt beenden“ und das Löschen der vorhandenen ETCS-Fahrterlaubnis verhindern eine unbeabsichtigte Weiterfahrt. Der Standort muss eindeutig benannt sein.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 300, label: train.label, dir: 1 },
        signals: [{ x: 620, label: "60A", aspect: "halt", km: STATION_INFO[station].km, name: STATION_INFO[station].esig }],
        etcs: { level: "Level 2", mode: "FS", message: "Fahrterlaubnis vorhanden" },
        callouts: [
          {
            x: 250,
            y: 232,
            text: "Verbleiben im Stillstand",
            sub: `${station} · Fahrterlaubnis löschen`,
            tone: "red",
            to: [620, 250],
          },
        ],
        badge: `Gefahrenmeldung · ${station}`,
      },
    });
  },

  /* Befehl 5 – Geschwindigkeitsbegrenzung */
  "5": () => {
    const [a, b] = pickPair();
    const ia = STATION_INFO[a];
    const ib = STATION_INFO[b];
    const train = pickTrain();
    const cases = [
      {
        code: "29 – Mängel am Oberbau",
        speed: "50 km/h",
        fact: "Oberbaumangel",
        text: `Bei einer Streckenprüfung wurde zwischen ${a} und ${b} ein Oberbaumangel festgestellt.`,
        radio: "Ich habe einen unruhigen Lauf; bitte um Geschwindigkeitsbeschränkung.",
      },
      {
        code: "22 – Bauarbeiten",
        speed: "30 km/h",
        fact: "Bauarbeiten",
        text: `Wegen Bauarbeiten im Gleis ist zwischen ${a} und ${b} nur eine reduzierte Geschwindigkeit zulässig.`,
        radio: "Im Abschnitt wird gebaut; ich bitte um die Geschwindigkeitsbeschränkung.",
      },
      {
        code: "26 – Niedrigere Geschwindigkeit gegenüber La",
        speed: "60 km/h",
        fact: "Niedrigere La",
        text: `Die Langsamfahrstelle zwischen ${a} und ${b} schreibt eine niedrigere Geschwindigkeit vor.`,
        radio: "Die La gilt ab sofort; ich bitte um die entsprechende Anweisung.",
      },
      {
        code: "33 – PZB-Streckeneinrichtung gestört",
        speed: "50 km/h",
        fact: "PZB-Störung",
        text: `Die PZB-Streckeneinrichtung ist zwischen ${a} und ${b} gestört.`,
        radio: "Die PZB meldet eine Streckenstörung; ich bitte um Befehl.",
      },
      {
        code: "34 – Weichen außer Abhängigkeit",
        speed: "50 km/h",
        fact: "Weichenstörung",
        text: `Die Weichen im Bereich ${a} sind außer Abhängigkeit von den Signalen.`,
        radio: "Die Weichenanzeige ist unklar; ich bitte um Geschwindigkeitsbegrenzung.",
      },
      {
        code: "19 – Bahnübergang nicht ausreichend gesichert",
        speed: "20 km/h",
        fact: "BÜ-Sicherung",
        text: `Ein Bahnübergang zwischen ${a} und ${b} ist nicht ausreichend gesichert.`,
        radio: "Ein Bahnübergang ist nur unzureichend gesichert; ich bitte um Befehl.",
      },
    ];
    const c = pick(cases);
    const time = randomTime();
    return make("5", {
      title: "Fahren mit Geschwindigkeitsbegrenzung",
      subtitle: `${a} – ${b}`,
      train: train.label,
      time,
      facts: [c.fact, c.speed, `${ia.esig} bis ${ib.esig}`],
      situation: `${c.text} Der Fahrdienstleister ordnet für den Abschnitt eine Höchstgeschwindigkeit von ${c.speed} an. Langsamfahrsignale sind nicht aufgestellt. Der Bereich reicht vom ${ia.esig} bis zum ${ib.esig}.`,
      task: "Stelle den Befehl mit Höchstgeschwindigkeit, Gültigkeitsbereich und Grund aus.",
      radio: radio(train, `Fahrdienstleiter, hier ${train.label}. ${c.radio}`),
      fieldPoints: {
        speed: { correct: c.speed, points: 2 },
        von: { correct: ia.esig, points: 1 },
        bis: { correct: ib.esig, points: 1 },
        grund: { correct: c.code, points: 2 },
      },
      measurePoints: {},
      explanation:
        "Befehl 5 benennt die Höchstgeschwindigkeit, den genauen Gültigkeitsbereich und den Grund nach Grundkatalog. Der Bereich wird über die Signale eindeutig begrenzt. Ohne Grund ist der Befehl unvollständig.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 205, label: train.label, dir: 1 },
        signals: [
          { x: 120, label: signalName(ia.esig), aspect: "fahrt", km: ia.km, name: ia.esig },
          { x: 845, label: signalName(ib.esig), aspect: "fahrt", km: ib.km, name: ib.esig },
        ],
        speedBoard: { x: 500, speed: c.speed.replace(" km/h", "") },
        callouts: [
          {
            x: 315,
            y: 66,
            text: `Höchstgeschwindigkeit ${c.speed}`,
            sub: `${c.code}`,
            tone: "amber",
            to: [500, 268],
            width: 270,
          },
          {
            x: 642,
            y: 176,
            text: `Gültig bis ${ib.esig}`,
            sub: `${b} · ${ib.km}`,
            tone: "blue",
            to: [845, 300],
          },
        ],
        badge: `${c.fact} · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 6 – Fahren auf Sicht */
  "6": () => {
    const [a, b] = pickPair();
    const ia = STATION_INFO[a];
    const ib = STATION_INFO[b];
    const train = pickTrain();
    const cases = [
      {
        code: "11 – Personen im Gleis",
        fact: "Personen im Gleis",
        text: `Zwischen ${a} und ${b} wurden Personen im Gleis gemeldet.`,
        radio: "Personen im Gleis! Ich bitte um Fahren auf Sicht.",
        scene: { people: { x: 575 }, fog: true },
      },
      {
        code: "10 – Gleis kann besetzt sein",
        fact: "Gleisbesetzung",
        text: `Für den Abschnitt zwischen ${a} und ${b} besteht der Verdacht, dass das Gleis besetzt ist.`,
        radio: "Ich habe eine unklare Gleisbelegung; bitte um Fahren auf Sicht.",
        scene: { fog: true },
      },
      {
        code: "17 – Auf der Strecke ruht die Arbeit",
        fact: "Ruhende Arbeit",
        text: `Auf der Strecke zwischen ${a} und ${b} ruht die Arbeit; der Zustand des Gleises ist zu prüfen.`,
        radio: "Die Arbeit ruht; ich soll den Abschnitt prüfen?",
        scene: { cones: { x: 610, track: "right" } },
      },
      {
        code: "22 – Bauarbeiten",
        fact: "Bauarbeiten",
        text: `Zwischen ${a} und ${b} finden Bauarbeiten statt; der Abschnitt ist auf Sicht zu befahren.`,
        radio: "Im Baubereich ist die Sicht eingeschränkt; ich bitte um Fahren auf Sicht.",
        scene: { cones: { x: 610, track: "right" } },
      },
      {
        code: "23 – Unbefahrbare Stelle im gesperrten Gleis",
        fact: "Unbefahrbare Stelle",
        text: `Im gesperrten Gleis zwischen ${a} und ${b} befindet sich eine unbefahrbare Stelle.`,
        radio: "Im Gleis ist eine unbefahrbare Stelle gemeldet; ich bitte um Befehl.",
        scene: { cones: { x: 610, track: "right" } },
      },
      {
        code: "25 – Arbeitsstelle nicht benachrichtigt",
        fact: "Arbeitsstelle",
        text: `Die Arbeitsstelle zwischen ${a} und ${b} wurde nicht benachrichtigt.`,
        radio: "Die Arbeitsstelle ist nicht erreichbar; ich bitte um Fahren auf Sicht.",
        scene: { cones: { x: 610, track: "right" } },
      },
      {
        code: "30 – Verdacht auf Oberleitungsschäden",
        fact: "Oberleitung",
        text: `Zwischen ${a} und ${b} besteht der Verdacht auf einen Oberleitungsschaden.`,
        radio: "Ich sehe eine beschädigte Oberleitung; ich bitte um Befehl.",
        scene: { damagedCatenary: true, power: true },
      },
      {
        code: "31 – Verdacht auf Unwetterschäden",
        fact: "Unwetterschaden",
        text: `Zwischen ${a} und ${b} besteht der Verdacht auf Unwetterschäden am Gleis.`,
        radio: "Nach dem Unwetter ist der Gleiszustand unklar; ich bitte um Fahren auf Sicht.",
        scene: { fog: true },
      },
    ];
    const c = pick(cases);
    const time = randomTime();
    return make("6", {
      title: "Fahren auf Sicht",
      subtitle: `${a} – ${b}`,
      train: train.label,
      time,
      facts: [c.fact, "Sichtweite prüfen", `${ia.esig} bis ${ib.esig}`],
      situation: `${c.text} Der Fahrdienstleister ordnet das Fahren auf Sicht zwischen dem ${ia.esig} und dem ${ib.esig} an. Die Strecke ist zu prüfen; das Ergebnis ist an den Fahrdienstleister zu melden.`,
      task: "Stelle den Befehl für das Fahren auf Sicht mit Bereich und Prüfungsgrund aus.",
      radio: radio(train, `Fahrdienstleiter, hier ${train.label}. ${c.radio}`),
      fieldPoints: {
        von: { correct: ia.esig, points: 2 },
        bis: { correct: ib.esig, points: 2 },
        grund: { correct: c.code, points: 2 },
      },
      measurePoints: {},
      explanation:
        "Befehl 6 ordnet das Fahren auf Sicht an. Der Bereich wird über die Signale begrenzt, der Grund nach Grundkatalog angegeben. Auf Sicht darf höchstens 40 km/h gefahren werden; die konkrete Geschwindigkeit richtet sich nach den Sichtverhältnissen.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 175, label: train.label, dir: 1 },
        signals: [
          { x: 110, label: signalName(ia.esig), aspect: "fahrt", km: ia.km, name: ia.esig },
          { x: 840, label: signalName(ib.esig), aspect: "fahrt", km: ib.km, name: ib.esig },
        ],
        ...c.scene,
        callouts: [
          {
            x: 310,
            y: 70,
            text: c.fact,
            sub: "Fahren auf Sicht anordnen",
            tone: "red",
            to: [575, 316],
          },
          {
            x: 646,
            y: 176,
            text: "Strecke prüfen",
            sub: "Ergebnis an Fdl melden",
            tone: "amber",
            to: [840, 300],
          },
        ],
        badge: `${c.fact} · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 7 – Start in SR */
  "7": () => {
    const station = pick(STATIONS);
    const info = STATION_INFO[station];
    const train = pickTrain();
    const time = randomTime();
    return make("7", {
      title: "Start in SR nach Zwangsbremsung",
      subtitle: `Freie Strecke vor EOA 12,4 · ${station}`,
      train: train.label,
      time,
      facts: ["ETCS-Zwangsbremsung (TR)", "Keine Fahrterlaubnis", "Bereich hinter EOA frei"],
      situation: `Der ${train.label} steht nach einer ETCS-Zwangsbremsung (TR) auf freier Strecke vor dem EOA 12,4. Eine neue ETCS-Fahrterlaubnis ist nicht verfügbar. Der Fahrdienstleister erteilt die Zustimmung zum Starten in SR und befreit vom Fahren auf Sicht, weil der Bereich bis ${station} frei ist.`,
      task: "Ordne den Start in SR am EOA 12,4 an. Der Bereich dahinter ist frei; die Befreiung vom Fahren auf Sicht ist zu erteilen.",
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich stehe nach einer Zwangsbremsung vor dem EOA 12,4. Keine Fahrterlaubnis – ich bitte um Befehl.`
      ),
      fieldPoints: { eoa: { correct: "EOA 12,4", points: 3 } },
      measurePoints: { sicht: { correct: true, points: 3 } },
      explanation:
        "Befehl 7 erlaubt den Start in der ETCS-Betriebsart SR. Das EOA muss benannt werden. Die Befreiung vom Fahren auf Sicht (×25) ist nur zulässig, wenn der Bereich dahinter nachweislich frei ist.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 260, label: train.label, dir: 1 },
        eoa: { x: 690, label: "EOA 12,4" },
        etcs: { level: "Level 2", mode: "TR", message: "Keine Fahrterlaubnis" },
        callouts: [
          {
            x: 250,
            y: 232,
            text: "Zwangsbremsung (TR)",
            sub: "Start in SR anordnen",
            tone: "red",
            to: [690, 300],
          },
          {
            x: 650,
            y: 68,
            text: "EOA 12,4",
            sub: "Bereich dahinter frei",
            tone: "green",
            to: [700, 240],
          },
        ],
        badge: `ETCS · TR vor EOA 12,4`,
      },
    });
  },

  /* Befehl 8 – BÜ sichern */
  "8": () => {
    const bue = pick(BUES);
    const speed = pick(["20 km/h", "30 km/h"]);
    const train = pickTrain();
    const time = randomTime();
    const km = bue.replace("BÜ ", "");
    return make("8", {
      title: "Bahnübergang technisch gestört",
      subtitle: `${bue} · technische Störung`,
      train: train.label,
      time,
      facts: ["Schranken offen", "Sicherung ausgefallen", bue],
      situation: `Der Bahnübergang bei ${km} ist technisch gestört; die Schranken sind offen und die Sicherung ist ausgefallen. Der Fahrdienstleister ordnet an, den BÜ zu sichern. Der Zug muss vor dem Bahnübergang halten und darf erst weiterfahren, wenn die Sicherung hergestellt ist. Die Geschwindigkeit wird auf ${speed} begrenzt.`,
      task: "Stelle den Befehl zum Sichern des Bahnübergangs aus: Halten vor dem BÜ, Weiterfahrt erst nach hergestellter Sicherung.",
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Der BÜ bei ${km} ist offen; die Schranken sind nicht geschlossen. Ich bitte um Befehl.`
      ),
      fieldPoints: {
        bue: { correct: bue, points: 2 },
        speed: { correct: speed, points: 2 },
      },
      measurePoints: { sichern: { correct: true, points: 2 } },
      explanation:
        "Befehl 8 benennt den betroffenen Bahnübergang und die Höchstgeschwindigkeit. „Halten vor BÜ und weiterfahren, wenn BÜ gesichert ist“ ist Pflicht, weil die technische Sicherung ausgefallen ist. Erst nach hergestellter Sicherung darf der BÜ befahren werden.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 185, label: train.label, dir: 1 },
        crossing: { x: 610, km },
        callouts: [
          {
            x: 300,
            y: 62,
            text: `${bue} gestört`,
            sub: "Schranken offen · Sicherung ausgefallen",
            tone: "red",
            to: [610, 300],
            width: 266,
          },
          {
            x: 690,
            y: 176,
            text: speed,
            sub: "Halten und BÜ sichern",
            tone: "amber",
            to: [650, 340],
          },
        ],
        badge: `Bahnübergang · ${km}`,
      },
    });
  },
};
