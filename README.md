# Teilzeitausbildungsrechner

Browserbasierter Rechner fuer Teilzeitausbildungen gemaess BBiG Paragraph 7a und 8.

## Ueberblick

Die Anwendung laeuft vollstaendig im Browser und benoetigt kein Backend mehr.
Alle Berechnungen werden lokal in JavaScript ausgefuehrt.

## Features

- Vollstaendige Berechnungslogik im Browser (ohne API-Call)
- 9 Sprachen: de, en, uk, tr, ar, fr, ru, pl, ro
- Eingabevalidierung mit unmittelbarer Rueckmeldung
- Ergebnisuebersicht mit Sharing und PDF-Funktionen
- Responsive UI fuer Desktop und Mobile
- Accessibility-Funktionen (z. B. Vorlesen, Theme, Schriftgroesse)

## Architekturueberblick

Die Anwendung laeuft vollstaendig im Browser:

- Einstiegspunkt: `index.html`
- UI und Interaktion: `static/script_*.js`
- Berechnungslogik (clientseitig): `static/script_calculation.js`
- Styles: `static/styles.css`
- Uebersetzungen: `static/Sprachdateien/messages.*.json`

Es gibt kein Backend und keine API-Calls mehr.

## Projektstruktur

```text
.
|- index.html
|- static/
|  |- script_calculation.js
|  |- script_Ergebnis_Uebersicht.js
|  |- script_eingabe.js
|  |- script_Sprache_Auswaehlen.js
|  |- script_sharing.js
|  |- script_accessibility.js
|  |- styles.css
|  `- Sprachdateien/messages.*.json
|- tests-js/
|- e2e/
|- scripts/prepare-pages.mjs
|- scripts/start-local.mjs
`- .github/workflows/ci-cd.yml
```

## Entwicklung

Voraussetzung:

- Node.js 20+

Installation:

```bash
npm install
```

Qualitaetspruefungen:

```bash
npm run lint
npm test
npm run test:e2e
```

## Tests

- `npm run lint`: ESLint, Stylelint, HTMLHint
- `npm test`: JavaScript-Unit-Tests (Node Test Runner)
- `npm run test:e2e`: End-to-End-Tests mit Playwright

Falls E2E lokal mit einer Meldung wie `Executable doesn't exist` fehlschlaegt,
fehlen die Playwright-Browser-Binaries. Einmalig ausfuehren:

```bash
npx playwright install
```

Optional nur Chromium installieren:

```bash
npx playwright install chromium
```

## Lokales Starten

Empfohlen (automatischer Port-Fallback ab 8000):

```bash
npm start
```

Der Startskript prueft Ports ab 8000 und verwendet automatisch den naechsten freien Port.

Optional (fixer Port 8000):

```bash
npm run start:8000
```

Bei `start:8000` kann bei bereits belegtem Port der Fehler `EADDRINUSE` auftreten.
In dem Fall entweder `npm start` nutzen oder einen anderen Port waehlen.

## Deployment

Die App ist fuer statisches Hosting ausgelegt (z. B. GitHub Pages).

Fuer den Publish wird eine saubere Artefakt-Struktur erzeugt:

```bash
npm run build:pages
```

Dabei wird ein schlanker `deploy/`-Ordner erstellt, der nur benoetigte Dateien enthaelt:

- `deploy/index.html`
- `deploy/static/`
- `deploy/.nojekyll`

So werden unnoetige Repository-Dateien (Tests, Konfigurationsdateien, Tooling) nicht mit veroeffentlicht.

Die GitHub-Workflow-Datei `.github/workflows/ci-cd.yml` fuehrt aus:

- Frontend-Lint
- JavaScript-Unit-Tests
- Playwright-E2E-Tests
- Deployment nach GitHub Pages auf `main` (nur bei Push auf `main`)

## Hinweise

- Die Berechnung ist eine Orientierungshilfe.
- Rechtlich verbindliche Entscheidungen erfolgen durch Ausbildungsbetrieb und zustaendige Kammer.
- Der Flyer-Link `Teilzeitausbildung - so geht's (PDF)` wird im Bereich der weiterfuehrenden Informationen angezeigt.
- Bitte den Flyer-Link regelmaessig pruefen und bei einer neuen PDF-Version in `index.html` aktualisieren.
