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
- **Admin-Bereich** für Anfragen, Befehle/Eingabefelder und eigene Situationen
  (inkl. Punktevergabe und Bildauswahl)
- **Auswertung:** Befehlswahl 4 P., Angaben und Zusatzmaßnahmen zusammen 6 P.
- Ergebnis- und Gesamtauswertung mit Einzelkriterien und Begründung
- **Keine Speicherung von Trainingsergebnissen:** nur Konten und Admin-Inhalte
  liegen in Supabase; der Trainingszustand bleibt im Browser

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

Einspielen:

```powershell
npx supabase link --project-ref zdemeuejvzweilikllef
npx supabase db push --remote
```

### Auth

- E-Mail-Bestätigung ist **deaktiviert** (`enable_confirmations = false`), weil
  die Anmeldung über den Discord-Namen läuft.
- Site URL: <https://jggaming25.github.io/Befehls-Trainer/>
- Zusätzliche Redirect-URLs für GitHub Pages und `http://localhost:8080`.

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
assets/styles.css              Design und responsive Layout
assets/vendor/supabase.js      Supabase JS Client (lokal gehostet)
supabase/migrations/           Datenbankschema und Befehls-Seed
```

## Sicherheit

- Im Frontend steht nur der **Publishable Key**. Der Secret-/Service-Role-Key
  und das Datenbankpasswort dürfen niemals ins Repository.
- RLS schützt Profile und Admin-Inhalte; Schreibzugriffe auf Befehle und
  Situationen sind nur für freigeschaltete Admins erlaubt.
- `.env.local` und Supabase-Temporärdateien sind per `.gitignore` ausgeschlossen.

## Hinweis

Dies ist ein Übungsprojekt und kein offizielles System der DB InfraGO AG.
Befehlsinhalte und Bewertungen sind vereinfacht und ersetzen weder die
einschlägigen Regelwerke noch die betriebliche Ausbildung.
