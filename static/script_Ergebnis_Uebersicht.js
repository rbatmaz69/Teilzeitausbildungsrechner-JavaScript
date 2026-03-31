/* global uebersetzung, aktuelleSprache */
/* script_Ergebnis_Übersicht.js – i18n-fähige Ergebnislogik */

// Kurz-Helfer
// DOM-Helfer: Kurzer Shortcut für `document.querySelector`
// Erhöht Lesbarkeit in kleinen UI-Helper-Funktionen.
const $ = (selektor) => document.querySelector(selektor);
// Schreibt `text` in das gefundene Element; ignoriert, falls Element fehlt.
function setzeText(selektor, text) {
  const element = $(selektor);
  if (element) element.textContent = text;
}

// Verbirgt ein Element auf eine A11Y-freundliche Weise (z.B. mit aria-hidden).
function verberge(element) {
  if (element) element.hidden = true;
}

function setzeErgebnisBegleitUIVisible(visible) {
  const notesContainer = document.getElementById("notes-container") || document.querySelector(".rechner-column.notes-column");
  if (notesContainer) notesContainer.hidden = !visible;

  const btnShare = document.getElementById("btn-share");
  if (btnShare) btnShare.hidden = !visible;
}


// Formatiert Zahl + Einheit als HTML, setzt Richtung so dass in RTL die Einheit rechts steht.
function formatValueUnitHtml(value, unitKey) {
  const unit = uebersetzung(unitKey) || "";
  // Einheitendarstellung einfach halten; das Wrapper-Element erzwingt die LTR-Reihenfolge
  // const dir = document.documentElement.getAttribute("dir") || "ltr";
  const numHtml = `<span class="i18n-num" dir="ltr">${String(value)}</span>`;
  const unitHtml = `<span class="i18n-unit" dir="auto">${String(unit)}</span>`;
  // Wrap both in an explicit LTR container so the internal order is always "number then unit".
  // Use a normal space (not &nbsp;) so the browser can break the line between number and unit if needed
  // when the unit would overflow the container (helps on mobile with large text sizes).
  return `<span class="i18n-value-unit" dir="ltr">${numHtml} ${unitHtml}</span>`;
}

// Locale-aware Zahl parser: akzeptiert deutsches Komma und (optional) Tausenderpunkte.
// Beispiele:
// - "1,5" -> 1.5
// - "1.234,5" -> 1234.5
const parseNumber = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;

  // Spaces entfernen (inkl. NBSP)
  let normalized = raw.replace(/[\s\u00A0]/g, "");

  // Wenn ein Komma vorkommt, behandeln wir Punkte als Tausendertrennzeichen
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "");
    normalized = normalized.replace(/,/g, ".");
  }

  return parseFloat(normalized);
};


// Zustand merken, damit wir bei Sprachwechsel neu rendern können
let LETZTE_EINGABEN = null;
let LETZTE_BERECHNUNG = null;

// Desktop-only Button-Layout (ohne Mobile zu verändern)
let DESKTOP_BUTTON_LAYOUT = null;

function initialisiereDesktopButtonLayout() {
  // Nutzt bestehenden Desktop-Breakpoint aus CSS (@media (width >= 900px))
  const mq = window.matchMedia("(min-width: 900px)");

  const actionbar = document.querySelector("nav.actionbar.rechner-bereich");
  const btnReset = document.getElementById("btn-reset");
  const btnShare = document.getElementById("btn-share");
  const btnBerechnen = document.getElementById("berechnenBtn");
  const vkActions = document.querySelector(".vk-actions");
  const notesColumn = document.querySelector(".rechner-column.notes-column");

  if (!actionbar || !btnReset || !btnBerechnen || !vkActions || !notesColumn) {
    return;
  }

  // Initiale State/Platzhalter nur einmal anlegen
  if (!DESKTOP_BUTTON_LAYOUT) {
    const resetPlaceholder = document.createComment("placeholder:btn-reset");
    const sharePlaceholder = btnShare ? document.createComment("placeholder:btn-share") : null;
    const berechnenPlaceholder = document.createComment("placeholder:berechnenBtn");

    // Platzhalter an den Originalpositionen setzen
    actionbar.insertBefore(resetPlaceholder, btnReset);
    if (btnShare && sharePlaceholder) {
      actionbar.insertBefore(sharePlaceholder, btnShare);
    }
    vkActions.insertBefore(berechnenPlaceholder, btnBerechnen);

    DESKTOP_BUTTON_LAYOUT = {
      mq,
      actionbar,
      vkActions,
      notesColumn,
      btnReset,
      btnShare,
      btnBerechnen,
      resetPlaceholder,
      sharePlaceholder,
      berechnenPlaceholder,
      actionsGroup: null,
      shareMount: null,
      listenerAttached: false
    };
  }

  const applyLayout = (isDesktop) => {
    const layout = DESKTOP_BUTTON_LAYOUT;
    if (!layout) return;

    if (isDesktop) {
      // 1) Reset links neben Ergebnis anzeigen in derselben Spalte
      if (!layout.actionsGroup) {
        const group = document.createElement("div");
        group.className = "button-group desktop-calc-actions";
        layout.actionsGroup = group;
      }

      if (layout.actionsGroup.parentNode !== layout.vkActions) {
        layout.vkActions.appendChild(layout.actionsGroup);
      }

      // Reihenfolge: Reset links, Berechnen rechts
      if (layout.btnBerechnen.parentNode !== layout.actionsGroup) {
        layout.actionsGroup.appendChild(layout.btnBerechnen);
      }
      if (layout.btnReset.parentNode !== layout.actionsGroup) {
        layout.actionsGroup.insertBefore(layout.btnReset, layout.btnBerechnen);
      } else {
        layout.actionsGroup.insertBefore(layout.btnReset, layout.btnBerechnen);
      }

      // 2) Share in die Hinweise-Spalte verschieben (falls vorhanden)
      if (layout.btnShare) {
        const notesCard = layout.notesColumn.querySelector(":scope > .card");
        if (notesCard) {
          if (!layout.shareMount) {
            const mount = document.createElement("div");
            mount.className = "desktop-share-action";
            layout.shareMount = mount;
          }

          // Direkt nach der Card einfügen
          if (layout.shareMount.parentNode !== layout.notesColumn) {
            layout.notesColumn.insertBefore(layout.shareMount, notesCard.nextSibling);
          } else if (notesCard.nextSibling !== layout.shareMount) {
            layout.notesColumn.insertBefore(layout.shareMount, notesCard.nextSibling);
          }

          if (layout.btnShare.parentNode !== layout.shareMount) {
            layout.shareMount.appendChild(layout.btnShare);
          }
        }
      }

      // Actionbar auf Desktop ausblenden, damit sie nicht leer bleibt
      layout.actionbar.dataset.desktopMoved = "true";
    } else {
      // Mobile: alles exakt zurück in den Originalzustand

      // Berechnen wieder direkt in .vk-actions (ohne Desktop-Wrapper)
      if (layout.berechnenPlaceholder.parentNode === layout.vkActions) {
        layout.vkActions.insertBefore(layout.btnBerechnen, layout.berechnenPlaceholder.nextSibling);
      }

      if (layout.actionsGroup && layout.actionsGroup.parentNode) {
        layout.actionsGroup.parentNode.removeChild(layout.actionsGroup);
      }
      layout.actionsGroup = null;

      // Reset/Share zurück in die Actionbar
      if (layout.resetPlaceholder.parentNode === layout.actionbar) {
        layout.actionbar.insertBefore(layout.btnReset, layout.resetPlaceholder.nextSibling);
      }
      if (layout.btnShare && layout.sharePlaceholder && layout.sharePlaceholder.parentNode === layout.actionbar) {
        layout.actionbar.insertBefore(layout.btnShare, layout.sharePlaceholder.nextSibling);
      }

      if (layout.shareMount && layout.shareMount.parentNode) {
        layout.shareMount.parentNode.removeChild(layout.shareMount);
      }
      layout.shareMount = null;

      delete layout.actionbar.dataset.desktopMoved;
    }
  };

  // Initial anwenden
  applyLayout(mq.matches);

  // Listener nur einmal registrieren
  if (!DESKTOP_BUTTON_LAYOUT.listenerAttached) {
    DESKTOP_BUTTON_LAYOUT.listenerAttached = true;
    mq.addEventListener("change", (event) => {
      applyLayout(event.matches);
    });
  }
}

/**
 * Sammelt alle Verkürzungsgründe und gibt sie als Objekt zurück,
 * das direkt an das Backend geschickt werden kann.
 */
