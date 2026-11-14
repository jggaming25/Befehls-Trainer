# Befehlstrainer

Übungswebsite für den **Digitalen Befehl (DVN FIS)**. Jedes Training besteht aus
zehn realistischen Betriebssituationen – schematisches Streckenbild, Beschreibung,
Zugfunkmeldung und Auftrag. Der passende Befehl wird ausgestellt und anschließend
mit bis zu **10 Punkten pro Situation** logisch ausgewertet.

Die Situationen werden aus Vorlagen und Zufallswerten erzeugt, sodass praktisch
unbegrenzt viele Läufe möglich sind. Admins können zusätzlich eigene Befehle,
Eingabefelder und Situationen in Supabase anlegen.

## Funktionen

- **Registrierung ohne externen Login:** Discord-Name, Roblox-Name und Passwort
  (Supabase Auth mit intern erzeugter E-Mail-Adresse)
- **Freigabe durch Admins:** neue Konten sind zunächst `pending`; Admins sehen
  offene Anfragen, können sie annehmen oder mit optionaler Begründung ablehnen
- **Erster Account = erster Admin:** Die erste Registrierung wird automatisch
  freigeschaltet und erhält die Admin-Rolle
- **16 Befehle** (1–9 und 21–28) mit dynamischen Eingabefeldern und Maßnahmen
- **Generierte Situationen** für alle Befehle, inklusive Zugfunk und
  Streckenbild-Presets
- **Offizieller Befehlsvordruck** nach Muster Ril 408.2411 V01 (Stand 14.12.2025)
  mit Kennung, Feldern A–Y und Zusatzmaßnahmen
- **Betriebsregelwerk-Tab:** bettet das freigegebene Google-Dokument ein, immer
  in der aktuellen Fassung und ohne die Seite zu verlassen
- **Quiz/Prüfung** zum Betriebsregelwerk: Multiple Choice (automatisch),
  Kurz-/Langantwort und Befehlserstellung (manuell durch Admins)
- **Auswertungen** mit Gesamtpunkten, Prozentwert, Empfehlung,
  Bewertungsanmerkung und bewertender Person
- **Manuelle Bestehensentscheidung:** Die Prozentgrenze ist nur eine Empfehlung;
  ob ein Versuch bestanden ist, entscheidet der Admin bei der Bewertung
- **Admin-Bereich** für Anfragen, Befehle/Eingabefelder, eigene Situationen,
  Quizfragen, Bewertungen, Quiz-Einstellungen und Konten
- **Kontoverwaltung:** deaktivieren, Passwort per Einmalpasswort zurücksetzen,
  Prüfung mit Frist anfordern, Zusatzversuch freigeben und Konten vollständig
  löschen (Auth-Konto, Profil und alle Versuche in Supabase)
- **Ergebnis-Export** als CSV: eine Übersicht aller bewerteten Versuche und ein
  Detail-Export mit jeder Antwort und Musterlösung
- **Auswertung:** Befehlswahl 4 P., Angaben und Zusatzmaßnahmen zusammen 6 P.
- **Keine Speicherung von Trainingsergebnissen:** nur Konten, Quizversuche und
  Admin-Inhalte liegen in Supabase; der Trainingszustand bleibt im Browser

## Lokal starten

Die Seite besteht aus statischen Dateien und benötigt nur einen HTTP-Server:

```powershell
python -m http.server 8080
# oder
npx serve .
```

Danach <http://localhost:8080> öffnen. Das Backend ist bereits in
`assets/config.js` eingetragen (öffentliche Supabase-URL und Publishable Key).

## Supabase

Projekt-Ref: `zdemeuejvzweilikllef` (URL `https://zdemeuejvzweilikllef.supabase.co`).
Die öffentliche Konfiguration steht in `assets/config.js`.

### Schema

Die Migrationen liegen unter `supabase/migrations`:

| Datei | Inhalt |
| --- | --- |
| `20261112170000_init.sql` | Profile, Befehle, Situationen, RLS, Trigger, RPCs |
| `20261112180000_seed_commands.sql` | Startkatalog mit 16 Befehlen |
| `20261112210000_auto_confirm_users.sql` | Trigger: neue Auth-Konten automatisch bestätigen |
| `20261113120000_quiz_accounts.sql` | Quiz, Auswertungen, Kontosperre, Einmalpasswörter, RLS |
| `20261113121000_seed_quiz.sql` | Startfragen für das Quiz (57 Punkte) |
| `20261113130000_fix_account_sessions.sql` | Korrektur der Session-Bereinigung beim Deaktivieren/Zurücksetzen |
| `20261114120000_manual_pass_export_delete.sql` | Manuelle Bestehensentscheidung, Löschen von Versuchen und Konten |
| `20261114130000_fix_grade_review.sql` | Manuelle Punkte auch in der Einzelauswertung speichern |

