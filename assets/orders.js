/* ==========================================================================
   Befehlstrainer – Befehlsvordruck und GSM-R-Zugfunk
   Gemeinsame Datenbasis für Training und Quiz:
   - Kopfzeilenfelder A, B, C, D, E, V, W, Y, Z
   - Tf-/Fdl-Namen, Datum, Uhrzeit, eindeutige Kennung, Vordruckanzahl
   - vollständiges GSM-R-Transkript (Tf-Meldung, Fdl-Anweisung, Rücklesen)
   - Vergleichslogik für die automatische Prüfung
   ========================================================================== */

const ORDER_HEADER_FIELDS = [
  {
    id: "A",
    label: "Zugnummer",
    placeholder: "z. B. RE 4711",
    hint: "Zugnummer genau wie im Zugfunk.",
    reason: "Die Zugnummer steht in der Tf-Meldung und in der Fdl-Anweisung.",
  },
  {
    id: "B",
    label: "Datum",
    placeholder: "TT.MM.JJJJ",
    hint: "Tagesdatum der Anweisung.",
    reason: "Das Datum wird vom Fahrdienstleiter mit Datum und Uhrzeit angesagt.",
  },
  {
    id: "C",
    label: "Standort des Zuges",
    placeholder: "z. B. Bf Musterstadt · Esig 60A",
    hint: "Standort aus der Tf-Meldung.",
    reason: "Der Standort des Zuges muss den Ort eindeutig benennen.",
  },
  {
    id: "D",
    label: "Standort des Anweisenden",
    placeholder: "z. B. Bf Musterstadt",
    hint: "Dienststelle des Fdl.",
    reason: "Der Standort des Anweisenden ist die Dienststelle des Fahrdienstleiters.",
  },
  {
    id: "E",
    label: "Anzahl der Vordrucke",
    placeholder: "z. B. 1",
    hint: "Anzahl der ausgegebenen Vordrucke.",
    reason: "Die Anzahl der Vordrucke wird vom Fahrdienstleiter angesagt.",
  },
  {
    id: "V",
    label: "Name Tf",
    placeholder: "Nachname Tf",
    hint: "Name aus der Tf-Meldung.",
    reason: "Der Name des Triebfahrzeugführers steht in der Tf-Meldung.",
  },
  {
    id: "W",
    label: "Name Anweisender",
    placeholder: "Nachname Fdl",
    hint: "Name des Fahrdienstleiters.",
    reason: "Der Name des Anweisenden steht in der Fdl-Anweisung.",
  },
  {
    id: "Y",
    label: "Uhrzeit",
    placeholder: "HH:MM",
    hint: "Uhrzeit der Anweisung.",
    reason: "Die Uhrzeit wird mit Datum und Kennung angesagt.",
  },
  {
    id: "Z",
    label: "Eindeutige Kennung",
    placeholder: "z. B. BT-RE4711-0812",
    hint: "Kennung aus der Fdl-Anweisung.",
    reason: "Die eindeutige Kennung verbindet Vordruck und Zugfunkmeldung.",
  },
];

const ORDER_TF_NAMES = [
  "Weber",
  "Schneider",
  "Hoffmann",
  "Krüger",
  "Neumann",
  "Brandt",
  "Keller",
  "Vogel",
  "Hartmann",
  "Richter",
];

const ORDER_FDL_NAMES = [
  "Müller",
  "Wagner",
  "Becker",
  "Schulz",
  "Koch",
  "Wolf",
  "Zimmermann",
  "Maier",
  "Lehmann",
  "König",
];

const ORDER_FRONT_COMMANDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function orderSectionOf(nr) {
  return ORDER_FRONT_COMMANDS.includes(String(nr)) ? "vorne" : "hinten";
}