function collectVerkuerzungsgruende() {
  const result = {
    abitur: false,
    realschule: false,
    alter_ueber_21: false,
    familien_kinderbetreuung: false,
    familien_pflegeverantwortung: false,
    vorkenntnisse_monate: 0,
    // Neue berufliche Fragen
    beruf_q1: false,
    beruf_q2: false,
    beruf_q2_dauer_monate: 0,
    beruf_q3: false,
    beruf_q4: false,
    berufliche_verkuerzung_monate: 0
  };


  // 1) Alle Checkbox-Kacheln mit data-vk-field
  const checkboxInputs = document.querySelectorAll(
    '#vk-fieldset input[type="checkbox"][data-vk-field]'
  );

  checkboxInputs.forEach((input) => {
    if (!input.checked) return;

    const field = input.dataset.vkField;
    const months = Number(input.dataset.vkMonths || 0);

    if (field === "vorkenntnisse_monate") {
      // mehrere Kacheln könnten Monate addieren
      result.vorkenntnisse_monate += months;
    } else {
      // boolsche Flags
      result[field] = true;
    }
  });

  // 2) Schulabschluss-Select (Single-Choice)
  const schoolSelect = document.querySelector('select[data-vk-type="school-select"]');
  if (schoolSelect) {
    const selectedOption = schoolSelect.selectedOptions[0];
    if (selectedOption) {
      const fields = (selectedOption.dataset.vkSetFields || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      fields.forEach((f) => {
        if (f in result) {
          result[f] = true;
        } else {
          // falls Backend später neue Felder erwartet
          result[f] = true;
        }
      });
    }
  }

  // 3) Alter über 21
  const alterInput = document.getElementById("alter");
  if (alterInput) {
    const alterInt = parseInt(alterInput.value);
    if (!isNaN(alterInt) && alterInt >= 21) {
      result.alter_ueber_21 = true;
    }
  }

  // 4) Neue berufliche Fragen (Ja/Nein und Dauer für Q2)
  try {
    const q1 = document.getElementById('vk_beruf_q1_ja');
    const q2 = document.getElementById('vk_beruf_q2_ja');
    const q2dur = document.getElementById('vk_beruf_q2_dauer_months');
    const q3 = document.getElementById('vk_beruf_q3_ja');
    const q4 = document.getElementById('vk_beruf_q4_ja');

    if (q1 && q1.checked) result.beruf_q1 = true;
    if (q2 && q2.checked) result.beruf_q2 = true;
    if (q3 && q3.checked) result.beruf_q3 = true;
    if (q4 && q4.checked) result.beruf_q4 = true;

    // Q2 Dauer verarbeiten (nur wenn Q2 ausgewählt)
    if (result.beruf_q2 && q2dur) {
      const dur = parseInt(q2dur.value);
      result.beruf_q2_dauer_monate = isNaN(dur) ? 0 : Math.max(0, dur);
    }

    // Berufliche Verkürzung nach Regeln: Q1/Q3 -> 12, Q6 -> 6, Q2 -> mapping
    let berufMonate = 0;
    if (result.beruf_q1) berufMonate += 12;
    if (result.beruf_q3) berufMonate += 12;
    if (result.beruf_q4) berufMonate += 6;
    if (result.beruf_q2) {
      const d = result.beruf_q2_dauer_monate || 0;
      if (d >= 12) berufMonate += 12;
      else if (d >= 6) berufMonate += 6;
      // <6 => 0
    }

    // Legacy: falls vorkenntnisse_monate gesetzt (alte UI), mappe >0 -> 12
    if (result.vorkenntnisse_monate && result.vorkenntnisse_monate > 0) {
      berufMonate += 12;
    }

    result.berufliche_verkuerzung_monate = berufMonate;
  } catch (e) {
    // Falls DOM-Elemente fehlen, ignoriere silently (backwards compatible)
    console.warn('Fehler beim Lesen beruflicher Fragen', e);
  }

  return result;
}

/**
 * Holt die Berechnungsergebnisse vom Backend.
 *
 * Sammelt Formularwerte, sendet sie an den API-Endpunkt und normalisiert
 * das Ergebnis für die tabellarische Darstellung.
 */
/**
 * Validiert alle Eingabefelder und gibt Fehler aus wenn Felder leer sind.
 * Scrollt zum ersten Fehler und hebt ihn hervor.
 * @returns {boolean} true wenn alle Felder gültig sind, false sonst
 */
function validiereAlleEingaben() {
  // Alle Fehler-Markierungen entfernen
  document.querySelectorAll("input, .vk-yes-no-group").forEach(el => {
    el.classList.remove("error");
  });
  document.querySelectorAll(".error-message, .error-message-ja-nein").forEach(el => {
    el.textContent = "";
  });

  // Erforderliche Eingabefelder (number inputs)
  const erforderlicheFelder = [
    { id: "dauer", label: "Reguläre Ausbildungsdauer" },
    { id: "stunden", label: "Reguläre Wochenstunden" }
  ];

  // Ja/Nein Gruppen (mind. eine Antwort pro Frage)
  const jaNeineGruppen = [
    { ja: "abitur-ja", nein: "abitur-nein", label: "Schulabschluss" },
    { ja: "realschule-ja", nein: "realschule-nein", label: "Realschule" },
    { ja: "kinderbetreuung-ja", nein: "kinderbetreuung-nein", label: "Kinderbetreuung" },
    { ja: "pflege-ja", nein: "pflege-nein", label: "Pflege von Angehörigen" },
    { ja: "vk_beruf_q1_ja", nein: "vk_beruf_q1_nein", label: "Abgeschlossene Ausbildung" },
    { ja: "vk_beruf_q2_ja", nein: "vk_beruf_q2_nein", label: "Nicht abgeschlossene Ausbildung" },
    { ja: "vk_beruf_q3_ja", nein: "vk_beruf_q3_nein", label: "Praktische Erfahrung" },
    { ja: "vk_beruf_q4_ja", nein: "vk_beruf_q4_nein", label: "ECTS-Punkte im Studium" }
  ];

  let ersterFehler = null;

  // 1. Prüfe erforderliche Felder
  for (const feld of erforderlicheFelder) {
    const element = document.getElementById(feld.id);
    if (!element) continue;

    const wert = element.value?.trim();
    const zahl = parseNumber(wert);
    if (!wert || wert === "" || zahl === 0 || isNaN(zahl)) {
      element.classList.add("error");
      const errorId = "error" + feld.id.charAt(0).toUpperCase() + feld.id.slice(1);
      const errorElement = document.getElementById(errorId);
      if (errorElement) {
        errorElement.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }
      if (!ersterFehler) ersterFehler = element;
    }
  }

  // 2. Wenn Wochenstunden gesetzt sind, aber Teilzeitfelder leer, zeige Fehler
  const wochenstundenElement = document.getElementById("stunden");
  const teilzeitStundenElement = document.getElementById("teilzeitStunden");
  const teilzeitProzentElement = document.getElementById("teilzeitProzent");
  
  if (wochenstundenElement && teilzeitStundenElement && teilzeitProzentElement) {
    const wochenstunden = wochenstundenElement.value?.trim();
    const teilzeitStunden = teilzeitStundenElement.value?.trim();
    const teilzeitProzent = teilzeitProzentElement.value?.trim();
    
    // Wenn Wochenstunden gesetzt sind UND beide Teilzeitfelder leer sind
    const wochenstundenZahl = parseNumber(wochenstunden);
    if (wochenstunden && wochenstunden !== "" && wochenstundenZahl > 0 && 
        (!teilzeitStunden || teilzeitStunden === "") && (!teilzeitProzent || teilzeitProzent === "")) {
      
      // Fehler für Teilzeit-Stunden
      teilzeitStundenElement.classList.add("error");
      const errorTeilStunden = document.getElementById("errorTeilStunden");
      if (errorTeilStunden) {
        errorTeilStunden.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }
      if (!ersterFehler) ersterFehler = teilzeitStundenElement;
      
      // Fehler für Teilzeit-Prozent
      teilzeitProzentElement.classList.add("error");
      const errorProzent = document.getElementById("errorProzent");
      if (errorProzent) {
        errorProzent.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }
    }
  }

  // 3. Alter separat nach Teilzeit prüfen
  const alterElement = document.getElementById("alter");
  if (alterElement) {
    const alterWert = alterElement.value?.trim();
    const alterZahl = parseNumber(alterWert);
    if (!alterWert || alterWert === "" || alterZahl === 0 || isNaN(alterZahl)) {
      alterElement.classList.add("error");
      const errorAlter = document.getElementById("errorAlter");
      if (errorAlter) {
        errorAlter.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }
      if (!ersterFehler) ersterFehler = alterElement;
    }
  }

  // 4. Prüfe Ja/Nein Gruppen
  for (const gruppe of jaNeineGruppen) {
    const jaElement = document.getElementById(gruppe.ja);
    const neinElement = document.getElementById(gruppe.nein);

    if (!jaElement || !neinElement) continue;

    const jaChecked = jaElement.checked;
    const neinChecked = neinElement.checked;

    if (!jaChecked && !neinChecked) {
      // Beide sind nicht ausgewählt → Fehler
      // Markiere das tile-Label, nicht das checkbox
      const jaLabel = jaElement.closest(".tile");
      const neinLabel = neinElement.closest(".tile");
      
      if (jaLabel) jaLabel.classList.add("error");
      if (neinLabel) neinLabel.classList.add("error");

      // Fehlermeldung unter der Gruppe anzeigen
      // Finde die vk-yes-no-group und füge die Fehlermeldung danach ein
      const yesNoGroup = jaElement.closest(".vk-yes-no-group");
      if (yesNoGroup) {
        let errorElement = yesNoGroup.nextElementSibling;
        // Prüfe ob bereits eine error-message vorhanden ist
        if (!errorElement || !errorElement.classList.contains("error-message-ja-nein")) {
          errorElement = document.createElement("span");
          errorElement.className = "error-message error-message-ja-nein";
          yesNoGroup.parentNode.insertBefore(errorElement, yesNoGroup.nextSibling);
        }
        errorElement.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }

      if (!ersterFehler) ersterFehler = jaElement;
    }
  }

  // 5. Wenn Q2 "Ja" ist, prüfe ob Dauer eingegeben wurde
  const berufQ2Ja = document.getElementById("vk_beruf_q2_ja");
  const berufQ2Duration = document.getElementById("vk_beruf_q2_dauer_months");
  if (berufQ2Ja && berufQ2Ja.checked && berufQ2Duration) {
    const dauer = berufQ2Duration.value?.trim();
    const dauerZahl = parseNumber(dauer);
    if (!dauer || dauer === "" || dauerZahl === 0 || isNaN(dauerZahl)) {
      berufQ2Duration.classList.add("error");
      const errorElement = document.getElementById("errorBerufQ2Dauer");
      if (errorElement) {
        errorElement.textContent = uebersetzung("validation.required", "Dieses Feld ist erforderlich");
      }
      if (!ersterFehler) ersterFehler = berufQ2Duration;
    }
  }

  // 6. Wenn Fehler vorhanden, zum ersten Fehler scrollen (gleiche Logik wie "Zum Rechner" Button)
  if (ersterFehler) {
    setTimeout(() => {
      const elementTop = ersterFehler.getBoundingClientRect().top + window.pageYOffset;
      const offset = 70; // Offset für Tooltip + Abstand oben
      const targetScrollY = elementTop - offset;
      
      // Manuelle Scroll-Animation für langsames, sichtbares Scrollen
      const startY = window.pageYOffset;
      const distance = targetScrollY - startY;
      const duration = 1000; // 1 Sekunde für langsames Scrollen
      let startTime = null;
      
      const easeInOutQuad = (t) => {
        // Easing-Funktion für sanfte Animation
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      };
      
      const animateScroll = (currentTime) => {
        if (startTime === null) startTime = currentTime;
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const ease = easeInOutQuad(progress);
        const currentY = startY + distance * ease;
        
        window.scrollTo(0, currentY);
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          ersterFehler.focus();
        }
      };
      
      requestAnimationFrame(animateScroll);
    }, 50);
    return false;
  }

  return true;
}

