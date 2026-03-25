/* global html2canvas, jsPDF, uebersetzung, aktuelleSprache */
/**
 * script_sharing.js – PDF-Export und Link-Sharing
 * Implementiert clientseitige PDF-Generierung und URL-basiertes Teilen von Berechnungen
 */

// CDN-Fallback-Loader für PDF-Bibliotheken (mehrere Hosts, falls geblockt)
const PDF_LIB_SOURCES = {
  html2canvas: [
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
  ],
  jspdf: [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
  ]
};

let pdfLibsLoadingPromise = null;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script failed: ${url}`));
    document.head.appendChild(script);
  });
}

async function loadFirstAvailable(urls) {
  let lastError;
  for (const url of urls) {
    try {
      await loadScript(url);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function ensurePdfLibs() {
  if (typeof html2canvas !== "undefined" && (typeof jsPDF !== "undefined" || (window.jspdf && window.jspdf.jsPDF))) {
    return;
  }

  if (pdfLibsLoadingPromise) {
    return pdfLibsLoadingPromise;
  }

  pdfLibsLoadingPromise = (async () => {
    await loadFirstAvailable(PDF_LIB_SOURCES.html2canvas);
    await loadFirstAvailable(PDF_LIB_SOURCES.jspdf);

    // UMD-Version legt jsPDF unter window.jspdf.jsPDF ab
    if (typeof jsPDF === "undefined" && window.jspdf && window.jspdf.jsPDF) {
      window.jsPDF = window.jspdf.jsPDF;
    }
  })();

  return pdfLibsLoadingPromise;
}

/**
 * Initialisiert Sharing-Buttons und Event-Listener
 */
document.addEventListener("DOMContentLoaded", () => {
  const btnDownloadPdf = document.getElementById("btn-download-pdf");
  const btnCopyLink = document.getElementById("btn-copy-link");

  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener("click", generierePDF);
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", kopiereLinkZwischenablage);
  }

  // Laden von geteilten Links beim Seitenaufruf
  loadSharedData();
});

/**
 * Generiert ein PDF mit allen Berechnungsergebnissen
 * Vereinfachte Implementierung: zeigt nur Ergebnisübersicht und Berechnung-Container
 */
async function generierePDF() {
  try {
    await ensurePdfLibs();
  } catch (loadErr) {
    console.error("PDF-Bibliotheken nicht geladen", loadErr);
    alert(uebersetzung("sharing.error.libraries", "PDF-Bibliotheken konnten nicht geladen werden"));
    return;
  }

  const button = document.getElementById("btn-download-pdf");
  const originalText = button.innerHTML;
  const originalDisabled = button.disabled;

  // Button deaktivieren und Ladezustand anzeigen
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.setAttribute("aria-disabled", "true");
  button.innerHTML = `<svg class="sharing-btn-icon spinner" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg> <span>${uebersetzung("sharing.generating", "Erstelle PDF...")}</span>`;

  try {
    // Prüfe ob Ergebnisse vorhanden sind
    const ergebnisContainer = document.getElementById("ergebnis-container");
    const inputsSection = document.getElementById("inputs-section");

    if (!ergebnisContainer || ergebnisContainer.hidden) {
      alert(uebersetzung("sharing.error.noResults", "Bitte führen Sie zuerst eine Berechnung durch"));
      button.innerHTML = originalText;
      button.disabled = originalDisabled;
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-disabled");
      return;
    }

    // Speichere aktuelle Accessibility-Einstellungen
    const root = document.documentElement;
    const originalTheme = root.getAttribute("data-theme");
    const originalFontSize = root.style.fontSize;

    // Erstelle Overlay (Bildschirm für kurze Zeit verdecken)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${getComputedStyle(root).getPropertyValue('--background') || '#ffffff'};
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(overlay);

    // Warte kurz damit das Overlay sichtbar ist
    await new Promise(resolve => setTimeout(resolve, 100));

    // Deaktiviere Accessibility-Features temporär
    root.removeAttribute("data-theme"); // Force Light Theme
    root.style.fontSize = "16px"; // Force Standard Font Size

    // Öffne "Berechnung" Container falls geschlossen
    const wasInputsClosed = inputsSection && !inputsSection.open;
    if (inputsSection) {
      inputsSection.open = true;
    }

    // Warte kurz damit die Änderungen gerendert werden
    await new Promise(resolve => setTimeout(resolve, 50));

    // Finde nur die beiden gewünschten Container
    const resultCard = ergebnisContainer.querySelector('.card.highlight');
    
    // Erstelle Container für PDF-Inhalt
    const pdfWrapper = document.createElement('div');
    pdfWrapper.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 800px;
      padding: 20px;
      background: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: -1;
    `;

    // --- PDF-Desktop-Layout und Pfeil/Tooltip-Overrides ---
    const style = document.createElement('style');
    style.textContent = `
      /* Erzwinge Desktop-Layout für PDF-Export */
      @media all {
        .result-steps-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 1rem !important;
        }
        .result-step-content {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.25rem !important;
          flex-wrap: wrap !important;
        }
        .result-step-arrow {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          position: relative !important;
          min-width: 3.5rem !important;
          margin-bottom: 0.25rem !important;
        }
        .result-step-green .arrow-line,
        .result-step-red .arrow-line {
          transform: translateY(-10px) !important;
        }
        .arrow-tooltip {
          top: -0.35rem !important;
        }
        .arrow-tooltip::after {
          bottom: -4px !important;
        }
        .result-step-box {
          padding-bottom: 0.2rem !important;
        }
        /* Überschriften direkt am oberen Rand */
        .card.highlight h1,
        #inputs-section h2 {
          margin-top: 0 !important;
          margin-bottom: 0.25rem !important;
        }
      }
    `;
    pdfWrapper.appendChild(style);
    pdfWrapper.style.minWidth = '900px';
    pdfWrapper.style.width = '1024px';
    pdfWrapper.style.paddingBottom = '48px'; // Abstand zum unteren Rand
    // --- ENDE PDF-Desktop-Layout-Overrides ---

    // Füge Titel und Datum hinzu
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 20px; text-align: center;';
    const title = document.createElement('h1');
    title.textContent = uebersetzung('pdf.headline', 'Übersicht über Ihre Berechnung');
    title.style.cssText = 'font-size: 24px; margin: 0 0 8px 0; font-weight: 700;';
    const dateTime = document.createElement('p');
    const now = new Date();
    dateTime.textContent = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    dateTime.style.cssText = 'font-size: 14px; color: #666; margin: 0;';
    header.appendChild(title);
    header.appendChild(dateTime);
    pdfWrapper.appendChild(header);

    // Klone Ergebnisübersicht-Card
    if (resultCard) {
      const resultClone = resultCard.cloneNode(true);
      resultClone.style.cssText = 'margin-bottom: 20px;';
      pdfWrapper.appendChild(resultClone);
    }

    // Klone Berechnung-Container
    if (inputsSection) {
      const inputsClone = inputsSection.cloneNode(true);
      inputsClone.open = true;
      // Entferne Summary/Toggle und ersetze durch Überschrift
      const summary = inputsClone.querySelector('summary');
      if (summary) {
        const h2 = document.createElement('h2');
        h2.textContent = uebersetzung('inputs.title', 'Ihre Berechnung');
        h2.style.cssText = 'font-size: 20px; margin: 0 0 16px 0; font-weight: 700;';
        summary.replaceWith(h2);
      }
      pdfWrapper.appendChild(inputsClone);
    }

    // --- Pfeile im PDF bei arabisch umdrehen ---
    if (aktuelleSprache() === 'ar') {
      // Nur im PDF-Wrapper, nicht global!
      const arrows = pdfWrapper.querySelectorAll('.arrow-line');
      arrows.forEach(el => {
        if (el.textContent.trim() === '→') el.textContent = '←';
      });
    }

    document.body.appendChild(pdfWrapper);

    // Warte kurz damit Styles angewendet werden
    await new Promise(resolve => setTimeout(resolve, 50));


    // Erstelle Canvas mit html2canvas (optimiert: scale 1)
    const canvas = await html2canvas(pdfWrapper, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 800
    });

    // Entferne PDF-Wrapper
    document.body.removeChild(pdfWrapper);

    // Stelle Accessibility-Einstellungen wieder her
    if (originalTheme) {
      root.setAttribute("data-theme", originalTheme);
    } else {
      root.removeAttribute("data-theme");
    }
    root.style.fontSize = originalFontSize;

    // Schließe "Berechnung" Container wieder falls er vorher geschlossen war
    if (wasInputsClosed && inputsSection) {
      inputsSection.open = false;
    }

    // Entferne Overlay
    document.body.removeChild(overlay);

    // Erstelle PDF mit jsPDF
    const { jsPDF } = window.jspdf || window;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = 210; // A4 width in mm
    const margin = 10;
    
    // Berechne Bildabmessungen
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Füge Bild als JPEG mit Qualität 1.0 ein (deutlich kleinere Datei)
    pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', margin, margin, imgWidth, imgHeight);

    // Speichere PDF
    const timestamp = new Date().toISOString().split('T')[0];
    let fileName = uebersetzung('pdf.filename', 'Ergebnis_Teilzeitausbildung_{date}.pdf');
    fileName = fileName.replace('{date}', timestamp);
    pdf.save(fileName);

    // Erfolgs-Feedback
    button.innerHTML = `<svg class="sharing-btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${uebersetzung("sharing.downloaded", "PDF heruntergeladen")}</span>`;

    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = originalDisabled;
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-disabled");
    }, 2000);

  } catch (error) {
    console.error("PDF-Generierung fehlgeschlagen:", error);
    alert(uebersetzung("sharing.error.generation", "Fehler beim Erstellen der PDF-Datei"));
    button.innerHTML = originalText;
    button.disabled = originalDisabled;
    button.removeAttribute("aria-busy");
    button.removeAttribute("aria-disabled");
    
    // Stelle sicher dass Overlay entfernt wird im Fehlerfall
    const overlay = document.querySelector('div[style*="z-index: 99999"]');
    if (overlay && overlay.parentNode) {
      document.body.removeChild(overlay);
    }
  }
}

