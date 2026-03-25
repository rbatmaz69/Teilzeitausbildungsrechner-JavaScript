# Berechnungs-Referenz (Frontend)

Diese Anwendung nutzt keine Server-API mehr. Die Berechnung wird direkt im Browser ausgefuehrt.

## Einstiegspunkt

- Datei: `static/script_calculation.js`
- Export: `globalThis.berechneGesamtdauer(payload)`

## Eingabeformat

```json
{
  "basis_dauer_monate": 36,
  "vollzeit_stunden": 40,
  "teilzeit_eingabe": 75,
  "eingabetyp": "prozent",
  "verkuerzungsgruende": {
    "abitur": true,
    "realschule": false,
    "alter_ueber_21": false,
    "familien_kinderbetreuung": false,
    "familien_pflegeverantwortung": false,
    "vorkenntnisse_monate": 0,
    "beruf_q1": false,
    "beruf_q2": false,
    "beruf_q2_dauer_monate": 0,
    "beruf_q3": false,
    "beruf_q4": false,
    "berufliche_verkuerzung_monate": 0
  }
}
```

## Ergebnisformat

```json
{
  "original_dauer_monate": 36,
  "verkuerzte_dauer_monate": 24,
  "teilzeit_prozent": 75,
  "teilzeit_stunden": 30,
  "nach_schritt1_monate": 32,
  "nach_schritt2_monate": 32,
  "finale_dauer_monate": 32,
  "finale_dauer_jahre": 2.7,
  "wochenstunden": 30,
  "verkuerzung_gesamt_monate": 12,
  "verlaengerung_durch_teilzeit_monate": 8,
  "verkuerzung_gesamt_ohne_begrenzung": 12,
  "regel_8_abs_3_angewendet": false
}
```

## Fehlerverhalten

Die Funktion wirft JavaScript-Fehler (`TypeError`/`RangeError`) bei ungueltigen Eingaben, z. B.:

- Ausbildungsdauer ausserhalb 24 bis 42 Monate
- Vollzeitstunden ausserhalb 10 bis 48
- Teilzeit unter 50 Prozent oder ueber 100 Prozent
- ungueltiger `eingabetyp`

## UI-Integration

Die Ergebnisaufbereitung ruft die Funktion in `static/script_Ergebnis_Uebersicht.js` auf und rendert die Rueckgabe direkt in der Oberflaeche.
