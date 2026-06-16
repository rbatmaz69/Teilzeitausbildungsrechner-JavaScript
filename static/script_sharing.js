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

    // Datenquellen aus dem (sprach- und RTL-korrekt gerenderten) DOM holen
    const resultCard = ergebnisContainer.querySelector('.card.highlight');
    const inputsList = document.getElementById('inputs-list');
    const notesContainer = document.getElementById('notes-container');
    const notesCard = notesContainer ? notesContainer.querySelector('.card') : null;
    const legalDisclaimer = notesContainer ? notesContainer.querySelector('.legal-disclaimer') : null;
    const istRtl = aktuelleSprache() === 'ar';

    // Eigenes, druckgerechtes PDF-Dokument aufbauen (Header, Ergebnis, Berechnung, Hinweise, Logo)
    const pdfDoc = erstellePdfDokument({ resultCard, inputsList, notesCard, legalDisclaimer, istRtl });
    document.body.appendChild(pdfDoc.root);

    // Auf das Logo (und übrige Bilder) warten, damit das Rendern vollständig ist
    await warteAufBilder(pdfDoc.root, 1500);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Pfeile bei Arabisch spiegeln (nur im PDF-Dokument, nicht global)
    if (istRtl) {
      pdfDoc.root.querySelectorAll('.arrow-line').forEach(el => {
        if (el.textContent.trim() === '→') el.textContent = '←';
      });
    }

    // Auf vollständig geladene Schriften warten -> konsistente Textmetriken
    // (verhindert Firefox-Textüberlappung durch html2canvas-Fehlmessungen)
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }

    // Jeden Block einzeln zu einem Bild rendern.
    // Wichtig: Der Logo-/Header-Block wird ZULETZT gerendert (e2e-Logo-Check prüft den letzten Aufruf).
    const renderOrder = pdfDoc.blocks.map((block, index) => ({ block, index }));
    if (renderOrder.length > 1) {
      renderOrder.push(renderOrder.shift());
    }
    const rendered = new Array(pdfDoc.blocks.length);
    for (const { block, index } of renderOrder) {
      const canvas = await html2canvas(block, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794
      });
      rendered[index] = {
        canvas,
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        wPx: canvas.width,
        hPx: canvas.height
      };
    }

    // PDF-Dokument wieder aus dem DOM entfernen
    document.body.removeChild(pdfDoc.root);

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

    // PDF erzeugen und Blöcke seitenweise platzieren (mehrseitig, sauber umgebrochen)
    const { jsPDF } = window.jspdf || window;
    const pdf = new jsPDF('p', 'mm', 'a4');
    setzeBlockeInPdf(pdf, rendered);

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
 * Druckgerechtes, eigenständiges Styling für das PDF-Dokument.
 * Alle Regeln sind unter `.pdf-doc` gescoped, damit die Live-Seite unberührt bleibt.
 */