async function holeZusammenfassung() {
  const basisMonateElement = document.getElementById("dauer");
  const wochenstundenElement = document.getElementById("stunden");
  const prozentElement = document.getElementById("teilzeitProzent");

  const basisMonate = parseNumber(basisMonateElement?.value || 0);
  const wochenstunden = parseNumber(wochenstundenElement?.value || 0);
  const teilzeitProzent = parseNumber(prozentElement?.value || 0);

  const verkuerzungsgruende = collectVerkuerzungsgruende();  

  const nutzdaten = {
    basis_dauer_monate: basisMonate,
    vollzeit_stunden: wochenstunden,
    teilzeit_eingabe: teilzeitProzent,
    eingabetyp: "prozent",
    verkuerzungsgruende
  };

  if (typeof window.berechneGesamtdauer !== "function") {
    throw new Error(uebersetzung("errors.fetch", "Fehler beim Laden der Daten"));
  }

  let ergebnis;
  try {
    ergebnis = window.berechneGesamtdauer(nutzdaten);
  } catch (error) {
    const nachricht =
      error && error.message
        ? String(error.message)
        : uebersetzung("errors.fetch", "Fehler beim Laden der Daten");
    throw new Error(nachricht);
  }

  const gesamtMonate = Number(ergebnis.finale_dauer_monate || 0);
  const verlaengerungMonate = Number(ergebnis.verlaengerung_durch_teilzeit_monate || 0);
  const gesamteVerkuerzungMonate = Number(ergebnis.verkuerzung_gesamt_monate || 0);
  const gesamteVerkuerzungMonateOhneBegrenzung = Number(ergebnis.verkuerzung_gesamt_ohne_begrenzung || 0);
  const neueBasis = Number(ergebnis.verkuerzte_dauer_monate || 0);
  const regel8Abs3Angewendet = Boolean(ergebnis.regel_8_abs_3_angewendet || false);

  // Anzeige-Liste der gewählten Verkürzungsgründe aus dem Objekt bauen
  // Reihenfolge entspricht der visuellen Reihenfolge der Fragen im Formular
  const verkuerzungen = [];

  // 1) Schulabschluss (Select: Reihenfolge in Select beachten)
  if (verkuerzungsgruende.realschule) {
    verkuerzungen.push({ key: "realschule", months: 6 });
  }
  if (verkuerzungsgruende.abitur) {
    verkuerzungen.push({ key: "abitur", months: 12 });
  }

  // 2) Alter über 21
  if (verkuerzungsgruende.alter_ueber_21) {
    verkuerzungen.push({ key: "alter_ueber_21", months: 12 });
  }

  // 3) (Legacy) Vorkenntnisse (falls gesetzt)
  if (verkuerzungsgruende.vorkenntnisse_monate && verkuerzungsgruende.vorkenntnisse_monate > 0) {
    verkuerzungen.push({
      key: "vorkenntnisse",
      months: verkuerzungsgruende.vorkenntnisse_monate
    });
  }

  // 4) Familiäre Gründe: Kinderbetreuung zuerst, dann Pflege
  if (verkuerzungsgruende.familien_kinderbetreuung) {
    verkuerzungen.push({ key: "familien_kinderbetreuung", months: 12 });
  }
  if (verkuerzungsgruende.familien_pflegeverantwortung) {
    verkuerzungen.push({ key: "familien_pflegeverantwortung", months: 12 });
  }

  // 5) Berufliche Qualifikationen (sichtbar in dieser Reihenfolge in der UI):
  // q1, q2, q3, q5 (in der Qualifikationen-Box), danach q4 und q6 (in Bildungsweg-Box)
  if (verkuerzungsgruende.beruf_q1) {
    verkuerzungen.push({ key: "beruf_q1", months: 12 });
  }
  if (verkuerzungsgruende.beruf_q2) {
    // Berechne Months für Q2: <6 -> 0, 6-11 -> 6, >=12 -> 12
    const d = Number(verkuerzungsgruende.beruf_q2_dauer_monate || 0);
    let m = 0;
    if (d >= 12) m = 12;
    else if (d >= 6) m = 6;
    if (m > 0) verkuerzungen.push({ key: "beruf_q2", months: m });
  }
  if (verkuerzungsgruende.beruf_q3) {
    verkuerzungen.push({ key: "beruf_q3", months: 12 });
  }
  if (verkuerzungsgruende.beruf_q4) {
    verkuerzungen.push({ key: "beruf_q4", months: 6 });
  }

  return {
    eingaben: {
      basisMonate,
      wochenstunden,
      teilzeitProzent,
      verkuerzungen
    },
    berechnung: {
      verlaengerungMonate,
      gesamteVerkuerzungMonate,
      gesamteVerkuerzungMonateOhneBegrenzung,
      neueBasis,
      gesamtMonate,
      gesamtJahre: Math.round((gesamtMonate / 12) * 10) / 10,
      regel8Abs3Angewendet
    }
  };
}

/**
 * Füllt die Übersichtstabelle der Eingaben (mit i18n).
 *
 * @param {Object} eingaben - Vorverarbeitete Eingabewerte aus holeZusammenfassung().
 * @param {Object} berechnung - Berechnungsergebnisse zur Darstellung der Verkürzungen.
 */