Einspielen:

```powershell
npx supabase link --project-ref zdemeuejvzweilikllef
npx supabase db push --remote
```

### Auth

- E-Mail-Bestätigung kann **aktiviert** bleiben: ein Trigger bestätigt neue
  Auth-Konten automatisch, weil die Anmeldung über den Discord-Namen läuft.
- Site URL: <https://jggaming25.github.io/Befehls-Trainer/>
- Zusätzliche Redirect-URLs für GitHub Pages und `http://localhost:4173`.

### Erster Admin

Nach dem Einspielen der Migrationen ist die Profiltabelle leer. Die **erste
Registrierung** wird durch den Datenbank-Trigger automatisch als Admin
freigeschaltet. Alle weiteren Konten landen als Anfrage im Admin-Bereich.

Falls der erste Admin versehentlich gelöscht wurde, muss das Auth-Konto des
Admins entfernt werden; danach ist die Registrierung wieder für den ersten
Account frei.

## Bedienung als Admin

1. Anmelden → **Admin** in der Kopfzeile
2. **Anfragen:** Annehmen oder Ablehnen (Begründung optional)
3. **Befehle & Felder:** neue Befehle anlegen, Felder mit Optionen und
   Zusatzmaßnahmen pflegen
4. **Situationen:** eigene Lage anlegen; pro Befehl werden die passenden
   Eingabefelder eingeblendet. Angaben und Maßnahmen müssen zusammen genau
   6 Punkte ergeben, damit die Situation insgesamt 10 Punkte liefert.

Generierte Situationen bleiben als Grundstock erhalten. Sobald für einen Befehl
eine eigene Situation existiert, wird sie bei der Auswahl dieses Befehls bevorzugt
verwendet.

## Betriebsregelwerk

Der Tab **Betriebsregelwerk** bettet das freigegebene Google-Dokument ein
(`/preview?embedded=true`). Es wird immer die aktuelle Fassung angezeigt;
Änderungen am Dokument erscheinen ohne Deploy auf der Seite. Während eines
laufenden Quiz ist der Tab gesperrt.

## Quiz und Prüfungen

- **Fragetypen:** Multiple Choice (automatisch), Kurzantwort, Langantwort und
  Befehlserstellung (manuell durch Admins)
- **Punkte und Ergebnis:** Gesamtpunkte, Prozentwert, empfohlene Bestehensgrenze,
  Bewertungsanmerkung und bewertende Person werden in jeder Auswertung angezeigt
- **Bestehensentscheidung:** Die Prozentgrenze (Standard 60 %) ist nur eine
  Empfehlung. Der Admin wählt bei jeder Bewertung verbindlich „Bestanden“ oder
  „Nicht bestanden“; ohne Auswahl wird nicht gespeichert. Bis zur Entscheidung
  zeigt die Auswertung „Entscheidung offen“.
- **Zeitwerte:** Kurzantwort 1,5 Min., Langantwort 4 Min., Multiple Choice
  0,5 Min. (bis 4 Optionen), 1 Min. (bis 10 Optionen), 2 Min. (mehr Optionen).
  Der Admin sieht daraus eine vorgeschlagene Gesamtzeit und kann sie übernehmen
  oder eine eigene Zeit in Minuten setzen.
- **Ein Versuch pro Person:** Admins können einen weiteren Versuch freigeben –
  aber nur, solange kein Versuch aktiv läuft.
- **Speichern beim Verlassen:** Antworten werden laufend gespeichert. Neuladen
  oder Schließen beendet den Versuch und markiert ihn für die Bewertung.
- **Tab-/Browserwechsel:** Nach 20 Sekunden außerhalb erscheint eine Warnung,
  nach 35 Sekunden wird automatisch abgegeben und der Versuch als Auffälligkeit
  markiert. Der Seitentitel zeigt währenddessen „Seite derzeit nicht verfügbar“.
- **Aufbewahrung:** Auswertungen bleiben 12 Wochen nach der Freigabe sichtbar und
  werden danach datensparsam gelöscht (`prune_quiz_attempts`).
- **Prüfungspflicht:** Admins können eine Prüfung mit Frist und Notiz anfordern;
  Betroffene sehen ein Hinweisbanner mit Ausrufezeichen.

### Grenzen der Sperre