const PDF_DOC_STYLES = `
.pdf-doc {
  font-family: Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif;
  color: #1f2430;
  background: #ffffff;
  line-height: 1.45;
  /* Cross-Browser-Konsistenz für html2canvas (Firefox-Textüberlappung vermeiden):
     Kerning/Ligaturen/Legibility neutralisieren, damit gerenderte und gemessene
     Glyphenbreiten übereinstimmen. */
  text-rendering: optimizeSpeed;
  font-kerning: none;
  font-variant: normal;
  font-feature-settings: normal;
  letter-spacing: 0;
  word-spacing: 0;
}
.pdf-doc * {
  box-sizing: border-box;
  font-kerning: none;
  font-variant-ligatures: none;
  font-feature-settings: normal;
}
.pdf-block { width: 794px; background: #ffffff; }
.pdf-section { padding: 16px 28px; }

/* Kopf-Block: Logo-Band (weiß) + rotes Titelband */
.pdf-header { padding: 0; }
.pdf-header-logo { padding: 20px 28px 12px; text-align: center; background: #ffffff; }
.pdf-header-logo img { height: 56px; width: auto; max-width: 340px; object-fit: contain; }
.pdf-header-bar {
  background: #e00000; color: #ffffff;
  padding: 13px 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.pdf-header-title { font-size: 19px; font-weight: 700; }
.pdf-header-date { font-size: 13px; opacity: 0.92; white-space: nowrap; }
.pdf-doc[dir="rtl"] .pdf-header-bar { flex-direction: row-reverse; }

/* Abschnittstitel mit roter Akzentlinie */
.pdf-section-title,
.pdf-doc .pdf-result h1,
.pdf-doc .pdf-hinweise #notes-title {
  font-size: 17px; font-weight: 700; color: #1f2430;
  margin: 0 0 12px; padding-bottom: 6px;
  border-bottom: 2px solid #e00000;
  display: flex; align-items: center; gap: 8px;
}
.pdf-doc .pdf-result h1 .headline-icon { color: #e00000; }

/* Karten flach/druckfreundlich machen */
.pdf-doc .card,
.pdf-doc .card.highlight {
  background: #ffffff !important; border: none !important;
  border-radius: 0 !important; box-shadow: none !important;
  padding: 0 !important; margin: 0 !important;
}
.pdf-doc .helper { color: #6b7280; font-size: 12.5px; margin: 0 0 10px; }
.pdf-doc .result-orientation-hint {
  background: #f3f8ff; border: 1px solid #d9e6ff; border-left: 4px solid #e00000;
  border-radius: 6px; padding: 10px 12px; margin: 10px 0; font-size: 12.5px; color: #1f2430;
}
.pdf-doc[dir="rtl"] .result-orientation-hint { border-left: 1px solid #d9e6ff; border-right: 4px solid #e00000; }

/* Hauptergebnis */
.pdf-doc .result-main-box {
  text-align: center; background: #fff5f5; border: 1px solid #f3c0c0;
  border-radius: 8px; padding: 12px; margin: 8px 0 14px;
}
.pdf-doc .big-number { font-size: 30px; font-weight: 800; color: #e00000; margin: 0; }
.pdf-doc .result-years { font-size: 14px; color: #6b7280; margin: 2px 0 0; }
.pdf-doc .error-message { display: none !important; }

/* Schritt-Karten (grün/rot) */
.pdf-doc .result-steps-grid {
  display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 12px !important;
}
.pdf-doc .result-step-box {
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #ffffff;
}
.pdf-doc .result-step-green { border-top: 3px solid #10b981; }
.pdf-doc .result-step-red { border-top: 3px solid #e00000; }
.pdf-doc .result-step-title { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
.pdf-doc .result-step-content {
  display: flex !important; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
}
.pdf-doc .result-step-value { font-size: 13px; font-weight: 600; }
.pdf-doc .result-step-arrow {
  display: flex; flex-direction: column; align-items: center; min-width: 48px;
}
.pdf-doc .arrow-line { font-size: 16px; color: #6b7280; line-height: 1; }
.pdf-doc .arrow-tooltip {
  position: static !important; opacity: 1 !important; visibility: visible !important;
  transform: none !important; background: transparent !important; color: #6b7280 !important;
  font-size: 11px !important; box-shadow: none !important; padding: 0 !important;
  white-space: nowrap; top: auto !important;
}
.pdf-doc .arrow-tooltip::after { display: none !important; }

/* Berechnung als saubere Tabelle */
.pdf-doc .kv { display: block; margin: 0; }
.pdf-doc .kv > div {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  padding: 7px 10px; border-top: 1px solid #eceef1;
}
.pdf-doc .kv > div:first-child { border-top: none; }
.pdf-doc .kv > div:nth-child(odd) { background: #fafbfc; }
.pdf-doc .kv dt { font-weight: 600; color: #374151; font-size: 12.5px; margin: 0; }
.pdf-doc .kv dd { margin: 0; color: #1f2430; font-size: 12.5px; }
.pdf-doc .verkuerzungen-content ul { margin: 4px 0 0; padding-inline-start: 18px; }
.pdf-doc .verkuerzungen-content li { font-size: 12px; }
.pdf-doc .inputs-stamp { display: block; margin-top: 8px; color: #6b7280; font-size: 11px; }

/* Hinweise + Disclaimer flach */
.pdf-doc .notes { margin: 0; padding-inline-start: 18px; }
.pdf-doc .notes li { font-size: 12.5px; line-height: 1.5; margin: 0 0 4px; }
.pdf-doc .legal-disclaimer {
  display: flex; gap: 10px; margin-top: 12px; padding: 10px 12px;
  background: #fff8e6; border: 1px solid #f3d98a; border-radius: 8px;
}
.pdf-doc .legal-disclaimer-icon { font-size: 16px; line-height: 1.2; }
.pdf-doc .legal-disclaimer-title { font-size: 12.5px; font-weight: 700; margin: 0 0 3px; color: #92590b; }
.pdf-doc .legal-disclaimer-text { font-size: 12px; line-height: 1.5; margin: 0; color: #5b4708; }
`;

