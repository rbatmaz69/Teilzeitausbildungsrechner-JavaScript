# Teilzeitausbildungsrechner

Browserbasierter Rechner fuer Teilzeitausbildungen gemaess BBiG Paragraph 7a und 8.

## Architektur

Die Anwendung laeuft vollstaendig im Browser:

- Einstiegspunkt: `index.html`
- UI und Interaktion: `static/script_*.js`
- Berechnungslogik (clientseitig): `static/script_calculation.js`
- Styles: `static/styles.css`
- Uebersetzungen: `static/Sprachdateien/messages.*.json`

Es gibt kein Backend und keine API-Calls mehr.

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

## Lokales Starten

Fuer lokale Ausfuehrung kann ein statischer Server genutzt werden:

```bash
npx --yes http-server . -p 8000 -c-1 -s
```

Dann ist die Anwendung unter `http://localhost:8000` erreichbar.

## Deployment

Die App ist fuer statisches Hosting ausgelegt (z. B. GitHub Pages).

Die GitHub-Workflow-Datei `.github/workflows/ci-cd.yml` fuehrt aus:

- Frontend-Lint
- JavaScript-Unit-Tests
- Playwright-E2E-Tests
- Deployment nach GitHub Pages auf `main`

## Hinweise

- Die Berechnung ist eine Orientierungshilfe.
- Rechtlich verbindliche Entscheidungen erfolgen durch Ausbildungsbetrieb und zustaendige Kammer.
