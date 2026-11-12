/* ==========================================================================
   Befehlstrainer – Illustrationen
   Erzeugt aus einer Szenenbeschreibung ein schematisches Streckenbild (SVG).
   ========================================================================== */

const TONES = {
  red: "#dc2626",
  amber: "#d97706",
  blue: "#2563eb",
  green: "#15803d",
  slate: "#475569",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function drawDefs() {
  return `
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#eaf2fb"/>
      <stop offset="70%" stop-color="#f8fbfd"/>
      <stop offset="100%" stop-color="#fdfefe"/>
    </linearGradient>
    <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dbe4d5"/>
      <stop offset="100%" stop-color="#cbd8c4"/>
    </linearGradient>
    <linearGradient id="railGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a8b0ba"/>
      <stop offset="50%" stop-color="#7b8490"/>
      <stop offset="100%" stop-color="#a8b0ba"/>
    </linearGradient>
    <linearGradient id="trainGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ef1b2c"/>
      <stop offset="55%" stop-color="#d4001f"/>
      <stop offset="100%" stop-color="#a80018"/>
    </linearGradient>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2b3a4b"/>
      <stop offset="100%" stop-color="#101a25"/>
    </linearGradient>
    <linearGradient id="fogGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.72"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111a25"/>
      <stop offset="100%" stop-color="#0a1018"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
    <filter id="glowRed" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowGreen" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowAmber" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="ballastPattern" width="26" height="14" patternUnits="userSpaceOnUse">
      <rect width="26" height="14" fill="#d8d0c1"/>
      <circle cx="4" cy="5" r="1.4" fill="#b9ad99"/>
      <circle cx="15" cy="10" r="1.6" fill="#c4b9a6"/>
      <circle cx="22" cy="3" r="1.1" fill="#a99d88"/>
    </pattern>
  </defs>`;
}

function drawSky() {
  return `
  <rect width="960" height="440" fill="url(#skyGrad)"/>
  <circle cx="845" cy="72" r="34" fill="#fff4cf" opacity="0.55"/>
  <g fill="#ffffff" opacity="0.72">
    <ellipse cx="180" cy="82" rx="52" ry="15"/>
    <ellipse cx="215" cy="74" rx="35" ry="14"/>
    <ellipse cx="540" cy="54" rx="44" ry="12"/>
  </g>
  <g opacity="0.5">
    <path d="M0 306 L120 272 L235 296 L340 268 L470 300 L590 276 L710 298 L820 274 L960 300 L960 330 L0 330 Z" fill="#cfdcc9"/>
    <path d="M0 320 L90 300 L205 322 L330 296 L470 322 L610 302 L760 324 L880 306 L960 318 L960 340 L0 340 Z" fill="#c2d2bb"/>
  </g>
  <rect y="312" width="960" height="128" fill="url(#grassGrad)"/>`;
}

function drawTrack(y, { far = false } = {}) {
  const scale = far ? 0.88 : 1;
  const sleeperH = 7 * scale;
  const railTop = y;
  const railBottom = y + 11 * scale;
  let sleepers = "";
  for (let x = 4; x < 960; x += 30) {
    sleepers += `<rect x="${x}" y="${railBottom + 2}" width="${20 * scale}" height="${sleeperH}" rx="2" fill="#b3a894"/>`;
  }
  return `
  <g opacity="${far ? "0.82" : "1"}">
    <rect y="${railTop - 16 * scale}" width="960" height="${44 * scale}" fill="url(#ballastPattern)" opacity="0.95"/>
    <rect y="${railTop - 16 * scale}" width="960" height="${44 * scale}" fill="#cfc7b7" opacity="0.45"/>
    ${sleepers}
    <line x1="0" y1="${railTop}" x2="960" y2="${railTop}" stroke="url(#railGrad)" stroke-width="${4 * scale}" stroke-linecap="round"/>
    <line x1="0" y1="${railBottom}" x2="960" y2="${railBottom}" stroke="#6f7884" stroke-width="${3 * scale}" stroke-linecap="round"/>
    <line x1="0" y1="${railTop - 1.5}" x2="960" y2="${railTop - 1.5}" stroke="#d7dde4" stroke-width="${1.2 * scale}" opacity="0.8"/>
  </g>`;
}

function drawCatenary(damaged) {
  const poles = [55, 470, 905];
  let out = `<g stroke="#8994a3" stroke-width="5" stroke-linecap="round" opacity="0.9">`;
  poles.forEach((x) => {
    out += `<line x1="${x}" y1="384" x2="${x}" y2="206"/>`;
    out += `<line x1="${x}" y1="222" x2="${x + (x === 905 ? -60 : 60)}" y2="222" stroke-width="4"/>`;
  });
  out += `</g>`;
  if (damaged) {
    out += `
    <g stroke-linecap="round">
      <line x1="0" y1="224" x2="360" y2="224" stroke="#7d8794" stroke-width="3"/>
      <line x1="730" y1="224" x2="960" y2="224" stroke="#7d8794" stroke-width="3"/>
      <path d="M360 224 Q 410 260 452 246 Q 500 228 545 270 Q 570 294 600 320" fill="none" stroke="#dc2626" stroke-width="4" stroke-dasharray="9 7"/>
      <path d="M730 224 Q 700 246 665 252" fill="none" stroke="#dc2626" stroke-width="4" stroke-dasharray="9 7"/>
      <circle cx="600" cy="322" r="7" fill="#dc2626"/>
      <path d="M585 322 L615 322 M600 307 L600 337" stroke="#fff" stroke-width="2"/>
    </g>`;
  } else {
    out += `<line x1="0" y1="224" x2="960" y2="224" stroke="#7d8794" stroke-width="3"/>`;
    out += `<line x1="0" y1="228" x2="960" y2="228" stroke="#9aa4b1" stroke-width="1.5"/>`;
  }
  return out;
}

function drawPlatform(platform) {
  const x = platform.x;
  const name = platform.name;
  return `
  <g>
    <rect x="${x - 150}" y="336" width="300" height="28" rx="4" fill="#cbd3dc"/>
    <rect x="${x - 150}" y="336" width="300" height="5" fill="#e8edf3"/>
    <rect x="${x - 150}" y="360" width="300" height="4" fill="#9aa6b4"/>
    <g>
      <rect x="${x - 92}" y="304" width="184" height="26" rx="5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
      <text x="${x}" y="321" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#1f2937">${esc(name)}</text>
      <line x1="${x - 50}" y1="330" x2="${x - 50}" y2="338" stroke="#64748b" stroke-width="3"/>
      <line x1="${x + 50}" y1="330" x2="${x + 50}" y2="338" stroke="#64748b" stroke-width="3"/>
    </g>
    <g fill="#64748b" opacity="0.8">
      <circle cx="${x + 82}" cy="348" r="4"/>
      <path d="M${x + 78} 354 h8 l2 12 h-12 z"/>
      <circle cx="${x + 108}" cy="350" r="3.4"/>
      <path d="M${x + 105} 355 h6 l1.6 10 h-9 z"/>
    </g>
  </g>`;
}

function signalLamp(cx, cy, color, active) {
  if (active) {
    const filter =
      color === "#ef4444" ? "url(#glowRed)" : color === "#22c55e" ? "url(#glowGreen)" : "url(#glowAmber)";
    return `
      <circle cx="${cx}" cy="${cy}" r="15" fill="${color}" opacity="0.35"/>
      <circle cx="${cx}" cy="${cy}" r="9.5" fill="${color}" filter="${filter}" stroke="#f8fafc" stroke-width="1"/>
      <circle cx="${cx - 3}" cy="${cy - 3}" r="3" fill="#ffffff" opacity="0.55"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="9.5" fill="#232a34" stroke="#3f4854" stroke-width="1.4"/>`;
}

function drawSignal(sig, baseY) {
  const x = sig.x;
  const headY = baseY - 152;
  const aspect = sig.aspect || "halt";
  const top = aspect === "halt";
  const middle = aspect === "langsam";
  const bottom = aspect === "fahrt" || aspect === "langsam";
  let head = `
    <rect x="${x - 3}" y="${headY + 80}" width="6" height="${baseY - headY - 80}" rx="2" fill="#6b7280"/>
    <rect x="${x - 23}" y="${headY}" width="46" height="94" rx="10" fill="#18202b" stroke="#4b5563" stroke-width="2"/>
    <rect x="${x - 17}" y="${headY + 7}" width="34" height="80" rx="7" fill="#111827" stroke="#374151" stroke-width="1"/>
    ${signalLamp(x, headY + 24, "#ef4444", top)}
    ${signalLamp(x, headY + 47, "#f59e0b", middle)}
    ${signalLamp(x, headY + 70, "#22c55e", bottom)}
    <rect x="${x - 24}" y="${baseY - 22}" width="48" height="20" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="${x}" y="${baseY - 7.5}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="10.5" font-weight="700" fill="#1f2937">${esc(sig.label)}</text>`;

  if (aspect === "gestoert") {
    head += `
      <circle cx="${x}" cy="${headY + 47}" r="27" fill="none" stroke="#dc2626" stroke-width="4"/>
      <path d="M${x - 17} ${headY + 30} L${x + 17} ${headY + 64} M${x + 17} ${headY + 30} L${x - 17} ${headY + 64}" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (aspect === "dunkel") {
    head += `
      <circle cx="${x}" cy="${headY + 47}" r="30" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5"/>
      <text x="${x}" y="${headY + 52}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="18" font-weight="800" fill="#94a3b8">×</text>`;
  }
  let km = "";
  if (sig.km) {
    km = `<text x="${x + 34}" y="${baseY - 8}" font-family="Segoe UI, sans-serif" font-size="10" fill="#475569">${esc(sig.km)}</text>`;
  }
  return `<g>${head}${km}</g>`;
}

function drawNe1(ne1) {
  const x = ne1.x;
  return `
  <g>
    <rect x="${x - 3}" y="266" width="6" height="118" fill="#6b7280"/>
    <rect x="${x - 27}" y="232" width="54" height="38" rx="4" fill="#f8fafc" stroke="#1f2937" stroke-width="2.5"/>
    <path d="M${x - 27} 232 L${x + 27} 270 M${x + 27} 232 L${x - 27} 270" stroke="#dc2626" stroke-width="8"/>
    <rect x="${x - 27}" y="232" width="54" height="38" rx="4" fill="none" stroke="#1f2937" stroke-width="2.5"/>
    <text x="${x}" y="258" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="13" font-weight="800" fill="#111827">Ne 1</text>
    <text x="${x}" y="286" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="10" font-weight="600" fill="#475569">${esc(ne1.km)}</text>
  </g>`;
}

function drawEoa(eoa, baseY) {
  const x = eoa.x;
  return `
  <g>
    <rect x="${x - 3}" y="${baseY - 130}" width="6" height="130" fill="#6b7280"/>
    <rect x="${x - 24}" y="${baseY - 154}" width="48" height="34" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="2"/>
    <text x="${x}" y="${baseY - 132}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="800" fill="#111827">${esc(eoa.label)}</text>
    <path d="M${x - 18} ${baseY - 110} L${x + 18} ${baseY - 110}" stroke="#dc2626" stroke-width="3"/>
  </g>`;
}

function drawMissingSignal(sig, baseY) {
  const x = sig.x;
  return `
  <g>
    <rect x="${x - 3}" y="${baseY - 160}" width="6" height="160" fill="#94a3b8"/>
    <rect x="${x - 23}" y="${baseY - 206}" width="46" height="80" rx="9" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 5"/>
    <circle cx="${x}" cy="${baseY - 178}" r="10" fill="#cbd5e1"/>
    <circle cx="${x}" cy="${baseY - 154}" r="10" fill="#cbd5e1"/>
    <text x="${x}" y="${baseY - 220}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#64748b">${esc(sig.label)}</text>
    <path d="M${x - 16} ${baseY - 194} L${x + 16} ${baseY - 162} M${x + 16} ${baseY - 194} L${x - 16} ${baseY - 162}" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/>
  </g>`;
}

function drawTrain(train) {
  const baseY = train.track === "left" ? 300 : 384;
  const x = train.x;
  const dir = train.dir === -1 ? -1 : 1;
  const bodyW = 200;
  const bodyH = 78;
  const topY = -bodyH;
  const pantographUp = train.pantograph !== "down";
  let windows = "";
  for (let i = 0; i < 4; i += 1) {
    windows += `<rect x="${22 + i * 34}" y="-66" width="24" height="26" rx="4" fill="url(#glassGrad)" stroke="#0b1220" stroke-width="1"/>`;
  }
  const nose = dir === 1
    ? `<path d="M150 ${topY} H176 Q200 ${topY} 200 ${topY + 32} V-18 H150 Z" fill="url(#trainGrad)"/>
       <path d="M182 ${topY + 8} L199 ${topY + 34} L182 ${topY + 34} Z" fill="#0f172a" opacity="0.85"/>`
    : `<path d="M50 ${topY} H24 Q0 ${topY} 0 ${topY + 32} V-18 H50 Z" fill="url(#trainGrad)"/>
       <path d="M18 ${topY + 8} L1 ${topY + 34} L18 ${topY + 34} Z" fill="#0f172a" opacity="0.85"/>`;
  const panto = train.pantograph === "down"
    ? `<path d="M78 -92 L104 -82 L128 -92 L150 -82" fill="none" stroke="#334155" stroke-width="3"/>`
    : `<path d="M84 -92 L108 -128 L142 -128 L156 -160" fill="none" stroke="#334155" stroke-width="3"/>
       <line x1="118" y1="-160" x2="176" y2="-160" stroke="#334155" stroke-width="3"/>
       <line x1="118" y1="-160" x2="142" y2="-128" stroke="#334155" stroke-width="2"/>`;
  return `
  <g transform="translate(${x}, ${baseY})">
    <ellipse cx="102" cy="4" rx="96" ry="9" fill="#0f172a" opacity="0.18"/>
    ${panto}
    <ellipse cx="${dir === 1 ? 150 : 50}" cy="-9" rx="15" ry="15" fill="#1f2937"/>
    <ellipse cx="${dir === 1 ? 150 : 50}" cy="-9" rx="6" ry="6" fill="#94a3b8"/>
    <ellipse cx="${dir === 1 ? 52 : 148}" cy="-9" rx="15" ry="15" fill="#1f2937"/>
    <ellipse cx="${dir === 1 ? 52 : 148}" cy="-9" rx="6" ry="6" fill="#94a3b8"/>
    <path d="M12 ${topY} H188 Q200 ${topY} 200 ${topY + 14} V-18 H0 V${topY + 14} Q0 ${topY} 12 ${topY} Z" fill="url(#trainGrad)"/>
    <rect x="0" y="-30" width="200" height="7" fill="#f8fafc" opacity="0.95"/>
    <rect x="0" y="-21" width="200" height="3" fill="#7f1d1d" opacity="0.5"/>
    ${windows}
    <rect x="150" y="-66" width="30" height="26" rx="5" fill="#0b1220"/>
    <rect x="152" y="-64" width="26" height="22" rx="4" fill="url(#glassGrad)"/>
    ${nose}
    <text x="100" y="-41" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#ffffff" letter-spacing="0.4">${esc(train.label)}</text>
    <rect x="12" y="-16" width="176" height="4" rx="2" fill="#0f172a" opacity="0.5"/>
    <g transform="translate(${dir === 1 ? 218 : -18}, -110)" opacity="0.8">
      <path d="M0 0 L${dir === 1 ? 26 : -26} 0" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <path d="M${dir === 1 ? 20 : -20} -6 L${dir === 1 ? 28 : -28} 0 L${dir === 1 ? 20 : -20} 6" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>`;
}

function drawSpeedBoard(board) {
  const x = board.x;
  return `
  <g>
    <line x1="${x}" y1="364" x2="${x}" y2="268" stroke="#64748b" stroke-width="4"/>
    <rect x="${x - 30}" y="214" width="60" height="58" rx="7" fill="#ffffff" stroke="#1f2937" stroke-width="2.5"/>
    <text x="${x}" y="252" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="28" font-weight="800" fill="#111827">${esc(board.speed)}</text>
    <text x="${x}" y="264" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="9" font-weight="600" fill="#475569">km/h</text>
    <path d="M${x - 30} 272 L${x + 30} 272 L${x} 288 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/>
    <text x="${x}" y="283" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="9" font-weight="800" fill="#111827">!</text>
  </g>`;
}

function drawCrossing(crossing) {
  const x = crossing.x;
  return `
  <g>
    <path d="M${x - 72} 440 L${x - 44} 374 L${x + 44} 374 L${x + 72} 440 Z" fill="#6b7280"/>
    <path d="M${x - 66} 440 L${x - 40} 378 L${x + 40} 378 L${x + 66} 440 Z" fill="#7b8490"/>
    <path d="M${x} 386 L${x - 10} 432" stroke="#f8fafc" stroke-width="5" stroke-dasharray="14 12" opacity="0.9"/>
    <g>
      <rect x="${x - 96}" y="332" width="8" height="56" rx="3" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
      <rect x="${x - 96}" y="332" width="52" height="7" rx="3" fill="#dc2626"/>
      <rect x="${x - 96}" y="338" width="52" height="7" rx="3" fill="#f8fafc"/>
      <rect x="${x - 96}" y="344" width="52" height="7" rx="3" fill="#dc2626"/>
    </g>
    <g transform="translate(${x + 54}, ${318})">
      <rect x="-30" y="-24" width="60" height="44" rx="5" fill="#f8fafc" stroke="#1f2937" stroke-width="2"/>
      <path d="M-20 -20 L20 16 M20 -20 L-20 16" stroke="#dc2626" stroke-width="6"/>
      <rect x="-30" y="-24" width="60" height="44" rx="5" fill="none" stroke="#1f2937" stroke-width="2"/>
      <line x1="0" y1="20" x2="0" y2="46" stroke="#64748b" stroke-width="4"/>
    </g>
    <g transform="translate(${x - 46}, 402)">
      <rect x="-26" y="-15" width="52" height="22" rx="6" fill="#f59e0b" stroke="#92400e" stroke-width="1.5"/>
      <rect x="-16" y="-24" width="32" height="12" rx="4" fill="#fbbf24" stroke="#92400e" stroke-width="1.2"/>
      <circle cx="-15" cy="8" r="5" fill="#1f2937"/>
      <circle cx="15" cy="8" r="5" fill="#1f2937"/>
    </g>
    <g>
      <path d="M${x + 72} 382 L${x + 72} 330" stroke="#64748b" stroke-width="4"/>
      <rect x="${x + 60}" y="306" width="24" height="24" rx="4" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
      <text x="${x + 72}" y="324" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="16" font-weight="800" fill="#92400e">!</text>
      <text x="${x + 72}" y="348" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="10" font-weight="600" fill="#475569">${esc(crossing.km)}</text>
    </g>
  </g>`;
}

function drawPeople(people) {
  const x = people.x;
  return `
  <g>
    <circle cx="${x}" cy="296" r="7" fill="#334155"/>
    <path d="M${x - 7} 304 h14 l4 30 h-22 z" fill="#334155"/>
    <circle cx="${x + 22}" cy="301" r="6" fill="#475569"/>
    <path d="M${x + 16} 308 h13 l3 26 h-19 z" fill="#475569"/>
    <circle cx="${x}" cy="322" r="32" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="7 6" opacity="0.9"/>
  </g>`;
}

function drawCones(cones) {
  const y = cones.track === "right" ? 376 : 292;
  const x = cones.x;
  return `
  <g>
    <path d="M${x - 12} ${y} L${x - 4} ${y - 26} H${x + 4} L${x + 12} ${y} Z" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/>
    <path d="M${x - 7.5} ${y - 14} H${x + 7.5}" stroke="#f8fafc" stroke-width="5"/>
    <path d="M${x + 30} ${y} L${x + 38} ${y - 20} H${x + 46} L${x + 54} ${y} Z" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/>
    <path d="M${x + 34.5} ${y - 10} H${x + 49.5}" stroke="#f8fafc" stroke-width="4"/>
  </g>`;
}

function drawTrackLabels() {
  return `
  <g font-family="Segoe UI, sans-serif" font-size="11" font-weight="700">
    <rect x="18" y="252" width="92" height="22" rx="11" fill="#eef2f7" stroke="#cbd5e1"/>
    <circle cx="31" cy="263" r="4" fill="#f59e0b"/>
    <text x="41" y="267" fill="#475569">Gegengleis</text>
    <rect x="840" y="372" width="90" height="22" rx="11" fill="#eef2f7" stroke="#cbd5e1"/>
    <circle cx="853" cy="383" r="4" fill="#2563eb"/>
    <text x="863" y="387" fill="#475569">Regelgleis</text>
  </g>`;
}

function drawLzb() {
  return `
  <g>
    <path d="M0 410 H960" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.55"/>
    <g transform="translate(82, 402)">
      <rect x="-18" y="-42" width="36" height="34" rx="4" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
      <text x="0" y="-20" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="10" font-weight="800" fill="#1d4ed8">LZB</text>
      <line x1="0" y1="-8" x2="0" y2="6" stroke="#64748b" stroke-width="3"/>
    </g>
  </g>`;
}

function drawCallout(callout) {
  const tone = TONES[callout.tone] || TONES.slate;
  const width = callout.width || 252;
  const height = 66;
  const { x, y, to } = callout;
  const anchorX = Math.max(x + 16, Math.min(x + width - 16, to[0]));
  const leader =
    to[0] === anchorX
      ? `M${anchorX} ${y + height} L${to[0]} ${to[1]}`
      : `M${x + width / 2} ${y + height} Q ${(x + width / 2 + to[0]) / 2} ${y + height + 34} ${to[0]} ${to[1]}`;
  return `
  <g>
    <path d="${leader}" fill="none" stroke="${tone}" stroke-width="1.6" stroke-dasharray="5 5" opacity="0.8"/>
    <circle cx="${to[0]}" cy="${to[1]}" r="4.5" fill="#ffffff" stroke="${tone}" stroke-width="2.5"/>
    <g filter="url(#softShadow)">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="#ffffff" fill-opacity="0.97" stroke="${tone}" stroke-opacity="0.38" stroke-width="1.5"/>
      <rect x="${x}" y="${y}" width="5" height="${height}" rx="2.5" fill="${tone}"/>
    </g>
    <text x="${x + 17}" y="${y + 27}" font-family="Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${esc(callout.text)}</text>
    <text x="${x + 17}" y="${y + 48}" font-family="Segoe UI, sans-serif" font-size="11" fill="#64748b">${esc(callout.sub)}</text>
  </g>`;
}

function drawBadge(text) {
  const width = Math.min(430, text.length * 6.6 + 52);
  return `
  <g>
    <rect x="22" y="20" width="${width}" height="30" rx="15" fill="#111827" opacity="0.9"/>
    <circle cx="38" cy="35" r="4" fill="#ef4444"/>
    <text x="50" y="39.5" font-family="Segoe UI, sans-serif" font-size="11" font-weight="600" fill="#f8fafc" letter-spacing="0.3">${esc(text)}</text>
  </g>`;
}

function drawEtcs(etcs) {
  const mode = etcs.mode || "FS";
  const modeColor = mode === "TR" ? "#f59e0b" : mode === "OS" ? "#f59e0b" : "#22c55e";
  return `
  <g filter="url(#softShadow)">
    <rect x="648" y="20" width="288" height="140" rx="12" fill="url(#screenGrad)" stroke="#334155" stroke-width="1.5"/>
    <rect x="648" y="20" width="288" height="28" rx="12" fill="#1e293b"/>
    <rect x="648" y="38" width="288" height="10" fill="#1e293b"/>
    <text x="664" y="39" font-family="Segoe UI, sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="0.8">ETCS · FÜHRERRAUMANZEIGE</text>
    <text x="920" y="39" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="9" fill="#64748b">DMI</text>
    <text x="668" y="78" font-family="Segoe UI, sans-serif" font-size="10" font-weight="600" fill="#64748b">LEVEL</text>
    <text x="668" y="108" font-family="Segoe UI, sans-serif" font-size="24" font-weight="800" fill="#f8fafc">${esc(etcs.level)}</text>
    <rect x="782" y="62" width="134" height="54" rx="8" fill="#0b1220" stroke="#334155"/>
    <text x="796" y="80" font-family="Segoe UI, sans-serif" font-size="9" font-weight="600" fill="#64748b">BETRIEBSART</text>
    <text x="796" y="106" font-family="Segoe UI, sans-serif" font-size="22" font-weight="800" fill="${modeColor}">${esc(mode)}</text>
    <circle cx="902" cy="88" r="5" fill="${modeColor}"/>
    <text x="668" y="137" font-family="Segoe UI, sans-serif" font-size="11" fill="#fca5a5">${esc(etcs.message)}</text>
  </g>`;
}

function drawLzbInset() {
  return `
  <g filter="url(#softShadow)">
    <rect x="690" y="24" width="246" height="106" rx="11" fill="url(#screenGrad)" stroke="#334155" stroke-width="1.5"/>
    <text x="706" y="45" font-family="Segoe UI, sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="0.8">LZB · STEUERUNG</text>
    <text x="706" y="76" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" fill="#f8fafc">Störung</text>
    <text x="706" y="96" font-family="Segoe UI, sans-serif" font-size="10.5" fill="#fca5a5">Streckeneinrichtung nicht verfügbar</text>
    <circle cx="900" cy="66" r="7" fill="#dc2626"/>
    <circle cx="900" cy="66" r="14" fill="#dc2626" opacity="0.2"/>
    <text x="706" y="116" font-family="Segoe UI, sans-serif" font-size="9.5" fill="#64748b">Abschnitt Musterstadt – Talheim</text>
  </g>`;
}

function drawFog() {
  return `<rect x="0" y="180" width="960" height="260" fill="url(#fogGrad)"/>`;
}

function drawPowerMarker() {
  return `
  <g transform="translate(575, 172)">
    <circle r="18" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
    <path d="M2 -10 L-7 3 H0 L-2 12 L8 -2 H1 Z" fill="#dc2626"/>
    <path d="M-13 -13 L13 13" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function renderScene(scene) {
  const isDouble = scene.track === "double";
  const parts = [drawDefs(), drawSky()];

  if (isDouble) {
    parts.push(drawTrack(300, { far: true }));
  }
  parts.push(drawTrack(384));
  if (isDouble && scene.trackLabels) parts.push(drawTrackLabels());
  if (scene.electrified) parts.push(drawCatenary(scene.damagedCatenary));
  if (scene.platform) parts.push(drawPlatform(scene.platform));
  if (scene.lzb) parts.push(drawLzb());

  (scene.signals || []).forEach((sig) => parts.push(drawSignal(sig, 384)));
  if (scene.speedBoard) parts.push(drawSpeedBoard(scene.speedBoard));
  if (scene.crossing) parts.push(drawCrossing(scene.crossing));
  if (scene.ne1) parts.push(drawNe1(scene.ne1, 300));
  if (scene.eoa) parts.push(drawEoa(scene.eoa, 384));
  if (scene.missingSignal) parts.push(drawMissingSignal(scene.missingSignal, 384));
  if (scene.train) parts.push(drawTrain(scene.train));
  if (scene.people) parts.push(drawPeople(scene.people));
  if (scene.cones) parts.push(drawCones(scene.cones));
  if (scene.power) parts.push(drawPowerMarker());

  if (scene.fog) parts.push(drawFog());
  if (scene.badge) parts.push(drawBadge(scene.badge));
  if (scene.etcs) parts.push(drawEtcs(scene.etcs));
  if (scene.lzb && !scene.etcs) parts.push(drawLzbInset());

  (scene.callouts || []).forEach((callout) => parts.push(drawCallout(callout)));

  return `<svg viewBox="0 0 960 440" role="img" aria-label="Schematische Darstellung der Situation" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}