/**
 * Generiert einen Share-Link mit allen Eingaben als URL-Parameter
 */
function generiereShareLink() {
  // Sammle alle Eingabe-Werte
  const dauer = document.getElementById("dauer")?.value || "";
  const stunden = document.getElementById("stunden")?.value || "";
  const teilzeitProzent = document.getElementById("teilzeitProzent")?.value || "";
  const teilzeitStunden = document.getElementById("teilzeitStunden")?.value || "";
  const alter = document.getElementById("alter")?.value || "";
  const sprache = aktuelleSprache();

  // Sammle Verkürzungsgründe (Checkboxen)
  const verkuerzungsgruende = {};
  document.querySelectorAll("#vk-fieldset input[type='checkbox'][data-vk-field]").forEach((input) => {
    if (input.checked) {
      const field = input.dataset.vkField;
      const months = Number(input.dataset.vkMonths || 0);

      if (field === "vorkenntnisse_monate") {
        verkuerzungsgruende.vorkenntnisse_monate = (verkuerzungsgruende.vorkenntnisse_monate || 0) + months;
      } else {
        verkuerzungsgruende[field] = true;
      }
    }
  });

  // Sammle Ja/Nein-Antworten (alle Checkboxen, auch "Nein")
  const yesNoQuestions = [
    { ja: 'kinderbetreuung-ja', nein: 'kinderbetreuung-nein', field: 'familien_kinderbetreuung' },
    { ja: 'pflege-ja', nein: 'pflege-nein', field: 'familien_pflegeverantwortung' },
    { ja: 'vk_beruf_q1_ja', nein: 'vk_beruf_q1_nein', field: 'beruf_q1' },
    { ja: 'vk_beruf_q2_ja', nein: 'vk_beruf_q2_nein', field: 'beruf_q2' },
    { ja: 'vk_beruf_q3_ja', nein: 'vk_beruf_q3_nein', field: 'beruf_q3' },
    { ja: 'vk_beruf_q4_ja', nein: 'vk_beruf_q4_nein', field: 'beruf_q4' },
    { ja: 'vk_beruf_q5_ja', nein: 'vk_beruf_q5_nein', field: 'beruf_q5' }
  ];

  yesNoQuestions.forEach(({ ja, nein, field }) => {
    const jaCheckbox = document.getElementById(ja);
    const neinCheckbox = document.getElementById(nein);
    if (jaCheckbox && jaCheckbox.checked) {
      verkuerzungsgruende[field] = 'ja';
    } else if (neinCheckbox && neinCheckbox.checked) {
      verkuerzungsgruende[field] = 'nein';
    }
  });

  // Speichere Monate der nicht abgeschlossenen Ausbildung
  const berufQ2Months = document.getElementById('vk_beruf_q2_dauer_months');
  if (berufQ2Months && berufQ2Months.value) {
    verkuerzungsgruende.beruf_q2_months = Number(berufQ2Months.value);
  }

  // Schulabschluss-Select
  const schoolSelect = document.querySelector('select[data-vk-type="school-select"]');
  if (schoolSelect && schoolSelect.value) {
    const selectedOption = schoolSelect.selectedOptions[0];
    const fields = (selectedOption.dataset.vkSetFields || "").split(",").map((s) => s.trim()).filter(Boolean);
    fields.forEach((f) => {
      if (f in verkuerzungsgruende || f === "abitur" || f === "realschule") {
        verkuerzungsgruende[f] = true;
      }
    });
  }

  // Erstelle Base64-kodierte Parameterkette
  const params = {
    dauer,
    stunden,
    teilzeitProzent,
    teilzeitStunden,
    alter,
    sprache,
    vk: JSON.stringify(verkuerzungsgruende)
  };

  // Entferne leere Parameter
  Object.keys(params).forEach((key) => {
    if (!params[key] || params[key] === "" || params[key] === "{}") {
      delete params[key];
    }
  });

  const queryString = new URLSearchParams(params).toString();
  const shareLink = `${window.location.origin}${window.location.pathname}?${queryString}`;

  return shareLink;
}

