/* ==========================================================================
   Befehlstrainer – Anwendung
   Supabase: Authentifizierung, Registrierungsanfragen, Befehlskatalog,
   admin-gepflegte Situationen. Trainingsergebnisse bleiben im Browser.
   ========================================================================== */

const CONFIG = window.BEFEHLSTRAINER_CONFIG || {};
const SCENARIOS_PER_RUN = CONFIG.scenariosPerRun || 10;

const app = document.getElementById("app");
const headerProgress = document.getElementById("header-progress");
const headerProgressLabel = document.getElementById("header-progress-label");
const headerProgressBar = document.getElementById("header-progress-bar");
const headerScore = document.getElementById("header-score");
const headerEnd = document.getElementById("header-end");
const headerUser = document.getElementById("user-chip");
const adminButton = document.getElementById("admin-button");
const logoutButton = document.getElementById("logout-button");
const referenceButton = document.getElementById("reference-button");
const mainNav = document.getElementById("main-nav");
const toastEl = document.getElementById("toast");
const referenceModal = document.getElementById("reference-modal");
const confirmModal = document.getElementById("confirm-modal");

let sb = null;
let dbScenarios = [];

const state = {
  screen: "boot",
  session: null,
  profile: null,
  bootstrap: false,
  authMode: "login",
  authError: "",
  authBusy: false,
  queue: [],
  index: 0,
  answers: [],
  current: { command: null, fields: {}, measures: {}, struck: {}, header: {}, note: "" },
  startedAt: null,
  endedAt: null,
  admin: {
    section: "requests",
    requests: [],
    scenarios: [],
    loading: false,
    commandDraft: null,
    scenarioDraft: null,
  },
};

let adminChannel = null;
let statusTimer = null;

const e = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function totalPoints() {
  return state.answers.reduce((sum, a) => sum + (a ? a.evaluation.points : 0), 0);
}

function answeredCount() {
  return state.answers.filter(Boolean).length;
}

function formatNumber(value) {
  return String(value).replace(".", ",");
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function scoreClass(points, max = 10) {
  const ratio = points / max;
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.6) return "mid";
  return "bad";
}

function scoreLabel(points) {
  if (points === 10) return "Perfekt ausgestellt";
  if (points >= 9) return "Sehr gut gemacht";
  if (points >= 8) return "Gut gemacht";
  if (points >= 7) return "Solide – mit kleinen Lücken";
  if (points >= 6) return "Bestanden – aber unsauber";
  if (points >= 4) return "Da fehlt noch Präzision";
  return "Das war nicht der richtige Befehl";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove("show"), 4200);
}

function isAdmin() {
  return Boolean(state.profile && state.profile.role === "admin" && state.profile.status === "approved");
}

function isApproved() {
  return Boolean(state.profile && state.profile.status === "approved");
}

/* --------------------------------------------------------------------------
   Supabase / Authentifizierung
   -------------------------------------------------------------------------- */