Ein Browser kann nicht verhindern, dass eine Person die Seite verlässt und das
Regelwerk in einem anderen Tab oder auf einem anderen Gerät öffnet. Umgesetzt
sind: gesperrter Regelwerk-Tab, gesperrte Navigation, Titelhinweis, Erkennung
von Tab-/Browserwechsel und Fullscreen-Verlassen sowie die automatische Abgabe.
Vollständiger Schutz ist nur mit einer kontrollierten Prüfungsumgebung möglich.

## Konten und Einmalpasswörter

1. Admin → **Konten** → **Passwort zurücksetzen**
2. Der kopierbare Text enthält Website-Link, Discord-Benutzername und ein
   Einmalpasswort
3. Nach der Anmeldung mit dem Einmalpasswort muss sofort ein neues Passwort
   gesetzt werden; alle alten Sitzungen werden beendet
4. **Deaktivieren** sperrt das Konto mit optionalem Grund; die Anmeldung zeigt
   dann nur noch den Hinweis auf Admin Jann (Discord `jlg09`) bzw. den
   DVN-Discord-Staff-Bereich

Kann etwas nicht gespeichert werden, zeigt die Seite denselben Kontakt-Hinweis.

### Konten und Daten löschen

- **Versuch löschen:** Admin → **Bewertungen** → **Löschen** entfernt einen
  einzelnen Versuch samt Antworten und Auswertung.
- **Konto löschen:** Admin → **Konten** → **Konto löschen** entfernt nach
  Eingabe des Discord-Namens das Auth-Konto in Supabase; Profil und alle
  Versuche werden per `on delete cascade` mitgelöscht.
- Das eigene Konto und das letzte verbleibende Admin-Konto können nicht
  gelöscht werden.

### Ergebnis-Export

Admin → **Bewertungen**:
- **Ergebnisse (CSV):** Teilnehmer, Zeiten, Punkte, Prozent, Empfehlung,
  Entscheidung, Auffälligkeit, Anmerkung und Aufbewahrungsdatum
- **Details (CSV):** jede Frage mit Antwort, vergebener Punktzahl und
  Musterlösung bzw. Bewertungshinweis

Die Dateien sind UTF-8 mit BOM und `;` als Trennzeichen, damit sie in deutschen
Excel-Versionen direkt korrekt geöffnet werden.

## Veröffentlichen

1. Änderungen nach `main` pushen.
2. Repository → **Settings → Pages** → „Deploy from a branch“ → `main` / `/ (root)`.
3. URL: <https://jggaming25.github.io/Befehls-Trainer/>

## Projektstruktur

```
index.html                     Grundgerüst, App-Leiste, Modale
assets/config.js               öffentliche Supabase-Konfiguration
assets/data.js                 Befehlskatalog, Auswahlwerte
assets/generator.js            Situationsgenerator (Befehle 1–8)
assets/generator2.js           Generator (9, 21–28), Lauf-Zusammenstellung
assets/scenes.js               SVG-Streckenbilder
assets/app.js                  Auth, Training, Auswertung, Admin
assets/quiz.js                 Regelwerk, Quiz, Anti-Cheat, Kontoseiten
assets/quiz-admin.js           Quizfragen, Bewertung, Einstellungen, Konten
assets/styles.css              Design und responsive Layout
assets/vendor/supabase.js      Supabase JS Client (lokal gehostet)
supabase/migrations/           Datenbankschema, Seeds und Korrekturen
```

## Sicherheit

- Im Frontend steht nur der **Publishable Key**. Der Secret-/Service-Role-Key
  und das Datenbankpasswort dürfen niemals ins Repository.
- RLS schützt Profile und Admin-Inhalte; Schreibzugriffe auf Befehle und
  Situationen sind nur für freigeschaltete Admins erlaubt.
- Lösungen der Quizfragen und Musterlösungen liegen in `quiz_attempt_keys`
  bzw. in der Admin-Sicht `quiz_questions_admin`; Teilnehmer sehen sie nicht.
- Einmalpasswörter werden nur einmal ausgegeben und müssen sofort geändert werden.
- Löschen von Versuchen und Konten läuft über SECURITY-DEFINER-RPCs, die nur
  Admins ausführen dürfen; das eigene Konto und das letzte Admin-Konto sind
  geschützt.
- `.env.local` und Supabase-Temporärdateien sind per `.gitignore` ausgeschlossen.

## Hinweis

Dies ist ein Übungsprojekt und kein offizielles System der DB InfraGO AG.
Befehlsinhalte und Bewertungen sind vereinfacht und ersetzen weder die
einschlägigen Regelwerke noch die betriebliche Ausbildung.