/**
 * Kopiert Share-Link in Zwischenablage
 */
async function kopiereLinkZwischenablage() {
  const button = document.getElementById("btn-copy-link");
  const feedback = document.getElementById("copy-feedback");
  const originalText = button.innerHTML;

  try {
    button.setAttribute("aria-busy", "true");
    const shareLink = generiereShareLink();

    // Nutze Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareLink);
      zeigeFeedback();
    } else {
      // Fallback für ältere Browser
      const textarea = document.createElement("textarea");
      textarea.value = shareLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      zeigeFeedback();
    }
  } catch (error) {
    console.error("Fehler beim Kopieren:", error);
    alert(uebersetzung("sharing.error.copy", "Link konnte nicht kopiert werden"));
    button.removeAttribute("aria-busy");
  }

  function zeigeFeedback() {
    feedback.hidden = false;
    button.innerHTML = `<svg class="sharing-btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${uebersetzung("sharing.copied", "Kopiert!")}</span>`;

    setTimeout(() => {
      button.innerHTML = originalText;
      feedback.hidden = true;
      button.removeAttribute("aria-busy");
    }, 2000);
  }
}

/**
 * Lädt geteilte Daten aus URL-Parametern und füllt die Formulare
 */
function loadSharedData() {
  const params = new URLSearchParams(window.location.search);

  // Nur laden, wenn Parameter vorhanden sind
  if (params.size === 0) {
    return;
  }

  // Verzögere Laden bis DOM vollständig initialisiert ist
  setTimeout(() => {
    // Basiseingaben
    const dauer = params.get("dauer");
    if (dauer && document.getElementById("dauer")) {
      document.getElementById("dauer").value = dauer;
      document.getElementById("dauer").dispatchEvent(new Event("input", { bubbles: true }));
    }

    const stunden = params.get("stunden");
    if (stunden && document.getElementById("stunden")) {
      document.getElementById("stunden").value = stunden;
      document.getElementById("stunden").dispatchEvent(new Event("input", { bubbles: true }));
    }

    const teilzeitProzent = params.get("teilzeitProzent");
    if (teilzeitProzent && document.getElementById("teilzeitProzent")) {
      document.getElementById("teilzeitProzent").value = teilzeitProzent;
      document.getElementById("teilzeitProzent").dispatchEvent(new Event("input", { bubbles: true }));
    }

    const teilzeitStunden = params.get("teilzeitStunden");
    if (teilzeitStunden && document.getElementById("teilzeitStunden")) {
      document.getElementById("teilzeitStunden").value = teilzeitStunden;
      document.getElementById("teilzeitStunden").dispatchEvent(new Event("input", { bubbles: true }));
    }

    const alter = params.get("alter");
    if (alter && document.getElementById("alter")) {
      document.getElementById("alter").value = alter;
      document.getElementById("alter").dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Sprache setzen
    const sprache = params.get("sprache");
    if (sprache && document.getElementById("lang-switcher")) {
      document.getElementById("lang-switcher").value = sprache;
      document.getElementById("lang-switcher").dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Verkürzungsgründe laden
    const vkJson = params.get("vk");
    if (vkJson) {
      try {
        const vk = JSON.parse(decodeURIComponent(vkJson));

        // Setze Checkboxen
        document.querySelectorAll("#vk-fieldset input[type='checkbox'][data-vk-field]").forEach((checkbox) => {
          const field = checkbox.dataset.vkField;
          if (vk[field] === true) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        // Setze Ja/Nein-Antworten
        const yesNoQuestions = [
          { ja: 'kinderbetreuung-ja', nein: 'kinderbetreuung-nein', field: 'familien_kinderbetreuung' },
          { ja: 'pflege-ja', nein: 'pflege-nein', field: 'familien_pflegeverantwortung' },
          { ja: 'vk_beruf_q1_ja', nein: 'vk_beruf_q1_nein', field: 'beruf_q1' },
          { ja: 'vk_beruf_q2_ja', nein: 'vk_beruf_q2_nein', field: 'beruf_q2' },
          { ja: 'vk_beruf_q3_ja', nein: 'vk_beruf_q3_nein', field: 'beruf_q3' },
          { ja: 'vk_beruf_q4_ja', nein: 'vk_beruf_q4_nein', field: 'beruf_q4' },
          { ja: 'vk_beruf_q5_ja', nein: 'vk_beruf_q5_nein', field: 'beruf_q5' }
        ];

        yesNoQuestions.forEach(({ ja, nein, field }) => {
          const jaCheckbox = document.getElementById(ja);
          const neinCheckbox = document.getElementById(nein);
          
          if (vk[field] === 'ja' && jaCheckbox) {
            jaCheckbox.checked = true;
            jaCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          } else if (vk[field] === 'nein' && neinCheckbox) {
            neinCheckbox.checked = true;
            neinCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        // Setze Monate der nicht abgeschlossenen Ausbildung
        if (vk.beruf_q2_months) {
          const berufQ2Months = document.getElementById('vk_beruf_q2_dauer_months');
          if (berufQ2Months) {
            berufQ2Months.value = vk.beruf_q2_months;
            berufQ2Months.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }

        // Schulabschluss-Select
        const schoolSelect = document.querySelector('select[data-vk-type="school-select"]');
        if (schoolSelect) {
          const options = schoolSelect.querySelectorAll("option");
          for (const option of options) {
            const fields = (option.dataset.vkSetFields || "").split(",").map((s) => s.trim()).filter(Boolean);
            if (fields.some((f) => vk[f] === true)) {
              schoolSelect.value = option.value;
              schoolSelect.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            }
          }
        }

        // Trigger Berechnung (ohne Scroll)
        window.__skipScrollToResults = true;
        setTimeout(() => {
          const btnCalculate = document.querySelector("button[data-i18n='btn.calculate']");
          if (btnCalculate) {
            btnCalculate.click();
          }
          // Reset Flag nach Berechnung
          setTimeout(() => {
            window.__skipScrollToResults = false;
          }, 1000);
        }, 500);
      } catch (error) {
        console.error("Fehler beim Laden geteilter Daten:", error);
      }
    }
  }, 500);
}

/**
 * CSS für Spinner-Animation hinzufügen
 */
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .spinner {
    animation: spin 1s linear infinite;
    display: inline-block;
  }
`;
document.head.appendChild(style);