function fuelleEingabenliste(eingaben, berechnung) {
  const liste = $("#inputs-list");
  if (!liste) return;
  
  // Prüfe zuerst, ob wir überhaupt Daten haben
  // Wenn keine Daten vorhanden sind, nicht leeren (behalte bestehenden Inhalt)
  if (!eingaben || !berechnung) {
    return;
  }
  
  // Prüfe auch, ob die notwendigen Eigenschaften vorhanden sind
  if (typeof eingaben.basisMonate === 'undefined' || 
      typeof eingaben.wochenstunden === 'undefined' || 
      typeof eingaben.teilzeitProzent === 'undefined' ||
      typeof berechnung.gesamtMonate === 'undefined') {
    return;
  }
  
  // Jetzt können wir sicher leeren, da wir vollständige Daten haben
  liste.innerHTML = "";

  // Teilzeit-Stunden berechnen
  const teilzeitStunden = Math.round((eingaben.wochenstunden * eingaben.teilzeitProzent) / 100);

  const zeilen = [
    [
      uebersetzung("inputs.dauer.labelShort", "Ausbildung (Vollzeit)"),
      { type: 'valueUnit', value: eingaben.basisMonate, unitKey: 'units.months.short' }
    ],
    [
      uebersetzung("inputs.stunden.labelShort", "Wochenstunden (Vollzeit)"),
      { type: 'valueUnit', value: eingaben.wochenstunden, unitKey: 'units.hours.short' }
    ],
    [
      uebersetzung("inputs.teilzeit.labelShort", "Teilzeit"),
      { type: 'percentCompare', percent: eingaben.teilzeitProzent, compareValue: teilzeitStunden, unitKey: 'units.hours.short' }
    ]
  ];

  for (const [schluessel, wert] of zeilen) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = schluessel;
    const dd = document.createElement("dd");
    if (typeof wert === 'object' && wert.type === 'valueUnit') {
      dd.innerHTML = formatValueUnitHtml(wert.value, wert.unitKey);
    } else if (typeof wert === 'object' && wert.type === 'percentCompare') {
      const percent = String(wert.percent) + "%";
      const compareHtml = formatValueUnitHtml(wert.compareValue, wert.unitKey);
      // Beispiel: "60% ↔ 24 س" — Prozent links, dann Pfeil, dann Zahl+Einheit
      dd.innerHTML = `${percent} ↔ ${compareHtml}`;
    } else {
      dd.textContent = String(wert);
    }
    wrapper.append(dt, dd);
    liste.append(wrapper);
  }

  // Verkürzungen hinzufügen (immer anzeigen, auch wenn keine vorhanden)
  const verkuerzungen = Array.isArray(eingaben.verkuerzungen)
    ? eingaben.verkuerzungen
    : [];
  
  if (berechnung) {
    const verkuerzungenWrapper = document.createElement("div");
    const verkuerzungenDt = document.createElement("dt");
    verkuerzungenDt.className = "verkuerzungen-label";
    verkuerzungenDt.textContent = uebersetzung("inputs.verkuerzungen.labelShort", "Verkürzungen");
    
    const verkuerzungenDd = document.createElement("dd");
    verkuerzungenDd.className = "verkuerzungen-content";
    
    // Warnhinweis-Element erstellen (wird später ggf. verwendet)
    const warnhinweis = document.createElement("p");
    warnhinweis.className = "error-message verkuerzungen-warning";
    warnhinweis.id = "errorVerkuerzungenInListe";
    warnhinweis.style.display = "none";
    
    if (verkuerzungen.length > 0) {
      // Liste der Verkürzungsgründe
      const verkuerzungenListe = document.createElement("ul");
      verkuerzungenListe.className = "verkuerzungen-list";

  verkuerzungen.forEach((verkuerzung) => {
    const li = document.createElement("li");
    // Label aus i18n je Key
    let beschriftungsSchluessel;
    switch (verkuerzung.key) {
      case "abitur":
          beschriftungsSchluessel = "vk.school.abitur";
        break;
      case "realschule":
          beschriftungsSchluessel = "vk.school.realschule";
        break;
      case "alter_ueber_21":
        beschriftungsSchluessel = "vk.alter21.label";
        break;
      case "vorkenntnisse":
        beschriftungsSchluessel = "vk.vork.label";
        break;
      case "familien_pflegeverantwortung":
        beschriftungsSchluessel = "vk.familie.label_pflege";
        break;
      case "familien_kinderbetreuung":
        beschriftungsSchluessel = "vk.familie.label_kinder";
        break;
      // Berufliche Fragen (kurze Zusammenfassung für Ergebnisse)
      case "beruf_q1":
        beschriftungsSchluessel = "vk.qual.abgeschlosseneAusbildung_short";
        break;
      case "beruf_q2":
        beschriftungsSchluessel = "vk.qual.nichtAbgeschlosseneAusbildung_short";
        break;
      case "beruf_q3":
        beschriftungsSchluessel = "vk.qual.praktischeErfahrung_short";
        break;
      case "beruf_q4":
        beschriftungsSchluessel = "vk.qual.ectsStudium_short";
        break;
      default:
        beschriftungsSchluessel = "";
    }
    const beschriftung = beschriftungsSchluessel
      ? uebersetzung(beschriftungsSchluessel, verkuerzung.key)
      : verkuerzung.key || "";
      
      // Strukturiertes Format: Label und Wert in separaten Spans
      if (verkuerzung.months) {
        const labelSpan = document.createElement("span");
        labelSpan.className = "verkuerzung-label";
        labelSpan.textContent = `${beschriftung}:`;
        
        const valueSpan = document.createElement("span");
        valueSpan.className = "verkuerzung-value";
        valueSpan.classList.add("bidi-ltr");
        valueSpan.setAttribute("dir", "ltr");
        // Einheitlich vollständige Form "Monate" für alle Geräte
        valueSpan.innerHTML = formatValueUnitHtml(verkuerzung.months, "units.months.short");
        
        li.appendChild(labelSpan);
        li.appendChild(valueSpan);
      } else {
        li.textContent = beschriftung;
      }
      verkuerzungenListe.appendChild(li);
    });
    
      verkuerzungenDd.appendChild(verkuerzungenListe);
      verkuerzungenDd.appendChild(warnhinweis);
    } else {
      // Keine Verkürzungen ausgewählt
      const keineVerkuerzung = document.createElement("p");
      keineVerkuerzung.className = "keine-verkuerzung";
      keineVerkuerzung.textContent = uebersetzung("inputs.noShortening", "Keine Verkürzung ausgewählt");
      verkuerzungenDd.appendChild(keineVerkuerzung);
    }
    
    verkuerzungenWrapper.append(verkuerzungenDt, verkuerzungenDd);
    liste.append(verkuerzungenWrapper);
    
    // Zusätzliche Berechnungen hinzufügen
    const nachVerkuerzungBeschriftung = uebersetzung("inputs.afterShortening", "Ausbildungsdauer nach Verkürzung");
    const nachVerkuerzungWrapper = document.createElement("div");
    const nachVerkuerzungDt = document.createElement("dt");
    nachVerkuerzungDt.textContent = nachVerkuerzungBeschriftung;
    const nachVerkuerzungDd = document.createElement("dd");
    nachVerkuerzungDd.classList.add("bidi-ltr");
    nachVerkuerzungDd.setAttribute("dir", "ltr");
    nachVerkuerzungDd.innerHTML = formatValueUnitHtml(berechnung.neueBasis, "units.months.short");
    nachVerkuerzungWrapper.append(nachVerkuerzungDt, nachVerkuerzungDd);
    liste.append(nachVerkuerzungWrapper);
    
    const inTeilzeitBeschriftung = uebersetzung("inputs.inPartTime", "Ausbildungsdauer in Teilzeit");
    const inTeilzeitWrapper = document.createElement("div");
    const inTeilzeitDt = document.createElement("dt");
    inTeilzeitDt.textContent = inTeilzeitBeschriftung;
    const inTeilzeitDd = document.createElement("dd");
    inTeilzeitDd.className = "teilzeit-formular";
    
    // Strukturiertes Format: Formel in separaten Elementen für Mobile/Desktop
    const formulaContainer = document.createElement("div");
    formulaContainer.className = "teilzeit-formula-container bidi-ltr";
    formulaContainer.setAttribute("dir", "ltr");
    
    // Zeile 1: "24 Monate / 75%"
    const formulaLine1 = document.createElement("span");
    formulaLine1.className = "teilzeit-formula-line1 bidi-ltr";
    formulaLine1.setAttribute("dir", "ltr");
    formulaLine1.textContent = `${berechnung.neueBasis} ${uebersetzung("units.months.short")} / ${eingaben.teilzeitProzent}%`;
    
    // Zeile 2: "= 48 Monate"
    const formulaLine2 = document.createElement("span");
    formulaLine2.className = "teilzeit-formula-line2 bidi-ltr";
    formulaLine2.setAttribute("dir", "ltr");
      formulaLine1.innerHTML = `${formatValueUnitHtml(berechnung.neueBasis, "units.months.short")} / ${String(eingaben.teilzeitProzent)}%`;
    
    formulaContainer.appendChild(formulaLine1);
    formulaContainer.appendChild(formulaLine2);
    inTeilzeitDd.appendChild(formulaContainer);
      formulaLine2.innerHTML = ` = ${formatValueUnitHtml(berechnung.gesamtMonate, "units.months.short")}`;
    inTeilzeitWrapper.append(inTeilzeitDt, inTeilzeitDd);
    liste.append(inTeilzeitWrapper);
    
    // Warnhinweis prüfen und anzeigen
    if (berechnung.gesamteVerkuerzungMonateOhneBegrenzung > 12) {
      warnhinweis.textContent = uebersetzung("errors.invalidCut", "Hinweis: Ihre gewählten Verkürzungsgründe ergeben zusammen mehr als 12 Monate. Die Gesamtverkürzung wird daher auf maximal 12 Monate begrenzt, wie vorgegeben.");
      warnhinweis.style.display = "block";
    }
  }
  
  // Warnhinweis für § 8 Abs. 3 BBiG (immer anzeigen, wenn Regel angewendet wurde)
  if (berechnung && berechnung.regel8Abs3Angewendet) {
    const warnhinweis8Abs3 = document.createElement("p");
    warnhinweis8Abs3.className = "error-message verkuerzungen-warning";
    warnhinweis8Abs3.id = "errorRegel8Abs3";
    warnhinweis8Abs3.textContent = uebersetzung(
      "errors.regel8Abs3",
      "Hinweis: Nach § 8 Abs. 3 BBiG wurde die Ausbildungsdauer auf die Regelausbildungsdauer reduziert, da die Überschreitung maximal 6 Monate beträgt."
    );
    warnhinweis8Abs3.style.display = "block";
    liste.appendChild(warnhinweis8Abs3);
  }

  // Einheiten-Legende
  const legende = document.createElement("p");
  legende.className = "units-legend bidi-ltr";
  legende.setAttribute("dir", "ltr");
  legende.textContent = uebersetzung(
    "inputs.unitsLegend",
    "Std = Stunden, M = Monate"
  );
  liste.appendChild(legende);
}

