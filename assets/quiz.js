/* ==========================================================================
   Befehlstrainer – Betriebsregelwerk, Quiz und Kontoverwaltung
   Wird vor app.js geladen. Die Funktionen greifen auf den gemeinsamen
   Zustand (state, sb) und die Hilfsfunktionen aus app.js zu.
   ========================================================================== */

const QUIZ_DOC_ID = "1KO3TPmR1nOH0BO2H2PVnZd21D_LbWUYL9oWDfjlioqQ";
const QUIZ_SITE_URL = "https://jggaming25.github.io/Befehls-Trainer/";
const QUIZ_EMBED_URL = `https://docs.google.com/document/d/${QUIZ_DOC_ID}/preview?embedded=true`;
const QUIZ_DIRECT_URL = `https://docs.google.com/document/d/${QUIZ_DOC_ID}/edit`;

const QUIZ_CATEGORY_LABELS = {
  regelwerk: "Betriebsregelwerk",
  befehl: "Befehl erstellen",
  allgemein: "Allgemein",
};

const QUIZ_TYPE_LABELS = {
  multiple_choice: "Multiple Choice",
  short: "Kurzantwort",
  long: "Langantwort",
  command: "Befehl erstellen",
};

const QUIZ_STATUS_LABELS = {
  active: "Läuft",
  submitted: "Bewertung offen",
  graded: "Bewertet",
  expired: "Abgelaufen",
};

const QUIZ_FLAG_LABELS = {
  left: "Seite verlassen / neu geladen",
  cheat: "Tab oder Browser verlassen",
  deadline: "Zeit abgelaufen",
};

const quizState = {
  loaded: false,
  loading: false,
  error: "",
  settings: null,
  attempts: [],
  publicQuestions: [],
  active: null,
  answers: {},
  dirty: {},
  index: 0,
  viewAttempt: null,
  timer: null,
  awaySince: null,
  awayTimer: null,
  warningVisible: false,
  warnings: 0,
  finishing: false,
  integrityOpen: false,
  integrityAck: false,
  orphanHandled: null,
  channel: null,
  tabId: Math.random().toString(36).slice(2),
  listenersReady: false,
  navLock: null,
  passwordError: "",
  admin: {
    section: null,
    loaded: false,
    loading: false,
    error: "",
    questions: [],
    settings: null,
    attempts: [],
    accounts: [],
    questionDraft: null,
    grading: null,
    gradingKeys: [],
    otp: null,
    busy: false,
  },
};

/* --------------------------------------------------------------------------
   Helfer
   -------------------------------------------------------------------------- */
function quizNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function quizFmt(value, digits = 1) {
  const n = quizNum(value);
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function quizPct(points, max) {
  if (!max) return 0;
  return Math.round((quizNum(points) / quizNum(max)) * 1000) / 10;
}

function quizStatusPill(status) {
  const cls =
    status === "graded" ? "ok" : status === "submitted" ? "wait" : status === "expired" ? "bad" : "live";
  return `<span class="status-pill ${cls}">${e(QUIZ_STATUS_LABELS[status] || status)}</span>`;
}

function quizFormatDate(value) {
  return formatDate(value);
}

function quizDeadlineText(value) {
  if (!value) return "keine Frist";
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return `Frist abgelaufen (${formatDate(value)})`;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `noch ${days} Tag${days === 1 ? "" : "e"} ${hours} Std. (${formatDate(value)})`;
  return `noch ${Math.max(1, hours)} Std. (${formatDate(value)})`;
}

function quizPassDecided(attempt) {
  return Boolean(attempt && attempt.status === "graded" && typeof attempt.passed === "boolean");
}

function quizPassed(attempt) {
  return Boolean(attempt && attempt.status === "graded" && attempt.passed === true);
}

function quizPassRecommendation(attempt) {
  const threshold = quizNum(quizState.settings?.pass_percent ?? 60);
  return quizNum(attempt?.percentage) >= threshold;
}

function quizPassLabel(attempt) {
  if (!attempt || attempt.status !== "graded") return "Entscheidung offen";
  if (!quizPassDecided(attempt)) return "Entscheidung offen";
  return attempt.passed ? "bestanden" : "nicht bestanden";
}

function quizQuestionSeconds(question, settings = quizState.settings) {
  const s = settings || {};
  const type = question.type || "multiple_choice";
  const options = Array.isArray(question.options) ? question.options.length : 0;
  if (type === "short") return Math.max(10, Math.round(quizNum(s.short_minutes ?? 1.5) * 60));
  if (type === "long") return Math.max(10, Math.round(quizNum(s.long_minutes ?? 4) * 60));
  if (type === "command") return Math.max(10, Math.round(quizNum(s.long_minutes ?? 4) * 120));
  if (type === "multiple_choice") {
    if (options <= 4) return Math.max(10, Math.round(quizNum(s.mc_1_4_minutes ?? 0.5) * 60));
    if (options <= 10) return Math.max(10, Math.round(quizNum(s.mc_5_10_minutes ?? 1) * 60));
    return Math.max(10, Math.round(quizNum(s.mc_11_plus_minutes ?? 2) * 60));
  }
  return 60;
}

function quizSuggestedSeconds(questions = quizState.publicQuestions) {
  return questions.reduce((sum, q) => sum + quizQuestionSeconds(q), 0);
}

function quizHeaderTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min >= 60) {
    const h = Math.floor(min / 60);
    return `${h}:${String(min % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function quizIsScreen(name) {
  return ["rulebook", "quiz", "quizrun", "quizresult"].includes(name);
}

function quizActive() {
  return quizState.active && quizState.active.status === "active";
}

function quizDefaultSettings() {
  return {
    quiz_enabled: true,
    short_minutes: 1.5,
    long_minutes: 4,
    mc_1_4_minutes: 0.5,
    mc_5_10_minutes: 1,
    mc_11_plus_minutes: 2,
    total_minutes: null,
    pass_percent: 60,
    retention_weeks: 12,
  };
}

function quizSettings() {
  return quizState.settings || quizDefaultSettings();
}

/* --------------------------------------------------------------------------
   Kontakt-Hinweis bei Speicherproblemen
   -------------------------------------------------------------------------- */
function showContact(message) {
  const text = document.getElementById("contact-text");
  if (text) {
    text.textContent =
      message ||
      "Deine Daten konnten nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich.";
  }
  const dialog = document.getElementById("contact-modal");
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function quizFail(error, message) {
  console.error(message || "Quiz-Fehler:", error);
  showContact(
    message
      ? `${message} Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich.`
      : undefined
  );
}

/* --------------------------------------------------------------------------
   Daten laden
   -------------------------------------------------------------------------- */
async function loadQuizData({ force = false } = {}) {
  if (!sb || !isApproved()) return;
  if (quizState.loading) return;
  if (quizState.loaded && !force) return;
  quizState.loading = true;
  quizState.error = "";
  try {
    const [settingsResult, attemptsResult, questionsResult] = await Promise.all([
      sb.from("quiz_settings").select("*").maybeSingle(),
      sb.from("quiz_attempts").select("*").order("started_at", { ascending: false }),
      sb.from("quiz_questions_public").select("id, type, options, category"),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (attemptsResult.error) throw attemptsResult.error;

    quizState.settings = settingsResult.data || quizDefaultSettings();
    quizState.attempts = attemptsResult.data || [];
    quizState.publicQuestions = questionsResult.error ? [] : questionsResult.data || [];
    quizState.loaded = true;

    const orphan = quizState.attempts.find((a) => a.status === "active");
    if (orphan && !quizActive() && quizState.orphanHandled !== orphan.id) {
      const liveElsewhere = await quizPingForActive();
      if (liveElsewhere) {
        quizState.navLock = "other";
      } else {
        quizState.orphanHandled = orphan.id;
        const { data, error } = await sb.rpc("flag_quiz_attempt", {
          p_attempt: orphan.id,
          p_flag: "left",
          p_note: "Seite neu geladen oder geschlossen – Antworten wurden gespeichert.",
        });
        if (!error && data) {
          const idx = quizState.attempts.findIndex((a) => a.id === orphan.id);
          if (idx >= 0) quizState.attempts[idx] = data;
          showToast("Offener Versuch wurde gespeichert und zur Bewertung markiert.");
          if (currentQuizScreen() === "quiz") {
            await loadQuizData({ force: true });
            render();
            return;
          }
        }
      }
    }
  } catch (error) {
    quizState.error = "Quizdaten konnten nicht geladen werden.";
    console.error(error);
    showContact(
      "Das Quiz konnte nicht geladen werden. Prüfe deine Verbindung und wende dich bei anhaltenden Problemen an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  } finally {
    quizState.loading = false;
  }
}

function currentQuizScreen() {
  return state.screen;
}

/* --------------------------------------------------------------------------
   Hinweisbanner
   -------------------------------------------------------------------------- */
function updateQuizAlert() {
  const el = document.getElementById("app-alert");
  if (!el) return;
  const profile = state.profile || {};
  let html = "";

  if (state.session && profile.status === "approved") {
    if (quizActive()) {
      const left = Math.max(0, Math.round((new Date(quizState.active.deadline_at).getTime() - Date.now()) / 1000));
      html = `
        <div class="alert-inner alert-live">
          <span class="alert-mark">!</span>
          <div class="alert-copy">
            <strong>Quiz läuft – Regelwerk ist gesperrt.</strong>
            <span>Verbleibende Zeit: <b data-quiz-clock>${quizHeaderTime(left)}</b>. Verlässt du die Seite, wird der Versuch gespeichert und markiert.</span>
          </div>
          <button class="btn btn-primary btn-sm" type="button" data-nav="quizrun">Zum Quiz</button>
        </div>`;
    } else if (profile.quiz_required) {
      const passed = quizState.attempts.some((a) => quizPassed(a));
      if (!passed) {
        html = `
          <div class="alert-inner alert-warn">
            <span class="alert-mark">!</span>
            <div class="alert-copy">
              <strong>Quiz / Prüfung erforderlich</strong>
              <span>${profile.quiz_deadline ? `Frist: ${e(quizDeadlineText(profile.quiz_deadline))}.` : "Es wurde keine Frist gesetzt."}${profile.quiz_required_note ? ` ${e(profile.quiz_required_note)}` : ""}</span>
            </div>
            <button class="btn btn-primary btn-sm" type="button" data-nav="quiz">Zum Quiz</button>
          </div>`;
      }
    }
  }

  el.innerHTML = html;
  el.hidden = !html;
}

function syncQuizClock() {
  if (!quizActive()) return;
  const left = Math.max(
    0,
    Math.round((new Date(quizState.active.deadline_at).getTime() - Date.now()) / 1000)
  );
  document.querySelectorAll("[data-quiz-clock]").forEach((node) => {
    node.textContent = quizHeaderTime(left);
  });
  if (left <= 0 && !quizState.finishing && state.screen === "quizrun") {
    finishQuiz("deadline", "Die Zeit ist abgelaufen.");
  }
}

/* --------------------------------------------------------------------------
   Regelwerk
   -------------------------------------------------------------------------- */
function rulebookScreen() {
  if (quizActive()) {
    return `
    <section class="quiz-wrap">
      <div class="card quiz-locked">
        <span class="locked-icon">🔒</span>
        <h1>Während des Quiz gesperrt</h1>
        <p>Das Betriebsregelwerk ist während einer laufenden Prüfung nicht verfügbar. Beende zuerst das Quiz.</p>
        <button class="btn btn-primary" type="button" data-nav="quizrun">Zum Quiz</button>
      </div>
    </section>`;
  }
  return `
  <section class="rulebook-wrap">
    <header class="page-head">
      <div>
        <p class="eyebrow">DVN Betriebsregelwerk</p>
        <h1>Aktuelle Fassung</h1>
        <p class="page-lead">Immer die aktuelle Version – direkt eingebettet, ohne die Seite zu verlassen.</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary btn-sm" href="${QUIZ_DIRECT_URL}" target="_blank" rel="noopener">In neuem Tab öffnen</a>
        <button class="btn btn-ghost btn-sm" type="button" data-nav="start">Zurück zum Training</button>
      </div>
    </header>
    <div class="rulebook-frame card">
      <iframe
        src="${QUIZ_EMBED_URL}"
        title="DVN Betriebsregelwerk"
        loading="lazy"
        allowfullscreen
        referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
    <p class="rulebook-note">Die Anzeige stammt direkt aus dem freigegebenen Google-Dokument. Änderungen erscheinen automatisch in der aktuellen Fassung.</p>
  </section>`;
}

/* --------------------------------------------------------------------------
   Quiz-Übersicht
   -------------------------------------------------------------------------- */
function quizLandingScreen() {
  const profile = state.profile || {};
  const settings = quizSettings();
  const attempts = quizState.attempts;
  const graded = attempts.filter((a) => a.status === "graded");
  const best = graded.reduce((max, a) => Math.max(max, quizNum(a.percentage)), 0);
  const last = graded[0] || null;
  const passed = graded.some((a) => quizPassed(a));
  const allowed = 1 + quizNum(profile.extra_attempts);
  const used = attempts.length;
  const remaining = Math.max(0, allowed - used);
  const hasActive = attempts.some((a) => a.status === "active");
  const required = Boolean(profile.quiz_required) && !passed;
  const suggested = Math.round(quizSuggestedSeconds() / 60);

  return `
  <section class="quiz-wrap">
    <header class="page-head">
      <div>
        <p class="eyebrow">Prüfung &amp; Wissensstand</p>
        <h1>Quiz zum Betriebsregelwerk</h1>
        <p class="page-lead">
          Multiple-Choice-Fragen werden automatisch bewertet. Freitext- und Befehlserstellungs-Aufgaben
          prüft ein Admin von Hand. Deine Auswertung bleibt ${quizNum(settings.retention_weeks)} Wochen sichtbar.
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-nav="rulebook">Betriebsregelwerk</button>
      </div>
    </header>

    ${
      required
        ? `<div class="quiz-requirement">
            <span class="alert-mark">!</span>
            <div>
              <strong>Du wurdest zur Prüfung aufgefordert.</strong>
              <span>${profile.quiz_deadline ? `Frist: ${e(quizDeadlineText(profile.quiz_deadline))}.` : "Es wurde keine Frist gesetzt."}${profile.quiz_required_note ? ` ${e(profile.quiz_required_note)}` : ""}</span>
            </div>
          </div>`
        : ""
    }

    ${
      quizState.error
        ? `<div class="quiz-error card"><strong>Daten nicht verfügbar.</strong><span>${e(quizState.error)}</span>
             <button class="btn btn-secondary btn-sm" type="button" data-quiz-action="reload">Erneut laden</button></div>`
        : ""
    }

    <div class="quiz-grid">
      <article class="card quiz-start-card">
        <div class="quiz-start-top">
          <span class="quiz-badge">${attempts.length ? `${used} Versuch${used === 1 ? "" : "e"} genutzt` : "Noch kein Versuch"}</span>
          ${passed ? `<span class="status-pill ok">Bestanden</span>` : `<span class="status-pill ${required ? "bad" : "wait"}">${required ? "Erforderlich" : "Offen"}</span>`}
        </div>
        <h2>${hasActive ? "Versuch läuft" : remaining > 0 ? "Bereit für das Quiz" : "Kein Versuch mehr frei"}</h2>
        <p>
          ${
            hasActive
              ? "Ein Versuch ist noch aktiv. Öffne ihn, um fortzufahren."
              : remaining > 0
              ? `Es stehen ${remaining} von ${allowed} Versuch${allowed === 1 ? "" : "en"} zur Verfügung. Die Zeit läuft ab dem Start.`
              : "Du hast alle Versuche verbraucht. Ein Admin kann einen weiteren Versuch freigeben."
          }
        </p>
        <dl class="quiz-facts">
          <div><dt>Fragen</dt><dd>${quizState.publicQuestions.length}</dd></div>
          <div><dt>Empfehlung</dt><dd>${quizNum(settings.pass_percent)} %</dd></div>
          <div><dt>Zeit</dt><dd>${settings.total_minutes ? `${quizNum(settings.total_minutes)} Min.` : `ca. ${suggested} Min.`}</dd></div>
          <div><dt>Aufbewahrung</dt><dd>${quizNum(settings.retention_weeks)} Wochen</dd></div>
        </dl>
        <div class="quiz-start-actions">
          ${
            hasActive
              ? `<button class="btn btn-primary btn-lg" type="button" data-nav="quizrun">Laufenden Versuch öffnen</button>`
              : remaining > 0
              ? `<button class="btn btn-primary btn-lg" type="button" data-quiz-action="start" ${!settings.quiz_enabled ? "disabled" : ""}>Quiz starten</button>`
              : `<button class="btn btn-secondary btn-lg" type="button" disabled>Kein Versuch frei</button>`
          }
          ${!settings.quiz_enabled ? `<p class="quiz-hint">Das Quiz ist derzeit durch einen Admin deaktiviert.</p>` : ""}
        </div>
        <p class="quiz-hint">
          Nach dem Start nicht neu laden und nicht den Tab wechseln. Nach 20 Sekunden außerhalb erscheint eine Warnung,
          nach 35 Sekunden wird automatisch abgegeben und der Versuch als Auffälligkeit markiert.
        </p>
      </article>

      <aside class="card quiz-side-card">
        <h2>Dein Stand</h2>
        <div class="quiz-kpis">
          <div><span>Beste Wertung</span><strong>${best ? `${quizFmt(best)} %` : "—"}</strong></div>
          <div><span>Letzte Wertung</span><strong>${last ? `${quizFmt(last.percentage)} %` : "—"}</strong></div>
          <div><span>Bestanden</span><strong>${passed ? "Ja" : last && quizPassDecided(last) ? "Nein" : "Offen"}</strong></div>
        </div>
        ${last ? `<p class="quiz-hint">Bewertet von <strong>${e(last.graded_by_name || "—")}</strong> am ${e(quizFormatDate(last.graded_at))}.</p>` : ""}
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-action="reload">Aktualisieren</button>
      </aside>
    </div>

    <section class="card quiz-attempts">
      <div class="panel-head">
        <div>
          <h2>Deine Auswertungen</h2>
          <p class="panel-hint">Bewertungen bleiben ${quizNum(settings.retention_weeks)} Wochen nach der Freigabe sichtbar.</p>
        </div>
      </div>
      ${
        !attempts.length
          ? `<p class="admin-empty">Noch keine Versuche. Starte oben dein erstes Quiz.</p>`
          : `<div class="admin-table quiz-attempt-table">
              <div class="admin-table-head attempt-head">
                <span>Datum</span><span>Status</span><span>Punkte</span><span>Ergebnis</span><span>Bewertet von</span><span></span>
              </div>
              ${attempts
                .map(
                  (a) => `
                <div class="admin-table-row attempt-row">
                  <span>${e(quizFormatDate(a.started_at))}</span>
                  <span>${quizStatusPill(a.status)}${a.flag ? `<small class="flag-note">${e(QUIZ_FLAG_LABELS[a.flag] || a.flag)}</small>` : ""}</span>
                  <span>${a.status === "graded" || a.status === "submitted" ? `${quizFmt(a.total_points)} / ${quizFmt(a.max_points)}` : "—"}</span>
                  <span>${a.percentage == null ? "—" : `${quizFmt(a.percentage)} %`}${a.status === "graded" ? (quizPassDecided(a) ? (a.passed ? ` <span class="status-pill ok">bestanden</span>` : ` <span class="status-pill bad">nicht bestanden</span>`) : ` <span class="status-pill wait">Entscheidung offen</span>`) : ""}</span>
                  <span>${e(a.graded_by_name || "—")}</span>
                  <span class="admin-row-actions">
                    ${
                      a.status === "active"
                        ? `<button class="link-btn" type="button" data-nav="quizrun">Fortsetzen</button>`
                        : `<button class="link-btn" type="button" data-quiz-action="view-attempt" data-id="${e(a.id)}">Auswertung</button>`
                    }
                  </span>
                </div>`
                )
                .join("")}
            </div>`
      }
    </section>
    ${
      quizState.integrityOpen
        ? `
    <div class="quiz-gate" role="dialog" aria-modal="true">
      <div class="quiz-gate-card card">
        <h2>Hinweis vor Prüfungsbeginn</h2>
        <p>
          Der Versuch wird automatisch ausgewertet und von einem Admin geprüft. Ein Betrugsversuch,
          die Nutzung von KI, Hilfsmitteln oder das Verlassen des Prüfungsbereichs kann zur
          Annullierung des Versuchs und zu disziplinarischen Maßnahmen führen. Bitte arbeite
          ausschließlich selbstständig.
        </p>
        <label class="check">
          <input type="checkbox" data-quiz-integrity ${quizState.integrityAck ? "checked" : ""} />
          <span class="check-box" aria-hidden="true"></span>
          <span class="check-text">Ich habe den Hinweis gelesen und arbeite selbstständig.</span>
        </label>
        <div class="quiz-start-actions">
          <button class="btn btn-primary" type="button" data-quiz-action="start-confirm" ${quizState.integrityAck ? "" : "disabled"}>Prüfung starten</button>
          <button class="btn btn-ghost" type="button" data-quiz-action="start-cancel">Abbrechen</button>
        </div>
      </div>
    </div>`
        : ""
    }
  </section>`;
}

/* --------------------------------------------------------------------------
   Quiz-Durchführung
   -------------------------------------------------------------------------- */
function quizAnswerValue(question) {
  return quizState.answers[question.id];
}

function quizOptionIds(question) {
  return Array.isArray(question.options) ? question.options.map((o) => o.id) : [];
}

function quizQuestionBody(question) {
  const value = quizAnswerValue(question);
  const type = question.type;

  if (type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return `
      <div class="quiz-options">
        ${(question.options || [])
          .map(
            (option) => `
          <label class="quiz-option ${selected.includes(option.id) ? "selected" : ""}">
            <input type="checkbox" data-quiz-option="${e(option.id)}" ${selected.includes(option.id) ? "checked" : ""} />
            <span class="quiz-option-box" aria-hidden="true"></span>
            <span class="quiz-option-label">${e(option.label)}</span>
          </label>`
          )
          .join("")}
      </div>
      <p class="quiz-hint">Mehrere Antworten können richtig sein. Es zählt nur die vollständig richtige Auswahl.</p>`;
  }

  if (type === "short" || type === "long") {
    return `
      <label class="quiz-text">
        <span class="field-label">${type === "short" ? "Deine Antwort (kurz)" : "Deine Antwort"}</span>
        <textarea data-quiz-text rows="${type === "short" ? 3 : 8}" maxlength="${type === "short" ? 600 : 4000}"
          placeholder="Antwort hier eingeben …">${e(typeof value === "string" ? value : "")}</textarea>
      </label>`;
  }

  if (type === "command") {
    const draft = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const selected = draft.command || "";
    const command = selected ? getCommand(selected) : null;
    const scenario = question.scenario || {};
    const orderScenario = { ...scenario, command: question.command_nr || scenario.command };
    const order = typeof buildOrderData === "function" ? buildOrderData(orderScenario) : null;
    return `
      <div class="quiz-scenario">
        ${scenario.title ? `<h3>${e(scenario.title)}</h3>` : ""}
        ${scenario.subtitle ? `<p class="quiz-scenario-sub">${e(scenario.subtitle)}</p>` : ""}
        <div class="facts">
          ${scenario.train ? `<span class="fact"><span class="fact-label">Zug</span>${e(scenario.train)}</span>` : ""}
          ${scenario.subtitle ? `<span class="fact"><span class="fact-label">Ort</span>${e(scenario.subtitle)}</span>` : ""}
          ${scenario.time ? `<span class="fact"><span class="fact-label">Zeit</span>${e(scenario.time)}</span>` : ""}
        </div>
        ${scenario.situation ? `<p class="situation-text">${e(scenario.situation)}</p>` : ""}
        ${scenario.task ? `<div class="task-box"><span class="task-label">Auftrag</span><p>${e(scenario.task)}</p></div>` : ""}
        ${Array.isArray(scenario.facts) && scenario.facts.length ? `<div class="fact-chips">${scenario.facts.map((f) => `<span class="mini-chip">${e(f)}</span>`).join("")}</div>` : ""}
        ${typeof radioTranscript === "function" ? radioTranscript(orderScenario) : ""}
      </div>

      <div class="quiz-command-picker">
        <p class="field-label">Befehl wählen</p>
        <div class="command-grid quiz-command-grid">
          ${COMMANDS.map(
            (cmd) => `
            <button type="button" class="command-item ${selected === cmd.nr ? "selected" : ""}"
              data-quiz-command="${e(cmd.nr)}" aria-pressed="${selected === cmd.nr}">
              <span class="cmd-nr">${e(cmd.nr)}</span>
              <span class="cmd-title">${e(cmd.title)}</span>
              <span class="cmd-check" aria-hidden="true">✓</span>
            </button>`
          ).join("")}
        </div>
      </div>

      ${
        command
          ? `<div class="quiz-command-form">
              <div class="form-grid ${command.fields.length === 1 ? "single" : ""}">
                ${command.fields
                  .map(
                    (field) => `
                  <label class="field">
                    <span class="field-label">${e(field.label)}</span>
                    <span class="select-wrap">
                      <select data-quiz-field="${e(field.id)}">
                        <option value="" ${!draft.fields?.[field.id] ? "selected" : ""} disabled>${e(field.placeholder || "Auswählen")}</option>
                        ${(field.options || [])
                          .map(
                            (option) =>
                              `<option value="${e(option)}" ${draft.fields?.[field.id] === option ? "selected" : ""}>${e(option)}</option>`
                          )
                          .join("")}
                      </select>
                    </span>
                  </label>`
                  )
                  .join("")}
              </div>
              ${
                command.measures.length
                  ? `<fieldset class="measures">
                      <legend>Zusatzmaßnahmen</legend>
                      <p class="measures-hint">Nur ankreuzen, was der Auftrag tatsächlich verlangt.</p>
                      ${command.measures
                        .map(
                          (m) => `
                        <label class="check">
                          <input type="checkbox" data-quiz-measure="${e(m.id)}" ${draft.measures?.[m.id] ? "checked" : ""} />
                          <span class="check-box" aria-hidden="true"></span>
                          <span class="check-text">${e(m.label)}</span>
                        </label>`
                        )
                        .join("")}
                    </fieldset>`
                  : ""
              }
              <div class="quiz-order-header">
                <p class="field-label">Kopfzeile des Vordrucks</p>
                <p class="quiz-hint">Alle Angaben stehen in der GSM-R-Anweisung des Fahrdienstleiters.</p>
                <div class="quiz-header-grid">
                  ${ORDER_HEADER_FIELDS.map(
                    (field) => `
                    <label class="field">
                      <span class="field-label">${e(field.id)} – ${e(field.label)}</span>
                      <input class="quiz-header-input" data-quiz-header="${e(field.id)}"
                        value="${e(draft.header?.[field.id] || "")}" placeholder="${e(field.placeholder)}" autocomplete="off" />
                    </label>`
                  ).join("")}
                </div>
              </div>
            </div>`
          : `<p class="quiz-hint">Wähle zuerst den Befehl aus. Danach erscheinen die Felder des Vordrucks.</p>`
      }`;
  }

  return `<p class="quiz-hint">Unbekannter Fragetyp.</p>`;
}

function quizRunScreen() {
  const attempt = quizState.active;
  if (!attempt || attempt.status !== "active") {
    return `
    <section class="quiz-wrap">
      <div class="card quiz-locked">
        <span class="locked-icon">…</span>
        <h1>Kein laufender Versuch</h1>
        <p>Starte das Quiz über die Quiz-Übersicht.</p>
        <button class="btn btn-primary" type="button" data-nav="quiz">Zur Quiz-Übersicht</button>
      </div>
    </section>`;
  }

  const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
  const index = Math.min(quizState.index, questions.length - 1);
  const question = questions[index];
  if (!question) {
    return `<section class="quiz-wrap"><div class="card quiz-locked"><h1>Keine Fragen</h1></div></section>`;
  }

  const answered = questions.filter((q) => {
    const value = quizState.answers[q.id];
    if (q.type === "multiple_choice") return Array.isArray(value) && value.length > 0;
    if (q.type === "command") return Boolean(value && value.command);
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  return `
  <section class="quiz-run">
    <header class="quiz-topbar card">
      <div class="quiz-topbar-main">
        <span class="quiz-badge">Frage ${index + 1} / ${questions.length}</span>
        <span class="quiz-cat">${e(QUIZ_CATEGORY_LABELS[question.category] || question.category)}</span>
        <span class="quiz-type">${e(QUIZ_TYPE_LABELS[question.type] || question.type)} · ${quizFmt(question.points)} P</span>
      </div>
      <div class="quiz-topbar-side">
        <div class="quiz-timer" id="quiz-timer" aria-live="off">
          <span>Restzeit</span>
          <strong data-quiz-clock>--:--</strong>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-action="leave">Abgeben &amp; beenden</button>
      </div>
      <div class="quiz-progress-track"><span style="width:${(answered / questions.length) * 100}%"></span></div>
    </header>

    <div class="quiz-run-grid">
      <article class="card quiz-question-card" id="quiz-question">
        <header class="quiz-question-head">
          <p class="eyebrow">${e(QUIZ_CATEGORY_LABELS[question.category] || "Frage")}</p>
          <h2>${e(question.prompt)}</h2>
          ${question.help ? `<p class="quiz-help">${e(question.help)}</p>` : ""}
        </header>
        ${quizQuestionBody(question)}
      </article>

      <aside class="card quiz-nav-card">
        <h3>Übersicht</h3>
        <div class="quiz-dots">
          ${questions
            .map((q, i) => {
              const done = (() => {
                const value = quizState.answers[q.id];
                if (q.type === "multiple_choice") return Array.isArray(value) && value.length > 0;
                if (q.type === "command") return Boolean(value && value.command);
                return typeof value === "string" && value.trim().length > 0;
              })();
              return `<button type="button" class="quiz-dot ${i === index ? "current" : ""} ${done ? "done" : ""}"
                data-quiz-action="goto" data-index="${i}" title="Frage ${i + 1}">${i + 1}</button>`;
            })
            .join("")}
        </div>
        <p class="quiz-hint">${answered} von ${questions.length} beantwortet. Antworten werden automatisch gespeichert.</p>
        <button class="btn btn-dark btn-sm btn-block" type="button" data-quiz-action="submit">Quiz abgeben</button>
        <p class="quiz-hint">Beim Verlassen wird dein Versuch gespeichert und für die Bewertung markiert.</p>
      </aside>
    </div>

    <footer class="quiz-run-actions">
      <button class="btn btn-secondary" type="button" data-quiz-action="prev" ${index === 0 ? "disabled" : ""}>← Zurück</button>
      <span class="quiz-save-state" id="quiz-save-state">Automatisch gespeichert</span>
      <button class="btn btn-primary" type="button" data-quiz-action="next" ${index >= questions.length - 1 ? "disabled" : ""}>Weiter →</button>
    </footer>
  </section>`;
}

function quizCurrentQuestion() {
  const questions = quizState.active?.questions || [];
  return questions[Math.min(quizState.index, questions.length - 1)] || null;
}

function quizHydrateAnswers(attempt) {
  quizState.answers = {};
  const stored = attempt?.answers && typeof attempt.answers === "object" ? attempt.answers : {};
  Object.entries(stored).forEach(([qid, entry]) => {
    if (entry && typeof entry === "object" && "value" in entry) {
      quizState.answers[qid] = entry.value;
    }
  });
}

function quizMarkDirty(questionId) {
  if (!questionId) return;
  quizState.dirty[questionId] = true;
  const stateEl = document.getElementById("quiz-save-state");
  if (stateEl) stateEl.textContent = "Speichert …";
  window.clearTimeout(quizMarkDirty.timer);
  quizMarkDirty.timer = window.setTimeout(() => {
    quizFlushDirty();
  }, 700);
}

async function quizSaveQuestion(questionId) {
  if (!quizActive()) return true;
  const value = quizState.answers[questionId];
  if (value === undefined) return true;
  const { error } = await sb.rpc("save_quiz_answer", {
    p_attempt: quizState.active.id,
    p_question: questionId,
    p_value: value,
  });
  if (error) {
    console.error(error);
    showContact(
      "Deine Antwort konnte nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
    return false;
  }
  delete quizState.dirty[questionId];
  const stateEl = document.getElementById("quiz-save-state");
  if (stateEl) stateEl.textContent = "Automatisch gespeichert";
  return true;
}

async function quizFlushDirty() {
  if (!quizActive()) return;
  const ids = Object.keys(quizState.dirty);
  for (const id of ids) {
    await quizSaveQuestion(id);
  }
}

async function quizUpdateAnswer(questionId, value) {
  quizState.answers[questionId] = value;
  quizMarkDirty(questionId);
}

function quizStartTimer() {
  window.clearInterval(quizState.timer);
  quizState.timer = window.setInterval(() => {
    if (!quizActive()) return;
    syncQuizClock();
    const timerEl = document.querySelector("#quiz-timer strong");
    if (timerEl) {
      const left = Math.max(
        0,
        Math.round((new Date(quizState.active.deadline_at).getTime() - Date.now()) / 1000)
      );
      timerEl.textContent = quizHeaderTime(left);
      timerEl.classList.toggle("urgent", left <= 300);
    }
  }, 1000);
}

function quizSetTitle() {
  document.title = "Seite derzeit nicht verfügbar – Befehlstrainer";
}

function quizRestoreTitle() {
  document.title = "Befehlstrainer – Digitaler Befehl üben";
}

function quizChannelPost(type) {
  try {
    quizState.channel?.postMessage({ type, tab: quizState.tabId, at: Date.now() });
  } catch {
    /* BroadcastChannel nicht verfügbar */
  }
}

function quizStartGuard() {
  quizRestoreTitle();
  quizSetTitle();
  window.clearInterval(quizState.awayTimer);
  quizState.awaySince = null;
  quizState.warningVisible = false;
  quizState.warnings = 0;
  quizChannelPost("quiz-active");
  quizStartTimer();
}

function quizStopGuard() {
  window.clearInterval(quizState.timer);
  window.clearInterval(quizState.awayTimer);
  quizState.timer = null;
  quizState.awayTimer = null;
  quizState.awaySince = null;
  quizState.warningVisible = false;
  quizRestoreTitle();
  quizHideWarning();
  quizChannelPost("quiz-done");
}

function quizShowWarning(text) {
  const box = document.getElementById("quiz-warning");
  const message = document.getElementById("quiz-warning-text");
  if (message && text) message.textContent = text;
  if (!box) return;
  box.hidden = false;
  quizState.warningVisible = true;
}

function quizHideWarning() {
  const box = document.getElementById("quiz-warning");
  if (box) box.hidden = true;
  quizState.warningVisible = false;
}

function quizMarkAway() {
  if (!quizActive() || quizState.finishing || state.screen !== "quizrun") return;
  if (quizState.awaySince) return;
  quizState.awaySince = Date.now();
  window.clearInterval(quizState.awayTimer);
  quizState.awayTimer = window.setInterval(() => {
    if (!quizState.awaySince || !quizActive()) return;
    const seconds = Math.round((Date.now() - quizState.awaySince) / 1000);
    if (seconds >= 35) {
      quizAutoCheat(seconds);
    } else if (seconds >= 20) {
      quizShowWarning(
        `Du bist seit ${seconds} Sekunden nicht im Quiz. Bei 35 Sekunden wird automatisch abgegeben und der Versuch als Auffälligkeit markiert.`
      );
    }
  }, 1000);
}

function quizMarkBack() {
  if (!quizState.awaySince) return;
  const seconds = Math.round((Date.now() - quizState.awaySince) / 1000);
  quizState.awaySince = null;
  window.clearInterval(quizState.awayTimer);
  quizState.awayTimer = null;
  if (!quizActive() || quizState.finishing) return;
  if (seconds >= 35) {
    quizAutoCheat(seconds);
  } else if (seconds >= 20) {
    quizState.warnings += 1;
    quizShowWarning(
      `Du warst ${seconds} Sekunden außerhalb des Quiz. Das wurde vermerkt. Beim nächsten Verlassen wird nach 35 Sekunden automatisch abgegeben.`
    );
  }
}

async function quizAutoCheat(seconds) {
  if (quizState.finishing) return;
  await finishQuiz(
    "cheat",
    `Tab oder Browser für ${seconds} Sekunden verlassen. Automatische Abgabe nach 35 Sekunden.`
  );
}

async function startQuiz() {
  if (!sb || !isApproved()) return;
  const settings = quizSettings();
  if (!settings.quiz_enabled) {
    showToast("Das Quiz ist derzeit deaktiviert.");
    return;
  }
  try {
    const { data, error } = await sb.rpc("start_quiz_attempt", { p_integrity_ack: true });
    if (error) throw error;
    const attempt = data?.attempt;
    if (!attempt) throw new Error("Kein Versuch erhalten.");
    quizState.active = attempt;
    quizState.orphanHandled = attempt.id;
    quizState.leavingSent = false;
    quizState.dirty = {};
    quizHydrateAnswers(attempt);
    quizState.index = 0;
    state.screen = "quizrun";
    quizStartGuard();
    render();
  } catch (error) {
    console.error(error);
    const msg = String(error?.message || error);
    if (/kein quiz-versuch/i.test(msg)) {
      showToast(msg);
      return;
    }
    if (/nicht verfügbar|keine quizfragen/i.test(msg)) {
      showToast(msg);
      return;
    }
    quizFail(error, "Das Quiz konnte nicht gestartet werden.");
  }
}

async function finishQuiz(flag = null, note = null) {
  if (!quizActive() || quizState.finishing) return;
  quizState.finishing = true;
  window.clearInterval(quizState.awayTimer);
  quizState.awayTimer = null;
  try {
    await quizFlushDirty();
    const summary =
      quizState.warnings > 0
        ? [note, `${quizState.warnings} Warnung(en) wegen Tabwechsel.`].filter(Boolean).join(" ")
        : note;
    const { data, error } = await sb.rpc("submit_quiz_attempt", {
      p_attempt: quizState.active.id,
      p_flag: flag,
      p_note: summary,
    });
    if (error) throw error;
    quizState.viewAttempt = data || null;
    quizState.active = null;
    quizState.answers = {};
    quizState.dirty = {};
    quizState.orphanHandled = null;
    quizState.leavingSent = false;
    quizStopGuard();
    state.screen = "quizresult";
    quizState.loaded = false;
    render();
    loadQuizData({ force: true }).then(() => {
      if (typeof updateQuizAlert === "function") updateQuizAlert();
      if (state.screen === "quiz" || state.screen === "quizresult") render();
    });
    showToast(flag ? "Versuch gespeichert und zur Bewertung markiert." : "Quiz abgegeben.");
  } catch (error) {
    quizState.finishing = false;
    quizFail(error, "Das Quiz konnte nicht abgegeben werden. Deine Antworten bleiben gespeichert.");
  }
}

function quizLeave() {
  if (!quizActive()) return;
  const ok = window.confirm(
    "Quiz wirklich abgeben? Dein Versuch wird gespeichert und für die Bewertung markiert."
  );
  if (ok) finishQuiz("left", "Quiz vorzeitig beendet.");
}

/* --------------------------------------------------------------------------
   Auswertung eines Versuchs
   -------------------------------------------------------------------------- */
function quizAttemptById(id) {
  return (
    quizState.attempts.find((a) => a.id === id) ||
    (quizState.viewAttempt && quizState.viewAttempt.id === id ? quizState.viewAttempt : null)
  );
}

function quizAnswerLines(item) {
  const value = item.value;
  if (item.type === "multiple_choice") {
    const chosen = Array.isArray(value) ? value : [];
    const options = Array.isArray(item.options) ? item.options : [];
    const correct = Array.isArray(item.correct_ids) ? item.correct_ids : [];
    return `
      <ul class="quiz-review-options">
        ${options
          .map((option) => {
            const picked = chosen.includes(option.id);
            const isCorrect = correct.includes(option.id);
            const cls = isCorrect ? "correct" : picked ? "wrong" : "";
            return `<li class="${cls}">
              <span class="opt-mark">${isCorrect ? "✓" : picked ? "✕" : "·"}</span>
              <span>${e(option.label)}</span>
              ${picked ? `<span class="opt-tag">deine Wahl</span>` : ""}
            </li>`;
          })
          .join("")}
      </ul>`;
  }

  if (item.type === "short" || item.type === "long") {
    const text = typeof value === "string" ? value.trim() : "";
    return `
      <div class="quiz-review-text">
        <span class="field-label">Deine Antwort</span>
        <p>${text ? e(text) : "<em>Keine Antwort abgegeben.</em>"}</p>
      </div>`;
  }

  if (item.type === "command") {
    const answer = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const command = answer.command ? getCommand(answer.command) : null;
    return `
      <div class="quiz-review-command">
        <div class="review-line"><span>Gewählter Befehl</span><strong>${command ? `${e(command.nr)} – ${e(command.title)}` : "—"}</strong></div>
        ${
          command
            ? command.fields
                .map(
                  (field) => `
                <div class="review-line"><span>${e(field.label)}</span><strong>${e(answer.fields?.[field.id] || "—")}</strong></div>`
                )
                .join("")
            : ""
        }
        ${
          command && answer.measures
            ? command.measures
                .map(
                  (m) => `
                <div class="review-line"><span>${e(m.label)}</span><strong>${answer.measures?.[m.id] ? "angekreuzt" : "—"}</strong></div>`
                )
                .join("")
            : ""
        }
        ${ORDER_HEADER_FIELDS.map(
          (field) => `
        <div class="review-line"><span>${e(field.id)} ${e(field.label)}</span><strong>${e(answer.header?.[field.id] || "—")}</strong></div>`
        ).join("")}
      </div>`;
  }

  return "";
}

function quizReviewItem(item, graded) {
  const earned =
    item.type === "command"
      ? quizNum(item.auto_points) + quizNum(item.manual_points)
      : item.auto_points != null
      ? quizNum(item.auto_points)
      : item.manual_points != null
      ? quizNum(item.manual_points)
      : null;
  const points = graded || item.type === "command" ? earned : null;
  const max = quizNum(item.points);
  const pending = points == null;
  return `
  <article class="quiz-review-item ${pending ? "pending" : points >= max ? "full" : "partial"}">
    <header class="quiz-review-head">
      <div>
        <span class="quiz-type">${e(QUIZ_TYPE_LABELS[item.type] || item.type)}</span>
        <h3>${e(item.prompt)}</h3>
      </div>
      <span class="quiz-review-points">${pending ? "offen" : `${quizFmt(points)} / ${quizFmt(max)} P`}</span>
    </header>
    ${quizAnswerLines(item)}
    ${
      graded && item.reference_answer
        ? `<div class="quiz-reference"><span class="field-label">Musterlösung / Bewertungshinweis</span><p>${e(item.reference_answer)}</p></div>`
        : ""
    }
  </article>`;
}

function quizResultScreen() {
  const attempt = quizState.viewAttempt || quizState.attempts[0];
  if (!attempt) {
    return `
    <section class="quiz-wrap"><div class="card quiz-locked">
      <span class="locked-icon">?</span><h1>Keine Auswertung gefunden</h1>
      <button class="btn btn-primary" type="button" data-nav="quiz">Zur Quiz-Übersicht</button>
    </div></section>`;
  }

  const graded = attempt.status === "graded";
  const review = Array.isArray(attempt.review) ? attempt.review : [];
  const decided = quizPassDecided(attempt);
  const passed = quizPassed(attempt);
  const recommendation = quizPassRecommendation(attempt);
  const threshold = quizNum(quizState.settings?.pass_percent ?? 60);
  const profile = state.profile || {};
  const remaining = Math.max(0, 1 + quizNum(profile.extra_attempts) - quizState.attempts.length);

  return `
  <section class="quiz-wrap">
    <header class="page-head">
      <div>
        <p class="eyebrow">Auswertung · ${e(quizFormatDate(attempt.started_at))}</p>
        <h1>${graded ? (decided ? (passed ? "Bestanden" : "Nicht bestanden") : "Ergebnis – Entscheidung offen") : "Abgegeben – Bewertung offen"}</h1>
        <p class="page-lead">${quizStatusPill(attempt.status)} ${attempt.flag ? `<span class="status-pill bad">${e(QUIZ_FLAG_LABELS[attempt.flag] || attempt.flag)}</span>` : ""}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" type="button" data-nav="quiz">Zur Quiz-Übersicht</button>
      </div>
    </header>

    ${
      attempt.flag
        ? `<div class="quiz-requirement">
            <span class="alert-mark">!</span>
            <div>
              <strong>Der Versuch wurde markiert.</strong>
              <span>${e(QUIZ_FLAG_LABELS[attempt.flag] || attempt.flag)}${attempt.flag_note ? ` – ${e(attempt.flag_note)}` : ""}</span>
            </div>
          </div>`
        : ""
    }

    <div class="quiz-result-grid">
      <article class="card quiz-scorecard">
        ${scoreRing(quizNum(attempt.percentage), 100)}
        <div class="quiz-score-meta">
          <div><span>Punkte</span><strong>${quizFmt(attempt.total_points)} / ${quizFmt(attempt.max_points)}</strong></div>
          <div><span>Ergebnis</span><strong>${attempt.percentage == null ? "—" : `${quizFmt(attempt.percentage)} %`}</strong></div>
          <div><span>Empfehlung</span><strong>${threshold} % · ${recommendation ? "erreicht" : "nicht erreicht"}</strong></div>
          <div><span>Entscheidung</span><strong>${decided ? (passed ? "Bestanden" : "Nicht bestanden") : graded ? "offen (Admin)" : "—"}</strong></div>
          <div><span>Bewertet von</span><strong>${e(attempt.graded_by_name || (graded ? "—" : "wartet auf Admin"))}</strong></div>
          <div><span>Bewertet am</span><strong>${e(quizFormatDate(attempt.graded_at))}</strong></div>
        </div>
      </article>

      <aside class="card quiz-side-card">
        <h2>Hinweise</h2>
        ${
          graded
            ? `<p class="quiz-hint">Diese Auswertung bleibt bis <strong>${e(quizFormatDate(attempt.retention_until))}</strong> sichtbar und wird danach datensparsam gelöscht.</p>
               ${attempt.grading_note ? `<div class="quiz-grading-note"><span>Anmerkung der Bewertung</span><p>${e(attempt.grading_note)}</p></div>` : ""}`
            : `<p class="quiz-hint">Die Multiple-Choice-Fragen sind bereits automatisch bewertet. Freitext- und Befehlserstellungs-Aufgaben prüft ein Admin. Du wirst hier benachrichtigt, sobald die Bewertung vorliegt.</p>`
        }
        <div class="quiz-result-actions">
          ${
            remaining > 0 && !quizActive()
              ? `<button class="btn btn-primary btn-sm" type="button" data-quiz-action="start">Neuen Versuch starten</button>`
              : ""
          }
          <button class="btn btn-ghost btn-sm" type="button" data-quiz-action="reload">Aktualisieren</button>
        </div>
      </aside>
    </div>

    <section class="card quiz-review">
      <div class="panel-head">
        <div>
          <h2>Einzelauswertung</h2>
          <p class="panel-hint">${review.length} Fragen · ${graded ? "vollständig bewertet" : "Multiple Choice automatisch, Rest durch Admin"}</p>
        </div>
      </div>
      ${
        review.length
          ? review.map((item) => quizReviewItem(item, graded)).join("")
          : `<p class="admin-empty">Die Einzelauswertung wird nach der Abgabe erstellt.</p>`
      }
    </section>
  </section>`;
}

function quizScreen() {
  if (state.screen === "rulebook") return rulebookScreen();
  if (state.screen === "quizrun") return quizRunScreen();
  if (state.screen === "quizresult") return quizResultScreen();
  return quizLandingScreen();
}

/* --------------------------------------------------------------------------
   Sperre zwischen Tabs und Verlassen der Seite
   -------------------------------------------------------------------------- */
let quizPingResolver = null;

function quizPingForActive() {
  if (!quizState.channel) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    quizPingResolver = () => {
      done = true;
      resolve(true);
    };
    quizState.channel.postMessage({ type: "quiz-ping", tab: quizState.tabId });
    window.setTimeout(() => {
      if (!done) {
        quizPingResolver = null;
        resolve(false);
      }
    }, 350);
  });
}

function quizSetupChannel() {
  if (!("BroadcastChannel" in window)) return;
  try {
    quizState.channel = new BroadcastChannel("befehlstrainer-quiz");
  } catch {
    return;
  }
  quizState.channel.onmessage = (event) => {
    const msg = event.data || {};
    if (!msg || msg.tab === quizState.tabId) return;
    if (msg.type === "quiz-ping" && quizActive()) {
      quizChannelPost("quiz-active");
      return;
    }
    if (msg.type === "quiz-active") {
      if (quizPingResolver) {
        const resolver = quizPingResolver;
        quizPingResolver = null;
        resolver();
        return;
      }
      if (!quizActive()) {
        quizState.navLock = msg.tab;
        if (["quiz", "quizrun", "rulebook"].includes(state.screen)) {
          showToast("Das Quiz läuft bereits in einem anderen Tab.");
          state.screen = "start";
          render();
        }
      }
      return;
    }
    if (msg.type === "quiz-done") {
      quizState.navLock = null;
      if (state.screen === "quiz") {
        quizState.loaded = false;
        loadQuizData({ force: true }).then(() => render());
      }
    }
  };
}

function quizKeepaliveFlag() {
  if (!quizActive() || quizState.finishing || quizState.leavingSent) return;
  const token = state.session?.access_token;
  if (!token) return;
  quizState.leavingSent = true;
  try {
    fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/flag_quiz_attempt`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: CONFIG.supabaseKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_attempt: quizState.active.id,
        p_flag: "left",
        p_note: "Seite verlassen oder geschlossen – Antworten wurden gespeichert.",
      }),
    });
  } catch {
    /* Beim Verlassen nicht mehr möglich */
  }
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */
function quizNavigate(target) {
  if (target === "quizrun" && !quizActive()) {
    if (quizState.navLock) {
      showToast("Der laufende Versuch gehört zu einem anderen Tab.");
      return;
    }
    showToast("Es läuft gerade kein Quiz-Versuch.");
    return;
  }
  if (quizActive() && target !== "quizrun") {
    showToast("Beende zuerst das laufende Quiz. Ein Wechsel würde den Versuch markieren.");
    return;
  }
  if (target === "rulebook") {
    state.screen = "rulebook";
    render();
    return;
  }
  if (target === "quiz") {
    state.screen = "quiz";
    render();
    if (!quizState.loaded) {
      loadQuizData({ force: true }).then(() => {
        if (state.screen === "quiz") render();
      });
    }
    return;
  }
  if (target === "quizrun") {
    state.screen = "quizrun";
    render();
    return;
  }
  if (target === "start") {
    state.screen = "start";
    render();
  }
}

