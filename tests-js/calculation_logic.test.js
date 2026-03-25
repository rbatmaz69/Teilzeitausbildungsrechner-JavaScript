import test from "node:test";
import assert from "node:assert/strict";

await import("../static/script_calculation.js");

const berechneGesamtdauer = globalThis.berechneGesamtdauer;

function defaultGruende(overrides = {}) {
  return {
    abitur: false,
    realschule: false,
    alter_ueber_21: false,
    familien_pflegeverantwortung: false,
    familien_kinderbetreuung: false,
    vorkenntnisse_monate: 0,
    beruf_q1: false,
    beruf_q2: false,
    beruf_q2_dauer_monate: 0,
    beruf_q3: false,
    beruf_q4: false,
    berufliche_verkuerzung_monate: 0,
    ...overrides
  };
}

test("Vollzeit ohne Verkürzung bleibt 36 Monate", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 100,
    verkuerzungsgruende: defaultGruende(),
    eingabetyp: "prozent"
  });

  assert.equal(result.finale_dauer_monate, 36);
  assert.equal(result.verlaengerung_durch_teilzeit_monate, 0);
  assert.equal(result.verkuerzung_gesamt_monate, 0);
});

test("50 Prozent Teilzeit wird bei 1.5x Obergrenze gedeckelt", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 50,
    verkuerzungsgruende: defaultGruende(),
    eingabetyp: "prozent"
  });

  assert.equal(result.finale_dauer_monate, 54);
  assert.equal(result.nach_schritt2_monate, 54);
});

test("Abitur wird mit 12 Monaten Verkürzung berücksichtigt", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 75,
    verkuerzungsgruende: defaultGruende({ abitur: true }),
    eingabetyp: "prozent"
  });

  assert.equal(result.verkuerzung_gesamt_monate, 12);
  assert.equal(result.verkuerzte_dauer_monate, 24);
  assert.equal(result.finale_dauer_monate, 32);
});

test("Realschule liefert 6 Monate Verkürzung", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 75,
    verkuerzungsgruende: defaultGruende({ realschule: true }),
    eingabetyp: "prozent"
  });

  assert.equal(result.verkuerzung_gesamt_monate, 6);
  assert.equal(result.finale_dauer_monate, 40);
  assert.equal(result.regel_8_abs_3_angewendet, false);
});

test("Kombinationen werden auf maximal 12 Monate gedeckelt", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 75,
    verkuerzungsgruende: defaultGruende({
      abitur: true,
      realschule: true,
      alter_ueber_21: true
    }),
    eingabetyp: "prozent"
  });

  assert.equal(result.verkuerzung_gesamt_monate, 12);
  assert.equal(result.finale_dauer_monate, 32);
});

test("Stunden-Input wird korrekt in Prozent umgerechnet", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 30,
    verkuerzungsgruende: defaultGruende(),
    eingabetyp: "stunden"
  });

  assert.equal(result.teilzeit_prozent, 75);
  assert.equal(result.teilzeit_stunden, 30);
  assert.equal(result.finale_dauer_monate, 48);
});

test("Sonderregel §8 Abs. 3 wird bei <= 6 Monaten Überschreitung angewendet", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 85,
    verkuerzungsgruende: defaultGruende(),
    eingabetyp: "prozent"
  });

  assert.equal(result.finale_dauer_monate, 36);
  assert.equal(result.regel_8_abs_3_angewendet, true);
});

test("beruf_q2 Dauer >= 6 und < 12 ergibt 6 Monate", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 75,
    verkuerzungsgruende: defaultGruende({
      beruf_q2: true,
      beruf_q2_dauer_monate: 8
    }),
    eingabetyp: "prozent"
  });

  assert.equal(result.verkuerzung_gesamt_monate, 6);
  assert.equal(result.finale_dauer_monate, 40);
});

test("berufliche_verkuerzung_monate wird bevorzugt", () => {
  const result = berechneGesamtdauer({
    basis_dauer_monate: 36,
    vollzeit_stunden: 40,
    teilzeit_eingabe: 75,
    verkuerzungsgruende: defaultGruende({
      beruf_q1: true,
      berufliche_verkuerzung_monate: 4
    }),
    eingabetyp: "prozent"
  });

  assert.equal(result.verkuerzung_gesamt_monate, 4);
  assert.equal(result.verkuerzte_dauer_monate, 32);
});

test("Ungültige Teilzeit unter 50 Prozent wirft Fehler", () => {
  assert.throws(
    () => berechneGesamtdauer({
      basis_dauer_monate: 36,
      vollzeit_stunden: 40,
      teilzeit_eingabe: 49,
      verkuerzungsgruende: defaultGruende(),
      eingabetyp: "prozent"
    }),
    /zwischen 50% und 100%/
  );
});

test("Ungültiger Eingabetyp wirft Fehler", () => {
  assert.throws(
    () => berechneGesamtdauer({
      basis_dauer_monate: 36,
      vollzeit_stunden: 40,
      teilzeit_eingabe: 80,
      verkuerzungsgruende: defaultGruende(),
      eingabetyp: "foo"
    }),
    /eingabetyp muss/
  );
});