/**
 * Zeigt die Hauptergebnisse (mit i18n) an.
 *
 * @param {Object} eingaben - Eingaben zur Ableitung von Plausibilitätsprüfungen.
 * @param {Object} berechnung - Kernzahlen der Berechnung (Monate, Wochen, Stunden).
 */
function fuelleErgebnisse(eingaben, berechnung) {
 if (!berechnung) return;

  // --- Haupt-Ergebnis: Gesamtmonate / -jahre ---
  const totalMonths =
    typeof berechnung.gesamtMonate === "number"
      ? berechnung.gesamtMonate
      : null;

  const totalYears =
    typeof berechnung.gesamtJahre === "number"
      ? berechnung.gesamtJahre
      : null;

  // Monate mit Einheit ("32 Monate" / "32 months")
  if (totalMonths !== null) {
    const unitMonths = uebersetzung("units.months.full", "Monate");
    const elMonths = document.getElementById('res-total-months');
    if (elMonths) {
      elMonths.innerHTML = `<span class="result-value-unit" dir="ltr"><span class="i18n-num" dir="ltr">${String(totalMonths)}</span> <span class="i18n-unit" dir="auto">${String(unitMonths)}</span></span>`;
    }
  } else {
    setzeText("#res-total-months", "–");
  }

  // Jahre mit Einheit, lokal formatiert ("2,7 Jahre" / "2.7 years")
  if (totalYears !== null) {
    const sprache = aktuelleSprache();
    const formatter = new Intl.NumberFormat(
      sprache === "en" ? "en-US" : "de-DE",
      { minimumFractionDigits: 0, maximumFractionDigits: 1 }
    );
    const formattedYears = formatter.format(totalYears);
    const unitYears = uebersetzung("units.years.full", "Jahre");
    const elYears = document.getElementById('res-total-years');
    if (elYears) {
      elYears.innerHTML = `<span class="result-value-unit" dir="ltr"><span class="i18n-num" dir="ltr">${String(formattedYears)}</span> <span class="i18n-unit" dir="auto">${String(unitYears)}</span></span>`;
    }
  } else {
    setzeText("#res-total-years", "–");
  }

  const errorTotalMonths = $("#errorTotalMonths");
  if (errorTotalMonths) {
    errorTotalMonths.textContent = "";
  }

  // --- 1. Block: Verkürzung durch Verkürzungsgründe ---
  const shorteningWrapper = document.getElementById("res-shortening-wrapper");
  if (shorteningWrapper) {
    const vollzeitMonate =
      typeof eingaben?.basisMonate === "number"
        ? eingaben.basisMonate
        : undefined;
    const verkuerzungMonate =
      typeof berechnung.gesamteVerkuerzungMonate === "number"
        ? berechnung.gesamteVerkuerzungMonate
        : undefined;
    const basisNachVerkuerzung =
      typeof berechnung.neueBasis === "number"
        ? berechnung.neueBasis
        : undefined;

    if (
      typeof vollzeitMonate === "number" &&
      typeof verkuerzungMonate === "number" &&
      typeof basisNachVerkuerzung === "number"
    ) {
      // z.B. "36 Monate"
      setzeText(
        "#res-extension-vollzeit",
        `${vollzeitMonate} ${uebersetzung("units.months.full", "Monate")}`
      );

      // z.B. "-6 M"
      const vorzeichen = verkuerzungMonate > 0 ? "-" : "";
      setzeText(
        "#res-extension-verkuerzungsdauer",
        `${vorzeichen}${Math.abs(
          verkuerzungMonate
        )} ${uebersetzung("units.months.short")}`
      );

      // z.B. "30 Monate"
      setzeText(
        "#res-shortening-total",
        `${basisNachVerkuerzung} ${uebersetzung(
          "units.months.full",
          "Monate"
        )}`
      );

      shorteningWrapper.hidden = false;
    } else {
      // Falls keine Daten → Block ausblenden und Platzhalter setzen
      shorteningWrapper.hidden = true;
      setzeText("#res-extension-vollzeit", "–");
      setzeText("#res-extension-verkuerzungsdauer", "+–");
      setzeText("#res-shortening-total", "–");
    }
  }

  // --- 2. Block: Verlängerung durch Teilzeit ---
  const extensionWrapper = document.getElementById("res-extension-wrapper");
  if (extensionWrapper) {
    // Basis für Teilzeit ist deine neue Basis (nach Verkürzung)
    const basisMonate =
      typeof berechnung.neueBasis === "number"
        ? berechnung.neueBasis
        : undefined;

    const teilzeitDelta =
      typeof berechnung.verlaengerungMonate === "number"
        ? berechnung.verlaengerungMonate
        : undefined;

    const zielMonate = totalMonths;

    if (
      typeof basisMonate === "number" &&
      typeof teilzeitDelta === "number" &&
      typeof zielMonate === "number"
    ) {
      // z.B. "30 Monate"
      setzeText(
        "#res-extension-basis",
        `${basisMonate} ${uebersetzung("units.months.full", "Monate")}`
      );

      // z.B. "+12 M"
      const sign = teilzeitDelta >= 0 ? "+" : "";
      setzeText(
        "#res-extension-delta",
        `${sign}${teilzeitDelta} ${uebersetzung(
          "units.months.short",
          "M"
        )}`
      );

      // z.B. "42 Monate"
      setzeText(
        "#res-extension-total",
        `${zielMonate} ${uebersetzung("units.months.full", "Monate")}`
      );

      extensionWrapper.hidden = false;
    } else {
      extensionWrapper.hidden = true;
      setzeText("#res-extension-basis", "–");
      setzeText("#res-extension-delta", "+–");
      setzeText("#res-extension-total", "–");
    }
  }
}

/** Setzt das Datum in der Fußzeile (lokalisiert). */
function setzeDatumstempel() {
  const element = $("#stamp-date");
  if (!element) return;
  const sprache = aktuelleSprache();
  const localeMap = {
    ar: "ar",
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
    pl: "pl-PL",
    ro: "ro-RO",
    ru: "ru-RU",
    tr: "tr-TR",
    uk: "uk-UA"
  };

  const locale = localeMap[sprache] || sprache || "de-DE";
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  const defaultLabelMap = {
    ar: "اعتبارًا من",
    de: "Stand",
    en: "As of",
    fr: "En date du",
    pl: "Stan na",
    ro: "Valabil la data de",
    ru: "Сегодня",
    tr: "Tarih itibarıyla",
    uk: "Станом на"
  };
  const defaultLabel = defaultLabelMap[sprache] || "As of";
  const beschriftung = window.I18N && typeof window.I18N.t === "function"
    ? window.I18N.t("meta.stampLabel", defaultLabel)
    : defaultLabel;
  
  // Für Arabisch: Label zuerst (wird rechts angezeigt), dann Datum LTR (wird links angezeigt)
  if (sprache === "ar") {
    const datumText = format.format(new Date());
    element.innerHTML = `${beschriftung}: <span dir="ltr" style="display: inline-block; direction: ltr; unicode-bidi: embed;">${datumText}</span>`;
    element.removeAttribute("dir");
    element.style.direction = "";
  } else {
    element.textContent = `${beschriftung}: ${format.format(new Date())}`;
    element.removeAttribute("dir");
    element.style.direction = "";
  }
}

/* ------------------------------
   Share / Reset – mit i18n
   ------------------------------ */

/**
 * Erstellt eine URL mit kodierten Berechnungsdaten als Parameter.
 */
function erstelleShareUrl(eingaben, berechnung) {
  const baseUrl = new URL(location.href);
  baseUrl.searchParams.delete('data'); // Alte Parameter entfernen
  
  // Daten in kompakter Form kodieren
  const shareData = {
    d: eingaben.basisMonate,
    s: eingaben.wochenstunden,
    t: eingaben.teilzeitProzent,
    v: eingaben.verkuerzungen.map(vk => ({ k: vk.key, m: vk.months })),
    r: {
      g: berechnung.gesamtMonate,
      n: berechnung.neueBasis,
      v: berechnung.gesamteVerkuerzungMonate,
      vo: berechnung.gesamteVerkuerzungMonateOhneBegrenzung,
      l: berechnung.verlaengerungMonate || 0,
      r8: berechnung.regel8Abs3Angewendet || false
    }
  };
  
  // Base64-kodieren für URL-Sicherheit
  try {
    const jsonString = JSON.stringify(shareData);
    const encoded = btoa(encodeURIComponent(jsonString));
    baseUrl.searchParams.set('data', encoded);
  } catch (error) {
    console.warn("Fehler beim Kodieren der Daten:", error);
    return baseUrl.toString();
  }
  
  return baseUrl.toString();
}