/* --------------------------------------------------------------------------
   Ereignisse
   -------------------------------------------------------------------------- */
function quizBindEvents() {
  if (quizState.listenersReady) return;
  quizState.listenersReady = true;

  app.addEventListener("click", (event) => {
    const commandButton = event.target.closest("[data-quiz-command]");
    if (commandButton) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const nr = commandButton.dataset.quizCommand;
      const current = quizState.answers[question.id];
      const draft = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      if (draft.command !== nr) {
        quizState.answers[question.id] = {
          command: nr,
          fields: {},
          measures: {},
          header: draft.header || {},
        };
        quizMarkDirty(question.id);
      }
      render({ preserveScroll: true });
      return;
    }

    const actionEl = event.target.closest("[data-quiz-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.quizAction;

    if (action === "start") {
      quizState.integrityOpen = true;
      quizState.integrityAck = false;
      render();
      return;
    }
    if (action === "start-confirm") {
      if (!quizState.integrityAck) {
        showToast("Bitte bestätige den Hinweis.");
        return;
      }
      quizState.integrityOpen = false;
      startQuiz();
      return;
    }
    if (action === "start-cancel") {
      quizState.integrityOpen = false;
      quizState.integrityAck = false;
      render();
      return;
    }
    if (action === "reload") {
      quizState.loaded = false;
      loadQuizData({ force: true }).then(() => render());
      return;
    }
    if (action === "view-attempt") {
      const attempt = quizAttemptById(actionEl.dataset.id);
      if (!attempt) {
        showToast("Auswertung nicht gefunden.");
        return;
      }
      quizState.viewAttempt = attempt;
      state.screen = "quizresult";
      render();
      return;
    }
    if (action === "prev") {
      quizFlushDirty();
      quizState.index = Math.max(0, quizState.index - 1);
      render();
      return;
    }
    if (action === "next") {
      quizFlushDirty();
      const questions = quizState.active?.questions || [];
      quizState.index = Math.min(questions.length - 1, quizState.index + 1);
      render();
      return;
    }
    if (action === "goto") {
      quizFlushDirty();
      quizState.index = Math.max(0, Math.min(Number(actionEl.dataset.index) || 0, (quizState.active?.questions || []).length - 1));
      render();
      return;
    }
    if (action === "submit") {
      if (window.confirm("Quiz jetzt abgeben? Danach kann der Versuch nicht mehr geändert werden.")) {
        finishQuiz(null, null);
      }
      return;
    }
    if (action === "leave") {
      quizLeave();
      return;
    }
    if (action === "dismiss-warning") {
      quizHideWarning();
      return;
    }
    if (action === "copy-otp") {
      const text = document.getElementById("otp-text")?.textContent || "";
      navigator.clipboard
        ?.writeText(text)
        .then(() => showToast("Zugangsdaten kopiert."))
        .catch(() => showToast("Kopieren nicht möglich – bitte markieren und kopieren."));
      return;
    }
    if (action === "close-otp") {
      quizState.admin.otp = null;
      render();
      return;
    }
  });

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      quizNavigate(nav.dataset.nav);
      return;
    }
    const dismiss = event.target.closest('[data-quiz-action="dismiss-warning"]');
    if (dismiss) quizHideWarning();
  });

  app.addEventListener("change", (event) => {
    const integrity = event.target.closest("[data-quiz-integrity]");
    if (integrity) {
      quizState.integrityAck = Boolean(integrity.checked);
      const button = document.querySelector('[data-quiz-action="start-confirm"]');
      if (button) button.disabled = !quizState.integrityAck;
      return;
    }

    const option = event.target.closest("[data-quiz-option]");
    if (option) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const chosen = Array.from(document.querySelectorAll("[data-quiz-option]:checked")).map(
        (input) => input.dataset.quizOption
      );
      quizState.answers[question.id] = chosen;
      option.closest(".quiz-option")?.classList.toggle("selected", option.checked);
      quizMarkDirty(question.id);
      return;
    }

    const field = event.target.closest("[data-quiz-field]");
    if (field) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const current = quizState.answers[question.id];
      const draft = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      draft.fields = { ...(draft.fields || {}), [field.dataset.quizField]: field.value };
      quizState.answers[question.id] = draft;
      quizMarkDirty(question.id);
      return;
    }

    const measure = event.target.closest("[data-quiz-measure]");
    if (measure) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const current = quizState.answers[question.id];
      const draft = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      draft.measures = { ...(draft.measures || {}), [measure.dataset.quizMeasure]: measure.checked };
      quizState.answers[question.id] = draft;
      quizMarkDirty(question.id);
      return;
    }

    const headerInput = event.target.closest("[data-quiz-header]");
    if (headerInput) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const current = quizState.answers[question.id];
      const draft = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      draft.header = { ...(draft.header || {}), [headerInput.dataset.quizHeader]: headerInput.value };
      quizState.answers[question.id] = draft;
      quizMarkDirty(question.id);
      return;
    }
  });

  app.addEventListener("input", (event) => {
    const headerInput = event.target.closest("[data-quiz-header]");
    if (headerInput) {
      const question = quizCurrentQuestion();
      if (!question) return;
      const current = quizState.answers[question.id];
      const draft = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      draft.header = { ...(draft.header || {}), [headerInput.dataset.quizHeader]: headerInput.value };
      quizState.answers[question.id] = draft;
      quizMarkDirty(question.id);
      return;
    }
    const text = event.target.closest("[data-quiz-text]");
    if (!text) return;
    const question = quizCurrentQuestion();
    if (!question) return;
    quizState.answers[question.id] = text.value;
    quizMarkDirty(question.id);
  });

  app.addEventListener("submit", async (event) => {
    if (event.target.matches("[data-password-form]")) {
      event.preventDefault();
      await quizChangePassword(event.target);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) quizMarkAway();
    else quizMarkBack();
  });

  window.addEventListener("blur", () => {
    if (state.screen === "quizrun") quizMarkAway();
  });

  window.addEventListener("focus", () => {
    if (state.screen === "quizrun") quizMarkBack();
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && state.screen === "quizrun") quizMarkAway();
  });

  window.addEventListener("beforeunload", (event) => {
    if (quizActive()) {
      event.preventDefault();
      event.returnValue = "";
      return "";
    }
    return undefined;
  });

  window.addEventListener("pagehide", () => {
    if (!quizActive()) return;
    quizKeepaliveFlag();
    quizState.active = null;
    quizStopGuard();
  });
}

