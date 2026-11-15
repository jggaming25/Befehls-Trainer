/* ==========================================================================
   Befehlstrainer – Benachrichtigungen
   Glocke in der Kopfzeile, Benachrichtigungsbox und Desktop-Hinweise.
   Wird vor app.js geladen; alle Funktionen greifen erst zur Laufzeit zu.
   ========================================================================== */

const NOTIFY_STORAGE_KEY = "bt_notifications_v1";
const NOTIFY_DESKTOP_KEY = "bt_notifications_desktop_v1";
const NOTIFY_ADMIN_INTERVAL = 5 * 60 * 1000;
const NOTIFY_MAX_ITEMS = 40;

let notifyItems = [];
let notifyDesktopShown = {};
let notifyPanelOpen = false;
let notifyAdminPending = null;
let notifyAdminCheckedAt = 0;
let notifyAdminLoading = false;

/* --------------------------------------------------------------------------
   Speicher
   -------------------------------------------------------------------------- */
function notifyLoadStore() {
  try {
    const raw = localStorage.getItem(NOTIFY_STORAGE_KEY);
    notifyItems = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(notifyItems)) notifyItems = [];
  } catch {
    notifyItems = [];
  }
  try {
    const raw = localStorage.getItem(NOTIFY_DESKTOP_KEY);
    notifyDesktopShown = raw ? JSON.parse(raw) : {};
    if (!notifyDesktopShown || typeof notifyDesktopShown !== "object") notifyDesktopShown = {};
  } catch {
    notifyDesktopShown = {};
  }
}

function notifySaveStore() {
  try {
    localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(notifyItems.slice(0, NOTIFY_MAX_ITEMS)));
  } catch {
    /* Speicher voll oder blockiert – Anzeige funktioniert trotzdem. */
  }
}

function notifySaveDesktop() {
  const cutoff = Date.now() - 30 * 86400000;
  Object.keys(notifyDesktopShown).forEach((key) => {
    if (notifyDesktopShown[key] < cutoff) delete notifyDesktopShown[key];
  });
  try {
    localStorage.setItem(NOTIFY_DESKTOP_KEY, JSON.stringify(notifyDesktopShown));
  } catch {
    /* ignorieren */
  }
}

/* --------------------------------------------------------------------------
   Helfer
   -------------------------------------------------------------------------- */
function notifyEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function notifyDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function notifyTimeAgo(timestamp) {
  const diff = Date.now() - Number(timestamp || 0);
  if (diff < 60000) return "gerade eben";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

function notifyTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function notifyIsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/* --------------------------------------------------------------------------
   Einträge verwalten
   -------------------------------------------------------------------------- */
function notifyPush(item) {
  const existing = notifyItems.find((n) => n.id === item.id);
  if (existing) {
    const toneChanged = existing.tone !== item.tone;
    existing.title = item.title;
    existing.body = item.body;
    existing.tone = item.tone;
    existing.action = item.action;
    if (toneChanged) existing.read = false;
    notifySaveStore();
    return false;
  }
  notifyItems.unshift({
    id: item.id,
    kind: item.kind || "info",
    tone: item.tone || "info",
    title: item.title,
    body: item.body || "",
    action: item.action || "",
    createdAt: Date.now(),
    read: false,
  });
  notifyItems = notifyItems.slice(0, NOTIFY_MAX_ITEMS);
  notifySaveStore();
  return true;
}

function notifyRemoveWhere(predicate) {
  const before = notifyItems.length;
  notifyItems = notifyItems.filter((n) => !predicate(n));
  if (notifyItems.length !== before) notifySaveStore();
}

/* --------------------------------------------------------------------------
   Inhalte ableiten
   -------------------------------------------------------------------------- */
function notifySyncQuiz(profile) {
  const passed =
    typeof quizState !== "undefined" &&
    Array.isArray(quizState.attempts) &&
    quizState.attempts.some((a) => (typeof quizPassed === "function" ? quizPassed(a) : false));
  if (!profile.quiz_required || passed) {
    notifyRemoveWhere((n) => n.kind === "quiz");
    return;
  }
  const deadline = profile.quiz_deadline ? new Date(profile.quiz_deadline) : null;
  const overdue = Boolean(deadline && deadline.getTime() < Date.now());
  const deadlineKey = profile.quiz_deadline || "ohne-frist";
  const id = `quiz-${deadlineKey}`;
  // Alte Frist-Einträge entfernen, damit nur die aktuelle Frist erscheint
  notifyRemoveWhere((n) => n.kind === "quiz" && n.id !== id);
  notifyPush({
    id,
    kind: "quiz",
    tone: overdue ? "danger" : "warning",
    title: overdue ? "Prüfungsfrist abgelaufen" : "Prüfung bis zur Frist ablegen",
    body: overdue
      ? `Deine Frist${deadline ? ` vom ${notifyDate(profile.quiz_deadline)}` : ""} ist abgelaufen. Bitte lege die Quiz-Prüfung jetzt ab.`
      : deadline
      ? `Bitte lege die Quiz-Prüfung bis zum ${notifyDate(profile.quiz_deadline)} ab.`
      : "Für dich ist eine Quiz-Prüfung hinterlegt. Es wurde noch keine Frist gesetzt.",
    action: "quiz",
  });
}

function notifySyncAdmin() {
  if (notifyAdminPending === null) return;
  notifyRemoveWhere((n) => n.kind === "admin-requests");
  if (notifyAdminPending > 0) {
    notifyPush({
      id: "admin-pending-requests",
      kind: "admin-requests",
      tone: "info",
      title: "Neue Registrierungen",
      body: `${notifyAdminPending} offene Anfrage${notifyAdminPending === 1 ? "" : "n"} warten auf Freigabe.`,
      action: "admin",
    });
  }
}

function notifyRefreshAdminRequests() {
  if (typeof sb === "undefined" || !sb || typeof state === "undefined") return;
  if (!state.profile || state.profile.role !== "admin") return;
  if (notifyAdminLoading) return;
  if (notifyAdminPending !== null && Date.now() - notifyAdminCheckedAt < NOTIFY_ADMIN_INTERVAL) return;
  notifyAdminLoading = true;
  sb
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .then(({ count, error }) => {
      notifyAdminLoading = false;
      notifyAdminCheckedAt = Date.now();
      notifyAdminPending = error ? null : Number(count) || 0;
      notifySyncAdmin();
      notifyRender();
      notifyMaybeDesktop();
    })
    .catch(() => {
      notifyAdminLoading = false;
    });
}

/* --------------------------------------------------------------------------
   Desktop-Benachrichtigungen
   -------------------------------------------------------------------------- */
function notifyMaybeDesktop() {
  if (!notifyIsSupported() || Notification.permission !== "granted") return;
  const today = notifyTodayKey();
  let shownAny = false;

  notifyItems
    .filter((n) => n.kind === "quiz" || n.kind === "admin-requests")
    .forEach((item) => {
      const key = `${item.id}@${today}`;
      if (notifyDesktopShown[key]) return;
      notifyDesktopShown[key] = Date.now();
      shownAny = true;
      try {
        const notification = new Notification(item.title, {
          body: item.body,
          tag: item.id,
          icon: new URL("assets/favicon.svg", window.location.href).href,
        });
        notification.onclick = () => {
          window.focus();
          notifyActivate(item.id);
          notification.close();
        };
      } catch {
        /* Browser erlaubt die Anzeige nicht – Box bleibt verfügbar. */
      }
    });

  if (shownAny) notifySaveDesktop();
}

/* --------------------------------------------------------------------------
   Box und Glocke
   -------------------------------------------------------------------------- */
function notifyUnreadCount() {
  return notifyItems.filter((n) => !n.read).length;
}

function notifyRender() {
  const button = document.getElementById("notification-button");
  const badge = document.getElementById("notification-badge");
  const list = document.getElementById("notification-list");
  const perm = document.getElementById("notification-perm");
  const panel = document.getElementById("notification-panel");
  if (!button || !badge || !list || !panel) return;

  const unread = notifyUnreadCount();
  button.hidden = typeof state === "undefined" || !state.profile;
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? "9+" : String(unread);

  if (!notifyItems.length) {
    list.innerHTML = `<p class="notify-empty">Keine Benachrichtigungen.</p>`;
  } else {
    list.innerHTML = notifyItems
      .map(
        (item) => `
      <button class="notify-item ${item.read ? "is-read" : ""} tone-${notifyEscape(item.tone)}" type="button" data-notify-id="${notifyEscape(item.id)}">
        <span class="notify-item-mark" aria-hidden="true"></span>
        <span class="notify-item-copy">
          <strong>${notifyEscape(item.title)}</strong>
          <span>${notifyEscape(item.body)}</span>
          <small>${notifyTimeAgo(item.createdAt)}</small>
        </span>
      </button>`
      )
      .join("");
  }

  if (perm) {
    if (!notifyIsSupported()) {
      perm.innerHTML = `<span>Desktop-Benachrichtigungen werden von diesem Browser nicht unterstützt.</span>`;
    } else if (Notification.permission === "granted") {
      perm.innerHTML = `
        <span>Desktop-Benachrichtigungen sind aktiv.</span>
        <button class="link-btn" type="button" data-notify-action="test">Test anzeigen</button>`;
    } else if (Notification.permission === "denied") {
      perm.innerHTML = `<span>Desktop-Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen.</span>`;
    } else {
      perm.innerHTML = `
        <span>Erhalte Hinweise direkt auf dem Desktop – auch nach einem Neustart des PCs.</span>
        <button class="btn btn-secondary btn-sm" type="button" data-notify-action="enable">Desktop-Benachrichtigungen aktivieren</button>`;
    }
  }

  button.classList.toggle("has-unread", unread > 0);
}

function notifyOpenPanel() {
  const panel = document.getElementById("notification-panel");
  const button = document.getElementById("notification-button");
  if (!panel || !button) return;
  panel.hidden = false;
  notifyPanelOpen = true;
  button.setAttribute("aria-expanded", "true");
  // Öffnen markiert alle Einträge als gelesen
  notifyItems.forEach((n) => {
    n.read = true;
  });
  notifySaveStore();
  notifyRender();
}

function notifyClosePanel() {
  const panel = document.getElementById("notification-panel");
  const button = document.getElementById("notification-button");
  if (!panel || !button) return;
  panel.hidden = true;
  notifyPanelOpen = false;
  button.setAttribute("aria-expanded", "false");
}

function notifyActivate(id) {
  const item = notifyItems.find((n) => n.id === id);
  if (!item) return;
  item.read = true;
  notifySaveStore();
  notifyClosePanel();
  if (typeof render !== "function" || typeof state === "undefined") return;
  if (item.action === "quiz") {
    state.screen = "quiz";
  } else if (item.action === "admin") {
    state.screen = "admin";
    state.admin.section = "requests";
    if (typeof quizAdminEnter === "function") quizAdminEnter("requests");
  }
  render();
}

/* --------------------------------------------------------------------------
   Haupt-Synchronisation
   -------------------------------------------------------------------------- */
function syncNotifications() {
  if (typeof state === "undefined") return;
  const profile = state.profile;

  if (!profile) {
    notifyRender();
    return;
  }

  notifySyncQuiz(profile);
  notifyRefreshAdminRequests();
  if (profile.role !== "admin") {
    notifyRemoveWhere((n) => n.kind === "admin-requests");
    notifyAdminPending = null;
  } else if (notifyAdminPending !== null) {
    notifySyncAdmin();
  }

  notifyRender();
  notifyMaybeDesktop();
}

/* --------------------------------------------------------------------------
   Ereignisse
   -------------------------------------------------------------------------- */
function notifyBindEvents() {
  if (notifyBindEvents.ready) return;
  notifyBindEvents.ready = true;

  const button = document.getElementById("notification-button");
  if (button) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (notifyPanelOpen) notifyClosePanel();
      else notifyOpenPanel();
    });
  }

  document.addEventListener("click", (event) => {
    if (!notifyPanelOpen) return;
    if (event.target.closest(".notify-wrap")) return;
    notifyClosePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && notifyPanelOpen) notifyClosePanel();
  });

  const panel = document.getElementById("notification-panel");
  if (panel) {
    panel.addEventListener("click", (event) => {
      const item = event.target.closest("[data-notify-id]");
      if (item) {
        notifyActivate(item.dataset.notifyId);
        return;
      }
      const actionEl = event.target.closest("[data-notify-action]");
      if (!actionEl) return;
      const action = actionEl.dataset.notifyAction;
      if (action === "mark-read") {
        notifyItems.forEach((n) => {
          n.read = true;
        });
        notifySaveStore();
        notifyRender();
      }
      if (action === "enable") {
        if (!notifyIsSupported()) return;
        Notification.requestPermission().then(() => {
          notifyRender();
          notifyMaybeDesktop();
        });
      }
      if (action === "test") {
        if (!notifyIsSupported() || Notification.permission !== "granted") return;
        try {
          new Notification("Befehlstrainer – Test", {
            body: "Desktop-Benachrichtigungen funktionieren.",
            icon: new URL("assets/favicon.svg", window.location.href).href,
          });
        } catch {
          /* ignorieren */
        }
      }
    });
  }
}

function notifyInit() {
  notifyLoadStore();
  notifyBindEvents();
  notifyRender();
  syncNotifications();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    notifyInit();
    window.setInterval(() => syncNotifications(), 60000);
  });
} else {
  notifyInit();
  window.setInterval(() => syncNotifications(), 60000);
}

window.syncNotifications = syncNotifications;