/**
 * Liest Berechnungsdaten aus URL-Parametern.
 */
function ladeDatenAusUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (!encodedData) {
      return null;
    }
    
    // Base64-dekodieren
    const jsonString = decodeURIComponent(atob(encodedData));
    const shareData = JSON.parse(jsonString);
    
    // Datenstruktur wiederherstellen
    return {
      eingaben: {
        basisMonate: shareData.d,
        wochenstunden: shareData.s,
        teilzeitProzent: shareData.t,
        verkuerzungen: shareData.v ? shareData.v.map(v => ({ key: v.k, months: v.m })) : []
      },
      berechnung: {
        gesamtMonate: shareData.r.g,
        neueBasis: shareData.r.n,
        gesamteVerkuerzungMonate: shareData.r.v,
        gesamteVerkuerzungMonateOhneBegrenzung: shareData.r.vo,
        verlaengerungMonate: shareData.r.l || 0, // Verlängerung durch Teilzeit
        gesamtJahre: Math.round((shareData.r.g / 12) * 10) / 10,
        regel8Abs3Angewendet: shareData.r.r8 || false
      }
    };
  } catch (error) {
    console.warn("Fehler beim Dekodieren der URL-Daten:", error);
    return null;
  }
}

/**
 * Teilt die Ergebnisübersicht über die Web Share API oder die Zwischenablage.
 * Die URL enthält kodierte Berechnungsdaten, damit die Ergebnisse beim Öffnen des Links sichtbar sind.
 */
async function teileLink() {
  // Prüfe, ob wir aktuelle Berechnungsdaten haben
  if (!LETZTE_EINGABEN || !LETZTE_BERECHNUNG) {
    const meldung = uebersetzung("share.noData", "Bitte berechnen Sie zuerst ein Ergebnis, bevor Sie den Link teilen.");
    alert(meldung);
    return;
  }
  
  const adresse = erstelleShareUrl(LETZTE_EINGABEN, LETZTE_BERECHNUNG);
  const titel = uebersetzung("share.title", "Teilzeitrechner – Ergebnis");
  const text = uebersetzung("share.text", "Hier ist meine Ergebnisübersicht.");
  const kopiert = uebersetzung("share.copied", "Link in die Zwischenablage kopiert.");
  const fehlerText = uebersetzung("share.error", "Fehler beim Teilen. Bitte kopieren Sie den Link manuell.");
  
  try {
    // Web Share API (funktioniert auf Mobile-Geräten)
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: titel, 
          text: text, 
          url: adresse.toString() 
        });
        return; // Erfolgreich geteilt
      } catch (shareError) {
        // Benutzer hat geteilt abgebrochen - das ist OK, kein Fehler
        if (shareError.name === 'AbortError') {
          return;
        }
        // Anderer Fehler - weiter zu Fallback
        console.warn("Web Share API Fehler:", shareError);
      }
    }
    
    // Fallback: Zwischenablage (funktioniert über HTTPS)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(adresse.toString());
        alert(kopiert);
        return;
      } catch (clipboardError) {
        console.warn("Zwischenablage Fehler:", clipboardError);
      }
    }
    
    // Letzter Fallback: Textauswahl für manuelles Kopieren
    const textarea = document.createElement("textarea");
    textarea.value = adresse.toString();
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      alert(kopiert);
    } catch (execError) {
      console.warn("execCommand Fehler:", execError);
      alert(fehlerText + "\n\n" + adresse.toString());
    } finally {
      document.body.removeChild(textarea);
    }
  } catch (fehler) {
    console.error("Unerwarteter Fehler beim Teilen:", fehler);
    alert(fehlerText + "\n\n" + adresse.toString());
  }
}

/**
 * Setzt alle gespeicherten Formular- und Spracheinstellungen zurück.
 * Die zuletzt gewählte Sprache wird erneut gespeichert.
 */