/* --------------------------------------------------------------------------
   Konto: Passwortwechsel und deaktiviertes Konto
   -------------------------------------------------------------------------- */
function accountPasswordScreen() {
  return `
  <section class="status-screen">
    <div class="status-card card">
      <span class="status-icon pending">🔑</span>
      <p class="eyebrow">Konto</p>
      <h1>Neues Passwort setzen</h1>
      <p class="status-lead">
        Du hast ein Einmalpasswort erhalten. Bitte setze jetzt ein eigenes Passwort mit mindestens 6 Zeichen.
      </p>
      <form data-password-form novalidate>
        <label class="field">
          <span class="field-label">Neues Passwort</span>
          <input name="password" type="password" autocomplete="new-password" minlength="6" required />
        </label>
        <label class="field">
          <span class="field-label">Passwort wiederholen</span>
          <input name="password2" type="password" autocomplete="new-password" minlength="6" required />
        </label>
        ${quizState.passwordError ? `<p class="form-error">${e(quizState.passwordError)}</p>` : ""}
        <div class="status-actions">
          <button class="btn btn-primary" type="submit">Passwort speichern</button>
          <button class="btn btn-ghost" type="button" data-action="logout">Abmelden</button>
        </div>
      </form>
      <p class="status-hint">Falls das nicht funktioniert, wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich.</p>
    </div>
  </section>`;
}