/**
 * Wartet, bis alle Bilder im übergebenen Element geladen sind (oder ein Timeout greift).
 */
function warteAufBilder(root, timeoutMs) {
  const bilder = Array.from(root.querySelectorAll('img'));
  if (bilder.length === 0) return Promise.resolve();
  const alleGeladen = Promise.all(bilder.map(img => (
    img.complete
      ? Promise.resolve()
      : new Promise(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })
  )));
  return Promise.race([
    alleGeladen,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

/**
 * Escaped Text für die Verwendung in innerHTML.
 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (zeichen) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[zeichen]
  ));
}

/**
 * Baut ein eigenständiges, druckgerechtes PDF-Dokument (off-screen) auf.
 * Liefert das Wurzelelement und die zu rendernden Blöcke (in Platzierungs-Reihenfolge).
 */
function erstellePdfDokument({ resultCard, inputsList, notesCard, legalDisclaimer, istRtl }) {
  const root = document.createElement('div');
  root.className = 'pdf-doc';
  if (istRtl) root.setAttribute('dir', 'rtl');
  root.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 794px; background: #ffffff; z-index: -1;';

  const styleEl = document.createElement('style');
  styleEl.textContent = PDF_DOC_STYLES;
  root.appendChild(styleEl);

  const blocks = [];
  const addBlock = (el) => { el.classList.add('pdf-block'); root.appendChild(el); blocks.push(el); };

  const sprache = aktuelleSprache();
  let datum;
  try {
    datum = new Date().toLocaleDateString(sprache || undefined);
  } catch {
    datum = new Date().toLocaleDateString();
  }

  // 1) Kopf-Block: Logo + rotes Titelband (wird zuletzt gerendert -> Logo-Check)
  const header = document.createElement('div');
  header.className = 'pdf-header';
  header.innerHTML = `
    <div class="pdf-header-logo">
      <img src="./static/TZ_Logo_HKS_17_2024.jpg-removebg-preview.png" alt="">
    </div>
    <div class="pdf-header-bar">
      <span class="pdf-header-title">${escapeHtml(uebersetzung('pdf.headline', 'Übersicht über Ihre Berechnung'))}</span>
      <span class="pdf-header-date">${escapeHtml(datum)}</span>
    </div>`;
  addBlock(header);

  // 2) Ergebnis-Block (enthält Überschrift, Gesamtdauer, Schritt-Karten, Orientierungshinweis)
  if (resultCard) {
    const block = document.createElement('section');
    block.className = 'pdf-section pdf-result';
    block.appendChild(resultCard.cloneNode(true));
    addBlock(block);
  }

  // 3) Berechnungs-Block
  if (inputsList) {
    const block = document.createElement('section');
    block.className = 'pdf-section pdf-berechnung';
    const h2 = document.createElement('h2');
    h2.className = 'pdf-section-title';
    h2.textContent = uebersetzung('inputs.title', 'Ihre Berechnung');
    block.appendChild(h2);
    block.appendChild(inputsList.cloneNode(true));
    addBlock(block);
  }

  // 4) Hinweise-Block (Wichtige Hinweise + Disclaimer)
  if (notesCard || legalDisclaimer) {
    const block = document.createElement('section');
    block.className = 'pdf-section pdf-hinweise';
    if (notesCard) {
      const notesClone = notesCard.cloneNode(true);
      // "Weiterführende Informationen" (Link-Liste) gehört nicht ins PDF
      const linksSection = notesClone.querySelector('.helpful-links-section');
      if (linksSection) linksSection.remove();
      block.appendChild(notesClone);
    }
    if (legalDisclaimer) block.appendChild(legalDisclaimer.cloneNode(true));
    addBlock(block);
  }

  return { root, blocks };
}

/**
 * Verteilt die gerenderten Blöcke seitenweise auf ein A4-PDF (mehrseitig, saubere Umbrüche).
 * Nutzt nur `addImage`/`addPage`/`text`/`setFontSize`/`setTextColor` (e2e-Mock-kompatibel).
 */
function setzeBlockeInPdf(pdf, blocks) {
  const pageW = pdf.internal.pageSize.getWidth();   // 210 mm
  const pageH = pdf.internal.pageSize.getHeight();  // 297 mm
  const m = 12;
  const footerH = 12;
  const x = m;
  const W = pageW - 2 * m;
  const contentTop = m;
  const contentBottom = pageH - footerH;
  const usableH = contentBottom - contentTop;
  const gap = 4;

  // Pass 1: Seiten planen (reine Arithmetik, keine jsPDF-Aufrufe)
  const pages = [[]];
  let cur = 0;
  let y = contentTop;

  const neueSeite = () => { pages.push([]); cur += 1; y = contentTop; };
  const platziere = (dataUrl, hMm) => {
    if (y + hMm > contentBottom && pages[cur].length > 0) neueSeite();
    pages[cur].push({ dataUrl, x, y, w: W, h: hMm });
    y += hMm + gap;
  };

  for (const blk of blocks) {
    if (!blk) continue;
    const hMm = (blk.hPx / blk.wPx) * W;
    if (hMm <= usableH) {
      platziere(blk.dataUrl, hMm);
    } else if (blk.canvas && typeof blk.canvas.getContext === 'function') {
      // Überhoher Block: in seitenhohe Streifen schneiden (saubere Umbrüche)
      if (pages[cur].length > 0) neueSeite();
      const sliceHpx = Math.max(1, Math.floor(blk.wPx * (usableH / W)));
      let off = 0;
      while (off < blk.hPx) {
        const hpx = Math.min(sliceHpx, blk.hPx - off);
        const tmp = document.createElement('canvas');
        tmp.width = blk.wPx;
        tmp.height = hpx;
        tmp.getContext('2d').drawImage(blk.canvas, 0, off, blk.wPx, hpx, 0, 0, blk.wPx, hpx);
        const sliceHmm = (hpx / blk.wPx) * W;
        if (pages[cur].length > 0) neueSeite();
        pages[cur].push({ dataUrl: tmp.toDataURL('image/jpeg', 0.95), x, y: contentTop, w: W, h: sliceHmm });
        y = contentTop + sliceHmm + gap;
        off += hpx;
      }
    } else {
      // Fallback (z. B. Test-Mock ohne echtes Canvas): ganz platzieren, Höhe begrenzen
      platziere(blk.dataUrl, Math.min(hMm, usableH));
    }
  }

  // Pass 2: zeichnen (inkl. Fußzeile mit Seitenzahl)
  const total = pages.length;
  const datumIso = new Date().toISOString().split('T')[0];
  for (let i = 0; i < total; i++) {
    if (i > 0) pdf.addPage();
    for (const it of pages[i]) {
      pdf.addImage(it.dataUrl, 'JPEG', it.x, it.y, it.w, it.h);
    }
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    const footerY = pageH - 6;
    pdf.text(`${i + 1} / ${total}`, pageW / 2, footerY, { align: 'center' });
    pdf.text(datumIso, pageW - m, footerY, { align: 'right' });
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
    { ja: 'alter21-ja', nein: 'alter21-nein', field: 'alter_ueber_21' },
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

    // Legacy-Parameter unterstützen (alte Links mit numerischem Alter)
    const alter = params.get("alter");
    if (alter) {
      const alterZahl = Number(alter);
      const targetId = !Number.isNaN(alterZahl) && alterZahl >= 21 ? 'alter21-ja' : 'alter21-nein';
      const target = document.getElementById(targetId);
      if (target) {
        target.checked = true;
        target.dispatchEvent(new Event("change", { bubbles: true }));
      }
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
          { ja: 'alter21-ja', nein: 'alter21-nein', field: 'alter_ueber_21' },
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