function setzeDatenZurueck() {
  const meldung = uebersetzung(
    "reset.confirm",
    "Möchten Sie wirklich alle Daten zurücksetzen?"
  );
  if (!confirm(meldung)) return;

  // Sprache merken, bevor wir den Storage leeren
  const SPRACH_SCHLUESSEL = "lang";
  const gespeicherteSprache =
    localStorage.getItem(SPRACH_SCHLUESSEL) ||
    (window.I18N && window.I18N.lang) ||
    null;

  // Formularfelder zurücksetzen
  const dauerInput = document.getElementById("dauer");
  const stundenInput = document.getElementById("stunden");
  const teilzeitProzentInput = document.getElementById("teilzeitProzent");
  const teilzeitStundenInput = document.getElementById("teilzeitStunden");
  const presetButtons = document.querySelectorAll('.preset[data-type="percent"], .preset[data-type="hours"]');
  const fehlerProzent = document.getElementById("errorProzent");
  const fehlerStunden = document.getElementById("errorTeilStunden");
  
  if (dauerInput) dauerInput.value = "";
  if (stundenInput) stundenInput.value = "";
  if (teilzeitProzentInput) teilzeitProzentInput.value = "";
  if (teilzeitStundenInput) teilzeitStundenInput.value = "";

  // Teilzeitfelder deaktivieren und optisch zurücksetzen
  [teilzeitProzentInput, teilzeitStundenInput].forEach((inp) => {
    if (!inp) return;
    inp.disabled = true;
    inp.classList.remove('error');
  });
  // Presets deaktivieren und aktiv-Zustand entfernen
  presetButtons.forEach((btn) => {
    btn.disabled = true;
    btn.classList.remove('active');
  });
  if (fehlerProzent) fehlerProzent.textContent = "";
  if (fehlerStunden) fehlerStunden.textContent = "";
  
  // Checkboxes für Verkürzungsgründe zurücksetzen
  const checkboxes = document.querySelectorAll('input[type="checkbox"][data-vk-field]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Alle Ja/Nein-Checkboxen (beide Spalten) zurücksetzen, inkl. Nein-Buttons
  const allVkCheckboxes = document.querySelectorAll('.vk-yes-no-group input[type="checkbox"]');
  allVkCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Alter-Feld zurücksetzen
  const alterInput = document.getElementById('alter');
  if (alterInput) alterInput.value = "";
  
  // Fehler-Nachrichten für Alter zurücksetzen
  const errorAlter = document.getElementById('errorAlter');
  if (errorAlter) errorAlter.textContent = "";
  
  // Dauer-Inputs für berufliche Fragen zurücksetzen
  const berufQ2Dauer = document.getElementById('vk_beruf_q2_dauer_months');
  if (berufQ2Dauer) berufQ2Dauer.value = "";
  
  // Fehler-Nachrichten für Q2 Dauer zurücksetzen
  const errorBerufQ2Dauer = document.getElementById('errorBerufQ2Dauer');
  if (errorBerufQ2Dauer) errorBerufQ2Dauer.textContent = "";
  
  // Q2 Dauer-Container verstecken (falls sichtbar)
  const berufQ2DurationContainer = document.getElementById('vk_beruf_q2_duration_container');
  if (berufQ2DurationContainer) berufQ2DurationContainer.style.display = 'none';
  
  // Schulabschluss zurücksetzen
  const abiturCheckbox = document.getElementById("g-abitur");
  const realschuleCheckbox = document.getElementById("g-realschule");
  const schoolSelect = document.getElementById("vk-school-select");
  if (abiturCheckbox) abiturCheckbox.checked = false;
  if (realschuleCheckbox) realschuleCheckbox.checked = false;
  if (schoolSelect) schoolSelect.value = "none";
  
  // Vorkenntnisse-Monate zurücksetzen (falls vorhanden)
  const vorkenntnisseInput = document.querySelector('input[data-vk-field="vorkenntnisse_monate"]');
  if (vorkenntnisseInput && vorkenntnisseInput.type === "number") {
    vorkenntnisseInput.value = "";
  }

  // Gespeicherten Zustand löschen
  try {
    localStorage.removeItem("calculatorState");
    localStorage.removeItem("teilzeitrechner_eingaben"); // Eingaben-Cache ebenfalls löschen
  } catch (fehler) {
    console.warn("Konnte calculatorState nicht löschen:", fehler);
  }
  
  // Alles andere löschen (außer Sprache und Barrierefreiheit-Einstellungen)
  try {
    const gespeicherteSprache = localStorage.getItem(SPRACH_SCHLUESSEL);
    const gespeichertesTheme = localStorage.getItem('theme');
    const gespeicherteLeichteSprache = localStorage.getItem('easyLanguage');
    const gespeichertesFontSizeLevel = localStorage.getItem('fontSizeLevel');

    localStorage.clear();

    if (gespeicherteSprache) {
      localStorage.setItem(SPRACH_SCHLUESSEL, gespeicherteSprache);
    }
    if (gespeichertesTheme) {
      localStorage.setItem('theme', gespeichertesTheme);
    }
    if (gespeicherteLeichteSprache) {
      localStorage.setItem('easyLanguage', gespeicherteLeichteSprache);
    }
    if (gespeichertesFontSizeLevel) {
      localStorage.setItem('fontSizeLevel', gespeichertesFontSizeLevel);
    }
  } catch (fehler) {
    console.warn("Konnte localStorage nicht löschen:", fehler);
  }
  try {
    sessionStorage.clear();
  } catch (fehler) {
    console.warn("Konnte sessionStorage nicht löschen:", fehler);
  }

  // Sprache wiederherstellen
  if (gespeicherteSprache) {
    try {
      localStorage.setItem(SPRACH_SCHLUESSEL, gespeicherteSprache);
    } catch (fehler) {
      console.warn("Konnte Sprache nicht wiederherstellen:", fehler);
    }
  }

  // Ergebnisse zurücksetzen
  setzeText("#res-total-months", "–");
  setzeText("#res-total-years", "–");

  const shorteningWrapper = document.getElementById("res-shortening-wrapper");
  if (shorteningWrapper) {
    shorteningWrapper.hidden = true;
  }
  setzeText("#res-extension-vollzeit", "–");
  setzeText("#res-extension-verkuerzungsdauer", "+–");
  setzeText("#res-shortening-total", "–");

  const extensionWrapper = $("#res-extension-wrapper");
  if (extensionWrapper) {
    verberge(extensionWrapper); // hattest du schon
  }
  setzeText("#res-extension-basis", "–");
  setzeText("#res-extension-delta", "+–");
  setzeText("#res-extension-total", "–");

  const errorTotalMonths = $("#errorTotalMonths");
  if (errorTotalMonths) {
    errorTotalMonths.textContent = "";
  }
  
  // Eingabenliste leeren
  const inputsList = $("#inputs-list");
  if (inputsList) inputsList.innerHTML = "";
  
  // Ergebnis-Sektion verstecken
  const ergebnisContainer = document.getElementById("ergebnis-container");
  if (ergebnisContainer) {
    ergebnisContainer.hidden = true;
  }

  // Hinweise/Share wieder ausblenden
  setzeErgebnisBegleitUIVisible(false);
  
  // Rote Border von Ergebnis-Box entfernen
  const highlightBox = document.querySelector(".card.highlight");
  if (highlightBox) {
    highlightBox.classList.remove("active");
  }
  
  // Gespeicherte Daten zurücksetzen
  LETZTE_EINGABEN = null;
  LETZTE_BERECHNUNG = null;

  // Nach Bestätigung sanft zum Eingabebereich scrollen (gleiche Logik wie "Zum Rechner" Button)
  const eingabenSection = document.querySelector('section.card');
  if (eingabenSection) {
    const top = eingabenSection.getBoundingClientRect().top + window.pageYOffset - 70 + 38;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

/* ------------------------------
   Initialisierung & Re-Render bei Sprachwechsel
   ------------------------------ */

/**
 * Speichert den aktuellen Zustand (Eingaben und Berechnung) in localStorage.
 */
function speichereZustand(eingaben, berechnung) {
  try {
    // Speichere auch die ursprünglichen Formularwerte für die Wiederherstellung
    const vorkenntnisseInput = document.querySelector('input[data-vk-field="vorkenntnisse_monate"]');
    const formularWerte = {
      dauer: document.getElementById("dauer")?.value || null,
      stunden: document.getElementById("stunden")?.value || null,
      teilzeitProzent: document.getElementById("teilzeitProzent")?.value || null,
      schoolSelect: document.querySelector('select[data-vk-type="school-select"]')?.value || null,
      vorkenntnisseMonate: vorkenntnisseInput?.value || null
    };
    
    const zustand = {
      eingaben,
      berechnung,
      formularWerte,
      timestamp: Date.now()
    };
    localStorage.setItem("calculatorState", JSON.stringify(zustand));
  } catch (fehler) {
    console.warn("Konnte Zustand nicht speichern:", fehler);
  }
}

/**
 * Lädt den gespeicherten Zustand aus localStorage.
 */
function ladeZustand() {
  try {
    const gespeichert = localStorage.getItem("calculatorState");
    if (!gespeichert) return null;
    
    const zustand = JSON.parse(gespeichert);
    // Prüfe, ob der Zustand nicht älter als 7 Tage ist
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 Tage in Millisekunden
    if (Date.now() - zustand.timestamp > maxAge) {
      localStorage.removeItem("calculatorState");
      return null;
    }
    
    return zustand;
  } catch (fehler) {
    console.warn("Konnte Zustand nicht laden:", fehler);
    return null;
  }
}

/**
 * Stellt die Formularwerte aus dem gespeicherten Zustand wieder her.
 */
function stelleFormularWiederHer(zustand) {
  if (!zustand) return;
  
  const formularWerte = zustand.formularWerte || {};
  const eingaben = zustand.eingaben;
  
  // Basis-Eingaben wiederherstellen
  const dauerElement = document.getElementById("dauer");
  const stundenElement = document.getElementById("stunden");
  const prozentElement = document.getElementById("teilzeitProzent");
  
  if (dauerElement && formularWerte.dauer) {
    dauerElement.value = formularWerte.dauer;
  }
  if (stundenElement && formularWerte.stunden) {
    stundenElement.value = formularWerte.stunden;
  }
  if (prozentElement && formularWerte.teilzeitProzent) {
    prozentElement.value = formularWerte.teilzeitProzent;
  }
  
  // Schulabschluss-Select wiederherstellen
  if (formularWerte.schoolSelect) {
    const schoolSelect = document.querySelector('select[data-vk-type="school-select"]');
    if (schoolSelect) {
      schoolSelect.value = formularWerte.schoolSelect;
    }
  }
  
  // Verkürzungsgründe wiederherstellen
  if (eingaben && eingaben.verkuerzungen && Array.isArray(eingaben.verkuerzungen)) {
    eingaben.verkuerzungen.forEach(vk => {
      if (vk.key === "abitur") {
        const checkbox = document.getElementById("g-abitur");
        if (checkbox) checkbox.checked = true;
      }
      if (vk.key === "realschule") {
        const checkbox = document.getElementById("g-realschule");
        if (checkbox) checkbox.checked = true;
      }
      if (vk.key === "alter_ueber_21") {
        const checkbox = document.querySelector('input[data-vk-field="alter_ueber_21"]');
        if (checkbox) checkbox.checked = true;
      }
      if (vk.key === "familien_kinderbetreuung") {
        const checkbox = document.querySelector('input[data-vk-field="familien_kinderbetreuung"]');
        if (checkbox) checkbox.checked = true;
      }
      if (vk.key === "familien_pflegeverantwortung") {
        const checkbox = document.querySelector('input[data-vk-field="familien_pflegeverantwortung"]');
        if (checkbox) checkbox.checked = true;
      }
      if (vk.key === "vorkenntnisse" && vk.months > 0) {
        const checkbox = document.querySelector('input[data-vk-field="vorkenntnisse_monate"]');
        if (checkbox) checkbox.checked = true;
      }
    });
  }
}

/**
 * Initialisiert die Ergebnisansicht (nur Event-Listener, keine automatische Berechnung).
 * Die Ergebnisse werden erst beim Klick auf "Ergebnis anzeigen" geladen.
 * Beim Laden der Seite wird geprüft, ob ein gespeicherter Zustand vorhanden ist.
 */
function initialisiere() {
  $("#btn-share")?.addEventListener("click", teileLink);
  $("#btn-reset")?.addEventListener("click", setzeDatenZurueck);

  // Ergebnisbereich standardmäßig ausblenden.
  // Er wird erst nach Klick auf "Ergebnis anzeigen" sichtbar.
  const ergebnisContainer = document.getElementById("ergebnis-container");
  if (ergebnisContainer) {
    ergebnisContainer.hidden = true;
  }

  // Hinweise/Share standardmäßig ausblenden (erst sichtbar, wenn Ergebnis sichtbar ist)
  setzeErgebnisBegleitUIVisible(false);

  // Desktop-only Button-Layout (Reset neben Berechnen, Share unter Hinweise)
  initialisiereDesktopButtonLayout();
  
  // Clear validation errors when the user interacts with inputs or yes/no tiles
  const clearableInputs = ["dauer", "stunden", "alter", "vk_beruf_q2_dauer_months"];
  clearableInputs.forEach(id => {
    const el = document.getElementById(id) || document.querySelector(`input[data-vk-field="${id}"]`);
    if (!el) return;
    el.addEventListener("input", () => {
      el.classList.remove("error");
      const errorId = id === 'vk_beruf_q2_dauer_months' ? 'errorBerufQ2Dauer' : 'error' + id.charAt(0).toUpperCase() + id.slice(1);
      const errEl = document.getElementById(errorId);
      if (errEl) errEl.textContent = "";
    });
  });

  // Ja/Nein groups: clear tile error and group message on change
  const yesNoPairs = [
    ["abitur-ja","abitur-nein"],
    ["realschule-ja","realschule-nein"],
    ["kinderbetreuung-ja","kinderbetreuung-nein"],
    ["pflege-ja","pflege-nein"],
    ["vk_beruf_q1_ja","vk_beruf_q1_nein"],
    ["vk_beruf_q2_ja","vk_beruf_q2_nein"],
    ["vk_beruf_q3_ja","vk_beruf_q3_nein"],
    ["vk_beruf_q4_ja","vk_beruf_q4_nein"]
  ];

  yesNoPairs.forEach(([jaId, neinId]) => {
    [jaId, neinId].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        // remove error class from both tiles if present
        const jaTile = document.getElementById(jaId)?.closest?.(".tile");
        const neinTile = document.getElementById(neinId)?.closest?.(".tile");
        if (jaTile) jaTile.classList.remove("error");
        if (neinTile) neinTile.classList.remove("error");

        // remove group error message if present
        const yesNoGroup = el.closest(".vk-yes-no-group");
        if (yesNoGroup) {
          const next = yesNoGroup.nextElementSibling;
          if (next && next.classList.contains("error-message-ja-nein")) {
            next.parentNode.removeChild(next);
          }
        }
      });
    });
  });
  
  // Prüfe zuerst URL-Parameter (hat Priorität, da es ein geteilter Link sein könnte)
  const urlDaten = ladeDatenAusUrl();
  if (urlDaten && urlDaten.eingaben && urlDaten.berechnung) {
    // Formular wiederherstellen (nur Basis-Eingaben, da Verkürzungen aus URL kommen)
    const dauerElement = document.getElementById("dauer");
    const stundenElement = document.getElementById("stunden");
    const prozentElement = document.getElementById("teilzeitProzent");
    
    if (dauerElement) dauerElement.value = urlDaten.eingaben.basisMonate;
    if (stundenElement) stundenElement.value = urlDaten.eingaben.wochenstunden;
    if (prozentElement) prozentElement.value = urlDaten.eingaben.teilzeitProzent;
    
    // Verkürzungsgründe wiederherstellen
    if (urlDaten.eingaben.verkuerzungen && Array.isArray(urlDaten.eingaben.verkuerzungen)) {
      urlDaten.eingaben.verkuerzungen.forEach(vk => {
        if (vk.key === "abitur" || vk.key === "realschule" || vk.key === "hauptschule" || vk.key === "none") {
          const dropdown = document.getElementById("vk-school-select");
          if (dropdown) dropdown.value = vk.key;
        }
        if (vk.key === "alter_ueber_21") {
          const checkbox = document.querySelector('input[data-vk-field="alter_ueber_21"]');
          if (checkbox) checkbox.checked = true;
        }
        if (vk.key === "familien_kinderbetreuung") {
          const checkbox = document.querySelector('input[data-vk-field="familien_kinderbetreuung"]');
          if (checkbox) checkbox.checked = true;
        }
        if (vk.key === "familien_pflegeverantwortung") {
          const checkbox = document.querySelector('input[data-vk-field="familien_pflegeverantwortung"]');
          if (checkbox) checkbox.checked = true;
        }
        if (vk.key === "vorkenntnisse" && vk.months > 0) {
          const checkbox = document.querySelector('input[data-vk-field="vorkenntnisse_monate"]');
          if (checkbox) checkbox.checked = true;
        }
      });
    }
    
    // Ergebnisse wiederherstellen
    LETZTE_EINGABEN = urlDaten.eingaben;
    LETZTE_BERECHNUNG = urlDaten.berechnung;
    
    // Ergebnis-Sektion anzeigen
    const ergebnisContainer = document.getElementById("ergebnis-container");
    if (ergebnisContainer) {
      ergebnisContainer.hidden = false;
    }

    setzeErgebnisBegleitUIVisible(true);
    
    // Ergebnisse anzeigen
    fuelleEingabenliste(urlDaten.eingaben, urlDaten.berechnung);
    fuelleErgebnisse(urlDaten.eingaben, urlDaten.berechnung);
    setzeDatumstempel();
    
    // URL bereinigen (Parameter entfernen, damit sie nicht beim Refresh bleiben)
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } else {
    // Prüfe, ob ein gespeicherter Zustand vorhanden ist
    const gespeicherterZustand = ladeZustand();
    if (gespeicherterZustand && gespeicherterZustand.eingaben && gespeicherterZustand.berechnung) {
      // Formular wiederherstellen
      stelleFormularWiederHer(gespeicherterZustand);

      // Ergebnisbereich NICHT automatisch anzeigen.
      // Der Nutzer muss aktiv auf "Ergebnis anzeigen" klicken.
      LETZTE_EINGABEN = null;
      LETZTE_BERECHNUNG = null;
    } else {
      // Ergebnis-Sektion initial verstecken
      const ergebnisContainer = document.getElementById("ergebnis-container");
      if (ergebnisContainer) {
        ergebnisContainer.hidden = true;
      }

      setzeErgebnisBegleitUIVisible(false);
    }
  }
}

