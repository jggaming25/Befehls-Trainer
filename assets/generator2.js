/* ==========================================================================
   Befehlstrainer – Situationsgenerator (Teil 2)
   Befehle 9, 21–28 sowie die Zusammenstellung eines Trainingslaufs.
   ========================================================================== */

Object.assign(GENERATORS, {
  /* Befehl 9 – eingeschränkte Fahrstromversorgung */
  "9": () => {
    const [a, b] = pickPair();
    const ia = STATION_INFO[a];
    const ib = STATION_INFO[b];
    const train = pickTrain();
    const time = randomTime();
    const pantograph = Math.random() < 0.6;
    const measure = pantograph ? "pantograph" : "hauptschalter";
    const measureText = pantograph
      ? "Fahren mit gesenktem Stromabnehmer"
      : "Fahren mit ausgeschaltetem Hauptschalter";
    return make("9", {
      title: "Eingeschränkte Fahrstromversorgung",
      subtitle: `${a} – ${b}`,
      train: train.label,
      time,
      facts: [
        "Fahrstrom eingeschränkt",
        measureText,
        `${ia.esig} bis ${ib.esig}`,
      ],
      situation: `Die Fahrstromversorgung ist zwischen ${a} und ${b} eingeschränkt; die Oberleitung wurde beschädigt. Der Fahrdienstleister ordnet für den Abschnitt vom ${ia.esig} bis zum ${ib.esig} das ${measureText} an. Weitere Einschränkungen bestehen nicht.`,
      task: `Stelle den Befehl für die Fahrt mit eingeschränkter Fahrstromversorgung aus: Bereich ${ia.esig} bis ${ib.esig}, Maßnahme „${measureText}“.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Die Oberleitung sieht beschädigt aus; ich bitte um Befehl für den Abschnitt ${a} – ${b}.`
      ),
      fieldPoints: {
        von: { correct: ia.esig, points: 2 },
        bis: { correct: ib.esig, points: 2 },
      },
      measurePoints: { [measure]: { correct: true, points: 2 } },
      explanation:
        "Befehl 9 begrenzt den Abschnitt mit eingeschränkter Fahrstromversorgung und legt die erforderliche Maßnahme fest. Nur die tatsächlich angeordnete Maßnahme darf angekreuzt werden – Stromabnehmer senken und Hauptschalter ausschalten sind nicht austauschbar.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 250, label: train.label, dir: 1, pantograph: pantograph ? "down" : "up" },
        damagedCatenary: true,
        power: true,
        signals: [
          { x: 120, label: signalName(ia.esig), aspect: "fahrt", km: ia.km, name: ia.esig },
          { x: 840, label: signalName(ib.esig), aspect: "fahrt", km: ib.km, name: ib.esig },
        ],
        callouts: [
          {
            x: 315,
            y: 64,
            text: "Fahrstrom eingeschränkt",
            sub: "Oberleitung beschädigt",
            tone: "red",
            to: [555, 170],
          },
          {
            x: 656,
            y: 176,
            text: measureText,
            sub: `${ia.esig} bis ${ib.esig}`,
            tone: "amber",
            to: [430, 290],
            width: 250,
          },
        ],
        badge: `Fahrstrom · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 21 – Einfahrt / Weiterfahrt */
  "21": () => {
    const station = pick(STATIONS);
    const info = STATION_INFO[station];
    const train = pickTrain();
    const time = randomTime();
    const track = pick(TRACKS);
    const einfahren = Math.random() < 0.5;
    const art = einfahren ? "einfahren" : "weiterfahren";
    return make("21", {
      title: einfahren ? "Einfahrt in den Bahnhof" : "Weiterfahrt im Bahnhof",
      subtitle: `${station} · ${track}`,
      train: train.label,
      time,
      facts: [
        einfahren ? "Einfahrt angeordnet" : "Weiterfahrt angeordnet",
        track,
        station,
      ],
      situation: `Das Einfahrsignal ${info.esig} in ${station} ist gestört und zeigt Halt. Der Fahrdienstleister lässt den ${train.label} in den Bahnhof ${station} auf ${track} ${art}. Der Fahrweg ist geprüft und frei; weitere Signale sind nicht zu beachten.`,
      task: `Stelle den Befehl für die ${art === "einfahren" ? "Einfahrt" : "Weiterfahrt"} in ${station} auf ${track} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich stehe vor ${info.esig}; das Signal zeigt Halt. Ich bitte um Befehl für die ${art === "einfahren" ? "Einfahrt" : "Weiterfahrt"}.`
      ),
      fieldPoints: {
        stelle: { correct: station, points: 2 },
        gleis: { correct: track, points: 2 },
        art: { correct: art, points: 2 },
      },
      measurePoints: {},
      explanation:
        "Befehl 21 genehmigt die Einfahrt in einen Bahnhof oder die Weiterfahrt dort, wenn kein Hauptsignal dies zulässt. Zugmeldestelle, Gleis und die Art der Fahrt (einfahren oder weiterfahren) müssen exakt benannt sein.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: einfahren ? 260 : 470, label: train.label, dir: 1 },
        platform: { x: 770, name: station },
        signals: [
          {
            x: 600,
            label: signalName(info.esig),
            aspect: "halt",
            km: info.km,
            name: info.esig,
          },
        ],
        trackLabels: true,
        callouts: [
          {
            x: 300,
            y: 62,
            text: `${info.esig} zeigt Hp0`,
            sub: "Einfahrt auf Befehl",
            tone: "red",
            to: [600, 250],
          },
          {
            x: 650,
            y: 176,
            text: `${art} · ${track}`,
            sub: `${station} · Fahrweg frei`,
            tone: "green",
            to: [770, 330],
          },
        ],
        badge: `${station} · ${track}`,
      },
    });
  },

  /* Befehl 22 – Ausfahrt aus Bf / Bft */
  "22": () => {
    const station = pick(STATIONS);
    const info = STATION_INFO[station];
    const bft = info.bft;
    const direction = pick(DIRECTIONS);
    const train = pickTrain();
    const time = randomTime();
    const useBft = Math.random() < 0.6;
    const place = useBft ? bft : `Bf ${station}`;
    return make("22", {
      title: "Ausfahrt ohne Hauptsignal",
      subtitle: `${place} · ${direction}`,
      train: train.label,
      time,
      facts: ["Kein Hauptsignal", place, direction],
      situation: `Der ${train.label} steht in ${place}. Für die Ausfahrt in ${direction} ist kein Hauptsignal vorhanden; das Ausfahrsignal fehlt bzw. lässt keine Fahrt zu. Der Fahrweg ist geprüft und frei. Der Fahrdienstleister erteilt die Genehmigung zur Ausfahrt.`,
      task: `Stelle den Befehl für die Ausfahrt aus ${place} in ${direction} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich stehe in ${place} und habe kein Ausfahrsignal. Ich bitte um Befehl zur Ausfahrt ${direction}.`
      ),
      fieldPoints: {
        bf: { correct: place, points: 3 },
        richtung: { correct: direction, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 22 wird benötigt, wenn die Ausfahrt nicht durch ein Hauptsignal zugelassen wird. Bahnhof bzw. Bahnhofsteil und die Ausfahrrichtung müssen eindeutig benannt sein; „Bf“ und „Bft“ sind dabei präzise zu unterscheiden.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 420, label: train.label, dir: 1 },
        platform: { x: 300, name: station },
        missingSignal: { x: 640, label: "kein Hauptsignal" },
        callouts: [
          {
            x: 500,
            y: 62,
            text: "Ausfahrt ohne Hauptsignal",
            sub: place,
            tone: "amber",
            to: [640, 285],
            width: 250,
          },
          {
            x: 686,
            y: 180,
            text: direction,
            sub: "Ausfahrt genehmigen",
            tone: "blue",
            to: [800, 330],
          },
        ],
        badge: `${station} · Ausfahrt`,
      },
    });
  },

  /* Befehl 23 – Fahren auf dem Gegengleis */
  "23": () => {
    const [a, b] = pickPair();
    const train = pick(SPECIAL_TRAINS.concat(TRAINS));
    const time = randomTime();
    return make("23", {
      title: "Fahren auf dem Gegengleis",
      subtitle: `${a} – ${b}`,
      train: train.label,
      time,
      facts: ["Regelgleis gesperrt", "Gegengleis befahren", `${a} bis ${b}`],
      situation: `Das Regelgleis zwischen ${a} und ${b} ist gesperrt. Der ${train.label} soll deshalb auf dem Gegengleis von ${a} bis ${b} fahren. Das Gegengleis ist frei; der Fahrdienstleister erteilt die Genehmigung.`,
      task: `Stelle den Befehl zum Befahren des Gegengleises von ${a} bis ${b} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Das Regelgleis ist gesperrt. Ich bitte um Befehl für die Fahrt auf dem Gegengleis ${a} bis ${b}.`
      ),
      fieldPoints: {
        von: { correct: a, points: 3 },
        bis: { correct: b, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 23 genehmigt die Fahrt auf dem Gegengleis. Die beiden Zugmeldestellen begrenzen den Abschnitt eindeutig. Achtung: Das Befahren des Gegengleises (Befehl 23) ist nicht mit dem Weiterfahren vom Gegengleis (Befehl 25) zu verwechseln.",
      scene: {
        track: "double",
        electrified: true,
        train: { x: 430, label: train.label, dir: 1, track: "left" },
        trackLabels: true,
        cones: { x: 640, track: "right" },
        callouts: [
          {
            x: 150,
            y: 66,
            text: "Gegengleis befahren",
            sub: "Regelgleis gesperrt",
            tone: "red",
            to: [430, 250],
          },
          {
            x: 640,
            y: 176,
            text: `${a} → ${b}`,
            sub: "Befehl 23 · Gegengleis",
            tone: "blue",
            to: [720, 250],
          },
        ],
        badge: `Gegengleis · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 24 – rückfahrende Fahrten */
  "24": () => {
    const special = pickSpecial();
    const [a, b] = pickPair();
    const info = STATION_INFO[b];
    const km = pick(KMS);
    const time = randomTime();
    return make("24", {
      title: "Rückfahrende Fahrt",
      subtitle: `${special.kind} · ${a} – ${b}`,
      train: special.label,
      time,
      facts: [special.kind, `${a} bis ${b}`, `zurück bis ${km}`],
      situation: `Die ${special.label} fährt von ${a} nach ${b}. Sie ist nicht gekuppelt und muss nach dem Erledigen des Auftrags bis ${km} zurückkehren. Der Fahrdienstleister regelt die rückfahrende Fahrt; der Abschnitt ist frei und für Rückfahrten gesperrt.`,
      task: `Stelle den Befehl für die rückfahrende Fahrt nach ${b} und die Rückkehr bis ${km} aus.`,
      radio: radio(
        special,
        `Fahrdienstleiter, hier ${special.label}. Ich bin bereit zur Fahrt nach ${b} und kehre anschließend bis ${km} zurück. Ich bitte um Befehl.`
      ),
      fieldPoints: {
        stelle: { correct: b, points: 3 },
        km: { correct: km, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 24 gilt für rückfahrende Fahrten, insbesondere für Sperrfahrten und nicht gekuppelte Schiebetriebfahrzeuge. Ziel-Zugmeldestelle und der km-Punkt der Rückkehr müssen eindeutig angegeben werden, damit die Fahrt betrieblich abgesichert ist.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 300, label: special.label, dir: 1 },
        platform: { x: 780, name: b },
        signals: [
          {
            x: 620,
            label: signalName(info.esig),
            aspect: "langsam",
            km: info.km,
            name: info.esig,
          },
        ],
        callouts: [
          {
            x: 300,
            y: 62,
            text: "Rückfahrende Fahrt",
            sub: `${special.kind} · nicht gekuppelt`,
            tone: "amber",
            to: [520, 250],
          },
          {
            x: 650,
            y: 176,
            text: `zurück bis ${km}`,
            sub: `${b} · Rückfahrt gesichert`,
            tone: "blue",
            to: [780, 330],
          },
        ],
        badge: `${special.kind} · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 25 – Weiterfahren vom Gegengleis */
  "25": () => {
    const [a, b] = pickPair();
    const info = STATION_INFO[b];
    const train = pickTrain();
    const time = randomTime();
    const km = pick(KMS);
    return make("25", {
      title: "Weiterfahren vom Gegengleis",
      subtitle: `${b} · ab ${km}`,
      train: train.label,
      time,
      facts: ["Fahrt auf dem Gegengleis", `ab ${km}`, info.bft],
      situation: `Der ${train.label} fährt auf dem Gegengleis in Richtung ${b}. Ab ${km} soll er in den ${info.bft} ein- und ausfahren. Der Fahrdienstleister erteilt die Genehmigung für die Weiterfahrt vom Gegengleis; der Fahrweg ist frei.`,
      task: `Stelle den Befehl zum Weiterfahren vom Gegengleis ab ${km} in den ${info.bft} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich fahre auf dem Gegengleis und bitte um Befehl für die Einfahrt in den ${info.bft}.`
      ),
      fieldPoints: {
        ab: { correct: km, points: 3 },
        ziel: { correct: info.bft, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 25 regelt die Weiterfahrt vom Gegengleis sowie das Ein- und Ausfahren in einen Bahnhof oder Bahnhofsteil. Der km-Punkt und das Ziel müssen exakt angegeben werden. Er unterscheidet sich vom Befehl 23, der die Fahrt auf dem Gegengleis erst genehmigt.",
      scene: {
        track: "double",
        electrified: true,
        train: { x: 340, label: train.label, dir: 1, track: "left" },
        trackLabels: true,
        platform: { x: 800, name: `${b}` },
        callouts: [
          {
            x: 250,
            y: 62,
            text: "Weiterfahren vom Gegengleis",
            sub: `ab ${km}`,
            tone: "amber",
            to: [520, 250],
          },
          {
            x: 660,
            y: 176,
            text: info.bft,
            sub: `${b} · Ein- und Ausfahrt`,
            tone: "blue",
            to: [800, 330],
          },
        ],
        badge: `Gegengleis · ${b}`,
      },
    });
  },

  /* Befehl 26 – Halten auf dem Gegengleis */
  "26": () => {
    const [a, b] = pickPair();
    const train = pickTrain();
    const time = randomTime();
    const variants = [
      { ort: "vor Signal Ne 1", scene: { ne1: { x: 700, km: "km 12,4" } }, sub: "vor Signal Ne 1" },
      {
        ort: "in Höhe des Esig 70A",
        scene: { signals: [{ x: 700, label: "70A", aspect: "halt", km: "km 14,8", name: "Esig 70A" }] },
        sub: "Höhe Esig 70A",
      },
      {
        ort: "in Höhe des ASig 62B",
        scene: { signals: [{ x: 700, label: "62B", aspect: "halt", km: "km 8,9", name: "ASig 62B" }] },
        sub: "Höhe ASig 62B",
      },
    ];
    const v = pick(variants);
    const km = pick(KMS);
    return make("26", {
      title: "Halten auf dem Gegengleis",
      subtitle: `Gegengleis · ${a} – ${b}`,
      train: train.label,
      time,
      facts: ["Gegengleis", v.sub, km],
      situation: `Der ${train.label} fährt auf dem Gegengleis in Richtung ${b}. Wegen Bauarbeiten muss er auf dem Gegengleis ${v.ort} bei ${km} anhalten. Der Fahrdienstleister ordnet das Halten ausdrücklich an.`,
      task: `Stelle den Befehl zum Halten auf dem Gegengleis ${v.ort} bei ${km} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich fahre auf dem Gegengleis und bitte um Befehl, wo ich halten soll.`
      ),
      fieldPoints: {
        ort: { correct: v.ort, points: 3 },
        km: { correct: km, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 26 legt fest, wo der Zug auf dem Gegengleis zu halten hat. Der Halteort muss eindeutig beschrieben und mit dem km-Punkt ergänzt werden, damit der Triebfahrzeugführer ihn sicher zuordnen kann.",
      scene: {
        track: "double",
        electrified: true,
        train: { x: 330, label: train.label, dir: 1, track: "left" },
        trackLabels: true,
        ...v.scene,
        callouts: [
          {
            x: 215,
            y: 62,
            text: "Halt auf dem Gegengleis",
            sub: `${v.sub} · ${km}`,
            tone: "red",
            to: [700, 290],
            width: 260,
          },
          {
            x: 660,
            y: 172,
            text: "Bauarbeiten",
            sub: "Halteort exakt angeben",
            tone: "amber",
            to: [760, 340],
          },
        ],
        badge: `Gegengleis · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 27 – LZB abschalten */
  "27": () => {
    const [a, b] = pickPair();
    const ia = STATION_INFO[a];
    const ib = STATION_INFO[b];
    const train = pickTrain();
    const time = randomTime();
    return make("27", {
      title: "LZB abschalten",
      subtitle: `${a} – ${b}`,
      train: train.label,
      time,
      facts: ["LZB-Störung", `${a} – ${b}`, "LZB abschalten"],
      situation: `Die LZB-Streckeneinrichtung zwischen ${a} und ${b} ist gestört. Der Fahrdienstleister ordnet an, die LZB von ${a} bis ${b} abzuschalten, damit der Zug signalgeführt weiterfahren kann.`,
      task: `Stelle den Befehl zum Abschalten der LZB von ${a} bis ${b} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Die LZB zeigt eine Streckenstörung. Ich bitte um Befehl für die Weiterfahrt.`
      ),
      fieldPoints: {
        von: { correct: a, points: 3 },
        bis: { correct: b, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 27 beauftragt das Abschalten der LZB. Der Gültigkeitsbereich wird über die Zugmeldestellen festgelegt. Nach dem Abschalten fährt der Zug signalgeführt weiter; die LZB darf erst nach der Anweisung abgeschaltet werden.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 260, label: train.label, dir: 1 },
        lzb: true,
        signals: [
          { x: 120, label: signalName(ia.esig), aspect: "fahrt", km: ia.km, name: ia.esig },
          { x: 840, label: signalName(ib.esig), aspect: "fahrt", km: ib.km, name: ib.esig },
        ],
        callouts: [
          {
            x: 330,
            y: 66,
            text: "LZB-Streckeneinrichtung gestört",
            sub: `${a} – ${b}`,
            tone: "red",
            to: [560, 262],
            width: 260,
          },
          {
            x: 660,
            y: 178,
            text: "Signalgeführte Weiterfahrt",
            sub: "LZB abschalten",
            tone: "amber",
            to: [840, 300],
            width: 240,
          },
        ],
        badge: `LZB-Störung · ${a} – ${b}`,
      },
    });
  },

  /* Befehl 28 – ETCS-Level / Betriebsart wechseln */
  "28": () => {
    const station = pick(STATIONS);
    const train = pickTrain();
    const time = randomTime();
    const levels = ["ETCS Level 1", "ETCS Level 2", "ETCS Level 3"];
    const modes = ["Betriebsart SR", "Betriebsart OS", "Betriebsart FS", "Betriebsart TR"];
    const level = pick(levels);
    const mode = pick(modes);
    return make("28", {
      title: "ETCS-Stufe / Betriebsart wechseln",
      subtitle: `${station} · ETCS-Fahrzeuggerät`,
      train: train.label,
      time,
      facts: ["ETCS-Fahrterlaubnis fehlt", level, mode],
      situation: `Das ETCS-Fahrzeuggerät des ${train.label} empfängt im Bereich ${station} keine gültige Fahrterlaubnis. Der Fahrdienstleister ordnet an, den ${level} zu wählen und in die ${mode} zu wechseln, damit die Fahrt fortgesetzt werden kann.`,
      task: `Stelle den Befehl zum Wechsel auf ${level} und ${mode} aus.`,
      radio: radio(
        train,
        `Fahrdienstleiter, hier ${train.label}. Ich erhalte keine gültige ETCS-Fahrterlaubnis. Ich bitte um Befehl für Level und Betriebsart.`
      ),
      fieldPoints: {
        level: { correct: level, points: 3 },
        mode: { correct: mode, points: 3 },
      },
      measurePoints: {},
      explanation:
        "Befehl 28 enthält zwei getrennte Anweisungen: den ETCS-Level und die ETCS-Betriebsart. Beide Angaben müssen exakt dem Auftrag entsprechen – ein falscher Level oder eine falsche Betriebsart macht den Befehl unbrauchbar.",
      scene: {
        track: "single",
        electrified: true,
        train: { x: 300, label: train.label, dir: 1 },
        etcs: { level: "Level 2", mode: "FS", message: "Keine gültige Fahrterlaubnis" },
        callouts: [
          {
            x: 240,
            y: 228,
            text: "ETCS: keine Fahrterlaubnis",
            sub: `${level} · ${mode}`,
            tone: "red",
            to: [650, 120],
            width: 250,
          },
        ],
        badge: `ETCS · ${station}`,
      },
    });
  },
});

/* --------------------------------------------------------------------------
   Zusammenstellung eines Trainingslaufs
   Ein Lauf enthält zehn unterschiedliche Befehle. Über mehrere Läufe hinweg
   werden alle Befehle verwendet (Kartenstapel-Prinzip).
   -------------------------------------------------------------------------- */

const commandDeck = { remaining: [] };

function refillDeck(commandNumbers) {
  const pool = commandNumbers.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  commandDeck.remaining = pool;
}

function drawCommandNumbers(count, commandNumbers) {
  const drawn = [];
  const pool = commandNumbers.slice();

  while (drawn.length < count) {
    if (!commandDeck.remaining.length) {
      refillDeck(pool.filter((nr) => !drawn.includes(nr)));
    }
    const available = commandDeck.remaining.find((nr) => !drawn.includes(nr));
    if (available === undefined) break;
    commandDeck.remaining = commandDeck.remaining.filter((nr) => nr !== available);
    drawn.push(available);
  }

  // Falls der Stapel zu klein ist: mit noch nicht verwendeten Befehlen auffüllen.
  for (const nr of shuffle(pool)) {
    if (drawn.length >= count) break;
    if (!drawn.includes(nr)) drawn.push(nr);
  }

  return drawn;
}

function scenarioForCommand(nr, dbScenarios) {
  const fromDb = (dbScenarios || []).filter((s) => s.command === nr && s.active !== false);
  if (fromDb.length) return { ...pick(fromDb), source: "admin" };
  const generate = GENERATORS[nr];
  if (!generate) return null;
  return { ...generate(), source: "generated" };
}

/**
 * Baut einen Trainingslauf.
 * @param {number} count Anzahl der Situationen
 * @param {Array}  dbScenarios vom Admin gepflegte Situationen (optional)
 */
function buildScenarioQueue(count = 10, dbScenarios = []) {
  const commands = COMMANDS.map((c) => c.nr).filter(
    (nr) => (dbScenarios || []).some((s) => s.command === nr && s.active !== false) || GENERATORS[nr]
  );

  const chosen = drawCommandNumbers(count, commands);
  const queue = [];

  for (const nr of chosen) {
    const scenario = scenarioForCommand(nr, dbScenarios);
    if (scenario) queue.push(scenario);
  }

  // Auffüllen, falls einzelne Befehle nicht erzeugt werden konnten.
  if (queue.length < count) {
    for (const nr of shuffle(commands)) {
      if (queue.length >= count) break;
      if (queue.some((s) => s.command === nr)) continue;
      const scenario = scenarioForCommand(nr, dbScenarios);
      if (scenario) queue.push(scenario);
    }
  }

  return queue;
}

/* Beispielsituation für den Startbildschirm */
const PREVIEW_SCENARIO = {
  id: "preview",
  command: "1",
  title: "Halt zeigendes Einfahrsignal",
  subtitle: "Bf Musterstadt · Esig 60A",
  train: "RE 4711",
  time: "08:12",
  facts: ["Hp0 am Esig 60A", "Signalstörung bestätigt", "Block bis ASig 62B geprüft"],
  situation:
    "Der Regionalexpress RE 4711 steht vor dem Einfahrsignal 60A des Bahnhofs Musterstadt. Das Signal zeigt Hp0; die Signalstörung ist bestätigt. Der Block bis zum Ausfahrsignal 62B ist frei.",
  task: "Stelle den passenden Befehl aus.",
  radio: [
    {
      speaker: "TF",
      who: "RE 4711",
      text: "Fahrdienstleiter, hier RE 4711. Ich stehe vor dem Esig 60A in Musterstadt; das Signal zeigt Halt. Ich bitte um Befehl.",
    },
  ],
  fieldPoints: {
    signal: { correct: "Esig 60A", points: 2 },
    stelle: { correct: "Musterstadt", points: 1 },
    bis: { correct: "ASig 62B", points: 1 },
  },
  measurePoints: { sicht: { correct: true, points: 2 } },
  explanation:
    "Ein Halt zeigendes oder gestörtes Signal wird mit Befehl 1 überfahren. Signal, Zugmeldestelle und Weiterfahrt bis zum nächsten Signal müssen eindeutig benannt sein.",
  scene: {
    track: "single",
    electrified: true,
    train: { x: 250, label: "RE 4711", dir: 1 },
    signals: [
      { x: 590, label: "60A", aspect: "halt", km: "km 8,2", name: "Esig 60A" },
      { x: 865, label: "62B", aspect: "langsam", km: "km 8,9", name: "ASig 62B" },
    ],
    platform: { x: 770, name: "Musterstadt" },
    callouts: [
      {
        x: 78,
        y: 62,
        text: "Esig 60A zeigt Hp0",
        sub: "Halt · Signalstörung bestätigt",
        tone: "red",
        to: [590, 250],
      },
      {
        x: 690,
        y: 150,
        text: "Weiterfahrt bis 62B",
        sub: "Block geprüft und frei",
        tone: "green",
        to: [865, 280],
      },
    ],
    badge: "Befehlsstelle Musterstadt · 08:12",
  },
};