function emailFor(discord) {
  const normalized = String(discord || "").trim().toLowerCase();
  const slug =
    normalized
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "mitglied";
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${slug}.${(hash >>> 0).toString(36)}@befehlstrainer.local`;
}

function authErrorMessage(error) {
  const message = error?.message || "";
  if (/invalid login credentials/i.test(message)) return "Discord-Name oder Passwort ist falsch.";
  if (/already registered|already been registered/i.test(message))
    return "Dieser Discord-Name ist bereits registriert.";
  if (/duplicate|unique/i.test(message)) return "Dieser Discord-Name ist bereits registriert.";
  if (/database error/i.test(message))
    return "Registrierung fehlgeschlagen. Ist der Discord-Name eventuell schon vergeben?";
  if (/password/i.test(message)) return "Das Passwort ist zu kurz – mindestens 6 Zeichen.";
  if (/email not confirmed/i.test(message))
    return "Das Konto ist noch nicht bestätigt. Bitte wende dich an einen Admin.";
  if (/rate limit|too many/i.test(message)) return "Zu viele Versuche. Bitte kurz warten.";
  return message || "Unbekannter Fehler. Bitte erneut versuchen.";
}

async function fetchBootstrap() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc("bootstrap_needed");
    if (!error) state.bootstrap = Boolean(data);
  } catch {
    state.bootstrap = false;
  }
}

async function loadProfile() {
  if (!sb || !state.session?.user) {
    state.profile = null;
    return;
  }
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", state.session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Profil konnte nicht geladen werden:", error);
    state.profile = null;
    return;
  }
  state.profile = data || null;
}

async function loadCatalog() {
  if (!sb || !isApproved()) return;
  const [commandsResult, scenariosResult] = await Promise.all([
    sb.from("commands").select("*").order("sort_order", { ascending: true }).order("nr", { ascending: true }),
    sb.from("scenarios").select("*").order("created_at", { ascending: false }),
  ]);

  if (commandsResult.error) {
    console.error("Befehle konnten nicht geladen werden:", commandsResult.error);
    showToast("Befehle konnten nicht geladen werden.");
  } else if (commandsResult.data?.length) {
    COMMANDS.length = 0;
    commandsResult.data.forEach((row) => COMMANDS.push(fromDbCommand(row)));
  }

  if (scenariosResult.error) {
    console.error("Situationen konnten nicht geladen werden:", scenariosResult.error);
  } else {
    dbScenarios = (scenariosResult.data || []).map(fromDbScenario);
    state.admin.scenarios = dbScenarios;
  }
}

function fromDbCommand(row) {
  return {
    nr: row.nr,
    title: row.title,
    short: row.short || "",
    description: row.description || "",
    template: row.template || "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    measures: Array.isArray(row.measures) ? row.measures : [],
    active: row.active !== false,
  };
}

function fromDbScenario(row) {
  return {
    id: row.id,
    command: row.command_nr,
    title: row.title,
    subtitle: row.subtitle || "",
    train: row.train || "",
    time: row.time || "",
    facts: Array.isArray(row.facts) ? row.facts : [],
    situation: row.situation || "",
    task: row.task || "",
    radio: Array.isArray(row.radio) ? row.radio : [],
    fieldPoints: row.field_points || {},
    measurePoints: row.measure_points || {},
    explanation: row.explanation || "",
    scene: row.scene && typeof row.scene === "object" ? row.scene : {},
    active: row.active !== false,
    source: "admin",
  };
}

async function handleAuth() {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  state.session = data?.session || null;
  await loadProfile();

  if (!state.session) {
    state.screen = "auth";
    state.profile = null;
    render();
    return;
  }

  if (state.profile && state.profile.status === "approved") {
    await loadCatalog();
    if (typeof ensureQuizData === "function") await ensureQuizData();
    if (state.profile.must_change_password) {
      state.screen = "change-password";
    } else if (!["train", "result", "summary", "admin", "rulebook", "quiz", "quizrun", "quizresult"].includes(state.screen)) {
      state.screen = "start";
    }
    if (state.screen === "admin" && !isAdmin()) state.screen = "start";
  } else if (state.profile && state.profile.status === "disabled") {
    state.screen = "disabled";
  } else if (state.profile && state.profile.status === "rejected") {
    state.screen = "rejected";
  } else {
    state.screen = "pending";
  }
  if (typeof updateQuizAlert === "function") updateQuizAlert();
  render();
}

async function signIn(discord, password) {
  const { error } = await sb.auth.signInWithPassword({
    email: emailFor(discord),
    password,
  });
  if (error) throw error;
  await handleAuth();
}

async function signUp(discord, roblox, password) {
  const { data, error } = await sb.auth.signUp({
    email: emailFor(discord),
    password,
    options: {
      data: {
        discord_username: discord.trim(),
        roblox_username: roblox.trim(),
      },
    },
  });
  if (error) throw error;

  if (data?.session) {
    await handleAuth();
    return;
  }

  // Falls "Confirm email" im Projekt aktiv ist, liefert signUp keine Sitzung.
  // Das Konto ist dank Datenbank-Trigger trotzdem sofort bestätigt.
  const retry = await sb.auth.signInWithPassword({
    email: emailFor(discord),
    password,
  });
  if (!retry.error && retry.data?.session) {
    await handleAuth();
    return;
  }

  state.screen = "auth";
  state.authMode = "login";
  state.authError =
    "Das Konto wurde angelegt. Bitte melde dich jetzt mit deinem Discord-Namen und Passwort an.";
  render();
}

async function signOut() {
  if (typeof quizBeforeSignOut === "function") await quizBeforeSignOut();
  if (sb) await sb.auth.signOut();
  if (typeof resetQuizSession === "function") resetQuizSession();
  state.session = null;
  state.profile = null;
  state.queue = [];
  state.answers = [];
  state.screen = "auth";
  state.authMode = "login";
  state.authError = "";
  await fetchBootstrap();
  render();
}

/* --------------------------------------------------------------------------
   Auswertung
   -------------------------------------------------------------------------- */
function evaluate(scenario, answer) {
  const correctCommand = getCommand(scenario.command);
  const chosenCommand = answer.command ? getCommand(answer.command) : null;
  const cmdOk = answer.command === scenario.command;
  const criteria = [];
  let points = 0;

  const chosenLabel = chosenCommand
    ? `Befehl ${chosenCommand.nr} – ${chosenCommand.title}`
    : "Kein Befehl gewählt";
  criteria.push({
    group: "Befehlswahl",
    label: "Passender Befehl",
    given: chosenLabel,
    expected: `Befehl ${correctCommand.nr} – ${correctCommand.title}`,
    ok: cmdOk,
    points: cmdOk ? 4 : 0,
    max: 4,
    note: "Der zutreffende Befehl wird aus der Lage und dem GSM-R-Zugfunk ermittelt.",
  });
  if (cmdOk) points += 4;

  const fieldPoints = scenario.fieldPoints || scenario.field_points || {};
  Object.entries(fieldPoints).forEach(([id, target]) => {
    const field = correctCommand.fields.find((f) => f.id === id);
    const given = answer.fields[id] || "";
    const ok = cmdOk && orderValueMatches(given, target.correct);
    if (ok) points += target.points;
    criteria.push({
      group: "Angaben",
      label: field ? field.label : id,
      given: given || "—",
      expected: target.correct,
      ok,
      skipped: !cmdOk,
      points: ok ? target.points : 0,
      max: target.points,
      note: field ? `Angabe aus der Fdl-Anweisung für ${field.label}.` : "",
    });
  });

  let measureEarned = 0;
  let measurePenalty = 0;
  correctCommand.measures.forEach((measure) => {
    const target = (scenario.measurePoints || scenario.measure_points || {})[measure.id] || {
      correct: false,
      points: 0,
    };
    const checked = Boolean(answer.measures[measure.id]);
    const ok = cmdOk && checked === Boolean(target.correct);
    if (cmdOk && target.correct && checked) measureEarned += target.points;
    if (cmdOk && !target.correct && checked) measurePenalty += 1;
    criteria.push({
      group: "Zusatzmaßnahmen",
      label: measure.label,
      given: checked ? "angekreuzt" : "nicht angekreuzt",
      expected: target.correct ? "ankreuzen" : "nicht ankreuzen",
      ok,
      skipped: !cmdOk,
      points: ok && target.correct ? target.points : 0,
      penalty: cmdOk && !target.correct && checked ? 1 : 0,
      max: target.correct ? target.points : 0,
      note: "Zusatzmaßnahmen dürfen nur angekreuzt werden, wenn sie angeordnet sind.",
    });
  });

  if (cmdOk) {
    points += Math.max(0, measureEarned - measurePenalty);
  }

  const order = typeof buildOrderData === "function" ? buildOrderData(scenario) : null;
  let headerOk = true;
  if (order) {
    const headerResult = orderHeaderChecks(order, answer.header || {});
    headerOk = headerResult.ok;
    criteria.push(...headerResult.checks);
  }

  let strikesOk = true;
  if (order) {
    const strikeResult = orderStrikeChecks(order, answer.struck || {});
    strikesOk = strikeResult.ok;
    criteria.push(...strikeResult.checks);
  }

  return {
    points: Math.min(10, points),
    max: 10,
    cmdOk,
    measurePenalty,
    headerOk,
    strikesOk,
    formOk: headerOk && strikesOk,
    criteria,
  };
}

/* --------------------------------------------------------------------------
   Header
   -------------------------------------------------------------------------- */
function updateHeader() {
  const approved = isApproved();
  const inTraining = ["train", "result", "summary"].includes(state.screen);
  const showProgress = inTraining && state.queue.length > 0;
  const navTarget =
    state.screen === "rulebook"
      ? "rulebook"
      : ["quiz", "quizrun", "quizresult"].includes(state.screen)
      ? "quiz"
      : "start";

  headerProgress.hidden = !showProgress;
  headerScore.hidden = !showProgress;
  headerEnd.hidden = !inTraining;
  referenceButton.hidden = !approved || !["train", "result"].includes(state.screen);
  adminButton.hidden = !isAdmin() || state.screen === "admin";
  logoutButton.hidden = !state.session;
  headerUser.hidden = !state.profile;
  if (mainNav) {
    mainNav.hidden = !approved || state.screen === "admin";
    mainNav.querySelectorAll("[data-nav]").forEach((button) => {
      button.classList.toggle("active", button.dataset.nav === navTarget);
      button.disabled = typeof quizActive === "function" && quizActive() && button.dataset.nav !== "quizrun";
    });
  }

  if (state.profile) {
    headerUser.textContent = state.profile.discord_username || "Konto";
    headerUser.title = `${state.profile.discord_username || ""} · ${state.profile.role === "admin" ? "Admin" : "Mitglied"}`;
  }

  if (showProgress) {
    const position = Math.min(state.index + 1, state.queue.length);
    headerProgressLabel.textContent =
      state.screen === "summary"
        ? `${answeredCount()} / ${state.queue.length} bearbeitet`
        : `Situation ${position} / ${state.queue.length}`;
    const percent =
      state.screen === "summary"
        ? (answeredCount() / state.queue.length) * 100
        : ((state.index + (state.screen === "result" ? 1 : 0)) / state.queue.length) * 100;
    headerProgressBar.style.width = `${percent}%`;
  }

  if (showProgress) {
    headerScore.innerHTML = `<span class="score-pill-dot"></span><strong>${totalPoints()}</strong> P`;
  }

  headerEnd.textContent = state.screen === "summary" ? "Startseite" : "Beenden";

  if (typeof updateQuizAlert === "function") updateQuizAlert();
  if (typeof syncQuizClock === "function") syncQuizClock();
}

/* --------------------------------------------------------------------------
   Zugang: Anmeldung, Registrierung, Wartestatus
   -------------------------------------------------------------------------- */
function authScreen() {
  const mode = state.authMode;
  return `
  <section class="auth-layout">
    <div class="auth-hero">
      <p class="eyebrow"><span class="eyebrow-dot"></span> DVN FIS · Digitaler Befehl</p>
      <h1>Den richtigen<br><em>Befehl ausstellen.</em></h1>
      <p class="hero-lead">
        Zehn realistische Situationen aus dem Eisenbahnbetrieb – bildlich dargestellt
        und schriftlich erklärt. Wähle den passenden Befehl, ergänze die Angaben und
        erhalte eine logische Auswertung mit Punkten und Begründung.
      </p>
      <div class="auth-preview card">
        <div class="scene-frame">${renderScene(PREVIEW_SCENARIO.scene)}</div>
        <div class="visual-caption">
          <div>
            <strong>${e(PREVIEW_SCENARIO.title)}</strong>
            <span>${e(PREVIEW_SCENARIO.subtitle)}</span>
          </div>
          <span class="visual-cmd">Befehl 1</span>
        </div>
      </div>
      <ul class="auth-features">
        <li><strong>10</strong><span>Situationen pro Training</span></li>
        <li><strong>10</strong><span>Punkte pro Lage</span></li>
        <li><strong>∞</strong><span>generierte Situationen</span></li>
      </ul>
    </div>

    <div class="auth-card card">
      <div class="auth-tabs" role="tablist">
        <button class="auth-tab ${mode === "login" ? "active" : ""}" type="button" data-auth-tab="login" role="tab" aria-selected="${mode === "login"}">Anmelden</button>
        <button class="auth-tab ${mode === "register" ? "active" : ""}" type="button" data-auth-tab="register" role="tab" aria-selected="${mode === "register"}">Registrieren</button>
      </div>

      ${
        mode === "login"
          ? `<form data-auth-form="login" novalidate>
              <h2>Willkommen zurück</h2>
              <p class="auth-sub">Melde dich mit deinem Discord-Namen und deinem Passwort an.</p>
              <label class="field">
                <span class="field-label">Discord-Name</span>
                <input name="discord" type="text" autocomplete="username" placeholder="z. B. jggaming25" required />
              </label>
              <label class="field">
                <span class="field-label">Passwort</span>
                <input name="password" type="password" autocomplete="current-password" placeholder="Passwort" required />
              </label>
              <button class="btn btn-primary btn-lg btn-block" type="submit" ${state.authBusy ? "disabled" : ""}>
                ${state.authBusy ? "Anmeldung läuft …" : "Anmelden"}
              </button>
              <p class="auth-switch">Noch kein Konto? <button type="button" class="link-btn" data-auth-tab="register">Jetzt registrieren</button></p>
            </form>`
          : `<form data-auth-form="register" novalidate>
              <h2>Zugang anfragen</h2>
              <p class="auth-sub">Trage deine Discord- und Roblox-Namen ein. Ein Admin prüft die Anfrage.</p>
              ${
                state.bootstrap
                  ? `<div class="bootstrap-note"><strong>Erstes Konto = erster Admin.</strong><span>Es existiert noch kein Konto. Die erste Registrierung wird automatisch als Admin freigeschaltet.</span></div>`
                  : ""
              }
              <label class="field">
                <span class="field-label">Discord-Name</span>
                <input name="discord" type="text" autocomplete="username" placeholder="z. B. jggaming25" required />
              </label>
              <label class="field">
                <span class="field-label">Roblox-Name</span>
                <input name="roblox" type="text" autocomplete="off" placeholder="z. B. Genzmann" required />
              </label>
              <div class="form-grid">
                <label class="field">
                  <span class="field-label">Passwort</span>
                  <input name="password" type="password" autocomplete="new-password" placeholder="mind. 6 Zeichen" minlength="6" required />
                </label>
                <label class="field">
                  <span class="field-label">Passwort wiederholen</span>
                  <input name="password2" type="password" autocomplete="new-password" placeholder="Passwort wiederholen" minlength="6" required />
                </label>
              </div>
              <button class="btn btn-primary btn-lg btn-block" type="submit" ${state.authBusy ? "disabled" : ""}>
                ${state.authBusy ? "Anfrage wird gesendet …" : "Registrierung anfragen"}
              </button>
              <p class="auth-note">Der Discord-Name dient als Anmeldename. Es werden keine Daten an Discord oder Roblox übertragen.</p>
              <p class="auth-switch">Bereits freigeschaltet? <button type="button" class="link-btn" data-auth-tab="login">Zur Anmeldung</button></p>
            </form>`
      }

      ${state.authError ? `<p class="form-error">${e(state.authError)}</p>` : ""}
    </div>
  </section>`;
}

function pendingScreen() {
  const profile = state.profile || {};
  return `
  <section class="status-screen">
    <div class="status-card card">
      <span class="status-icon pending">⏳</span>
      <p class="eyebrow">Registrierungsanfrage</p>
      <h1>Anfrage eingegangen</h1>
      <p class="status-lead">
        Dein Konto <strong>${e(profile.discord_username || "")}</strong> wurde angelegt und wartet auf die Freigabe
        durch einen Admin. Sobald die Anfrage angenommen wurde, kannst du das Training starten.
      </p>
      <div class="status-facts">
        <span><span class="fact-label">Discord</span>${e(profile.discord_username || "—")}</span>
        <span><span class="fact-label">Roblox</span>${e(profile.roblox_username || "—")}</span>
        <span><span class="fact-label">Angefragt</span>${e(formatDate(profile.created_at))}</span>
      </div>
      <div class="status-actions">
        <button class="btn btn-secondary" type="button" data-action="refresh-status">Status prüfen</button>
        <button class="btn btn-ghost" type="button" data-action="logout">Abmelden</button>
      </div>
      <p class="status-hint">Die Seite aktualisiert sich automatisch, sobald ein Admin entscheidet.</p>
    </div>
  </section>`;
}

function rejectedScreen() {
  const profile = state.profile || {};
  return `
  <section class="status-screen">
    <div class="status-card card">
      <span class="status-icon rejected">✕</span>
      <p class="eyebrow">Registrierungsanfrage</p>
      <h1>Anfrage abgelehnt</h1>
      <p class="status-lead">
        Die Anfrage für <strong>${e(profile.discord_username || "")}</strong> wurde abgelehnt.
      </p>
      ${
        profile.rejection_reason
          ? `<div class="rejection-reason"><span>Begründung</span><p>${e(profile.rejection_reason)}</p></div>`
          : `<p class="status-hint">Es wurde keine Begründung hinterlegt.</p>`
      }
      <div class="status-actions">
        <button class="btn btn-secondary" type="button" data-action="refresh-status">Status prüfen</button>
        <button class="btn btn-ghost" type="button" data-action="logout">Abmelden</button>
      </div>
    </div>
  </section>`;
}

function configScreen() {
  return `
  <section class="status-screen">
    <div class="status-card card">
      <span class="status-icon rejected">!</span>
      <h1>Supabase ist nicht konfiguriert</h1>
      <p class="status-lead">
        In <code>assets/config.js</code> fehlen <code>supabaseUrl</code> und <code>supabaseKey</code>.
        Trage dort die öffentliche URL und den Publishable Key deines Supabase-Projekts ein.
      </p>
      <p class="status-hint">Die SQL-Migrationen liegen unter <code>supabase/migrations</code>.</p>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   Startbildschirm
   -------------------------------------------------------------------------- */
function startScreen() {
  const preview = PREVIEW_SCENARIO;
  return `
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow"><span class="eyebrow-dot"></span> DVN FIS · Digitaler Befehl</p>
      <h1>Den richtigen<br><em>Befehl ausstellen.</em></h1>
      <p class="hero-lead">
        Zehn realistische Situationen aus dem Eisenbahnbetrieb – bildlich dargestellt
        und schriftlich erklärt. Wähle den passenden Befehl, ergänze die Angaben und
        erhalte eine logische Auswertung mit Punkten und Begründung.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" data-action="start">
          <span class="btn-icon">▶</span> Training starten
        </button>
        <button class="btn btn-secondary btn-lg" data-action="reference">Befehlsübersicht</button>
      </div>
      <ul class="hero-meta">
        <li><strong>10</strong><span>Situationen</span></li>
        <li><strong>10</strong><span>Punkte pro Lage</span></li>
        <li><strong>${COMMANDS.length}</strong><span>Befehle im Katalog</span></li>
      </ul>
      <p class="hero-greeting">Angemeldet als <strong>${e(state.profile?.discord_username || "")}</strong>${
        isAdmin() ? " · Admin" : ""
      }</p>
    </div>
    <div class="hero-visual">
      <div class="visual-card">
        <div class="visual-topbar">
          <span class="live-dot"></span> Beispielsituation
          <span class="visual-tag">Bf Musterstadt</span>
        </div>
        <div class="scene-frame">${renderScene(preview.scene)}</div>
        <div class="visual-caption">
          <div>
            <strong>${e(preview.title)}</strong>
            <span>${e(preview.subtitle)}</span>
          </div>
          <span class="visual-cmd">Befehl 1</span>
        </div>
      </div>
    </div>
  </section>

  <section class="how-grid" aria-label="So funktioniert der Befehlstrainer">
    <article class="how-card">
      <span class="how-icon">01</span>
      <h2>Sehen &amp; verstehen</h2>
      <p>Jede Lage kommt als schematisches Streckenbild mit klarer Beschreibung, Zugdaten, Zugfunk und Auftrag.</p>
    </article>
    <article class="how-card">
      <span class="how-icon">02</span>
      <h2>Befehl ausstellen</h2>
      <p>Befehl wählen, Signal, Zugmeldestelle, Geschwindigkeit oder Grund ergänzen – wie im digitalen Vordruck.</p>
    </article>
    <article class="how-card">
      <span class="how-icon">03</span>
      <h2>Logisch auswerten</h2>
      <p>Punkte für Befehlswahl, Angaben und Zusatzmaßnahmen. Du siehst genau, was richtig war – und warum.</p>
    </article>
  </section>

  <section class="privacy-note">
    <div class="privacy-icon">🔒</div>
    <div>
      <strong>Dein Konto, deine Trainings.</strong>
      <p>Konten und Befehle liegen in Supabase. Trainingsergebnisse werden nicht gespeichert – beim Neuladen der Seite startest du mit einem neuen Lauf.</p>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   Trainingsbildschirm
   -------------------------------------------------------------------------- */
function scoreRing(points, max = 10, size = "normal") {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, points / max));
  const offset = circumference * (1 - ratio);
  return `
  <div class="score-ring ${scoreClass(points, max)} ${size === "small" ? "small" : ""}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-bg" cx="60" cy="60" r="${radius}"/>
      <circle class="ring-value" cx="60" cy="60" r="${radius}"
        stroke-dasharray="${circumference.toFixed(1)}"
        stroke-dashoffset="${offset.toFixed(1)}"/>
    </svg>
    <div class="ring-label">
      <span>${formatNumber(points)}</span>
      <small>von ${max}</small>
    </div>
  </div>`;
}

function situationFacts(scenario) {
  return `
    <div class="facts">
      <span class="fact"><span class="fact-label">Zug</span>${e(scenario.train)}</span>
      <span class="fact"><span class="fact-label">Ort</span>${e(scenario.subtitle)}</span>
      <span class="fact"><span class="fact-label">Zeit</span>${e(scenario.time)}</span>
    </div>`;
}

function radioTranscript(scenario) {
  const order = typeof buildOrderData === "function" ? buildOrderData(scenario) : null;
  const messages = order && Array.isArray(order.radio) && order.radio.length
    ? order.radio
    : Array.isArray(scenario?.radio)
    ? scenario.radio
    : [];
  if (!messages.length) return "";
  return `
  <div class="radio-box">
    <div class="radio-head">
      <span class="radio-icon" aria-hidden="true">📻</span>
      <span>GSM-R-Zugfunk</span>
      <span class="radio-channel">Kanal 1 · Rangierfunk</span>
    </div>
    ${messages
      .map(
        (msg) => `
        <div class="radio-line">
          <span class="radio-speaker">${e(msg.speaker || "TF")}</span>
          <div class="radio-text">
            <span class="radio-who">${e(msg.who || scenario.train || "")}</span>
            <p>„${e(msg.text)}“</p>
          </div>
        </div>`
      )
      .join("")}
  </div>`;
}

function situationCard(scenario) {
  return `
  <section class="card situation-card">
    <div class="scene-frame large">${renderScene(scenario.scene)}</div>
    <div class="situation-body">
      ${situationFacts(scenario)}
      <div class="situation-heading">
        <span class="situation-index">Lage</span>
        <h2>${e(scenario.title)}</h2>
      </div>
      <p class="situation-text">${e(scenario.situation)}</p>
      <div class="task-box">
        <span class="task-label">Dein Auftrag</span>
        <p>${e(scenario.task)}</p>
      </div>
      ${radioTranscript(scenario)}
      <div class="fact-chips">
        ${(scenario.facts || []).map((f) => `<span class="mini-chip">${e(f)}</span>`).join("")}
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   Befehlsvordruck – digitales Abbild des DB-Vordrucks (Ril 408.2411 V01)
   Vorderseite: Befehle 1–9 · Rückseite: nationale Befehle ab 21
   -------------------------------------------------------------------------- */
const VORDRUCK_VORNE = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function vordruckSectionOf(nr) {
  if (typeof orderSectionOf === "function") return orderSectionOf(nr);
  return VORDRUCK_VORNE.includes(String(nr)) ? "vorne" : "hinten";
}

function vordruckStruck(nr) {
  const override = state.current.struck ? state.current.struck[nr] : undefined;
  if (override === true) return true;
  if (override === false) return false;
  return false;
}

function vordruckFieldControl(cmd, field, index) {
  const value = state.current.fields[field.id] || "";
  const code = `${cmd.nr}.${String(index + 1).padStart(2, "0")}`;
  return `
  <label class="vfill">
    <span class="vfill-label"><span class="vfill-code">${e(code)}</span>${e(field.label)}</span>
    <span class="vfill-control">
      <select data-field="${e(field.id)}" autocomplete="off" aria-label="${e(field.label)}">
        <option value="" ${!value ? "selected" : ""} disabled>${e(field.placeholder || "eintragen …")}</option>
        ${(field.options || [])
          .map(
            (option) =>
              `<option value="${e(option)}" ${value === option ? "selected" : ""}>${e(option)}</option>`
          )
          .join("")}
      </select>
    </span>
  </label>`;
}

function vordruckFill(cmd) {
  const fields = (cmd.fields || [])
    .map((field, index) => vordruckFieldControl(cmd, field, index))
    .join("");
  const measures = (cmd.measures || []).length
    ? `
    <fieldset class="vordruck-measures">
      <legend>Zusätzliche Anweisungen</legend>
      ${cmd.measures
        .map(
          (m) => `
        <label class="check">
          <input type="checkbox" data-measure="${e(m.id)}" ${
            state.current.measures[m.id] ? "checked" : ""
          }>
          <span class="check-box" aria-hidden="true"></span>
          <span class="check-text">${e(m.label)}</span>
        </label>`
        )
        .join("")}
    </fieldset>`
    : "";
  return `
  <div class="vrow-fill">
    <p class="vrow-template">${e(cmd.template || cmd.description)}</p>
    <div class="vfill-grid">${fields}</div>
    ${measures}
    <label class="vfill vfill-note">
      <span class="vfill-label"><span class="vfill-code">96</span>Freitext / zusätzliche Anweisungen</span>
      <span class="vfill-control">
        <input type="text" data-note value="${e(state.current.note || "")}" placeholder="optional" autocomplete="off">
      </span>
    </label>
  </div>`;
}

function vordruckRow(cmd) {
  const selected = state.current.command === cmd.nr;
  const struck = vordruckStruck(cmd.nr);
  return `
  <div class="vrow ${selected ? "is-selected" : ""} ${struck ? "is-struck" : ""}">
    <label class="vrow-tick" title="Befehl ${e(cmd.nr)} ankreuzen">
      <input type="checkbox" data-command="${e(cmd.nr)}" ${selected ? "checked" : ""} aria-label="Befehl ${e(cmd.nr)} – ${e(cmd.title)}">
      <span class="vrow-box" aria-hidden="true"></span>
    </label>
    <span class="vrow-nr">${e(cmd.nr)}</span>
    <div class="vrow-body" data-command="${e(cmd.nr)}">
      <div class="vrow-head">
        <strong>${e(cmd.title)}</strong>
        <span class="vrow-desc">${e(cmd.description)}</span>
      </div>
      ${selected ? vordruckFill(cmd) : ""}
    </div>
    <button type="button" class="vrow-strike-btn" data-action="strike-row" data-row="${e(cmd.nr)}"
      aria-pressed="${struck}" title="${struck ? "Durchstreichung aufheben" : "Zeile durchstreichen"}">${
    struck ? "↺" : "✕"
  }</button>
  </div>`;
}

function vordruckSection(title, subtitle, commands, pageLabel, inactive = false) {
  if (!commands.length) return "";
  return `
  <section class="vordruck-seite ${inactive ? "is-inactive" : ""}">
    <header class="vordruck-seite-head">
      <div>
        <strong>${e(title)}</strong>
        <span>${e(subtitle)}</span>
      </div>
      <span>${e(pageLabel || "")}</span>
    </header>
    ${inactive ? `<p class="vordruck-page-note">Diese Seite ist nicht Bestandteil des Vordrucks.</p>` : ""}
    <div class="vrow-list">${commands.map(vordruckRow).join("")}</div>
  </section>`;
}

function orderForm(command) {
  const scenario = state.queue[state.index] || {};
  const order = typeof buildOrderData === "function" ? buildOrderData(scenario) : null;
  const header = state.current.header || {};

  const vordruckHeaderCell = (field) => `
    <div class="vordruck-cell${field.id === "Z" ? " vordruck-cell-wide" : ""}" title="${e(field.hint)}">
      <span class="vordruck-code">${e(field.id)}</span>
      <span class="vordruck-cell-label">${e(field.label)}</span>
      <input class="vordruck-input" data-header="${e(field.id)}" value="${e(header[field.id] || "")}"
        placeholder="${e(field.placeholder)}" autocomplete="off" spellcheck="false" />
      <span class="vordruck-cell-hint">${e(field.hint)}</span>
    </div>`;
  const vorne = COMMANDS.filter((cmd) => vordruckSectionOf(cmd.nr) === "vorne");
  const hinten = COMMANDS.filter((cmd) => vordruckSectionOf(cmd.nr) === "hinten");
  const struckCount = COMMANDS.filter((cmd) => vordruckStruck(cmd.nr)).length;
  const selectedCard = command
    ? `
  <div class="selected-command">
    <div class="selected-command-main">
      <span class="cmd-nr">${e(command.nr)}</span>
      <div>
        <strong>Befehl ${e(command.nr)}</strong>
        <span>${e(command.title)}</span>
      </div>
    </div>
    <button type="button" class="link-btn" data-action="clear-command">Anderer Befehl</button>
  </div>`
    : "";

  return `
  ${selectedCard}

  <form id="befehl-form" novalidate>
    <article class="vordruck" aria-label="Befehlsvordruck ${command ? "Befehl " + e(command.nr) : ""}">
      <header class="vordruck-head">
        <div class="vordruck-brand">
          <span class="vordruck-logo" aria-hidden="true">DB</span>
          <div>
            <strong>Befehlsvordruck</strong>
            <small>gemäß Ril 408.2411 V01 · gültig ab 14.12.2025</small>
          </div>
        </div>
        <div class="vordruck-kennung">
          <span>Z · Eindeutige Kennung</span>
          <strong>${e((order && order.header && order.header.Z) || "")}</strong>
        </div>
      </header>
 
      <div class="vordruck-grid">
        ${ORDER_HEADER_FIELDS.map(vordruckHeaderCell).join("")}
      </div>
 
      <div class="vordruck-toolbar">
        <span>Befehl ankreuzen · Kopfzeile ausfüllen · nicht zutreffende Zeilen durchstreichen.</span>
        <span class="vordruck-strike-count">${struckCount} Zeile${struckCount === 1 ? "" : "n"} durchgestrichen</span>
        <button type="button" class="link-btn" data-action="strike-others">Alle anderen durchstreichen</button>
      </div>
 
      ${vordruckSection(
        "Befehle 1 – 9",
        "Vorderseite · standardisierte Befehle (TSI OPE)",
        vorne,
        !state.current.command
          ? "Seite 1 von 2"
          : vordruckSectionOf(command.nr) === "vorne"
          ? "Seite 1 von 1"
          : "nicht Bestandteil",
        Boolean(state.current.command) && vordruckSectionOf(command.nr) !== "vorne"
      )}
      ${vordruckSection(
        "Befehle 21 – 95",
        "Rückseite · nationale Befehle der DB",
        hinten,
        !state.current.command
          ? "Seite 2 von 2"
          : vordruckSectionOf(command.nr) === "hinten"
          ? "Seite 1 von 1"
          : "nicht Bestandteil",
        Boolean(state.current.command) && vordruckSectionOf(command.nr) !== "hinten"
      )}

      <footer class="vordruck-foot">
        <div class="vordruck-sign">
          <span>Name Anweisender / Unterschrift</span>
          <strong>${e(state.profile?.discord_username || "")}</strong>
        </div>
        <div class="vordruck-sign">
          <span>Standortbestätigung Tf</span>
          <strong>wird im Zugfunk bestätigt</strong>
        </div>
        <div class="vordruck-note">Vordruck nach DB-Muster · Übungsbetrieb DVN</div>
      </footer>
    </article>

    <div class="order-actions">
      <p class="privacy-mini"><span>🔒</span> Auswertung im Browser – ohne Speicherung.</p>
      <button type="submit" class="btn btn-primary btn-lg" data-action="submit">
        Befehl absenden
      </button>
    </div>
  </form>`;
}

function orderPanel(scenario) {
  const selected = state.current.command;
  const command = selected ? getCommand(selected) : null;
  return `
  <div class="order-head">
    <div>
      <p class="eyebrow">Befehl ausstellen</p>
      <h2>Welcher Befehl löst die Lage?</h2>
    </div>
    <span class="step-chip">${state.index + 1}<span>/${state.queue.length}</span></span>
  </div>
  <p class="order-hint">Kreuze den passenden Befehl im Vordruck an, trage die Angaben auf den Linien ein und streiche die nicht zutreffenden Zeilen durch.</p>
  ${orderForm(command)}`;
}

function trainScreen() {
  const scenario = state.queue[state.index];
  return `
  <div class="train-layout">
    ${situationCard(scenario)}
    <section class="card order-card" id="order-panel" aria-live="polite">
      ${orderPanel(scenario)}
    </section>
  </div>`;
}

/* --------------------------------------------------------------------------
   Ergebnisbildschirm
   -------------------------------------------------------------------------- */
function criteriaGroup(group, criteria) {
  const rows = criteria.filter((c) => c.group === group);
  if (!rows.length) return "";
  const earned = rows.reduce((sum, c) => sum + c.points - (c.penalty || 0), 0);
  const max = rows.reduce((sum, c) => sum + c.max, 0);
  return `
  <section class="criteria-group">
    <header class="criteria-head">
      <h3>${e(group)}</h3>
      <span>${
        max === 0
          ? `${rows.filter((c) => c.ok).length} / ${rows.length} korrekt`
          : `${Math.max(0, earned)} / ${max} P`
      }</span>
    </header>
    ${rows
      .map((c) => {
        const icon = c.skipped ? "–" : c.ok ? "✓" : "✕";
        const className = c.skipped ? "skip" : c.ok ? "ok" : "bad";
        return `
        <div class="criterion ${className}">
          <span class="criterion-icon" aria-hidden="true">${icon}</span>
          <div class="criterion-main">
            <span class="criterion-label">${e(c.label)}</span>
            <span class="criterion-values">
              <span>Deine Angabe: <strong>${e(c.given)}</strong></span>
              ${
                c.ok
                  ? ""
                  : `<span class="expected">Richtig: <strong>${e(c.expected)}</strong></span>`
              }
              ${c.note ? `<span class="criterion-note">${e(c.note)}</span>` : ""}
            </span>
          </div>
          <span class="criterion-points ${c.penalty ? "penalty" : ""}">
            ${c.penalty ? "−1 P" : c.max === 0 ? (c.ok ? "✓" : "✕") : `${c.points} / ${c.max} P`}
          </span>
        </div>`;
      })
      .join("")}
  </section>`;
}

function solutionSummary(scenario) {
  const cmd = getCommand(scenario.command);
  const fields = Object.entries(scenario.fieldPoints || {}).map(([id, target]) => {
    const field = cmd.fields.find((f) => f.id === id);
    return `<span class="solution-chip"><span>${e(field ? field.label : id)}</span><strong>${e(target.correct)}</strong></span>`;
  });
  const measures = Object.entries(scenario.measurePoints || {})
    .filter(([, value]) => value.correct)
    .map(([id]) => {
      const measure = cmd.measures.find((m) => m.id === id);
      return `<span class="solution-chip measure"><span>Maßnahme</span><strong>${e(measure ? measure.label : id)}</strong></span>`;
    });
  const order = typeof buildOrderData === "function" ? buildOrderData(scenario) : null;
  const headerChips = order
    ? ORDER_HEADER_FIELDS.map(
        (field) =>
          `<span class="solution-chip"><span>${e(field.id)} ${e(field.label)}</span><strong>${e(order.header[field.id] || "—")}</strong></span>`
      )
    : [];
  return `
    <div class="solution-box">
      <div class="solution-title">
        <span class="cmd-nr">${e(cmd.nr)}</span>
        <div>
          <span class="eyebrow">Richtige Lösung</span>
          <strong>Befehl ${e(cmd.nr)} – ${e(cmd.title)}</strong>
        </div>
      </div>
      <div class="solution-chips">${fields.join("")}${measures.join("")}</div>
      <div class="solution-chips">${headerChips.join("")}</div>
      <p class="solution-note">„Richtig“ heißt hier: der Befehl löst die geschilderte Lage betrieblich korrekt auf – nicht nur „ein Befehl wurde gewählt“.</p>
    </div>`;
}

function resultScreen() {
  const scenario = state.queue[state.index];
  const answer = state.answers[state.index];
  const ev = answer.evaluation;
  const isLast = state.index === state.queue.length - 1;
  const wrongCommand = !ev.cmdOk;

  return `
  <div class="train-layout result-layout">
    ${situationCard(scenario)}
    <section class="card result-card" aria-live="polite">
      <div class="result-top">
        ${scoreRing(ev.points, ev.max)}
        <div class="result-headline">
          <p class="eyebrow">Auswertung · Situation ${state.index + 1} / ${state.queue.length}</p>
          <h2>${e(scoreLabel(ev.points))}</h2>
          <p class="result-sub">
            ${
              wrongCommand
                ? "Der gewählte Befehl passt nicht zu dieser Lage. Für die Situation ist ein anderer Befehl erforderlich."
                : ev.points === 10
                ? "Befehl, Angaben und Zusatzmaßnahmen stimmen vollständig."
                : "Die Einzelbewertung zeigt dir, welche Angaben gefehlt haben oder ungenau waren."
            }
          </p>
        </div>
      </div>

      ${
        wrongCommand
          ? `<div class="wrong-banner">
              <span class="wrong-icon">!</span>
              <p><strong>Falscher Befehl gewählt.</strong> Angaben und Zusatzmaßnahmen werden deshalb nicht gewertet. Die richtige Lösung steht unten.</p>
            </div>`
          : ""
      }

      ${
        !ev.formOk
          ? `<div class="wrong-banner">
              <span class="wrong-icon">!</span>
              <p><strong>Vordruck unvollständig oder fehlerhaft.</strong> Kopfzeile oder Durchstreichungen stimmen nicht. Die Befehlsbewertung bleibt unverändert.</p>
            </div>`
          : ""
      }
      <div class="criteria-list">
        ${criteriaGroup("Befehlswahl", ev.criteria)}
        ${criteriaGroup("Angaben", ev.criteria)}
        ${criteriaGroup("Zusatzmaßnahmen", ev.criteria)}
        ${criteriaGroup("Kopfzeile", ev.criteria)}
        ${criteriaGroup("Durchstreichung", ev.criteria)}
      </div>

      ${solutionSummary(scenario)}

      <div class="explanation">
        <span class="explanation-icon">i</span>
        <div>
          <h3>Warum?</h3>
          <p>${e(scenario.explanation)}</p>
        </div>
      </div>

      <div class="result-actions">
        <span class="result-scoreline">${ev.points} von 10 Punkten</span>
        <button class="btn btn-primary btn-lg" data-action="next">
          ${isLast ? "Auswertung ansehen" : "Nächste Situation"} <span class="btn-arrow">→</span>
        </button>
      </div>
    </section>
  </div>`;
}

/* --------------------------------------------------------------------------
   Zusammenfassung
   -------------------------------------------------------------------------- */
function summaryScreen() {
  const total = totalPoints();
  const average = total / 10;
  const correctCommands = state.answers.filter((a) => a && a.evaluation.cmdOk).length;
  const correctForms = state.answers.filter((a) => a && a.evaluation.formOk).length;
  const duration = formatDuration((state.endedAt || Date.now()) - state.startedAt);

  return `
  <div class="summary-wrap">
    <section class="summary-hero">
      <div class="summary-hero-main">
        <p class="eyebrow">Training abgeschlossen</p>
        <h1>Deine Auswertung</h1>
        <p class="summary-lead">
          ${total >= 80 ? "Sehr sicher: Du stellst die Befehle präzise und lagegerecht aus." : total >= 60 ? "Gute Grundlage. Ein Blick auf die Begründungen zeigt dir die letzten Lücken." : "Nimm dir die Lösungen noch einmal vor – die Begründungen helfen dir beim nächsten Durchlauf."}
        </p>
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-label">Richtige Befehle</span>
            <strong>${correctCommands}<span> / ${state.queue.length}</span></strong>
          </div>
          <div class="stat">
            <span class="stat-label">Vordrucke korrekt</span>
            <strong>${correctForms}<span> / ${state.queue.length}</span></strong>
          </div>
          <div class="stat">
            <span class="stat-label">Punkte gesamt</span>
            <strong>${total}<span> / ${state.queue.length * 10}</span></strong>
          </div>
          <div class="stat">
            <span class="stat-label">Durchschnitt</span>
            <strong>${formatNumber(average.toFixed(1))}<span> / 10</span></strong>
          </div>
          <div class="stat">
            <span class="stat-label">Zeit</span>
            <strong>${duration}</strong>
          </div>
        </div>
      </div>
      <div class="summary-ring">
        ${scoreRing(Number(average.toFixed(1)), 10)}
        <span class="summary-ring-note">${scoreLabel(Math.round(average))}</span>
      </div>
    </section>

    <section class="summary-list-card">
      <div class="summary-list-head">
        <h2>Situationen im Überblick</h2>
        <span class="summary-hint">Zeile öffnen für Lösung und Begründung</span>
      </div>
      <div class="summary-list">
        ${state.queue
          .map((scenario, index) => {
            const answer = state.answers[index];
            const points = answer ? answer.evaluation.points : 0;
            const cmdOk = answer ? answer.evaluation.cmdOk : false;
            const cls = answer ? scoreClass(points) : "bad";
            const chosen =
              answer && answer.command ? `Befehl ${answer.command}` : "nicht bearbeitet";
            return `
            <details class="summary-item ${cls}">
              <summary>
                <span class="sum-index">${String(index + 1).padStart(2, "0")}</span>
                <span class="sum-title">
                  <strong>${e(scenario.title)}</strong>
                  <small>${e(scenario.subtitle)}</small>
                </span>
                <span class="sum-cmd ${cmdOk ? "ok" : "bad"}">${e(chosen)}</span>
                <span class="sum-bar"><i style="width:${points * 10}%"></i></span>
                <span class="sum-points">${points}<small>/10</small></span>
                <span class="sum-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div class="sum-body">
                ${
                  answer
                    ? `<div class="sum-answer">
                        <span><span class="sum-label">Deine Wahl</span> ${
                          answer.command
                            ? `Befehl ${e(answer.command)} – ${e(getCommand(answer.command)?.title || "")}`
                            : "—"
                        }</span>
                        <span><span class="sum-label">Richtig</span> Befehl ${e(scenario.command)} – ${e(
                        getCommand(scenario.command)?.title || ""
                      )}</span>
                      </div>
                      <p>${e(scenario.explanation)}</p>`
                    : `<p>Diese Situation wurde nicht bearbeitet und wird mit 0 Punkten gewertet.</p>`
                }
                <div class="sum-chips">
                  ${Object.values(scenario.fieldPoints || {})
                    .map((f) => `<span class="mini-chip">${e(f.correct)}</span>`)
                    .join("")}
                  ${Object.entries(scenario.measurePoints || {})
                    .filter(([, m]) => m.correct)
                    .map(([id]) => {
                      const m = getCommand(scenario.command)?.measures.find((x) => x.id === id);
                      return `<span class="mini-chip measure">${e(m ? m.label : id)}</span>`;
                    })
                    .join("")}
                </div>
              </div>
            </details>`;
          })
          .join("")}
      </div>
    </section>

    <div class="summary-actions">
      <button class="btn btn-primary btn-lg" data-action="restart">Neues Training starten</button>
      <button class="btn btn-secondary btn-lg" data-action="reference">Befehlsübersicht</button>
      <button class="btn btn-ghost btn-lg" data-action="home">Zur Startseite</button>
    </div>
    <p class="summary-footnote">Dieses Training wird nicht gespeichert. Beim Neuladen der Seite beginnst du von vorn.</p>
  </div>`;
}

/* --------------------------------------------------------------------------
   Administration
   -------------------------------------------------------------------------- */
function splitOptions(value) {
  return String(value || "")
    .split(/[\n;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pointsSum(fieldPoints, measurePoints) {
  const fields = Object.values(fieldPoints || {}).reduce((sum, f) => sum + (Number(f.points) || 0), 0);
  const measures = Object.values(measurePoints || {})
    .filter((m) => m.correct)
    .reduce((sum, m) => sum + (Number(m.points) || 0), 0);
  return fields + measures;
}

const SCENE_PRESETS = [
  { id: "signal", label: "Halt zeigendes Signal" },
  { id: "speed", label: "Geschwindigkeitsbegrenzung" },
  { id: "crossing", label: "Bahnübergang" },
  { id: "etcs", label: "ETCS / Zwangsbremsung" },
  { id: "lzb", label: "LZB-Störung" },
  { id: "double", label: "Gegengleis" },
  { id: "platform", label: "Bahnhof / Ausfahrt" },
];

function sceneFromPreset(preset, draft) {
  const train = { x: 260, label: draft.train || "Zug", dir: 1 };
  const base = {
    track: "single",
    electrified: true,
    train,
    badge: draft.subtitle || draft.title || "Admin-Situation",
  };

  if (preset === "speed") {
    return {
      ...base,
      signals: [
        { x: 120, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 840, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      speedBoard: { x: 500, speed: "50" },
      callouts: [
        { x: 320, y: 68, text: "Geschwindigkeitsbegrenzung", sub: "Admin-Situation", tone: "amber", to: [500, 268] },
        { x: 640, y: 176, text: "Gültig bis Esig 70A", sub: "Bereich beachten", tone: "blue", to: [840, 300] },
      ],
    };
  }
  if (preset === "crossing") {
    return {
      ...base,
      crossing: { x: 610, km: "km 12,4" },
      callouts: [
        { x: 300, y: 62, text: "Bahnübergang gestört", sub: "Schranken offen", tone: "red", to: [610, 300] },
        { x: 690, y: 176, text: "BÜ sichern", sub: "Halten und prüfen", tone: "amber", to: [650, 340] },
      ],
    };
  }
  if (preset === "etcs") {
    return {
      ...base,
      etcs: { level: "Level 2", mode: "TR", message: "Keine Fahrterlaubnis" },
      callouts: [
        { x: 250, y: 232, text: "ETCS-Meldung", sub: "Betriebsart prüfen", tone: "red", to: [640, 120] },
      ],
    };
  }
  if (preset === "lzb") {
    return {
      ...base,
      lzb: true,
      signals: [
        { x: 120, label: "60A", aspect: "fahrt", km: "km 8,2", name: "Esig 60A" },
        { x: 840, label: "70A", aspect: "fahrt", km: "km 14,8", name: "Esig 70A" },
      ],
      callouts: [
        { x: 330, y: 66, text: "LZB-Störung", sub: "Abschnitt prüfen", tone: "red", to: [560, 262] },
      ],
    };
  }
  if (preset === "double") {
    return {
      ...base,
      track: "double",
      train: { ...train, x: 430, track: "left" },
      trackLabels: true,
      cones: { x: 640, track: "right" },
      callouts: [
        { x: 150, y: 66, text: "Gegengleis", sub: "Regelgleis gesperrt", tone: "red", to: [430, 250] },
        { x: 640, y: 176, text: "Fahrt auf dem Gegengleis", sub: "Befehl beachten", tone: "blue", to: [720, 250] },
      ],
    };
  }
  if (preset === "platform") {
    return {
      ...base,
      train: { ...train, x: 420 },
      platform: { x: 300, name: "Musterstadt" },
      missingSignal: { x: 640, label: "kein Hauptsignal" },
      callouts: [
        { x: 500, y: 62, text: "Ausfahrt / Einfahrt", sub: "Bahnhofsbereich", tone: "amber", to: [640, 285] },
      ],
    };
  }
  return {
    ...base,
    signals: [
      { x: 590, label: "60A", aspect: "halt", km: "km 8,2", name: "Esig 60A" },
      { x: 865, label: "62B", aspect: "langsam", km: "km 8,9", name: "ASig 62B" },
    ],
    platform: { x: 770, name: "Musterstadt" },
    callouts: [
      { x: 78, y: 62, text: "Signal zeigt Halt", sub: "Befehl erforderlich", tone: "red", to: [590, 250] },
      { x: 690, y: 150, text: "Weiterfahrt", sub: "Block geprüft", tone: "green", to: [865, 280] },
    ],
  };
}

function adminScreen() {
  const section = state.admin.section;
  return `
  <div class="admin-wrap">
    <section class="admin-head">
      <div>
        <p class="eyebrow">Administration</p>
        <h1>Befehlstrainer verwalten</h1>
        <p class="admin-lead">Registrierungsanfragen prüfen, Befehle und Eingabefelder pflegen sowie eigene Situationen anlegen.</p>
      </div>
      <div class="admin-badges">
        <span class="admin-badge"><strong>${state.admin.requests.length}</strong> offene Anfragen</span>
        <span class="admin-badge"><strong>${COMMANDS.length}</strong> Befehle</span>
        <span class="admin-badge"><strong>${dbScenarios.length}</strong> eigene Situationen</span>
      </div>
    </section>

    <nav class="admin-tabs" aria-label="Admin-Bereiche">
      <button type="button" class="admin-tab ${section === "requests" ? "active" : ""}" data-admin-tab="requests">
        Anfragen ${state.admin.requests.length ? `<span class="tab-count">${state.admin.requests.length}</span>` : ""}
      </button>
      <button type="button" class="admin-tab ${section === "commands" ? "active" : ""}" data-admin-tab="commands">Befehle &amp; Felder</button>
      <button type="button" class="admin-tab ${section === "scenarios" ? "active" : ""}" data-admin-tab="scenarios">Situationen</button>
      <button type="button" class="admin-tab ${section === "quiz-questions" ? "active" : ""}" data-admin-tab="quiz-questions">Quizfragen</button>
      <button type="button" class="admin-tab ${section === "quiz-grading" ? "active" : ""}" data-admin-tab="quiz-grading">
        Bewertungen
      </button>
      <button type="button" class="admin-tab ${section === "quiz-settings" ? "active" : ""}" data-admin-tab="quiz-settings">Quiz-Einstellungen</button>
      <button type="button" class="admin-tab ${section === "accounts" ? "active" : ""}" data-admin-tab="accounts">Konten</button>
      <button type="button" class="admin-tab admin-tab-home" data-action="home">Zur Startseite</button>
    </nav>

    ${section === "requests" ? adminRequests() : ""}
    ${section === "commands" ? adminCommands() : ""}
    ${section === "scenarios" ? adminScenarios() : ""}
    ${typeof quizAdminSection === "function" ? quizAdminSection(section) : ""}
  </div>`;
}

function adminRequests() {
  if (state.admin.loading) {
    return `<section class="card admin-panel"><p class="admin-empty">Anfragen werden geladen …</p></section>`;
  }
  if (!state.admin.requests.length) {
    return `<section class="card admin-panel">
      <div class="admin-empty">
        <span class="empty-icon">✓</span>
        <p><strong>Keine offenen Anfragen.</strong><br>Neue Registrierungen erscheinen hier automatisch.</p>
      </div>
    </section>`;
  }
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <h2>Offene Registrierungen</h2>
      <button class="btn btn-ghost btn-sm" type="button" data-admin-action="reload-requests">Aktualisieren</button>
    </div>
    <div class="request-list">
      ${state.admin.requests
        .map(
          (request) => `
        <article class="request-row" data-request="${e(request.id)}">
          <div class="request-main">
            <strong>${e(request.discord_username)}</strong>
            <span>Roblox: ${e(request.roblox_username || "—")}</span>
            <span class="request-time">Angefragt ${e(formatDate(request.created_at))}</span>
          </div>
          <input class="request-reason" type="text" placeholder="Begründung bei Ablehnung (optional)"
            data-reject-reason="${e(request.id)}" maxlength="300" />
          <div class="request-actions">
            <button class="btn btn-primary btn-sm" type="button" data-admin-action="approve" data-id="${e(request.id)}">Annehmen</button>
            <button class="btn btn-danger btn-sm" type="button" data-admin-action="reject" data-id="${e(request.id)}">Ablehnen</button>
          </div>
        </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function adminCommands() {
  if (state.admin.commandDraft) return adminCommandEditor();
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Befehle &amp; Eingabefelder</h2>
        <p class="panel-hint">Diese Befehle erscheinen im Training und in der Befehlsübersicht.</p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-admin-action="new-command">Neuer Befehl</button>
    </div>
    <div class="admin-table">
      <div class="admin-table-head">
        <span>Nr.</span><span>Bezeichnung</span><span>Felder</span><span>Maßnahmen</span><span></span>
      </div>
      ${COMMANDS.map(
        (cmd) => `
        <div class="admin-table-row">
          <span class="cmd-nr">${e(cmd.nr)}</span>
          <span class="admin-table-title"><strong>${e(cmd.title)}</strong><small>${e(cmd.short || "")}</small></span>
          <span>${cmd.fields.length}</span>
          <span>${cmd.measures.length}</span>
          <span class="admin-row-actions">
            <button class="link-btn" type="button" data-admin-action="edit-command" data-nr="${e(cmd.nr)}">Bearbeiten</button>
            <button class="link-btn danger" type="button" data-admin-action="delete-command" data-nr="${e(cmd.nr)}">Löschen</button>
          </span>
        </div>`
      ).join("")}
    </div>
  </section>`;
}

function adminCommandEditor() {
  const cmd = state.admin.commandDraft;
  const isNew = !cmd.existing;
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>${isNew ? "Neuer Befehl" : `Befehl ${e(cmd.nr)} bearbeiten`}</h2>
        <p class="panel-hint">Felder und Maßnahmen bestimmen die Eingabemaske im Training.</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-admin-action="cancel-command">Zurück</button>
    </div>
    <form id="command-form" class="admin-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Befehlsnummer</span>
          <input data-cm="nr" type="text" value="${e(cmd.nr)}" ${isNew ? "" : "readonly"} required />
        </label>
        <label class="field">
          <span class="field-label">Kurzbezeichnung</span>
          <input data-cm="short" type="text" value="${e(cmd.short || "")}" placeholder="z. B. BÜ sichern" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">Bezeichnung</span>
        <input data-cm="title" type="text" value="${e(cmd.title || "")}" required />
      </label>
      <label class="field">
        <span class="field-label">Beschreibung</span>
        <textarea data-cm="description" rows="3">${e(cmd.description || "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Befehlstext / Vorlage</span>
        <textarea data-cm="template" rows="2">${e(cmd.template || "")}</textarea>
      </label>

      <div class="editor-block">
        <div class="editor-head">
          <h3>Eingabefelder</h3>
          <button class="btn btn-secondary btn-sm" type="button" data-admin-action="add-field">Feld hinzufügen</button>
        </div>
        <p class="panel-hint">Optionen mit <code>|</code> oder Semikolon trennen. Kommas bleiben Teil der Option (z. B. „km 8,7“). Die Feld-ID ist intern und muss eindeutig sein.</p>
        <div class="editor-rows" id="command-fields">
          ${(cmd.fields || [])
            .map(
              (field) => `
            <div class="editor-row" data-cf-row>
              <input data-cf="id" type="text" value="${e(field.id)}" placeholder="id" aria-label="Feld-ID" />
              <input data-cf="label" type="text" value="${e(field.label)}" placeholder="Beschriftung" aria-label="Beschriftung" />
              <input data-cf="options" type="text" value="${e((field.options || []).join(" | "))}" placeholder="Option 1 | Option 2" aria-label="Optionen" />
              <input data-cf="placeholder" type="text" value="${e(field.placeholder || "")}" placeholder="Platzhalter" aria-label="Platzhalter" />
              <button class="icon-btn" type="button" data-admin-action="remove-row" aria-label="Feld entfernen">×</button>
            </div>`
            )
            .join("")}
        </div>
      </div>

      <div class="editor-block">
        <div class="editor-head">
          <h3>Zusatzmaßnahmen</h3>
          <button class="btn btn-secondary btn-sm" type="button" data-admin-action="add-measure">Maßnahme hinzufügen</button>
        </div>
        <div class="editor-rows" id="command-measures">
          ${(cmd.measures || [])
            .map(
              (measure) => `
            <div class="editor-row measure-row" data-cm-row>
              <input data-cm="id" type="text" value="${e(measure.id)}" placeholder="id" aria-label="Maßnahmen-ID" />
              <input data-cm="label" type="text" value="${e(measure.label)}" placeholder="Beschriftung" aria-label="Beschriftung" />
              <button class="icon-btn" type="button" data-admin-action="remove-row" aria-label="Maßnahme entfernen">×</button>
            </div>`
            )
            .join("")}
        </div>
      </div>

      <div class="editor-actions">
        <button class="btn btn-primary" type="submit">Befehl speichern</button>
        <button class="btn btn-ghost" type="button" data-admin-action="cancel-command">Abbrechen</button>
      </div>
    </form>
  </section>`;
}

function adminScenarios() {
  if (state.admin.scenarioDraft) return adminScenarioEditor();
  const generated = COMMANDS.length - new Set(dbScenarios.map((s) => s.command)).size;
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Eigene Situationen</h2>
        <p class="panel-hint">
          Zusätzlich zu automatisch erzeugten Lagen. Für ${generated} Befehl(e) liefert der Generator weiterhin neue Situationen.
        </p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-admin-action="new-scenario">Neue Situation</button>
    </div>
    ${
      dbScenarios.length
        ? `<div class="admin-table">
            <div class="admin-table-head scenario-head">
              <span>Befehl</span><span>Situation</span><span>Punkte</span><span></span>
            </div>
            ${dbScenarios
              .map((s) => {
                const cmd = getCommand(s.command);
                return `
                <div class="admin-table-row scenario-row">
                  <span class="cmd-nr">${e(s.command)}</span>
                  <span class="admin-table-title"><strong>${e(s.title)}</strong><small>${e(cmd ? cmd.title : "")}</small></span>
                  <span>${pointsSum(s.fieldPoints, s.measurePoints) + 4} / 10</span>
                  <span class="admin-row-actions">
                    <button class="link-btn" type="button" data-admin-action="edit-scenario" data-id="${e(s.id)}">Bearbeiten</button>
                    <button class="link-btn danger" type="button" data-admin-action="delete-scenario" data-id="${e(s.id)}">Löschen</button>
                  </span>
                </div>`;
              })
              .join("")}
          </div>`
        : `<div class="admin-empty"><p><strong>Noch keine eigenen Situationen.</strong><br>Der Trainer nutzt aktuell ausschließlich generierte Lagen.</p></div>`
    }
  </section>`;
}

function scenarioFieldRows(draft) {
  const cmd = getCommand(draft.command_nr);
  if (!cmd) {
    return `<p class="admin-empty">Wähle zuerst einen Befehl – danach erscheinen dessen Eingabefelder.</p>`;
  }
  if (!cmd.fields.length) {
    return `<p class="panel-hint">Dieser Befehl hat keine Eingabefelder. Vergib die Punkte über die Zusatzmaßnahmen.</p>`;
  }
  return cmd.fields
    .map((field) => {
      const target = draft.fieldPoints?.[field.id] || { correct: "", points: 2 };
      return `
      <div class="editor-row scenario-points-row" data-sfp-row data-field="${e(field.id)}">
        <span class="editor-label">${e(field.label)}</span>
        <select data-sfp="correct" aria-label="Richtige Angabe">
          <option value="">Richtige Angabe wählen</option>
          ${(field.options || [])
            .map(
              (option) =>
                `<option value="${e(option)}" ${target.correct === option ? "selected" : ""}>${e(option)}</option>`
            )
            .join("")}
        </select>
        <input data-sfp="points" type="number" min="0" max="6" value="${Number(target.points) || 0}" aria-label="Punkte" />
        <span class="points-unit">P</span>
      </div>`;
    })
    .join("");
}

function scenarioMeasureRows(draft) {
  const cmd = getCommand(draft.command_nr);
  if (!cmd || !cmd.measures.length) {
    return `<p class="panel-hint">Dieser Befehl hat keine Zusatzmaßnahmen.</p>`;
  }
  return cmd.measures
    .map((measure) => {
      const target = draft.measurePoints?.[measure.id] || { correct: false, points: 0 };
      return `
      <div class="editor-row scenario-measure-row" data-smp-row data-measure="${e(measure.id)}">
        <label class="check compact">
          <input type="checkbox" data-smp="correct" ${target.correct ? "checked" : ""} />
          <span class="check-box" aria-hidden="true"></span>
          <span class="check-text">${e(measure.label)}</span>
        </label>
        <input data-smp="points" type="number" min="0" max="6" value="${Number(target.points) || 0}" aria-label="Punkte" />
        <span class="points-unit">P</span>
      </div>`;
    })
    .join("");
}

function adminScenarioEditor() {
  const draft = state.admin.scenarioDraft;
  const isNew = !draft.id;
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>${isNew ? "Neue Situation" : "Situation bearbeiten"}</h2>
        <p class="panel-hint">Vergabe: Befehlswahl 4 P + Angaben und Maßnahmen zusammen 6 P = 10 P.</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-admin-action="cancel-scenario">Zurück</button>
    </div>

    <form id="scenario-form" class="admin-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Befehl</span>
          <span class="select-wrap">
            <select id="sc-command" data-sm="command_nr" required>
              <option value="">Befehl wählen</option>
              ${COMMANDS.map(
                (cmd) =>
                  `<option value="${e(cmd.nr)}" ${draft.command_nr === cmd.nr ? "selected" : ""}>${e(cmd.nr)} – ${e(cmd.title)}</option>`
              ).join("")}
            </select>
          </span>
        </label>
        <label class="field">
          <span class="field-label">Zug</span>
          <input data-sm="train" type="text" value="${e(draft.train || "")}" placeholder="z. B. RE 4711" />
        </label>
      </div>

      <div class="form-grid">
        <label class="field">
          <span class="field-label">Titel der Situation</span>
          <input data-sm="title" type="text" value="${e(draft.title || "")}" required />
        </label>
        <label class="field">
          <span class="field-label">Ort / Untertitel</span>
          <input data-sm="subtitle" type="text" value="${e(draft.subtitle || "")}" placeholder="z. B. Bf Musterstadt · Esig 60A" />
        </label>
        <label class="field">
          <span class="field-label">Zeit</span>
          <input data-sm="time" type="text" value="${e(draft.time || "")}" placeholder="z. B. 08:12" />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Situation (Beschreibung)</span>
        <textarea data-sm="situation" rows="5" required>${e(draft.situation || "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Auftrag</span>
        <textarea data-sm="task" rows="2">${e(draft.task || "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Merkmale (eine Zeile pro Merkmal)</span>
        <textarea data-sm="facts" rows="3">${e(draft.facts || "")}</textarea>
      </label>

      <div class="editor-block">
        <h3>Zugfunk (optional)</h3>
        <label class="field">
          <span class="field-label">Meldung des Triebfahrzeugführers</span>
          <textarea data-sm="radioText" rows="3" placeholder="Fahrdienstleiter, hier …">${e(draft.radioText || "")}</textarea>
        </label>
        <p class="panel-hint">Der Sprecher wird automatisch als TF mit dem Zugnamen gesetzt.</p>
      </div>

      <div class="editor-block">
        <div class="editor-head">
          <h3>Angaben &amp; Punkte</h3>
          <span class="points-total" id="scenario-points-total">${pointsSum(draft.fieldPoints, draft.measurePoints)} / 6 P</span>
        </div>
        <div class="editor-rows">${scenarioFieldRows(draft)}</div>
      </div>

      <div class="editor-block">
        <h3>Zusatzmaßnahmen</h3>
        <div class="editor-rows">${scenarioMeasureRows(draft)}</div>
      </div>

      <label class="field">
        <span class="field-label">Begründung / Erklärung</span>
        <textarea data-sm="explanation" rows="4">${e(draft.explanation || "")}</textarea>
      </label>

      <label class="field">
        <span class="field-label">Streckenbild</span>
        <span class="select-wrap">
          <select data-sm="preset">
            ${draft.id ? `<option value="original" ${draft.preset === "original" ? "selected" : ""}>Vorhandenes Bild beibehalten</option>` : ""}
            ${SCENE_PRESETS.map(
              (preset) =>
                `<option value="${preset.id}" ${draft.preset === preset.id ? "selected" : ""}>${preset.label}</option>`
            ).join("")}
          </select>
        </span>
      </label>

      <div class="editor-actions">
        <button class="btn btn-primary" type="submit">Situation speichern</button>
        <button class="btn btn-ghost" type="button" data-admin-action="cancel-scenario">Abbrechen</button>
      </div>
    </form>
  </section>`;
}

/* --------------------------------------------------------------------------
   Admin-Daten
   -------------------------------------------------------------------------- */
async function loadRequests() {
  if (!isAdmin()) return;
  state.admin.loading = state.admin.requests.length === 0;
  if (state.screen === "admin" && state.admin.section === "requests") render();
  const { data, error } = await sb
    .from("profiles")
    .select("id, discord_username, roblox_username, created_at, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  state.admin.loading = false;
  if (error) {
    console.error("Anfragen konnten nicht geladen werden:", error);
    showToast("Anfragen konnten nicht geladen werden.");
  } else {
    state.admin.requests = data || [];
  }
  if (state.screen === "admin") render({ preserveScroll: true });
}

async function enterAdmin() {
  if (!isAdmin()) return;
  state.screen = "admin";
  state.admin.section = "requests";
  state.admin.commandDraft = null;
  state.admin.scenarioDraft = null;
  await loadCatalog();
  await loadRequests();
  render();
}

function syncAdminRealtime() {
  if (!sb) return;
  const shouldSubscribe = state.screen === "admin" && isAdmin();
  if (shouldSubscribe && !adminChannel) {
    adminChannel = sb
      .channel("admin-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          window.clearTimeout(syncAdminRealtime.timer);
          syncAdminRealtime.timer = window.setTimeout(loadRequests, 400);
        }
      )
      .subscribe();
  } else if (!shouldSubscribe && adminChannel) {
    sb.removeChannel(adminChannel);
    adminChannel = null;
  }
}

/* Solange die Anfrage offen ist, wird der Status regelmäßig geprüft. */
function syncStatusPolling() {
  window.clearTimeout(statusTimer);
  if (!["pending", "rejected"].includes(state.screen) || !state.session) return;
  statusTimer = window.setTimeout(async () => {
    const previous = state.screen;
    await loadProfile();
    const status = state.profile?.status;
    if (status === "approved") {
      await loadCatalog();
      state.screen = "start";
    } else if (status === "rejected") {
      state.screen = "rejected";
    } else {
      state.screen = "pending";
    }
    if (previous !== state.screen) render();
    else syncStatusPolling();
  }, 5000);
}

async function approveRequest(id) {
  const { error } = await sb.rpc("approve_request", { target: id });
  if (error) {
    console.error(error);
    showToast("Freigabe fehlgeschlagen.");
    return;
  }
  showToast("Anfrage angenommen.");
  await loadRequests();
}

async function rejectRequest(id) {
  const input = document.querySelector(`[data-reject-reason="${id}"]`);
  const reason = input ? input.value.trim() : "";
  const { error } = await sb.rpc("reject_request", { target: id, reason: reason || null });
  if (error) {
    console.error(error);
    showToast("Ablehnung fehlgeschlagen.");
    return;
  }
  showToast(reason ? "Anfrage mit Begründung abgelehnt." : "Anfrage abgelehnt.");
  await loadRequests();
}

function collectCommandDraft() {
  const root = document.getElementById("command-form");
  if (!root) return null;
  const value = (name) => root.querySelector(`[data-cm="${name}"]`)?.value.trim() || "";
  const fields = [...root.querySelectorAll("[data-cf-row]")]
    .map((row) => ({
      id: row.querySelector('[data-cf="id"]').value.trim(),
      label: row.querySelector('[data-cf="label"]').value.trim(),
      options: splitOptions(row.querySelector('[data-cf="options"]').value),
      placeholder: row.querySelector('[data-cf="placeholder"]').value.trim() || "Auswählen",
    }))
    .filter((field) => field.id && field.label && field.options.length);
  const measures = [...root.querySelectorAll("[data-cm-row]")]
    .map((row) => ({
      id: row.querySelector('[data-cm="id"]').value.trim(),
      label: row.querySelector('[data-cm="label"]').value.trim(),
    }))
    .filter((measure) => measure.id && measure.label);
  return {
    nr: value("nr"),
    title: value("title"),
    short: value("short"),
    description: value("description"),
    template: value("template"),
    fields,
    measures,
    existing: state.admin.commandDraft?.existing || false,
  };
}

async function saveCommand() {
  const draft = collectCommandDraft();
  if (!draft) return;
  if (!draft.nr || !draft.title) {
    showToast("Befehlsnummer und Bezeichnung sind erforderlich.");
    return;
  }
  if (!draft.fields.length && !draft.measures.length) {
    showToast("Mindestens ein Eingabefeld oder eine Maßnahme anlegen.");
    return;
  }
  const ids = draft.fields.map((f) => f.id);
  if (new Set(ids).size !== ids.length) {
    showToast("Die Feld-IDs müssen eindeutig sein.");
    return;
  }
  const payload = {
    nr: draft.nr,
    title: draft.title,
    short: draft.short,
    description: draft.description,
    template: draft.template,
    fields: draft.fields,
    measures: draft.measures,
    sort_order: COMMANDS.findIndex((c) => c.nr === draft.nr) + 1 || COMMANDS.length + 1,
    active: true,
  };
  const { error } = await sb.from("commands").upsert(payload, { onConflict: "nr" });
  if (error) {
    console.error(error);
    showToast("Befehl konnte nicht gespeichert werden.");
    return;
  }
  showToast("Befehl gespeichert.");
  state.admin.commandDraft = null;
  await loadCatalog();
  buildReference();
  render();
}

async function deleteCommand(nr) {
  if (!window.confirm(`Befehl ${nr} und alle zugehörigen eigenen Situationen löschen?`)) return;
  const { error } = await sb.from("commands").delete().eq("nr", nr);
  if (error) {
    console.error(error);
    showToast("Befehl konnte nicht gelöscht werden.");
    return;
  }
  showToast("Befehl gelöscht.");
  await loadCatalog();
  buildReference();
  render();
}

function collectScenarioDraft() {
  const root = document.getElementById("scenario-form");
  if (!root) return state.admin.scenarioDraft;
  const value = (name) => root.querySelector(`[data-sm="${name}"]`)?.value || "";
  const fieldPoints = {};
  root.querySelectorAll("[data-sfp-row]").forEach((row) => {
    const id = row.dataset.field;
    fieldPoints[id] = {
      correct: row.querySelector('[data-sfp="correct"]').value,
      points: Number(row.querySelector('[data-sfp="points"]').value) || 0,
    };
  });
  const measurePoints = {};
  root.querySelectorAll("[data-smp-row]").forEach((row) => {
    const id = row.dataset.measure;
    measurePoints[id] = {
      correct: row.querySelector('[data-smp="correct"]').checked,
      points: Number(row.querySelector('[data-smp="points"]').value) || 0,
    };
  });
  const previous = state.admin.scenarioDraft || {};
  return {
    id: previous.id || null,
    command_nr: value("command_nr"),
    title: value("title").trim(),
    subtitle: value("subtitle").trim(),
    train: value("train").trim(),
    time: value("time").trim(),
    facts: value("facts"),
    situation: value("situation").trim(),
    task: value("task").trim(),
    radioText: value("radioText").trim(),
    explanation: value("explanation").trim(),
    preset: value("preset") || "signal",
    fieldPoints,
    measurePoints,
    scene: previous.scene || null,
  };
}

async function saveScenario() {
  const draft = collectScenarioDraft();
  if (!draft) return;
  if (!draft.command_nr) {
    showToast("Bitte einen Befehl wählen.");
    return;
  }
  if (!draft.title || !draft.situation) {
    showToast("Titel und Situation sind erforderlich.");
    return;
  }
  const cmd = getCommand(draft.command_nr);
  const missing = Object.entries(draft.fieldPoints || {}).filter(([, v]) => !v.correct);
  if (missing.length) {
    showToast("Für jedes Eingabefeld muss die richtige Angabe gewählt sein.");
    return;
  }
  const sum = pointsSum(draft.fieldPoints, draft.measurePoints);
  if (sum !== 6) {
    showToast(`Angaben und Maßnahmen ergeben ${sum} P – erforderlich sind genau 6 P.`);
    return;
  }
  const scene =
    draft.preset === "original" && draft.scene
      ? draft.scene
      : sceneFromPreset(draft.preset, draft);
  const radio = draft.radioText
    ? [{ speaker: "TF", who: draft.train || "TF", text: draft.radioText }]
    : [];
  const payload = {
    command_nr: draft.command_nr,
    title: draft.title,
    subtitle: draft.subtitle,
    train: draft.train,
    time: draft.time,
    facts: String(draft.facts || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    situation: draft.situation,
    task: draft.task,
    radio,
    field_points: draft.fieldPoints,
    measure_points: draft.measurePoints,
    explanation: draft.explanation,
    scene,
    active: true,
  };
  const query = draft.id
    ? sb.from("scenarios").update(payload).eq("id", draft.id)
    : sb.from("scenarios").insert(payload);
  const { error } = await query;
  if (error) {
    console.error(error);
    showToast("Situation konnte nicht gespeichert werden.");
    return;
  }
  showToast("Situation gespeichert.");
  state.admin.scenarioDraft = null;
  await loadCatalog();
  render();
}

async function deleteScenario(id) {
  if (!window.confirm("Diese Situation wirklich löschen?")) return;
  const { error } = await sb.from("scenarios").delete().eq("id", id);
  if (error) {
    console.error(error);
    showToast("Situation konnte nicht gelöscht werden.");
    return;
  }
  showToast("Situation gelöscht.");
  await loadCatalog();
  render();
}

/* --------------------------------------------------------------------------
   Rendern
   -------------------------------------------------------------------------- */
function buildReference() {
  const list = document.getElementById("reference-list");
  if (!list) return;
  list.innerHTML = COMMANDS.map(
    (cmd) => `
    <article class="reference-item" data-search="${e(
      `${cmd.nr} ${cmd.title} ${cmd.description}`.toLowerCase()
    )}">
      <div class="reference-head">
        <span class="cmd-nr">${e(cmd.nr)}</span>
        <h3>${e(cmd.title)}</h3>
      </div>
      <p>${e(cmd.description)}</p>
      <div class="reference-template">${e(cmd.template)}</div>
      <div class="reference-fields">
        ${cmd.fields.map((f) => `<span>${e(f.label)}</span>`).join("")}
        ${cmd.measures.map((m) => `<span class="measure-ref">${e(m.label)}</span>`).join("")}
      </div>
    </article>`
  ).join("");
}

function render({ preserveScroll = false } = {}) {
  const scrollY = window.scrollY;
  updateHeader();
  document.body.dataset.screen = state.screen;

  if (state.screen === "boot") {
    app.innerHTML = `<section class="status-screen"><div class="status-card card"><span class="status-icon pending">…</span><h1>Anmeldung wird geprüft</h1><p class="status-lead">Einen Moment bitte.</p></div></section>`;
  } else if (state.screen === "config") {
    app.innerHTML = configScreen();
  } else if (state.screen === "auth") {
    app.innerHTML = authScreen();
  } else if (state.screen === "pending") {
    app.innerHTML = pendingScreen();
  } else if (state.screen === "rejected") {
    app.innerHTML = rejectedScreen();
  } else if (state.screen === "start") {
    buildReference();
    app.innerHTML = startScreen();
  } else if (state.screen === "train") {
    app.innerHTML = trainScreen();
  } else if (state.screen === "result") {
    app.innerHTML = resultScreen();
  } else if (state.screen === "summary") {
    app.innerHTML = summaryScreen();
  } else if (state.screen === "admin") {
    app.innerHTML = adminScreen();
  } else if (typeof quizIsScreen === "function" && quizIsScreen(state.screen)) {
    app.innerHTML = quizScreen();
  } else if (state.screen === "change-password" || state.screen === "disabled") {
    app.innerHTML = quizAccountScreen();
  } else {
    app.innerHTML = startScreen();
  }

  syncAdminRealtime();
  syncStatusPolling();

  if (preserveScroll) window.scrollTo({ top: scrollY });
  else window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function refreshOrderPanel() {
  const panel = document.getElementById("order-panel");
  if (!panel) return;
  const scenario = state.queue[state.index];
  panel.innerHTML = orderPanel(scenario);
}

function startTraining() {
  const queue = enrichOrderQueue(buildScenarioQueue(SCENARIOS_PER_RUN, dbScenarios));
  if (queue.length < 2) {
    showToast("Es sind noch nicht genug Situationen verfügbar.");
    return;
  }
  state.queue = queue;
  state.index = 0;
  state.answers = [];
  state.current = { command: null, fields: {}, measures: {}, struck: {}, header: {}, note: "" };
  state.startedAt = Date.now();
  state.endedAt = null;
  state.screen = "train";
  render();
}

function nextSituation() {
  if (state.index >= state.queue.length - 1) {
    state.endedAt = Date.now();
    state.screen = "summary";
    render();
    return;
  }
  state.index += 1;
  state.current = { command: null, fields: {}, measures: {}, struck: {}, header: {}, note: "" };
  state.screen = "train";
  render();
}

function submitOrder() {
  const scenario = state.queue[state.index];
  if (!state.current.command) {
    showToast("Bitte wähle zuerst einen Befehl aus.");
    return;
  }
  const missing = orderMissingHeaderFields(state.current.header || {});
  if (missing.length) {
    showToast(`Bitte fülle die Kopfzeile vollständig aus: ${missing.map((f) => f.id).join(", ")}.`);
    return;
  }
  const answer = {
    command: state.current.command,
    fields: { ...state.current.fields },
    measures: { ...state.current.measures },
    header: { ...(state.current.header || {}) },
    struck: { ...(state.current.struck || {}) },
    evaluation: null,
  };
  answer.evaluation = evaluate(scenario, answer);
  state.answers[state.index] = answer;
  state.screen = "result";
  render();
}

function openEndConfirm() {
  if (state.screen === "summary") {
    state.screen = "start";
    render();
    return;
  }
  if (!["train", "result"].includes(state.screen)) return;
  if (typeof confirmModal.showModal === "function") confirmModal.showModal();
  else if (window.confirm("Training beenden? Nicht bearbeitete Situationen werden mit 0 Punkten gewertet.")) {
    state.endedAt = Date.now();
    state.screen = "summary";
    render();
  }
}

function finishEarly() {
  confirmModal.close();
  state.answers = state.queue.map((_, i) => state.answers[i] || null);
  state.endedAt = Date.now();
  state.screen = "summary";
  render();
}

function openReference() {
  if (!isApproved()) return;
  buildReference();
  const search = document.getElementById("cmd-search");
  if (!search) return;
  search.value = "";
  document.querySelectorAll(".reference-item").forEach((item) => {
    item.hidden = false;
  });
  if (typeof referenceModal.showModal === "function") referenceModal.showModal();
  else referenceModal.setAttribute("open", "");
  window.setTimeout(() => search.focus(), 60);
}

/* --------------------------------------------------------------------------
   Ereignisse
   -------------------------------------------------------------------------- */
app.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-auth-tab]");
  if (tab) {
    state.authMode = tab.dataset.authTab;
    state.authError = "";
    render();
    return;
  }

  const adminTab = event.target.closest("[data-admin-tab]");
  if (adminTab) {
    state.admin.section = adminTab.dataset.adminTab;
    state.admin.commandDraft = null;
    state.admin.scenarioDraft = null;
    if (typeof quizAdminEnter === "function") quizAdminEnter(state.admin.section);
    render();
    return;
  }

  const adminActionEl = event.target.closest("[data-admin-action]");
  if (adminActionEl) {
    const action = adminActionEl.dataset.adminAction;
    if (action === "approve") await approveRequest(adminActionEl.dataset.id);
    if (action === "reject") await rejectRequest(adminActionEl.dataset.id);
    if (action === "reload-requests") await loadRequests();
    if (action === "new-command") {
      state.admin.commandDraft = { nr: "", title: "", short: "", description: "", template: "", fields: [], measures: [], existing: false };
      render();
    }
    if (action === "edit-command") {
      const cmd = getCommand(adminActionEl.dataset.nr);
      if (cmd) {
        state.admin.commandDraft = JSON.parse(JSON.stringify({ ...cmd, existing: true }));
        render();
      }
    }
    if (action === "delete-command") await deleteCommand(adminActionEl.dataset.nr);
    if (action === "cancel-command") {
      state.admin.commandDraft = null;
      render();
    }
    if (action === "add-field") {
      document.getElementById("command-fields")?.insertAdjacentHTML(
        "beforeend",
        `<div class="editor-row" data-cf-row>
          <input data-cf="id" type="text" placeholder="id" aria-label="Feld-ID" />
          <input data-cf="label" type="text" placeholder="Beschriftung" aria-label="Beschriftung" />
          <input data-cf="options" type="text" placeholder="Option 1, Option 2" aria-label="Optionen" />
          <input data-cf="placeholder" type="text" placeholder="Platzhalter" aria-label="Platzhalter" />
          <button class="icon-btn" type="button" data-admin-action="remove-row" aria-label="Feld entfernen">×</button>
        </div>`
      );
    }
    if (action === "add-measure") {
      document.getElementById("command-measures")?.insertAdjacentHTML(
        "beforeend",
        `<div class="editor-row measure-row" data-cm-row>
          <input data-cm="id" type="text" placeholder="id" aria-label="Maßnahmen-ID" />
          <input data-cm="label" type="text" placeholder="Beschriftung" aria-label="Beschriftung" />
          <button class="icon-btn" type="button" data-admin-action="remove-row" aria-label="Maßnahme entfernen">×</button>
        </div>`
      );
    }
    if (action === "remove-row") adminActionEl.closest(".editor-row")?.remove();
    if (action === "new-scenario") {
      state.admin.scenarioDraft = {
        id: null,
        command_nr: "",
        title: "",
        subtitle: "",
        train: "",
        time: "",
        facts: "",
        situation: "",
        task: "",
        radioText: "",
        explanation: "",
        preset: "signal",
        fieldPoints: {},
        measurePoints: {},
        scene: null,
      };
      render();
    }
    if (action === "edit-scenario") {
      const scenario = dbScenarios.find((s) => s.id === adminActionEl.dataset.id);
      if (scenario) {
        state.admin.scenarioDraft = {
          id: scenario.id,
          command_nr: scenario.command,
          title: scenario.title,
          subtitle: scenario.subtitle,
          train: scenario.train,
          time: scenario.time,
          facts: (scenario.facts || []).join("\n"),
          situation: scenario.situation,
          task: scenario.task,
          radioText: scenario.radio?.[0]?.text || "",
          explanation: scenario.explanation,
          preset: "original",
          fieldPoints: JSON.parse(JSON.stringify(scenario.fieldPoints || {})),
          measurePoints: JSON.parse(JSON.stringify(scenario.measurePoints || {})),
          scene: scenario.scene,
        };
        render();
      }
    }
    if (action === "delete-scenario") await deleteScenario(adminActionEl.dataset.id);
    if (action === "cancel-scenario") {
      state.admin.scenarioDraft = null;
      render();
    }
    return;
  }

  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === "start" || action === "restart") startTraining();
    if (action === "next") nextSituation();
    if (action === "home") {
      if (!isApproved()) {
        render();
        return;
      }
      state.screen = "start";
      render();
    }
    if (action === "end") openEndConfirm();
    if (action === "reference") openReference();
    if (action === "submit") {
      event.preventDefault();
      submitOrder();
    }
    if (action === "clear-command") {
      state.current.command = null;
      state.current.fields = {};
      state.current.measures = {};
      state.current.struck = {};
      state.current.note = "";
      refreshOrderPanel();
    }
    if (action === "strike-row") {
      const nr = actionEl.dataset.row;
      state.current.struck = state.current.struck || {};
      state.current.struck[nr] = !vordruckStruck(nr);
      refreshOrderPanel();
    }
    if (action === "strike-others") {
      state.current.struck = {};
      const selected = state.current.command;
      const page = selected ? vordruckSectionOf(selected) : null;
      COMMANDS.forEach((cmd) => {
        if (page && vordruckSectionOf(cmd.nr) !== page) return;
        if (cmd.nr !== selected) state.current.struck[cmd.nr] = true;
      });
      refreshOrderPanel();
    }
    if (action === "logout") await signOut();
    if (action === "refresh-status") {
      await loadProfile();
      if (state.profile?.status === "approved") await loadCatalog();
      if (!state.session) state.screen = "auth";
      else if (state.profile?.status === "approved") state.screen = "start";
      else if (state.profile?.status === "rejected") state.screen = "rejected";
      else state.screen = "pending";
      render();
    }
    return;
  }

  const commandButton = event.target.closest("[data-command]");
  if (commandButton) {
    if (event.target.closest(".vrow-fill")) return;
    const nr = commandButton.dataset.command;
    if (state.current.command !== nr) {
      state.current.command = nr;
      state.current.fields = {};
      state.current.measures = {};
      state.current.struck = {};
      state.current.note = "";
    }
    refreshOrderPanel();
    if (window.innerWidth < 900) {
      document.getElementById("order-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

app.addEventListener("change", (event) => {
  const field = event.target.closest("[data-field]");
  if (field) {
    state.current.fields[field.dataset.field] = field.value;
    return;
  }
  const measure = event.target.closest("[data-measure]");
  if (measure) {
    state.current.measures[measure.dataset.measure] = measure.checked;
    return;
  }
  if (event.target.id === "sc-command") {
    const draft = collectScenarioDraft();
    if (draft) {
      draft.command_nr = event.target.value;
      draft.fieldPoints = {};
      draft.measurePoints = {};
      state.admin.scenarioDraft = draft;
      render();
    }
    return;
  }
  if (event.target.closest("#scenario-form")) {
    const draft = collectScenarioDraft();
    if (draft) {
      state.admin.scenarioDraft = draft;
      const total = document.getElementById("scenario-points-total");
      if (total) total.textContent = `${pointsSum(draft.fieldPoints, draft.measurePoints)} / 6 P`;
    }
  }
});

app.addEventListener("input", (event) => {
  const header = event.target.closest("[data-header]");
  if (header) {
    state.current.header = state.current.header || {};
    state.current.header[header.dataset.header] = header.value;
    return;
  }
  const note = event.target.closest("[data-note]");
  if (note) {
    state.current.note = note.value;
    return;
  }
  if (!event.target.closest("#scenario-form")) return;
  const draft = collectScenarioDraft();
  if (draft) {
    state.admin.scenarioDraft = draft;
    const total = document.getElementById("scenario-points-total");
    if (total) total.textContent = `${pointsSum(draft.fieldPoints, draft.measurePoints)} / 6 P`;
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.matches('[data-auth-form="login"]')) {
    const form = event.target;
    const discord = form.elements.discord.value.trim();
    const password = form.elements.password.value;
    state.authError = "";
    if (!discord || !password) {
      state.authError = "Bitte Discord-Name und Passwort eingeben.";
      render();
      return;
    }
    state.authBusy = true;
    render();
    try {
      await signIn(discord, password);
    } catch (error) {
      state.authBusy = false;
      state.authError = authErrorMessage(error);
      state.authMode = "login";
      render();
      return;
    }
    state.authBusy = false;
    return;
  }

  if (event.target.matches('[data-auth-form="register"]')) {
    const form = event.target;
    const discord = form.elements.discord.value.trim();
    const roblox = form.elements.roblox.value.trim();
    const password = form.elements.password.value;
    const password2 = form.elements.password2.value;
    state.authError = "";
    if (!discord || !roblox) {
      state.authError = "Bitte Discord- und Roblox-Namen eingeben.";
      state.authMode = "register";
      render();
      return;
    }
    if (password.length < 6) {
      state.authError = "Das Passwort muss mindestens 6 Zeichen haben.";
      state.authMode = "register";
      render();
      return;
    }
    if (password !== password2) {
      state.authError = "Die Passwörter stimmen nicht überein.";
      state.authMode = "register";
      render();
      return;
    }
    state.authBusy = true;
    render();
    try {
      await signUp(discord, roblox, password);
    } catch (error) {
      state.authBusy = false;
      state.authError = authErrorMessage(error);
      state.authMode = "register";
      render();
      return;
    }
    state.authBusy = false;
    return;
  }

  if (event.target.id === "befehl-form") {
    submitOrder();
    return;
  }

  if (event.target.id === "command-form") {
    await saveCommand();
    return;
  }

  if (event.target.id === "scenario-form") {
    await saveScenario();
  }
});

document.querySelector(".brand")?.addEventListener("click", () => {
  if (isApproved()) {
    state.screen = "start";
    render();
  } else {
    render();
  }
});

headerEnd.addEventListener("click", () => {
  if (state.screen === "summary") {
    state.screen = "start";
    render();
  } else {
    openEndConfirm();
  }
});

adminButton.addEventListener("click", enterAdmin);
logoutButton.addEventListener("click", signOut);
referenceButton.addEventListener("click", openReference);

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});

referenceModal?.addEventListener("click", (event) => {
  if (event.target === referenceModal) referenceModal.close();
});
confirmModal?.addEventListener("click", (event) => {
  if (event.target === confirmModal) confirmModal.close();
});

document.getElementById("cmd-search")?.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".reference-item").forEach((item) => {
    item.hidden = query.length > 0 && !item.dataset.search.includes(query);
  });
});

document.querySelector('[data-action="confirm-end"]')?.addEventListener("click", finishEarly);
document.querySelector('[data-action="cancel-end"]')?.addEventListener("click", () => confirmModal.close());

/* --------------------------------------------------------------------------
   Start
   -------------------------------------------------------------------------- */
async function init() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey || !window.supabase) {
    state.screen = "config";
    render();
    return;
  }

  sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      if (typeof resetQuizSession === "function") resetQuizSession();
      state.session = null;
      state.profile = null;
      state.screen = "auth";
      render();
      return;
    }
    window.setTimeout(() => {
      handleAuth().catch((error) => {
        console.error(error);
        showToast("Anmeldung konnte nicht geprüft werden.");
      });
    }, 0);
  });

  await fetchBootstrap();
  try {
    await handleAuth();
    if (typeof initQuiz === "function") await initQuiz();
  } catch (error) {
    console.error(error);
    state.screen = "auth";
    state.authError = "Verbindung zu Supabase fehlgeschlagen.";
    render();
  }
}

init();