// Erst-Init
document.addEventListener("DOMContentLoaded", initialisiere);

function rerendereErgebnisUIWennSichtbar() {
  const ergebnisContainer = document.getElementById("ergebnis-container");
  if (!ergebnisContainer || ergebnisContainer.hidden) return;
  if (!LETZTE_EINGABEN || !LETZTE_BERECHNUNG) return;

  // Sicherstellen, dass der Titel in der Box "Ihre Berechnung" ebenfalls aktualisiert wird
  const inputsTitle = document.getElementById("inputs-title");
  if (inputsTitle) {
    inputsTitle.textContent = uebersetzung("inputs.title", inputsTitle.textContent);
  }

  fuelleEingabenliste(LETZTE_EINGABEN, LETZTE_BERECHNUNG);
  fuelleErgebnisse(LETZTE_EINGABEN, LETZTE_BERECHNUNG);
  setzeDatumstempel();
}

// Bei Sprachwechsel nur UI neu rendern (ohne neue API-Calls)
// Nur wenn Ergebnisse bereits angezeigt wurden
window.addEventListener("i18n:changed", () => {
  rerendereErgebnisUIWennSichtbar();
});

// Beim Umschalten der "Leichten Sprache" wird i18n neu angewendet.
// Da dieses Script vor der i18n-Initialisierung geladen wird, warten wir einen Tick,
// damit `window.I18N` und das Wörterbuch bereits aktualisiert sind.
window.addEventListener("easyLanguage:changed", () => {
  setTimeout(() => {
    rerendereErgebnisUIWennSichtbar();
  }, 0);
});

// Bei Fenstergrößenänderung neu rendern (für Mobile/Desktop-Umschaltung)
// Nur bei Änderungen der Breite, nicht der Höhe (um Scroll-Events zu vermeiden)
let resizeTimeout;
let lastWindowWidth = window.innerWidth;
window.addEventListener("resize", () => {
  const currentWidth = window.innerWidth;
  // Nur neu rendern, wenn sich die Breite geändert hat (nicht die Höhe)
  if (currentWidth === lastWindowWidth) {
    return;
  }
  lastWindowWidth = currentWidth;
  
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const ergebnisContainer = document.getElementById("ergebnis-container");
    if (!ergebnisContainer || ergebnisContainer.hidden) return;
    if (!LETZTE_EINGABEN || !LETZTE_BERECHNUNG) return;
    fuelleEingabenliste(LETZTE_EINGABEN, LETZTE_BERECHNUNG);
  }, 250);
}); 

/**
 * Führt eine erneute Berechnung aus und aktualisiert die Ergebnisansicht.
 * Zeigt die Ergebnis-Sektion an, wenn sie noch versteckt ist.
 * Fehler werden im UI angezeigt.
 */
async function berechnen() {
  // Validierung vor Berechnung
  if (!validiereAlleEingaben()) {
    return; // Abbruch wenn Validierung fehlgeschlagen
  }

  // Ergebnis-Sektion anzeigen
  const ergebnisContainer = document.getElementById("ergebnis-container");
  if (ergebnisContainer) {
    ergebnisContainer.hidden = false;
    setzeErgebnisBegleitUIVisible(true);
    // Sanftes Scrollen zur Ergebnis-Sektion (außer bei geteilten Links)
    if (!window.__skipScrollToResults) {
      const top = ergebnisContainer.getBoundingClientRect().top + window.pageYOffset - 38;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }
  
  // Rote Border zur Ergebnis-Box hinzufügen
  const highlightBox = document.querySelector(".card.highlight");
  if (highlightBox) {
    highlightBox.classList.add("active");
  }
  
  try {
    const { eingaben, berechnung } = await holeZusammenfassung();
    LETZTE_EINGABEN = eingaben;
    LETZTE_BERECHNUNG = berechnung;
    
    // Zustand speichern
    speichereZustand(eingaben, berechnung);
    
    fuelleEingabenliste(eingaben, berechnung);
    fuelleErgebnisse(eingaben, berechnung);
    setzeDatumstempel();
  } catch (fehler) {
    console.error("Fehler beim Laden der Daten:", fehler);
    const meldung =
      fehler && fehler.message ? String(fehler.message) : "Unbekannter Fehler";
    setzeText("#res-total-months", "–");
    setzeText("#res-total-years", "–");
    const extensionWrapper = $("#res-extension-wrapper");
    if (extensionWrapper) verberge(extensionWrapper);
    const fehlerElement = document.getElementById("errorTotalMonths");
    if (fehlerElement) fehlerElement.textContent = meldung;
  }
}

// Berechnen-Button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("berechnenBtn");
  if (btn) {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      berechnen();
    });
  }
});