function accountDisabledScreen() {
  const profile = state.profile || {};
  return `
  <section class="status-screen">
    <div class="status-card card">
      <span class="status-icon rejected">!</span>
      <p class="eyebrow">Konto deaktiviert</p>
      <h1>Kein Zugriff</h1>
      <p class="status-lead">
        Das Konto <strong>${e(profile.discord_username || "")}</strong> wurde deaktiviert.
        ${profile.disabled_reason ? `Grund: ${e(profile.disabled_reason)}` : ""}
      </p>
      <div class="status-actions">
        <button class="btn btn-ghost" type="button" data-action="logout">Abmelden</button>
      </div>
      <p class="status-hint">
        Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich.
      </p>
    </div>
  </section>`;
}

function quizAccountScreen() {
  return state.screen === "change-password" ? accountPasswordScreen() : accountDisabledScreen();
}

async function quizChangePassword(form) {
  const password = form.elements.password?.value || "";
  const password2 = form.elements.password2?.value || "";
  quizState.passwordError = "";
  if (password.length < 6) {
    quizState.passwordError = "Das Passwort muss mindestens 6 Zeichen haben.";
    render();
    return;
  }
  if (password !== password2) {
    quizState.passwordError = "Die Passwörter stimmen nicht überein.";
    render();
    return;
  }
  try {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    const rpc = await sb.rpc("complete_password_change");
    if (rpc.error) throw rpc.error;
    quizState.passwordError = "";
    await loadProfile();
    state.screen = isApproved() ? "start" : "pending";
    render();
    showToast("Passwort gespeichert.");
  } catch (error) {
    console.error(error);
    quizState.passwordError =
      "Das Passwort konnte nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09).";
    render();
  }
}

