/* ==========================================================================
   Befehlstrainer – Admin: Quizfragen, Bewertung, Einstellungen, Konten
   Wird zusammen mit quiz.js vor app.js geladen.
   ========================================================================== */

function quizAdminIsSection(section) {
  return ["quiz-questions", "quiz-grading", "quiz-settings", "accounts"].includes(section);
}

function quizAdminEnter(section) {
  if (!isAdmin() || !quizAdminIsSection(section)) return;
  quizAdminLoad(section).then(() => {
    if (state.screen === "admin" && state.admin.section === section) render();
  });
}

async function quizAdminLoad(section) {
  const admin = quizState.admin;
  admin.error = "";
  admin.section = section;
  try {
    if (section === "quiz-questions") {
      if (admin.loadedFor === "quiz-questions") return;
      admin.loading = true;
      render();
      const { data, error } = await sb
        .from("quiz_questions_admin")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      admin.questions = data || [];
      admin.loadedFor = "quiz-questions";
    } else if (section === "quiz-grading") {
      if (admin.loadedFor === "quiz-grading") return;
      admin.loading = true;
      render();
      const [attemptsRes, profilesRes] = await Promise.all([
        sb.from("quiz_attempts").select("*").order("submitted_at", { ascending: false }),
        sb.from("profiles").select("id, discord_username, roblox_username"),
      ]);
      if (attemptsRes.error) throw attemptsRes.error;
      admin.attempts = attemptsRes.data || [];
      admin.names = {};
      (profilesRes.data || []).forEach((p) => {
        admin.names[p.id] = p.discord_username;
      });
      admin.accounts = profilesRes.data || [];
      admin.loadedFor = "quiz-grading";
    } else if (section === "quiz-settings") {
      if (admin.loadedFor === "quiz-settings") return;
      admin.loading = true;
      render();
      const [settingsRes, questionsRes] = await Promise.all([
        sb.from("quiz_settings").select("*").maybeSingle(),
        sb.from("quiz_questions_public").select("id, type, options"),
      ]);
      if (settingsRes.error) throw settingsRes.error;
      admin.settings = settingsRes.data || quizDefaultSettings();
      if (!questionsRes.error && questionsRes.data) quizState.publicQuestions = questionsRes.data;
      admin.loadedFor = "quiz-settings";
    } else if (section === "accounts") {
      if (admin.loadedFor === "accounts") return;
      admin.loading = true;
      render();
      const [profilesRes, attemptsRes] = await Promise.all([
        sb.from("profiles").select("*").order("created_at", { ascending: true }),
        sb.from("quiz_attempts").select("id, user_id, status, percentage, started_at"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      admin.accounts = profilesRes.data || [];
      admin.attempts = attemptsRes.error ? [] : attemptsRes.data || [];
      admin.loadedFor = "accounts";
    }
  } catch (error) {
    console.error(error);
    admin.error = "Daten konnten nicht geladen werden.";
    showContact(
      "Die Verwaltungsdaten konnten nicht geladen werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  } finally {
    admin.loading = false;
  }
}

function quizAdminSection(section) {
  if (!quizAdminIsSection(section)) return "";
  const admin = quizState.admin;
  if (admin.loading) {
    return `<section class="card admin-panel"><p class="admin-empty">Daten werden geladen …</p></section>`;
  }
  if (admin.error) {
    return `<section class="card admin-panel">
      <div class="quiz-error"><strong>Fehler.</strong><span>${e(admin.error)}</span>
      <button class="btn btn-secondary btn-sm" type="button" data-quiz-admin="reload" data-section="${e(section)}">Erneut laden</button></div>
    </section>`;
  }
  if (section === "quiz-questions") return quizAdminQuestions();
  if (section === "quiz-grading") return quizAdminGrading();
  if (section === "quiz-settings") return quizAdminSettings();
  if (section === "accounts") return quizAdminAccounts();
  return "";
}

/* --------------------------------------------------------------------------
   Fragen
   -------------------------------------------------------------------------- */
function quizAdminQuestions() {
  if (quizState.admin.questionDraft) return quizAdminQuestionEditor();
  const questions = quizState.admin.questions;
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Quizfragen</h2>
        <p class="panel-hint">Fragen, Punkte und Lösungen frei bearbeiten. Änderungen gelten für neue Versuche.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="reload" data-section="quiz-questions">Aktualisieren</button>
        <button class="btn btn-primary btn-sm" type="button" data-quiz-admin="new-question">Neue Frage</button>
      </div>
    </div>
    <div class="admin-table quiz-question-table">
      <div class="admin-table-head question-head">
        <span>Pos.</span><span>Frage</span><span>Typ</span><span>Punkte</span><span>Status</span><span></span>
      </div>
      ${
        questions.length
          ? questions
              .map(
                (q) => `
        <div class="admin-table-row question-row">
          <span>${quizNum(q.position)}</span>
          <span class="admin-table-title"><strong>${e(q.prompt)}</strong><small>${e(QUIZ_CATEGORY_LABELS[q.category] || q.category)}${q.command_nr ? ` · Befehl ${e(q.command_nr)}` : ""}</small></span>
          <span>${e(QUIZ_TYPE_LABELS[q.type] || q.type)}</span>
          <span>${quizFmt(q.points)}</span>
          <span>${q.active ? `<span class="status-pill ok">aktiv</span>` : `<span class="status-pill bad">inaktiv</span>`}</span>
          <span class="admin-row-actions">
            <button class="link-btn" type="button" data-quiz-admin="edit-question" data-id="${e(q.id)}">Bearbeiten</button>
            <button class="link-btn danger" type="button" data-quiz-admin="delete-question" data-id="${e(q.id)}">Löschen</button>
          </span>
        </div>`
              )
              .join("")
          : `<p class="admin-empty">Noch keine Fragen angelegt.</p>`
      }
    </div>
    <p class="panel-hint">Multiple Choice wird automatisch bewertet. Kurz-, Lang- und Befehlsaufgaben werden manuell bewertet.</p>
  </section>`;
}

function quizAdminQuestionEditor() {
  const q = quizState.admin.questionDraft;
  const isNew = !q.id;
  const options = Array.isArray(q.options) ? q.options : [];
  const scenario = q.scenario && typeof q.scenario === "object" ? q.scenario : {};
  const command = q.command_nr ? getCommand(q.command_nr) : null;

  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>${isNew ? "Neue Quizfrage" : "Quizfrage bearbeiten"}</h2>
        <p class="panel-hint">Lösungen werden nur Admins angezeigt und nicht an die Teilnehmer ausgeliefert.</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="cancel-question">Zurück</button>
    </div>
    <form id="quiz-question-form" class="admin-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Position</span>
          <input data-qd="position" type="number" min="0" step="1" value="${quizNum(q.position)}" />
        </label>
        <label class="field">
          <span class="field-label">Kategorie</span>
          <select data-qd="category">
            ${["regelwerk", "allgemein", "befehl"]
              .map(
                (value) =>
                  `<option value="${value}" ${q.category === value ? "selected" : ""}>${e(QUIZ_CATEGORY_LABELS[value])}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Typ</span>
          <select data-qd="type">
            ${["multiple_choice", "short", "long", "command"]
              .map(
                (value) =>
                  `<option value="${value}" ${q.type === value ? "selected" : ""}>${e(QUIZ_TYPE_LABELS[value])}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Punkte</span>
          <input data-qd="points" type="number" min="0.5" step="0.5" value="${quizNum(q.points)}" />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Frage</span>
        <textarea data-qd="prompt" rows="3" required>${e(q.prompt || "")}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Hinweis / Modul (optional)</span>
        <input data-qd="help" type="text" value="${e(q.help || "")}" placeholder="z. B. Modul DVN.1005 – Blockwerk" />
      </label>

      ${
        q.type === "multiple_choice"
          ? `<div class="editor-block">
              <div class="editor-head">
                <h3>Antwortoptionen</h3>
                <button class="btn btn-secondary btn-sm" type="button" data-quiz-admin="add-option">Option hinzufügen</button>
              </div>
              <p class="panel-hint">Richtige Antworten ankreuzen. Bei mehreren richtigen Antworten muss die Auswahl vollständig sein.</p>
              <div class="editor-rows" id="quiz-options">
                ${
                  options.length
                    ? options
                        .map(
                          (option, index) => `
                  <div class="editor-row quiz-option-row" data-qopt-row>
                    <input data-qopt="id" data-index="${index}" type="text" value="${e(option.id || "")}" placeholder="id" aria-label="Options-ID" />
                    <input data-qopt="label" data-index="${index}" type="text" value="${e(option.label || "")}" placeholder="Antworttext" aria-label="Antworttext" />
                    <label class="check quiz-option-correct">
                      <input type="checkbox" data-qopt="correct" data-index="${index}" ${option.correct ? "checked" : ""} />
                      <span class="check-box" aria-hidden="true"></span>
                      <span class="check-text">richtig</span>
                    </label>
                    <button class="icon-btn" type="button" data-quiz-admin="remove-option" data-index="${index}" aria-label="Option entfernen">×</button>
                  </div>`
                        )
                        .join("")
                    : `<div class="editor-row quiz-option-row" data-qopt-row>
                        <input data-qopt="id" data-index="0" type="text" value="a" placeholder="id" aria-label="Options-ID" />
                        <input data-qopt="label" data-index="0" type="text" value="" placeholder="Antworttext" aria-label="Antworttext" />
                        <label class="check quiz-option-correct">
                          <input type="checkbox" data-qopt="correct" data-index="0" />
                          <span class="check-box" aria-hidden="true"></span>
                          <span class="check-text">richtig</span>
                        </label>
                        <button class="icon-btn" type="button" data-quiz-admin="remove-option" data-index="0" aria-label="Option entfernen">×</button>
                      </div>`
                }
              </div>
            </div>`
          : ""
      }

      <label class="field">
        <span class="field-label">Musterlösung / Bewertungshinweis</span>
        <textarea data-qd="reference_answer" rows="4">${e(q.reference_answer || "")}</textarea>
      </label>

      ${
        q.type === "command"
          ? `<div class="editor-block">
              <div class="editor-head"><h3>Befehlserstellungs-Aufgabe</h3></div>
              <div class="form-grid">
                <label class="field">
                  <span class="field-label">Erwarteter Befehl</span>
                  <select data-qd="command_nr">
                    <option value="">Befehl wählen</option>
                    ${COMMANDS.map(
                      (cmd) =>
                        `<option value="${e(cmd.nr)}" ${q.command_nr === cmd.nr ? "selected" : ""}>${e(cmd.nr)} – ${e(cmd.title)}</option>`
                    ).join("")}
                  </select>
                </label>
                <label class="field">
                  <span class="field-label">Titel der Situation</span>
                  <input data-qd="scenario.title" type="text" value="${e(scenario.title || "")}" />
                </label>
                <label class="field">
                  <span class="field-label">Ort / Untertitel</span>
                  <input data-qd="scenario.subtitle" type="text" value="${e(scenario.subtitle || "")}" />
                </label>
                <label class="field">
                  <span class="field-label">Zug</span>
                  <input data-qd="scenario.train" type="text" value="${e(scenario.train || "")}" />
                </label>
                <label class="field">
                  <span class="field-label">Zeit</span>
                  <input data-qd="scenario.time" type="text" value="${e(scenario.time || "")}" />
                </label>
              </div>
              <label class="field">
                <span class="field-label">Situation</span>
                <textarea data-qd="scenario.situation" rows="4">${e(scenario.situation || "")}</textarea>
              </label>
              <label class="field">
                <span class="field-label">Auftrag</span>
                <textarea data-qd="scenario.task" rows="2">${e(scenario.task || "")}</textarea>
              </label>
              <label class="field">
                <span class="field-label">Stichpunkte (eine Zeile pro Punkt)</span>
                <textarea data-qd="scenario.facts" rows="3">${e((scenario.facts || []).join("\n"))}</textarea>
              </label>
              ${
                command
                  ? `<div class="editor-block">
                      <div class="editor-head"><h3>Erwartete Angaben (nur für die Bewertung)</h3></div>
                      <p class="panel-hint">Diese Werte werden dem Admin bei der manuellen Bewertung angezeigt.</p>
                      <div class="form-grid">
                        ${command.fields
                          .map(
                            (field) => `
                          <label class="field">
                            <span class="field-label">${e(field.label)}</span>
                            <select data-qfield-expected="${e(field.id)}">
                              <option value="">—</option>
                              ${(field.options || [])
                                .map(
                                  (option) =>
                                    `<option value="${e(option)}" ${scenario.field_points?.[field.id]?.correct === option ? "selected" : ""}>${e(option)}</option>`
                                )
                                .join("")}
                            </select>
                          </label>`
                          )
                          .join("")}
                      </div>
                      ${
                        command.measures.length
                          ? `<div class="editor-rows">${command.measures
                              .map(
                                (m) => `
                            <label class="check">
                              <input type="checkbox" data-qmeasure-expected="${e(m.id)}" ${scenario.measure_points?.[m.id]?.correct ? "checked" : ""} />
                              <span class="check-box" aria-hidden="true"></span>
                              <span class="check-text">${e(m.label)}</span>
                            </label>`
                              )
                              .join("")}</div>`
                          : ""
                      }
                    </div>`
                  : ""
              }
            </div>`
          : ""
      }

      <div class="order-actions">
        <label class="check">
          <input type="checkbox" data-qd="active" ${q.active !== false ? "checked" : ""} />
          <span class="check-box" aria-hidden="true"></span>
          <span class="check-text">Frage ist aktiv</span>
        </label>
        <button class="btn btn-primary" type="submit">${isNew ? "Frage anlegen" : "Änderungen speichern"}</button>
      </div>
    </form>
  </section>`;
}

function quizCollectQuestionDraft() {
  const root = document.getElementById("quiz-question-form");
  if (!root) return null;
  const draft = { ...(quizState.admin.questionDraft || {}) };
  root.querySelectorAll("[data-qd]").forEach((input) => {
    const key = input.dataset.qd;
    if (key.startsWith("scenario.")) {
      draft.scenario = draft.scenario || {};
      const field = key.slice("scenario.".length);
      if (field === "facts") {
        draft.scenario.facts = input.value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
      } else {
        draft.scenario[field] = input.value;
      }
      return;
    }
    if (key === "active") draft.active = input.checked;
    else if (key === "points") draft.points = quizNum(input.value);
    else if (key === "position") draft.position = Math.round(quizNum(input.value));
    else draft[key] = input.value;
  });

  const options = [];
  root.querySelectorAll("[data-qopt-row]").forEach((row) => {
    const id = row.querySelector('[data-qopt="id"]')?.value.trim();
    const label = row.querySelector('[data-qopt="label"]')?.value.trim();
    const correct = Boolean(row.querySelector('[data-qopt="correct"]')?.checked);
    if (id || label) options.push({ id: id || String(options.length + 1), label: label || "", correct });
  });
  draft.options = options;

  if (draft.type === "command") {
    draft.scenario = draft.scenario || {};
    const fieldPoints = {};
    root.querySelectorAll("[data-qfield-expected]").forEach((select) => {
      if (select.value) {
        fieldPoints[select.dataset.qfieldExpected] = { correct: select.value, points: 0 };
      }
    });
    draft.scenario.field_points = fieldPoints;
    const measurePoints = {};
    root.querySelectorAll("[data-qmeasure-expected]").forEach((input) => {
      measurePoints[input.dataset.qmeasureExpected] = { correct: Boolean(input.checked), points: 0 };
    });
    draft.scenario.measure_points = measurePoints;
  }
  quizState.admin.questionDraft = draft;
  return draft;
}

async function quizAdminSaveQuestion() {
  const draft = quizCollectQuestionDraft();
  if (!draft) return;
  if (!draft.prompt || !draft.prompt.trim()) {
    showToast("Bitte eine Frage eingeben.");
    return;
  }
  if (draft.type === "multiple_choice") {
    const options = (draft.options || []).filter((o) => o.label.trim());
    if (options.length < 2) {
      showToast("Multiple Choice braucht mindestens zwei Antworten.");
      return;
    }
    if (!options.some((o) => o.correct)) {
      showToast("Bitte mindestens eine richtige Antwort markieren.");
      return;
    }
    draft.options = options;
  } else {
    draft.options = [];
  }

  const payload = {
    position: draft.position || 0,
    category: draft.category || "regelwerk",
    type: draft.type || "multiple_choice",
    prompt: draft.prompt.trim(),
    help: (draft.help || "").trim() || null,
    points: draft.points > 0 ? draft.points : 1,
    options: draft.options,
    reference_answer: (draft.reference_answer || "").trim() || null,
    scenario: draft.scenario || {},
    command_nr: draft.type === "command" ? draft.command_nr || null : null,
    active: draft.active !== false,
  };

  try {
    if (draft.id) {
      const { error } = await sb.from("quiz_questions").update(payload).eq("id", draft.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("quiz_questions").insert(payload);
      if (error) throw error;
    }
    quizState.admin.questionDraft = null;
    quizState.admin.loadedFor = null;
    quizState.loaded = false;
    await quizAdminLoad("quiz-questions");
    render();
    showToast("Frage gespeichert.");
  } catch (error) {
    console.error(error);
    showContact(
      "Die Frage konnte nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  }
}

/* --------------------------------------------------------------------------
   Einstellungen
   -------------------------------------------------------------------------- */
function quizAdminSettings() {
  const s = quizState.admin.settings || quizSettings();
  const suggested = Math.round(quizSuggestedSeconds() / 60);
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Quiz-Einstellungen</h2>
        <p class="panel-hint">Zeitrichtwerte pro Fragetyp. Die Gesamtzeit wird beim Start festgeschrieben.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="reload" data-section="quiz-settings">Aktualisieren</button>
      </div>
    </div>
    <form id="quiz-settings-form" class="admin-form" novalidate>
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Kurzantwort (Minuten)</span>
          <input data-qs="short_minutes" type="number" min="0.5" step="0.5" value="${quizNum(s.short_minutes)}" />
        </label>
        <label class="field">
          <span class="field-label">Langantwort (Minuten)</span>
          <input data-qs="long_minutes" type="number" min="0.5" step="0.5" value="${quizNum(s.long_minutes)}" />
        </label>
        <label class="field">
          <span class="field-label">MC bis 4 Optionen (Minuten)</span>
          <input data-qs="mc_1_4_minutes" type="number" min="0.5" step="0.5" value="${quizNum(s.mc_1_4_minutes)}" />
        </label>
        <label class="field">
          <span class="field-label">MC bis 10 Optionen (Minuten)</span>
          <input data-qs="mc_5_10_minutes" type="number" min="0.5" step="0.5" value="${quizNum(s.mc_5_10_minutes)}" />
        </label>
        <label class="field">
          <span class="field-label">MC über 10 Optionen (Minuten)</span>
          <input data-qs="mc_11_plus_minutes" type="number" min="0.5" step="0.5" value="${quizNum(s.mc_11_plus_minutes)}" />
        </label>
        <label class="field">
          <span class="field-label">Empfohlene Bestehensgrenze (%)</span>
          <input data-qs="pass_percent" type="number" min="0" max="100" step="1" value="${quizNum(s.pass_percent)}" />
          <small class="field-note">Nur Empfehlung – bestanden/nicht bestanden entscheidet der Admin bei der Bewertung.</small>
        </label>
        <label class="field">
          <span class="field-label">Aufbewahrung (Wochen)</span>
          <input data-qs="retention_weeks" type="number" min="1" max="52" step="1" value="${quizNum(s.retention_weeks)}" />
        </label>
        <label class="field">
          <span class="field-label">Gesamtzeit (Minuten, leer = Vorschlag)</span>
          <input data-qs="total_minutes" type="number" min="1" step="1" value="${s.total_minutes == null ? "" : quizNum(s.total_minutes)}" placeholder="${suggested}" />
        </label>
      </div>
      <div class="quiz-suggestion">
        <div>
          <strong>Vorgeschlagene Gesamtzeit: ${suggested} Minuten</strong>
          <span>Berechnet aus ${quizState.publicQuestions.length} aktiven Fragen und den Zeitwerten oben. Du kannst sie übernehmen oder eine eigene Zeit eintragen.</span>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-quiz-admin="use-suggestion" data-minutes="${suggested}">Vorschlag übernehmen</button>
      </div>
      <label class="check">
        <input data-qs="quiz_enabled" type="checkbox" ${s.quiz_enabled ? "checked" : ""} />
        <span class="check-box" aria-hidden="true"></span>
        <span class="check-text">Quiz für Teilnehmer freigeben</span>
      </label>
      <div class="order-actions">
        <p class="panel-hint">Änderungen gelten für neue Versuche. Laufende Versuche behalten ihre Zeit.</p>
        <button class="btn btn-primary" type="submit">Einstellungen speichern</button>
      </div>
    </form>
  </section>`;
}

async function quizSaveSettings() {
  const root = document.getElementById("quiz-settings-form");
  if (!root) return;
  const payload = {
    short_minutes: quizNum(root.querySelector('[data-qs="short_minutes"]').value) || 1.5,
    long_minutes: quizNum(root.querySelector('[data-qs="long_minutes"]').value) || 4,
    mc_1_4_minutes: quizNum(root.querySelector('[data-qs="mc_1_4_minutes"]').value) || 0.5,
    mc_5_10_minutes: quizNum(root.querySelector('[data-qs="mc_5_10_minutes"]').value) || 1,
    mc_11_plus_minutes: quizNum(root.querySelector('[data-qs="mc_11_plus_minutes"]').value) || 2,
    pass_percent: Math.max(0, Math.min(100, Math.round(quizNum(root.querySelector('[data-qs="pass_percent"]').value)))),
    retention_weeks: Math.max(1, Math.min(52, Math.round(quizNum(root.querySelector('[data-qs="retention_weeks"]').value)))),
    total_minutes: root.querySelector('[data-qs="total_minutes"]').value
      ? Math.max(1, Math.round(quizNum(root.querySelector('[data-qs="total_minutes"]').value)))
      : null,
    quiz_enabled: root.querySelector('[data-qs="quiz_enabled"]').checked,
  };
  try {
    const { data, error } = await sb
      .from("quiz_settings")
      .update(payload)
      .eq("id", true)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    quizState.admin.settings = data || payload;
    quizState.settings = quizState.admin.settings;
    quizState.loaded = false;
    render();
    showToast("Einstellungen gespeichert.");
  } catch (error) {
    console.error(error);
    showContact(
      "Die Einstellungen konnten nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  }
}

/* --------------------------------------------------------------------------
   Bewertung
   -------------------------------------------------------------------------- */
function quizAdminGrading() {
  if (quizState.admin.grading) return quizAdminGradingEditor();
  const attempts = quizState.admin.attempts.filter((a) => a.status !== "active");
  const names = quizState.admin.names || {};
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Abgegebene Versuche</h2>
        <p class="panel-hint">Multiple Choice ist automatisch bewertet. Offene Freitext- und Befehlsaufgaben hier manuell bewerten. Über Bestanden entscheidet der Admin – die Prozentgrenze ist nur eine Empfehlung.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-secondary btn-sm" type="button" data-quiz-admin="export-results">Ergebnisse (CSV)</button>
        <button class="btn btn-secondary btn-sm" type="button" data-quiz-admin="export-details">Details (CSV)</button>
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="reload" data-section="quiz-grading">Aktualisieren</button>
      </div>
    </div>
    <div class="admin-table quiz-attempt-table">
      <div class="admin-table-head grading-head">
        <span>Teilnehmer</span><span>Abgegeben</span><span>Status</span><span>Punkte</span><span>Hinweis</span><span></span>
      </div>
      ${
        attempts.length
          ? attempts
              .map(
                (a) => `
        <div class="admin-table-row grading-row">
          <span class="admin-table-title"><strong>${e(names[a.user_id] || "Unbekannt")}</strong><small>${e(quizFormatDate(a.started_at))}</small></span>
          <span>${e(quizFormatDate(a.submitted_at))}</span>
          <span>${quizStatusPill(a.status)}</span>
          <span>${a.percentage == null ? "—" : `${quizFmt(a.total_points)} / ${quizFmt(a.max_points)} · ${quizFmt(a.percentage)} %`}
            ${a.status === "graded" ? (quizPassDecided(a) ? (a.passed ? ` <span class="status-pill ok">bestanden</span>` : ` <span class="status-pill bad">nicht bestanden</span>`) : ` <span class="status-pill wait">Entscheidung offen</span>`) : ""}
          </span>
          <span>${a.flag ? `<span class="status-pill bad">${e(QUIZ_FLAG_LABELS[a.flag] || a.flag)}</span>` : "—"}</span>
          <span class="admin-row-actions">
            <button class="link-btn" type="button" data-quiz-admin="open-grading" data-id="${e(a.id)}">
              ${a.status === "graded" ? "Neu bewerten" : "Bewerten"}
            </button>
            <button class="link-btn danger" type="button" data-quiz-admin="delete-attempt" data-id="${e(a.id)}">Löschen</button>
          </span>
        </div>`
              )
              .join("")
          : `<p class="admin-empty">Noch keine abgegebenen Versuche.</p>`
      }
    </div>
  </section>`;
}

function quizExpectedBlock(item) {
  const q = (quizState.admin.gradingQuestions || []).find((row) => row.id === item.id);
  if (!q || item.type !== "command") return "";
  const scenario = q.scenario || {};
  const command = q.command_nr ? getCommand(q.command_nr) : null;
  if (!command) return "";
  const fields = Object.entries(scenario.field_points || {});
  const measures = Object.entries(scenario.measure_points || {}).filter(([, value]) => value.correct);
  if (!fields.length && !measures.length) return "";
  return `
    <div class="quiz-expected">
      <span class="field-label">Erwartete Lösung</span>
      <div class="expected-grid">
        ${fields
          .map(([id, target]) => {
            const field = command.fields.find((f) => f.id === id);
            return `<div><span>${e(field ? field.label : id)}</span><strong>${e(target.correct)}</strong></div>`;
          })
          .join("")}
        ${measures
          .map(([id]) => {
            const measure = command.measures.find((m) => m.id === id);
            return `<div><span>Maßnahme</span><strong>${e(measure ? measure.label : id)}</strong></div>`;
          })
          .join("")}
      </div>
    </div>`;
}

function quizAdminGradingEditor() {
  const attempt = quizState.admin.grading;
  const review = Array.isArray(attempt.review) ? attempt.review : [];
  const names = quizState.admin.names || {};
  const threshold = quizNum(quizState.settings?.pass_percent ?? 60);
  const recommended = quizNum(attempt.percentage) >= threshold;
  const decided = typeof attempt.passed === "boolean";
  return `
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Versuch bewerten</h2>
        <p class="panel-hint">
          ${e(names[attempt.user_id] || "Teilnehmer")} · ${e(quizFormatDate(attempt.started_at))} ·
          ${quizFmt(attempt.total_points)} / ${quizFmt(attempt.max_points)} Punkte
          ${attempt.flag ? ` · <span class="status-pill bad">${e(QUIZ_FLAG_LABELS[attempt.flag] || attempt.flag)}</span>` : ""}
        </p>
        ${attempt.flag_note ? `<p class="panel-hint">Hinweis: ${e(attempt.flag_note)}</p>` : ""}
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="back-grading">Zurück</button>
    </div>

    <form id="quiz-grading-form" class="admin-form" novalidate>
      <div class="grading-list">
        ${review
          .map(
            (item) => `
          <article class="grading-item">
            <div class="grading-head">
              <div>
                <span class="quiz-type">${e(QUIZ_TYPE_LABELS[item.type] || item.type)}</span>
                <h3>${e(item.prompt)}</h3>
              </div>
              <span class="quiz-review-points">${quizFmt(item.points)} P</span>
            </div>
            ${quizAnswerLines(item)}
            ${quizExpectedBlock(item)}
            ${
              item.reference_answer
                ? `<div class="quiz-reference"><span class="field-label">Musterlösung / Bewertungshinweis</span><p>${e(item.reference_answer)}</p></div>`
                : ""
            }
            <div class="grading-points">
              ${
                item.type === "multiple_choice"
                  ? `<span class="status-pill ${item.auto_points >= item.points ? "ok" : "bad"}">
                      automatisch ${quizFmt(item.auto_points)} / ${quizFmt(item.points)} P
                    </span>`
                  : `<label class="field field-inline">
                      <span class="field-label">Punkte (max. ${quizFmt(item.points)})</span>
                      <input data-grade="${e(item.id)}" type="number" min="0" max="${quizNum(item.points)}" step="0.5"
                        value="${item.manual_points == null ? "" : quizNum(item.manual_points)}" placeholder="0" />
                    </label>`
              }
            </div>
          </article>`
          )
          .join("")}
      </div>
      <div class="grading-decision">
        <div class="grading-decision-head">
          <span class="field-label">Bestehensentscheidung (manuell)</span>
          <p class="panel-hint">
            Empfehlung: <strong>${threshold} %</strong> – erreicht: ${recommended ? "ja" : "nein"}
            (${quizFmt(attempt.percentage)} %). Die Entscheidung trifft der Admin.
          </p>
        </div>
        <div class="decision-options">
          <label class="check compact">
            <input type="radio" name="quiz-passed" value="yes" ${decided && attempt.passed ? "checked" : ""}>
            <span class="check-box" aria-hidden="true"></span>
            <span class="check-text">Bestanden</span>
          </label>
          <label class="check compact">
            <input type="radio" name="quiz-passed" value="no" ${decided && !attempt.passed ? "checked" : ""}>
            <span class="check-box" aria-hidden="true"></span>
            <span class="check-text">Nicht bestanden</span>
          </label>
        </div>
        <small class="decision-hint">Ohne Auswahl wird die Bewertung nicht gespeichert.</small>
      </div>
      <label class="field">
        <span class="field-label">Anmerkung zur Bewertung (für den Teilnehmer sichtbar)</span>
        <textarea id="quiz-grade-note" rows="3">${e(attempt.grading_note || "")}</textarea>
      </label>
      <div class="order-actions">
        <p class="panel-hint">Die Freigabe startet die 12-Wochen-Aufbewahrung.</p>
        <button class="btn btn-primary" type="submit">Bewertung speichern</button>
      </div>
    </form>
  </section>`;
}

async function quizOpenGrading(id) {
  const attempt = quizState.admin.attempts.find((a) => a.id === id);
  if (!attempt) return;
  quizState.admin.grading = attempt;
  const ids = (attempt.review || []).map((item) => item.id);
  if (ids.length) {
    const { data, error } = await sb.from("quiz_questions_admin").select("*").in("id", ids);
    if (!error) quizState.admin.gradingQuestions = data || [];
    else quizState.admin.gradingQuestions = [];
  } else {
    quizState.admin.gradingQuestions = [];
  }
  render();
}

async function quizSaveGrading() {
  const attempt = quizState.admin.grading;
  if (!attempt) return;
  const points = {};
  document.querySelectorAll("[data-grade]").forEach((input) => {
    points[input.dataset.grade] = quizNum(input.value);
  });
  const note = document.getElementById("quiz-grade-note")?.value || "";
  const passInput = document.querySelector('input[name="quiz-passed"]:checked');
  if (!passInput) {
    showToast("Bitte „Bestanden“ oder „Nicht bestanden“ wählen.");
    return;
  }
  const passed = passInput.value === "yes";
  try {
    const { data, error } = await sb.rpc("grade_quiz_attempt", {
      p_attempt: attempt.id,
      p_points: points,
      p_note: note,
      p_passed: passed,
    });
    if (error) throw error;
    quizState.admin.grading = null;
    quizState.admin.loadedFor = null;
    quizState.loaded = false;
    await quizAdminLoad("quiz-grading");
    render();
    showToast("Bewertung gespeichert.");
    if (data) console.info("Bewertung:", data);
  } catch (error) {
    console.error(error);
    showContact(
      "Die Bewertung konnte nicht gespeichert werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  }
}

/* --------------------------------------------------------------------------
   Export (CSV)
   -------------------------------------------------------------------------- */
function quizCsvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function quizDownloadCsv(filename, rows) {
  const content = "\uFEFF" + rows.map((row) => row.map(quizCsvCell).join(";")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function quizCsvDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function quizAnswerText(item) {
  const value = item.value;
  if (item.type === "multiple_choice") {
    const chosen = Array.isArray(value) ? value : [];
    const options = Array.isArray(item.options) ? item.options : [];
    return chosen
      .map((id) => options.find((option) => option.id === id)?.label || id)
      .join(", ");
  }
  if (item.type === "short" || item.type === "long") {
    return typeof value === "string" ? value.trim() : "";
  }
  if (item.type === "command") {
    const answer = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const command = answer.command ? getCommand(answer.command) : null;
    const parts = [command ? `Befehl ${command.nr} – ${command.title}` : "kein Befehl"];
    if (command) {
      command.fields.forEach((field) => parts.push(`${field.label}: ${answer.fields?.[field.id] || "—"}`));
      const checked = command.measures
        .filter((m) => answer.measures?.[m.id])
        .map((m) => m.label);
      if (checked.length) parts.push(`Maßnahmen: ${checked.join(" | ")}`);
    }
    return parts.join(" · ");
  }
  return "";
}

function quizExportResults() {
  const attempts = (quizState.admin.attempts || []).filter((a) => a.status === "graded");
  if (!attempts.length) {
    showToast("Noch keine fertig bewerteten Ergebnisse.");
    return;
  }
  const names = quizState.admin.names || {};
  const threshold = quizNum(quizState.settings?.pass_percent ?? 60);
  const header = [
    "Teilnehmer",
    "Gestartet",
    "Abgegeben",
    "Bewertet am",
    "Bewertet von",
    "Punkte",
    "Max. Punkte",
    "Prozent",
    "Empfehlung (%)",
    "Empfehlung erreicht",
    "Entscheidung",
    "Auffälligkeit",
    "Anmerkung",
    "Aufbewahrung bis",
  ];
  const rows = attempts.map((a) => [
    names[a.user_id] || a.user_id,
    quizFormatDate(a.started_at),
    quizFormatDate(a.submitted_at),
    quizFormatDate(a.graded_at),
    a.graded_by_name || "",
    quizFmt(a.total_points),
    quizFmt(a.max_points),
    quizFmt(a.percentage),
    threshold,
    quizNum(a.percentage) >= threshold ? "ja" : "nein",
    typeof a.passed === "boolean" ? (a.passed ? "bestanden" : "nicht bestanden") : "offen",
    a.flag ? QUIZ_FLAG_LABELS[a.flag] || a.flag : "",
    a.grading_note || "",
    quizFormatDate(a.retention_until),
  ]);
  quizDownloadCsv(`befehlstrainer-ergebnisse-${quizCsvDate()}.csv`, [header, ...rows]);
  showToast(`${attempts.length} bewertete Ergebnisse exportiert.`);
}

function quizExportDetails() {
  const attempts = (quizState.admin.attempts || []).filter((a) => a.status === "graded");
  if (!attempts.length) {
    showToast("Noch keine fertig bewerteten Ergebnisse.");
    return;
  }
  const names = quizState.admin.names || {};
  const header = [
    "Teilnehmer",
    "Gestartet",
    "Frage",
    "Typ",
    "Punkte",
    "Max. Punkte",
    "Antwort",
    "Musterlösung / Hinweis",
    "Entscheidung",
  ];
  const rows = [];
  attempts.forEach((attempt) => {
    (Array.isArray(attempt.review) ? attempt.review : []).forEach((item) => {
      const points =
        item.auto_points != null
          ? quizNum(item.auto_points)
          : item.manual_points != null
          ? quizNum(item.manual_points)
          : "";
      rows.push([
        names[attempt.user_id] || attempt.user_id,
        quizFormatDate(attempt.started_at),
        item.prompt || "",
        QUIZ_TYPE_LABELS[item.type] || item.type || "",
        points,
        quizNum(item.points),
        quizAnswerText(item),
        item.reference_answer || "",
        typeof attempt.passed === "boolean"
          ? attempt.passed
            ? "bestanden"
            : "nicht bestanden"
          : "offen",
      ]);
    });
  });
  if (!rows.length) {
    showToast("Keine Detaildaten zum Export gefunden.");
    return;
  }
  quizDownloadCsv(`befehlstrainer-details-${quizCsvDate()}.csv`, [header, ...rows]);
  showToast(`${rows.length} Antworten exportiert.`);
}

/* --------------------------------------------------------------------------
   Konten
   -------------------------------------------------------------------------- */
function quizLocalDateTimeValue(days = 14) {
  const date = new Date(Date.now() + days * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function quizOtpCard() {
  const otp = quizState.admin.otp;
  if (!otp) return "";
  const text = `Befehlstrainer – Zugang
Link: ${otp.site_url || QUIZ_SITE_URL}
Benutzername (Discord): ${otp.discord_username}
Einmalpasswort: ${otp.one_time_password}

Bitte melde dich mit dem Einmalpasswort an und setze danach sofort ein neues Passwort.`;
  return `
  <section class="card admin-panel otp-card">
    <div class="admin-panel-head">
      <div>
        <h2>Einmalpasswort für ${e(otp.discord_username)}</h2>
        <p class="panel-hint">Der Text kann direkt kopiert und per DM verschickt werden. Das Passwort ist nur einmal gültig und muss danach geändert werden.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-secondary btn-sm" type="button" data-quiz-action="copy-otp">Kopieren</button>
        <button class="btn btn-ghost btn-sm" type="button" data-quiz-action="close-otp">Schließen</button>
      </div>
    </div>
    <pre class="otp-text" id="otp-text">${e(text)}</pre>
  </section>`;
}

function quizAdminAccounts() {
  const accounts = quizState.admin.accounts;
  const attempts = quizState.admin.attempts || [];
  return `
  ${quizOtpCard()}
  <section class="card admin-panel">
    <div class="admin-panel-head">
      <div>
        <h2>Konten</h2>
        <p class="panel-hint">Konten deaktivieren, Passwörter zurücksetzen, Prüfungen anfordern und Zusatzversuche freigeben. „Konto löschen“ entfernt das Konto endgültig aus Supabase (Auth-Konto, Profil und alle Versuche).</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-quiz-admin="reload" data-section="accounts">Aktualisieren</button>
    </div>
    <div class="admin-table account-table">
      <div class="admin-table-head account-head">
        <span>Konto</span><span>Status</span><span>Prüfung</span><span>Versuche</span><span>Aktionen</span>
      </div>
      ${accounts
        .map((account) => {
          const userAttempts = attempts.filter((a) => a.user_id === account.id);
          const graded = userAttempts.filter((a) => a.status === "graded");
          const best = graded.reduce((max, a) => Math.max(max, quizNum(a.percentage)), 0);
          const isSelf = account.id === state.profile?.id;
          return `
          <div class="admin-table-row account-row">
            <span class="admin-table-title">
              <strong>${e(account.discord_username)}${isSelf ? " (du)" : ""}</strong>
              <small>${e(account.roblox_username || "—")} · ${account.role === "admin" ? "Admin" : "Mitglied"} · seit ${e(quizFormatDate(account.created_at))}</small>
            </span>
            <span>
              ${account.status === "disabled" ? `<span class="status-pill bad">deaktiviert</span>` : account.status === "approved" ? `<span class="status-pill ok">freigegeben</span>` : `<span class="status-pill wait">${e(account.status)}</span>`}
              ${account.disabled_reason ? `<small class="flag-note">${e(account.disabled_reason)}</small>` : ""}
            </span>
            <span>
              ${
                account.quiz_required
                  ? `<span class="status-pill wait">angefordert</span><small class="flag-note">${e(quizDeadlineText(account.quiz_deadline))}</small>`
                  : `<span class="muted">—</span>`
              }
            </span>
            <span>
              ${userAttempts.length} Versuch${userAttempts.length === 1 ? "" : "e"} · ${account.extra_attempts || 0} extra
              ${best ? `<small class="flag-note">best ${quizFmt(best)} %</small>` : ""}
            </span>
            <span class="account-actions">
              <div class="account-action-line">
                <button class="link-btn ${account.status === "disabled" ? "" : "danger"}" type="button"
                  data-quiz-admin="toggle-account" data-id="${e(account.id)}" data-status="${account.status === "disabled" ? "approved" : "disabled"}"
                  ${isSelf ? "disabled" : ""}>
                  ${account.status === "disabled" ? "Aktivieren" : "Deaktivieren"}
                </button>
                <button class="link-btn" type="button" data-quiz-admin="reset-password" data-id="${e(account.id)}" ${isSelf ? "disabled" : ""}>Passwort zurücksetzen</button>
                <button class="link-btn" type="button" data-quiz-admin="grant-attempt" data-id="${e(account.id)}">Versuch freigeben</button>
              </div>
              <div class="account-action-line">
                <input class="account-deadline" type="datetime-local" data-account-deadline="${e(account.id)}" value="${quizLocalDateTimeValue(14)}" aria-label="Frist" />
                <input class="account-note" type="text" data-account-note="${e(account.id)}" placeholder="Notiz (optional)" maxlength="200" aria-label="Notiz" />
                <button class="link-btn" type="button" data-quiz-admin="require-quiz" data-id="${e(account.id)}">Prüfung anfordern</button>
                ${account.quiz_required ? `<button class="link-btn danger" type="button" data-quiz-admin="clear-requirement" data-id="${e(account.id)}">Anforderung entfernen</button>` : ""}
                <button class="link-btn danger" type="button" data-quiz-admin="delete-account" data-id="${e(account.id)}" data-name="${e(account.discord_username)}" ${isSelf ? "disabled" : ""}>Konto löschen</button>
              </div>
            </span>
          </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

async function quizAccountAction(action, id, dataset = {}) {
  const deadlineInput = document.querySelector(`[data-account-deadline="${id}"]`);
  const noteInput = document.querySelector(`[data-account-note="${id}"]`);
  try {
    if (action === "toggle-account") {
      const nextStatus = dataset.status;
      const reason =
        nextStatus === "disabled"
          ? window.prompt("Grund für die Deaktivierung (optional):", "Konto deaktiviert") || ""
          : null;
      const { error } = await sb.rpc("admin_set_account_status", {
        target: id,
        p_status: nextStatus,
        p_reason: reason,
      });
      if (error) throw error;
    } else if (action === "reset-password") {
      if (!window.confirm("Passwort zurücksetzen? Der Nutzer wird abgemeldet und erhält ein Einmalpasswort.")) return;
      const { data, error } = await sb.rpc("admin_reset_password", { target: id });
      if (error) throw error;
      quizState.admin.otp = data;
    } else if (action === "require-quiz") {
      const deadlineValue = deadlineInput?.value;
      const deadline = deadlineValue ? new Date(deadlineValue) : null;
      const { error } = await sb.rpc("set_quiz_requirement", {
        target: id,
        p_required: true,
        p_deadline: deadline ? deadline.toISOString() : null,
        p_note: noteInput?.value || null,
      });
      if (error) throw error;
    } else if (action === "clear-requirement") {
      const { error } = await sb.rpc("set_quiz_requirement", {
        target: id,
        p_required: false,
        p_deadline: null,
        p_note: null,
      });
      if (error) throw error;
    } else if (action === "grant-attempt") {
      const { data, error } = await sb.rpc("grant_quiz_attempt", { target: id });
      if (error) throw error;
      showToast(`Weiterer Versuch freigegeben (${data}).`);
    } else if (action === "delete-account") {
      const name = dataset.name || "";
      const typed = window.prompt(
        `Konto „${name}“ endgültig löschen?\n\n` +
          "Dabei werden Auth-Konto, Profil und alle Versuche in Supabase gelöscht. " +
          "Diese Aktion kann nicht rückgängig gemacht werden.\n\n" +
          "Zur Bestätigung den Discord-Namen eingeben:",
        ""
      );
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== name.toLowerCase()) {
        showToast("Der eingegebene Name stimmt nicht überein. Konto nicht gelöscht.");
        return;
      }
      const { error } = await sb.rpc("admin_delete_account", { target: id });
      if (error) throw error;
      quizState.admin.otp = null;
      showToast(`Konto „${name}“ wurde vollständig gelöscht.`);
    }
    quizState.admin.loadedFor = null;
    await quizAdminLoad("accounts");
    render();
  } catch (error) {
    console.error(error);
    showToast(error?.message || "Aktion fehlgeschlagen.");
    showContact(
      "Die Kontoaktion konnte nicht ausgeführt werden. Bitte wende dich an Admin Jann (Discord: jlg09) per DM oder an den DVN-Discord im Staff-Bereich."
    );
  }
}

/* --------------------------------------------------------------------------
   Ereignisse der Verwaltung
   -------------------------------------------------------------------------- */
function quizAdminBindEvents() {
  if (quizAdminBindEvents.ready) return;
  quizAdminBindEvents.ready = true;

  app.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-quiz-admin]");
    if (!actionEl) return;
    const action = actionEl.dataset.quizAdmin;
    const id = actionEl.dataset.id;

    if (action === "reload") {
      quizState.admin.loadedFor = null;
      quizAdminLoad(actionEl.dataset.section || quizState.admin.section).then(() => render());
      return;
    }
    if (action === "new-question") {
      quizState.admin.questionDraft = {
        id: null,
        position: (quizState.admin.questions.reduce((max, q) => Math.max(max, quizNum(q.position)), 0) || 0) + 10,
        category: "regelwerk",
        type: "multiple_choice",
        prompt: "",
        help: "",
        points: 2,
        options: [
          { id: "a", label: "", correct: false },
          { id: "b", label: "", correct: false },
        ],
        reference_answer: "",
        command_nr: "",
        scenario: {},
        active: true,
      };
      render();
      return;
    }
    if (action === "edit-question") {
      const question = quizState.admin.questions.find((q) => q.id === id);
      if (question) {
        quizState.admin.questionDraft = JSON.parse(JSON.stringify(question));
        render();
      }
      return;
    }
    if (action === "delete-question") {
      if (!window.confirm("Frage wirklich löschen? Bereits abgegebene Versuche behalten ihre Auswertung.")) return;
      sb.from("quiz_questions")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error(error);
            showContact("Die Frage konnte nicht gelöscht werden.");
            return;
          }
          quizState.admin.loadedFor = null;
          quizState.loaded = false;
          quizAdminLoad("quiz-questions").then(() => render());
        });
      return;
    }
    if (action === "cancel-question") {
      quizState.admin.questionDraft = null;
      render();
      return;
    }
    if (action === "add-option") {
      const draft = quizCollectQuestionDraft();
      if (draft) {
        draft.options = [...(draft.options || []), { id: String.fromCharCode(97 + (draft.options || []).length), label: "", correct: false }];
        quizState.admin.questionDraft = draft;
        render();
      }
      return;
    }
    if (action === "remove-option") {
      const draft = quizCollectQuestionDraft();
      if (draft) {
        const index = Number(actionEl.dataset.index);
        draft.options = (draft.options || []).filter((_, i) => i !== index);
        quizState.admin.questionDraft = draft;
        render();
      }
      return;
    }
    if (action === "use-suggestion") {
      const input = document.querySelector('[data-qs="total_minutes"]');
      if (input) input.value = actionEl.dataset.minutes || "";
      return;
    }
    if (action === "export-results") {
      quizExportResults();
      return;
    }
    if (action === "export-details") {
      quizExportDetails();
      return;
    }
    if (action === "delete-attempt") {
      if (!window.confirm("Diesen Versuch endgültig löschen? Auswertung und Antworten werden entfernt.")) return;
      sb.rpc("admin_delete_attempt", { p_attempt: id }).then(({ error }) => {
        if (error) {
          console.error(error);
          showToast(error.message || "Der Versuch konnte nicht gelöscht werden.");
          showContact("Der Versuch konnte nicht gelöscht werden.");
          return;
        }
        quizState.admin.loadedFor = null;
        quizState.loaded = false;
        quizAdminLoad("quiz-grading").then(() => render());
        showToast("Versuch gelöscht.");
      });
      return;
    }
    if (action === "open-grading") {
      quizOpenGrading(id);
      return;
    }
    if (action === "back-grading") {
      quizState.admin.grading = null;
      render();
      return;
    }
    if (action === "toggle-account" || action === "reset-password" || action === "require-quiz" || action === "clear-requirement" || action === "grant-attempt" || action === "delete-account") {
      quizAccountAction(action, id, actionEl.dataset);
      return;
    }
  });

  app.addEventListener("change", (event) => {
    if (!event.target.closest("#quiz-question-form")) return;
    const key = event.target.dataset.qd;
    if (key === "type" || key === "command_nr") {
      const draft = quizCollectQuestionDraft();
      if (!draft) return;
      if (key === "command_nr") {
        draft.command_nr = event.target.value;
        if (draft.scenario) {
          draft.scenario.field_points = {};
          draft.scenario.measure_points = {};
        }
      }
      quizState.admin.questionDraft = draft;
      render();
    }
  });

  app.addEventListener("submit", async (event) => {
    if (event.target.id === "quiz-question-form") {
      event.preventDefault();
      await quizAdminSaveQuestion();
      return;
    }
    if (event.target.id === "quiz-settings-form") {
      event.preventDefault();
      await quizSaveSettings();
      return;
    }
    if (event.target.id === "quiz-grading-form") {
      event.preventDefault();
      await quizSaveGrading();
    }
  });
}


