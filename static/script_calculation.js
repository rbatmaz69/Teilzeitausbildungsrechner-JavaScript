/* script_calculation.js - Browserseitige Berechnungslogik (1:1 Port aus Python) */

const VERKUERZUNG_ABITUR = 12;
const VERKUERZUNG_REALSCHULE = 6;
const VERKUERZUNG_ALTER_21 = 12;
const VERKUERZUNG_VORKENNTNISSE = 12;
const VERKUERZUNG_KINDERBETREUUNG = 12;
const VERKUERZUNG_FAMILIEN_PFLEGE = 12;

const MAX_GESAMT_VERKUERZUNG_MONATE = 12;
const MIN_TEILZEIT_PROZENT = 50;
const MAX_VERLAENGERUNG_FAKTOR = 1.5;

function ensureNumber(value, typeErrorMessage) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new TypeError(typeErrorMessage);
  }
  return value;
}

function berechneVerkuerzung(basisDauerMonate, verkuerzungsgruende = {}) {
  let verkuerzungGesamt = 0;

  if (verkuerzungsgruende.abitur) {
    verkuerzungGesamt += VERKUERZUNG_ABITUR;
  }
  if (verkuerzungsgruende.realschule) {
    verkuerzungGesamt += VERKUERZUNG_REALSCHULE;
  }
  if (verkuerzungsgruende.alter_ueber_21) {
    verkuerzungGesamt += VERKUERZUNG_ALTER_21;
  }
  if (verkuerzungsgruende.familien_kinderbetreuung) {
    verkuerzungGesamt += VERKUERZUNG_KINDERBETREUUNG;
  }
  if (verkuerzungsgruende.familien_pflegeverantwortung) {
    verkuerzungGesamt += VERKUERZUNG_FAMILIEN_PFLEGE;
  }

  let beruflicheTotal = 0;
  const hasNewBerufFields = [
    "beruf_q1",
    "beruf_q2",
    "beruf_q2_dauer_monate",
    "beruf_q3",
    "beruf_q4",
    "berufliche_verkuerzung_monate"
  ].some((key) => Object.prototype.hasOwnProperty.call(verkuerzungsgruende, key));

  if (hasNewBerufFields) {
    if (Number(verkuerzungsgruende.berufliche_verkuerzung_monate || 0)) {
      beruflicheTotal += Number(verkuerzungsgruende.berufliche_verkuerzung_monate || 0);
    } else {
      if (verkuerzungsgruende.beruf_q1) {
        beruflicheTotal += 12;
      }
      if (verkuerzungsgruende.beruf_q3) {
        beruflicheTotal += 12;
      }
      if (verkuerzungsgruende.beruf_q4) {
        beruflicheTotal += 6;
      }
      if (verkuerzungsgruende.beruf_q2) {
        const d = Number(verkuerzungsgruende.beruf_q2_dauer_monate || 0);
        if (d >= 12) {
          beruflicheTotal += 12;
        } else if (d >= 6) {
          beruflicheTotal += 6;
        }
      }
    }
  } else {
    const vorkenntnisse = Number(verkuerzungsgruende.vorkenntnisse_monate || 0);
    if (vorkenntnisse > 0) {
      beruflicheTotal += VERKUERZUNG_VORKENNTNISSE;
    }
  }

  if (beruflicheTotal) {
    verkuerzungGesamt += beruflicheTotal;
  }

  const verkuerzungFinal = Math.min(verkuerzungGesamt, MAX_GESAMT_VERKUERZUNG_MONATE);
  const verkuerzteDauer = Math.max(basisDauerMonate - verkuerzungFinal, 0);

  return {
    verkuerzteDauer,
    verkuerzungGesamtOhneBegrenzung: verkuerzungGesamt
  };
}

function berechneTeilzeitProzent(vollzeitStunden, teilzeitStunden) {
  return (teilzeitStunden / vollzeitStunden) * 100;
}

function berechneTeilzeitStunden(vollzeitStunden, teilzeitProzent) {
  return vollzeitStunden * (teilzeitProzent / 100);
}

function berechneTeilzeitSchritt1(verkuerzteDauerMonate, teilzeitProzent) {
  return verkuerzteDauerMonate / (teilzeitProzent / 100);
}

function obergrenzeAnwendenSchritt2(verlaengerteDauerMonate, originalAODauerMonate) {
  const obergrenze = originalAODauerMonate * MAX_VERLAENGERUNG_FAKTOR;
  return Math.min(verlaengerteDauerMonate, obergrenze);
}