/* --------------------------------------------------------------------------
   Anbindung an app.js
   -------------------------------------------------------------------------- */
async function initQuiz() {
  quizBindEvents();
  if (typeof quizAdminBindEvents === "function") quizAdminBindEvents();
  quizSetupChannel();
  if (!isApproved()) return;
  await loadQuizData({ force: true });
  updateQuizAlert();
  if (quizIsScreen(state.screen)) render();
  try {
    await sb.rpc("prune_quiz_attempts");
  } catch (error) {
    console.warn("Aufräumen nicht möglich:", error);
  }
}

async function ensureQuizData() {
  if (!quizState.loaded) await loadQuizData({ force: true });
}

function resetQuizSession() {
  quizStopGuard();
  quizState.loaded = false;
  quizState.loading = false;
  quizState.settings = null;
  quizState.attempts = [];
  quizState.publicQuestions = [];
  quizState.active = null;
  quizState.answers = {};
  quizState.dirty = {};
  quizState.index = 0;
  quizState.viewAttempt = null;
  quizState.error = "";
  quizState.orphanHandled = null;
  quizState.navLock = null;
  quizState.leavingSent = false;
  quizState.finishing = false;
  quizState.admin.loaded = false;
  quizState.admin.questions = [];
  quizState.admin.attempts = [];
  quizState.admin.accounts = [];
  quizState.admin.questionDraft = null;
  quizState.admin.grading = null;
  quizState.admin.otp = null;
  const alert = document.getElementById("app-alert");
  if (alert) {
    alert.innerHTML = "";
    alert.hidden = true;
  }
  const contact = document.getElementById("contact-modal");
  if (contact && contact.open) contact.close();
  quizRestoreTitle();
}

async function quizBeforeSignOut() {
  if (!quizActive()) {
    quizStopGuard();
    return;
  }
  try {
    await quizFlushDirty();
    await sb.rpc("flag_quiz_attempt", {
      p_attempt: quizState.active.id,
      p_flag: "left",
      p_note: "Abmeldung während des Quiz – Antworten wurden gespeichert.",
    });
  } catch (error) {
    console.error(error);
  }
  quizState.active = null;
  quizStopGuard();
}