function orderSeed(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function orderTrainKey(train) {
  return String(train || "ZUG")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "ZUG";
}

function orderClockDigits(time) {
  const digits = String(time || "").replace(/\D/g, "").slice(0, 4);
  return digits || "0000";
}

function orderKennung(train, time) {
  return `BT-${orderTrainKey(train)}-${orderClockDigits(time)}`;
}

function orderNormalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[3].padStart(2, "0")}.${iso[2].padStart(2, "0")}.${iso[1]}`;
  const de = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (de) {
    const year = de[3].length === 2 ? `20${de[3]}` : de[3];
    return `${de[1].padStart(2, "0")}.${de[2].padStart(2, "0")}.${year}`;
  }
  return text;
}

function orderToday() {
  return new Date().toLocaleDateString("de-DE");
}

function orderStationFromScenario(scenario) {
  const base = scenario || {};
  const preset = base.order && typeof base.order === "object" ? base.order : {};
  const presetStation = preset.fdl_station || preset.fdlStation;
  if (presetStation) return String(presetStation);

  const text = [
    base.subtitle,
    base.location,
    base.situation,
    base.title,
    ...(Array.isArray(base.facts) ? base.facts : []),
  ]
    .filter(Boolean)
    .join(" ");
  if (typeof STATIONS !== "undefined" && Array.isArray(STATIONS)) {
    const found = STATIONS.find((station) => text.includes(station));
    if (found) return found;
  }
  return "Musterstadt";
}

function orderFieldPoints(scenario) {
  const base = scenario || {};
  return base.fieldPoints || base.field_points || {};
}

function orderMeasurePoints(scenario) {
  const base = scenario || {};
  return base.measurePoints || base.measure_points || {};
}

function orderExpectedFieldValues(scenario) {
  const points = orderFieldPoints(scenario);
  const values = {};
  Object.entries(points).forEach(([id, target]) => {
    if (target && typeof target === "object") values[id] = target.correct;
    else values[id] = target;
  });
  return values;
}

function orderRequiredMeasureIds(scenario) {
  return Object.entries(orderMeasurePoints(scenario))
    .filter(([, target]) => target === true || (target && target.correct))
    .map(([id]) => id);
}

/**
 * Baut alle Vordruckdaten einer Situation. Das Ergebnis wird an der Situation
 * zwischengespeichert, damit Datum, Namen und Kennung während eines Laufs
 * unverändert bleiben.
 */
function buildOrderData(scenario) {
  const base = scenario || {};
  if (base.__orderCache) return base.__orderCache;

  const preset = base.order && typeof base.order === "object" ? base.order : {};
  const presetHeader = preset.header && typeof preset.header === "object" ? preset.header : {};
  const commandNr = String(base.command || base.command_nr || preset.command || "");
  const command = typeof getCommand === "function" ? getCommand(commandNr) : null;

  const train = String(presetHeader.A || base.train || preset.train || "Zug").trim();
  const time = String(presetHeader.Y || base.time || preset.time || "00:00").trim();
  const seed = orderSeed(`${base.id || base.prompt || base.title || train}|${commandNr}`);
  const tfName = String(
    preset.tf_name || preset.tfName || ORDER_TF_NAMES[seed % ORDER_TF_NAMES.length]
  );
  const fdlName = String(
    preset.fdl_name || preset.fdlName || ORDER_FDL_NAMES[Math.floor(seed / 7) % ORDER_FDL_NAMES.length]
  );
  const fdlStation = orderStationFromScenario(base);
  const date = orderNormalizeDate(preset.date || base.date || orderToday());
  const copies = String(preset.copies ?? preset.copiesOf ?? 1);
  const location = String(
    presetHeader.C || base.subtitle || base.location || `Bf ${fdlStation}`
  ).trim();
  const kennung = String(preset.kennung || presetHeader.Z || orderKennung(train, time));

  const header = {
    A: train,
    B: date,
    C: location,
    D: /^(Bf|Bft|Fdl)\b/i.test(fdlStation) ? fdlStation : `Bf ${fdlStation}`,
    E: copies,
    V: tfName,
    W: fdlName,
    Y: time,
    Z: kennung,
  };
  Object.entries(presetHeader).forEach(([key, value]) => {
    if (String(value ?? "").trim()) header[key] = value;
  });
  ORDER_HEADER_FIELDS.forEach((field) => {
    header[field.id] = String(header[field.id] ?? "").trim();
  });

  const derivedValues = orderExpectedFieldValues(base);
  const candidateValues =
    preset.command_values && typeof preset.command_values === "object"
      ? preset.command_values
      : preset.commandValues && typeof preset.commandValues === "object"
      ? preset.commandValues
      : {};
  const commandValues = { ...derivedValues, ...candidateValues };
  const requiredMeasures = Array.isArray(preset.required_measures)
    ? preset.required_measures.slice()
    : orderRequiredMeasureIds(base);

  const page = orderSectionOf(commandNr);
  const pageCommands =
    typeof COMMANDS !== "undefined" && Array.isArray(COMMANDS)
      ? COMMANDS.filter((item) => orderSectionOf(item.nr) === page)
      : [];

  const order = {
    command,
    commandNr,
    train,
    time,
    date,
    copies,
    tfName,
    fdlName,
    fdlStation,
    location,
    kennung,
    header,
    fieldPoints: orderFieldPoints(base),
    measurePoints: orderMeasurePoints(base),
    commandValues,
    requiredMeasures,
    page,
    pageCommands,
    radio: [],
  };
  order.radio = buildOrderRadio(order);

  base.order = {
    ...preset,
    tf_name: order.tfName,
    fdl_name: order.fdlName,
    fdl_station: order.fdlStation,
    date: order.date,
    copies: Number(order.copies) || 1,
    kennung: order.kennung,
    command: commandNr,
    header: order.header,
    command_values: order.commandValues,
    required_measures: order.requiredMeasures,
  };
  base.__orderCache = order;
  return order;
}

function enrichOrderQueue(queue) {
  (queue || []).forEach((scenario) => {
    if (scenario) buildOrderData(scenario);
  });
  return queue || [];
}

function buildOrderRadio(order) {
  if (!order || !order.command) return [];
  const command = order.command;
  const header = order.header;

  const values = command.fields.map(
    (field) => `${field.label}: ${order.commandValues[field.id] || "—"}`
  );
  const required = command.measures
    .filter((measure) => order.requiredMeasures.includes(measure.id))
    .map((measure) => measure.label);
  const notRequired = command.measures
    .filter((measure) => !order.requiredMeasures.includes(measure.id))
    .map((measure) => measure.label);
  const headerLine = ORDER_HEADER_FIELDS.map(
    (field) => `${field.id} ${field.label}: ${header[field.id] || "—"}`
  ).join(" · ");

  return [
    {
      speaker: `Tf ${order.tfName}`,
      who: order.train,
      text:
        `Fahrdienstleiter, hier Tf ${order.tfName} auf ${order.train}. ` +
        `Ich stehe ${order.location}. Meine Uhrzeit ist ${order.time}. ` +
        `Ich bitte um Befehl.`,
    },
    {
      speaker: `Fdl ${order.fdlName}`,
      who: header.D,
      text:
        `Tf ${order.tfName}, hier Fdl ${order.fdlName} in ${header.D}. ` +
        `Ich stelle Befehl ${command.nr} – ${command.title} aus. ` +
        `Angaben: ${values.join(" · ")}. ` +
        `Zusätzliche Anweisungen: ${required.length ? required.join(" · ") : "keine"}. ` +
        `${notRequired.length ? `Nicht ankreuzen: ${notRequired.join(" · ")}. ` : ""}` +
        `Für die Kopfzeile: ${headerLine}.`,
    },
    {
      speaker: `Tf ${order.tfName}`,
      who: order.train,
      text:
        `Befehl ${command.nr} verstanden. ${values.join(" · ")}. ` +
        `Zusatzmaßnahmen: ${required.length ? required.join(" · ") : "keine"}. ` +
        `Kopfzeile: ${headerLine}. ` +
        `Tf ${order.tfName} bestätigt.`,
    },
  ];
}

function orderNorm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[„“”‚‘’]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,]+$/g, "");
}

function orderHeaderValueOk(id, given, expected) {
  const left = orderNorm(given);
  const right = orderNorm(expected);
  if (!right) return true;
  if (!left) return false;

  if (id === "E") {
    const leftDigits = left.replace(/\D/g, "");
    const rightDigits = right.replace(/\D/g, "");
    return Boolean(rightDigits) && leftDigits === rightDigits;
  }
  if (id === "B") {
    return left.replace(/[-/]/g, ".") === right.replace(/[-/]/g, ".");
  }
  if (id === "Y") {
    const match = left.match(/\d{1,2}[:.]\d{2}/);
    return Boolean(match) && match[0].replace(".", ":") === right.replace(".", ":");
  }
  if (id === "V" || id === "W") {
    return left === right || left.includes(right) || (left.length >= 3 && right.includes(left));
  }
  return left === right;
}

function orderValueMatches(given, expected) {
  return orderNorm(given) === orderNorm(expected);
}

function orderHeaderChecks(order, givenHeader) {
  const header = givenHeader && typeof givenHeader === "object" ? givenHeader : {};
  const checks = ORDER_HEADER_FIELDS.map((field) => {
    const given = String(header[field.id] ?? "").trim();
    const expected = String(order.header[field.id] ?? "").trim();
    const ok = orderHeaderValueOk(field.id, given, expected);
    return {
      group: "Kopfzeile",
      label: `${field.id} – ${field.label}`,
      given: given || "—",
      expected,
      ok,
      points: 0,
      max: 0,
      note: field.reason,
    };
  });
  return { checks, ok: checks.every((check) => check.ok) };
}

function orderStrikeChecks(order, givenStruck) {
  const struck = givenStruck && typeof givenStruck === "object" ? givenStruck : {};
  const rows = order.pageCommands || [];
  const errors = [];
  rows.forEach((command) => {
    const expected = command.nr !== order.commandNr;
    const actual = Boolean(struck[command.nr]);
    if (expected === actual) return;
    errors.push({
      group: "Durchstreichung",
      label: `Befehl ${command.nr} – ${command.title}`,
      given: actual ? "durchgestrichen" : "nicht durchgestrichen",
      expected: expected ? "durchstreichen" : "nicht durchstreichen",
      ok: false,
      points: 0,
      max: 0,
      note: "Nur der zutreffende Befehl bleibt offen; alle anderen Zeilen dieser Vordruckseite werden durchgestrichen.",
    });
  });

  if (!errors.length) {
    return {
      checks: [
        {
          group: "Durchstreichung",
          label: "Nicht zutreffende Zeilen",
          given: "alle durchgestrichen",
          expected: "alle durchgestrichen",
          ok: true,
          points: 0,
          max: 0,
          note: "Die Vordruckseite ist vollständig bearbeitet.",
        },
      ],
      ok: true,
    };
  }
  return { checks: errors, ok: false };
}

function orderMissingHeaderFields(header) {
  return ORDER_HEADER_FIELDS.filter(
    (field) => !String((header && header[field.id]) ?? "").trim()
  );
}

function orderHeaderSummary(order) {
  return ORDER_HEADER_FIELDS.map((field) => ({
    id: field.id,
    label: field.label,
    value: order.header[field.id] || "—",
  }));
}