function rundungAnwendenSchritt3(dauerMonate) {
  return Math.floor(dauerMonate);
}

function berechneGesamtdauer({
  basis_dauer_monate,
  vollzeit_stunden,
  teilzeit_eingabe,
  verkuerzungsgruende,
  eingabetyp = "prozent"
}) {
  const basisDauerMonate = ensureNumber(
    basis_dauer_monate,
    "Ausbildungsdauer muss eine Zahl sein"
  );
  const vollzeitStunden = ensureNumber(
    vollzeit_stunden,
    "Vollzeit-Stunden müssen eine Zahl sein"
  );
  const teilzeitEingabe = ensureNumber(
    teilzeit_eingabe,
    "Teilzeit-Wert muss eine Zahl sein"
  );

  if (basisDauerMonate < 24 || basisDauerMonate > 42) {
    throw new RangeError(
      "Ausbildungsdauer muss zwischen 24 und 42 Monaten liegen (IHK-Ausbildungen)"
    );
  }
  if (vollzeitStunden < 10 || vollzeitStunden > 48) {
    throw new RangeError("Vollzeit-Stunden müssen zwischen 10 und 48 Stunden liegen");
  }

  let teilzeitProzent;
  let teilzeitStunden;

  if (eingabetyp === "prozent") {
    if (teilzeitEingabe < MIN_TEILZEIT_PROZENT || teilzeitEingabe > 100) {
      throw new RangeError(
        `Teilzeit-Anteil muss zwischen ${MIN_TEILZEIT_PROZENT}% und 100% liegen (§ 7a Abs. 1 Satz 3 BBiG)`
      );
    }
    teilzeitProzent = teilzeitEingabe;
    teilzeitStunden = berechneTeilzeitStunden(vollzeitStunden, teilzeitEingabe);
  } else if (eingabetyp === "stunden") {
    const minStunden = vollzeitStunden / 2;
    if (teilzeitEingabe < minStunden) {
      throw new RangeError(
        `Wochenstunden müssen mindestens ${minStunden} Stunden betragen (Hälfte der regulären Wochenstunden, § 7a Abs. 1 Satz 3 BBiG)`
      );
    }
    if (teilzeitEingabe > vollzeitStunden) {
      throw new RangeError(
        `Wochenstunden dürfen die regulären Wochenstunden (${vollzeitStunden}) nicht überschreiten`
      );
    }
    teilzeitProzent = berechneTeilzeitProzent(vollzeitStunden, teilzeitEingabe);
    teilzeitStunden = teilzeitEingabe;
  } else {
    throw new RangeError("eingabetyp muss 'prozent' oder 'stunden' sein");
  }

  const { verkuerzteDauer, verkuerzungGesamtOhneBegrenzung } = berechneVerkuerzung(
    basisDauerMonate,
    verkuerzungsgruende || {}
  );

  const nachSchritt1 = berechneTeilzeitSchritt1(verkuerzteDauer, teilzeitProzent);
  const nachSchritt2 = obergrenzeAnwendenSchritt2(nachSchritt1, basisDauerMonate);
  let finaleDauer = rundungAnwendenSchritt3(nachSchritt2);

  let regel8Abs3Angewendet = false;
  if (verkuerzteDauer === basisDauerMonate && finaleDauer > basisDauerMonate) {
    const differenz = finaleDauer - basisDauerMonate;
    if (differenz <= 6) {
      finaleDauer = basisDauerMonate;
      regel8Abs3Angewendet = true;
    }
  }

  const verkuerzungGesamt = basisDauerMonate - verkuerzteDauer;
  const verlaengerungDurchTeilzeit = finaleDauer - verkuerzteDauer;

  return {
    original_dauer_monate: basisDauerMonate,
    verkuerzte_dauer_monate: verkuerzteDauer,
    teilzeit_prozent: teilzeitProzent,
    teilzeit_stunden: teilzeitStunden,
    nach_schritt1_monate: nachSchritt1,
    nach_schritt2_monate: nachSchritt2,
    finale_dauer_monate: finaleDauer,
    finale_dauer_jahre: Math.round((finaleDauer / 12) * 10) / 10,
    wochenstunden: teilzeitStunden,
    verkuerzung_gesamt_monate: verkuerzungGesamt,
    verlaengerung_durch_teilzeit_monate: verlaengerungDurchTeilzeit,
    verkuerzung_gesamt_ohne_begrenzung: verkuerzungGesamtOhneBegrenzung,
    regel_8_abs_3_angewendet: regel8Abs3Angewendet
  };
}

globalThis.berechneGesamtdauer = berechneGesamtdauer;
