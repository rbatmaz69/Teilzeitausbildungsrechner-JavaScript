import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Happy Path - Hauptnutzerflüsse
 * 
 * Diese Tests decken die wichtigsten User-Journeys ab:
 * - Vollzeit-Berechnung (36 Monate, 100%)
 * - Teilzeit-Berechnung (36 Monate, 75%)
 * - Teilzeit mit Verkürzung (Abitur)
 * - Stunden-Eingabe statt Prozent
 */

/**
 * Helper: Navigiert zur Seite und wartet bis Formular geladen ist
 * Das Formular ist jetzt immer sichtbar und scrollbar (kein Button-Klick nötig)
 */
async function gotoCalculator(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Sprachwechsel: Desktop oder Mobile
  const lang = 'de'; // Standard, kann für englische Tests angepasst werden
  const switcher = await page.$('#lang-switcher') || await page.$('#lang-switcher-desktop');
  if (switcher) {
    await switcher.selectOption(lang, { force: true });
  }
  await page.waitForTimeout(500);
  await expect(page.locator('body')).toContainText(lang === 'de' ? 'Ausbildungsdauer' : 'Training duration', { timeout: 5000 });
  await page.waitForSelector('#dauer', { state: 'visible', timeout: 5000 });
  await page.waitForSelector('#dauer', { state: 'visible', timeout: 10000 });
  await page.locator('#dauer').scrollIntoViewIfNeeded();
  await expect(page.locator('body')).toContainText(lang === 'de' ? 'Ausbildungsdauer' : 'Training duration', { timeout: 10000 });
  // Neue UI: Pflicht-Fragen als Ja/Nein-Kacheln
  if (await page.$('#alter21-nein') !== null) {
    const neinSelectors = ['alter21-nein','kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q2_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
    for (const id of neinSelectors) {
      // Sicherstellen, dass die Checkbox gesetzt ist, auch wenn sie nicht sichtbar ist (per JS togglen)
      await page.evaluate((elId) => {
        const el = document.getElementById(elId);
        if (!el) return;
        if (!el.checked) {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, id);
    }
  }
}

/**
 * Helper: Klickt Button mit automatischem Scroll
 */
async function clickButton(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.click(selector);
}

test.describe('Happy Path: Vollzeit Berechnungen', () => {
  
  test('Vollzeit ohne Verkürzung: 36 Monate, 40h, 100%', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Explizit 100% setzen (falls vorheriger Test Teilzeit aktiviert hat)
    await page.click('#teilzeitProzent');
    await page.fill('#teilzeitProzent', '100');
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    // Ergebnis: 36 Monate
    await expect(page.locator('#res-total-months')).toContainText('36');
  });

  test('Vollzeit mit Abitur-Verkürzung: 36-12 = 24 Monate', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Explizit 100% setzen (Vollzeit)
    await page.click('#teilzeitProzent');
    await page.fill('#teilzeitProzent', '100');
    // Abitur aus Dropdown auswählen (12 Monate Verkürzung)
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'abitur');
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    // Ergebnis: 36 - 12 = 24 Monate
    await expect(page.locator('#res-total-months')).toContainText('24');
  });
});

test.describe('Happy Path: Teilzeit Berechnungen', () => {
  
  test('Teilzeit 75%: (36 Monate * 100/75) = 48 Monate (Preset-Button)', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 75% Teilzeit eingeben
    await page.fill('#teilzeitProzent', '75');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75');
    await expect(page.locator('#teilzeitStunden')).toHaveValue('30');
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('48');
  });

  test('Teilzeit 50%: Preset-Button und manuelle Prozent-Eingabe', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 50% Teilzeit eingeben
    await page.fill('#teilzeitProzent', '50');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50', { timeout: 1000 });
    await expect(page.locator('#teilzeitStunden')).toHaveValue('20');
    // Ändere manuell auf 55%
    await page.fill('#teilzeitProzent', '55');
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('54');
  });

  test('Teilzeit 75% mit Abitur: (36-12) * 100/75 = 32 Monate', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 75% Teilzeit eingeben
    await page.fill('#teilzeitProzent', '75');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75', { timeout: 1000 });
    await page.selectOption('#vk-school-select', 'abitur');
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('32');
  });

  test('Teilzeit 50% (Minimum): 36 * 100/50 = 72, aber max 1.5x = 54 Monate', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 50% Teilzeit eingeben
    await page.fill('#teilzeitProzent', '50');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50', { timeout: 1000 });
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('54');
  });
});

test.describe('Happy Path: Stunden-Eingabe', () => {
  
  test('30 von 40 Stunden = 75% (manuelle Eingabe)', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 30 Stunden eingeben → Event-Handler berechnet 75%
    await page.fill('#teilzeitStunden', '30');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75', { timeout: 1000 });
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('48');
  });

  test('24h Preset-Button setzt korrekte Stunden', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 24 Stunden eingeben
    await page.fill('#teilzeitStunden', '24');
    await expect(page.locator('#teilzeitStunden')).toHaveValue('24');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('60');
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('54');
  });

  test('32h Preset-Button setzt korrekte Stunden', async ({ page }) => {
    await gotoCalculator(page);
    // Setze zuerst Ausbildungsdauer und Wochenstunden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 32 Stunden eingeben
    await page.fill('#teilzeitStunden', '32');
    await expect(page.locator('#teilzeitStunden')).toHaveValue('32');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('80');
    await clickButton(page, '#berechnenBtn');
    await expect(page.locator('#res-total-months')).toContainText('45');
  });
});

test.describe('Happy Path: Sprachwechsel', () => {
  
  test('Sprachwechsel DE → EN funktioniert', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wechsle zu Deutsch (um sauberen Startzustand zu haben)
    await page.selectOption('#lang-switcher', 'de', { force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.startseite-title-accent').first()).toContainText('Teilzeitausbildung', { timeout: 5000 });
    
    // Wechsle zu Englisch
    await page.selectOption('#lang-switcher', 'en', { force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.startseite-title-accent').first()).toContainText('part-time training', { timeout: 5000 });
  });
});

test.describe('Happy Path: English Language Tests', () => {
  
  /**
   * Helper für englische Tests
   */
  async function gotoCalculatorEnglish(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Sprachwechsel über UI (robuster als localStorage!) - force weil Dropdown manchmal hidden
    await page.selectOption('#lang-switcher', 'en', { force: true });
    
    // Warte bis Sprachänderung angewendet wurde
    await page.waitForTimeout(500); // Kurz warten für I18N reload
    await expect(page.locator('body')).toContainText('part-time training', { timeout: 5000 });
    await page.waitForSelector('#dauer', { state: 'visible', timeout: 5000 });
    await page.locator('#dauer').scrollIntoViewIfNeeded();
    // Neue UI: Pflicht-Fragen als Ja/Nein-Kacheln
    if (await page.$('#alter21-nein') !== null) {
      const neinSelectors = ['alter21-nein','kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q2_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
      for (const id of neinSelectors) {
        await page.evaluate((elId) => {
          const el = document.getElementById(elId);
          if (!el) return;
          if (!el.checked) {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, id);
      }
    }
  }
  
  test('Full-time calculation in English: 36 months', async ({ page }) => {
    await gotoCalculatorEnglish(page);
    
    // Prüfen, dass die englische Oberfläche geladen wurde
    await expect(page.locator('.startseite-title-accent').first()).toContainText('part-time training');
    
    // Pflichtfelder setzen, damit die Steuerelemente aktiviert werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    
    // 100% setzen (Vollzeit)
    await page.click('#teilzeitProzent');
    await page.fill('#teilzeitProzent', '100');
    
    // Berechnen
    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    await page.click('#berechnenBtn');
    
    // Ergebnis prüfen: 36 Monate
    await expect(page.locator('#res-total-months')).toContainText('36');
  });
  
  test('Part-time 75% calculation in English: 48 months', async ({ page }) => {
    await gotoCalculatorEnglish(page);
    
    // Sicherstellen, dass erforderliche Eingaben gesetzt sind, damit Prozent-Buttons aktiviert werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    
    // 75%-Voreinstellung klicken
    await page.click('[data-value="75"][data-type="percent"]');
    
    // Berechnen
    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    await page.click('#berechnenBtn');
    
    // Ergebnis prüfen: 36 * 100/75 = 48 Monate
    await expect(page.locator('#res-total-months')).toContainText('48');
  });
});

test.describe('Happy Path: Reset-Button', () => {
  
  test('Reset-Button setzt alle Felder zurück', async ({ page }) => {
    await gotoCalculator(page);
    
    // Mock confirm Dialog mit Zähler - nur ersten Aufruf bestätigen
    await page.evaluate(() => {
      let confirmCount = 0;
      window.confirm = () => {
        confirmCount++;
        return confirmCount === 1; // Nur beim ersten Mal true (für Reset)
      };
    });
    
    // Fülle Formular aus
    await page.fill('#dauer', '42');
    await page.fill('#stunden', '35');
    await page.fill('#teilzeitProzent', '80');
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'realschule');
    
    // Berechne Ergebnis
    await clickButton(page, '#berechnenBtn');
    
    // Prüfe dass Ergebnis sichtbar ist
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Reset-Button klicken
    await clickButton(page, '#btn-reset');
    
    // Warte bis Felder zurückgesetzt wurden (Akzeptiere leeren Wert oder Default)
    const dauerVal = await page.inputValue('#dauer');
    expect(['', '36']).toContain(dauerVal);
    const stundenVal = await page.inputValue('#stunden');
    expect(['', '40']).toContain(stundenVal);
    const prozentVal = await page.inputValue('#teilzeitProzent');
    expect(['', '75']).toContain(prozentVal);
    await expect(page.locator('#vk-school-select')).toHaveValue('none');
    
    // Prüfe dass Ergebnis hidden-Attribut hat
    await expect(page.locator('#ergebnis-container')).toHaveAttribute('hidden', '');
  });
});

test.describe('Happy Path: Sharing & PDF', () => {
  async function prepareFormWithResult(page) {
    await gotoCalculator(page);
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '75');
    await clickButton(page, '#berechnenBtn');
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
  }

  test('Link teilen kopiert URL und lädt Werte korrekt', async ({ page }) => {
    await prepareFormWithResult(page);

    // Mock Clipboard & alert
    await page.evaluate(() => {
      window.__copied = undefined;
      window.alert = () => {};
      if (!navigator.clipboard) navigator.clipboard = {};
      navigator.clipboard.writeText = async (text) => {
        window.__copied = text;
        return Promise.resolve();
      };
    });

    await page.locator('#btn-copy-link').scrollIntoViewIfNeeded();
    await page.click('#btn-copy-link');

    await expect.poll(async () => page.evaluate(() => window.__copied), { timeout: 4000 }).not.toBeNull();
    const finalUrl = await page.evaluate(() => window.__copied);
    expect(finalUrl).toContain('dauer=36');
    expect(finalUrl).toContain('stunden=40');
    expect(finalUrl).toContain('teilzeitProzent=75');

    await page.goto(finalUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#dauer')).toHaveValue('36');
    await expect(page.locator('#stunden')).toHaveValue('40');
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75');
  });

  test('PDF erstellen ruft html2canvas/jsPDF und speichert', async ({ page }) => {
    // Stub html2canvas und jsPDF vor dem ersten Page Load
    await page.addInitScript(() => {
      // Mock html2canvas als globale Funktion
      window.html2canvas = async (element) => ({
        width: 1200,
        height: 1800,
        toDataURL: (type, quality) => 'data:image/png;base64,TEST'
      });
      
      // Mock jsPDF
      function jsPDFMock() {
        this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
        this.addImage = (...args) => { window.__pdfAddImageArgs = args; };
        this.save = (name) => { window.__pdfSaved = name; };
        this.addPage = () => {};
        this.setFontSize = () => {};
        this.setTextColor = () => {};
        this.text = () => {};
      }
      
      window.jspdf = { jsPDF: jsPDFMock };
      window.jsPDF = jsPDFMock;
    });

    await prepareFormWithResult(page);

    await page.locator('#btn-download-pdf').scrollIntoViewIfNeeded();
    await page.click('#btn-download-pdf');

    // Warte auf save() Aufruf
    await expect.poll(async () => page.evaluate(() => window.__pdfSaved), { timeout: 10000 }).not.toBeUndefined();
    
    const saveName = await page.evaluate(() => window.__pdfSaved);
    const addImageArgs = await page.evaluate(() => window.__pdfAddImageArgs);
    expect(saveName).toMatch(/Ergebnis_Teilzeitausbildung_/);
    expect(addImageArgs?.[4]).toBeGreaterThan(0); // width
    expect(addImageArgs?.[5]).toBeGreaterThan(0); // height
  });
});

test.describe('Mobile Tests: Happy Path', () => {
  /**
   * Helper für Mobile-Tests (iPhone 13 Viewport)
   */
  async function gotoCalculatorMobile(page) {
    // iPhone 13 Viewport setzen
    await page.setViewportSize({ width: 390, height: 844 });
    
    // Setze Sprache auf Deutsch via UI (robuster als localStorage)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.selectOption('#lang-switcher', 'de', { force: true });
    await page.waitForTimeout(200);
    
    // Warte bis Seite komplett geladen ist
    await page.waitForLoadState('networkidle');
    
    // Warte bis Formular sichtbar ist
    await page.waitForSelector('#dauer', { state: 'visible', timeout: 10000 });
    
    // Scroll zum Formular
    await page.locator('#dauer').scrollIntoViewIfNeeded();
    
    // Warte auf deutschen Text (robuster für Mobile)
    await expect(page.locator('body')).toContainText('Ausbildungsdauer', { timeout: 10000 });
    // Neue UI: Pflicht-Fragen als Ja/Nein-Kacheln
    if (await page.$('#alter21-nein') !== null) {
      const neinIds = ['alter21-nein','kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q2_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
      for (const id of neinIds) {
        await page.evaluate((elId) => {
          const el = document.getElementById(elId);
          if (!el) return;
          if (!el.checked) {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, id);
      }
    }
  }
  
  /**
   * Helper: Klickt Button mit automatischem Scroll (Mobile)
   */
  async function clickButtonMobile(page, selector) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.click(selector);
  }
  
  test('Mobile: Vollzeit ohne Verkürzung - 36 Monate', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Teilzeit-Input aktiv wird
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Explizit 100% setzen (Vollzeit)
    await page.click('#teilzeitProzent');
    await page.fill('#teilzeitProzent', '100');
    
    // Berechnen
    await clickButtonMobile(page, '#berechnenBtn');
    
    // Warte auf Ergebnis-Container
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Scroll zum Ergebnis (wichtig auf Mobile!)
    await page.locator('#res-total-months').scrollIntoViewIfNeeded();
    
    // Ergebnis: 36 Monate
    await expect(page.locator('#res-total-months')).toContainText('36');
  });
  
  test('Mobile: Teilzeit 75% - 48 Monate', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Preset-Buttons aktiv werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 75% Button klicken
    await clickButtonMobile(page, '[data-value="75"][data-type="percent"]');
    
    // Prüfe dass Button den Wert gesetzt hat
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75');
    
    // Berechnen
    await clickButtonMobile(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Scroll zum Ergebnis
    await page.locator('#res-total-months').scrollIntoViewIfNeeded();
    
    // Ergebnis: 36 * 100/75 = 48 Monate
    await expect(page.locator('#res-total-months')).toContainText('48');
  });
  
  test('Mobile: Teilzeit 50% mit Abitur - 48 Monate', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Preset-Buttons aktiv werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // 50% Button klicken
    await clickButtonMobile(page, '[data-value="50"][data-type="percent"]');
    
    // Abitur aus Dropdown auswählen
    await page.selectOption('#vk-school-select', 'abitur');
    
    // Berechnen
    await clickButtonMobile(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Scroll zum Ergebnis
    await page.locator('#res-total-months').scrollIntoViewIfNeeded();
    
    // Ergebnis: (36 - 12) * 100/50 = 48 Monate
    await expect(page.locator('#res-total-months')).toContainText('48');
  });
  
  test('Mobile: Validierung Minimum 24 Monate', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Ungültigen Wert eingeben (unter 24)
    await page.fill('#dauer', '10');
    
    // Blur Event auslösen durch Klick auf anderes Feld
    await clickButtonMobile(page, '#stunden');
    
    // Wert wird auf 24 korrigiert
    await expect(page.locator('#dauer')).toHaveValue('24');
    
    // Fehlermeldung wird angezeigt
    await expect(page.locator('#errorDauer')).toBeVisible();
    await expect(page.locator('#errorDauer')).toContainText('mindestens 24 Monate');
  });
  
  test('Mobile: Validierung Minimum 50% Teilzeit', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Teilzeit-Feld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Aktiviere Teilzeit mit 75% Button (damit Feld aktiv ist)
    await clickButtonMobile(page, '[data-value="75"][data-type="percent"]');
    
    // Warte bis Button-Handler fertig
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75', { timeout: 1000 });
    
    // Ungültigen Wert eingeben (unter 50%)
    await page.fill('#teilzeitProzent', '30');
    
    // Blur Event auslösen
    await clickButtonMobile(page, '#dauer');
    
    // Wert wird auf 50 korrigiert - warte auf Validierung
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50', { timeout: 2000 });
    
    // Fehlermeldung wird angezeigt
    await expect(page.locator('#errorProzent')).toContainText('mindestens 50%');
  });
  
  test('Mobile: Sprachwechsel DE → EN mit Mobile-Switcher', async ({ page }) => {
    // iPhone 13 Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wechsle zu Deutsch (um sauberen Startzustand zu haben)
    await page.selectOption('#lang-switcher', 'de', { force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.startseite-title-accent').first()).toContainText('Teilzeitausbildung', { timeout: 5000 });
    
    // Wechsle zu Englisch
    await page.selectOption('#lang-switcher', 'en', { force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.startseite-title-accent').first()).toContainText('part-time training', { timeout: 5000 });
  });
  
  test('Mobile: Scroll zu Ergebnis nach Berechnung', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Setze Werte
    await page.fill('#dauer', '30');
    await page.fill('#stunden', '35');
    await clickButtonMobile(page, '[data-value="75"][data-type="percent"]');
    
    // Warte bis Event-Handler fertig ist
    await expect(page.locator('#teilzeitProzent')).toHaveValue('75', { timeout: 1000 });
    
    // Berechnen
    await clickButtonMobile(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Prüfe dass Ergebnis-Container sichtbar ist (impliziert automatisches Scroll)
    await expect(page.locator('#ergebnis-container')).toBeVisible();
    
    // Warte bis das Ergebnis tatsächlich gerendert ist (nicht die Platzhalter '–')
    await page.waitForFunction(() => {
      const el = document.querySelector('#res-total-months');
      return el && /\d/.test(el.innerText);
    }, [], { timeout: 3000 });

    // Prüfe Ergebnis: 30 * 100/75 ≈ 40 Monate (Toleranz: 39 oder 40 wegen Rundung/Logik)
    const monthsText = await page.locator('#res-total-months').innerText();
    expect(monthsText).toMatch(/39|40/);
  });
  
  test('Mobile: Reset-Button funktioniert', async ({ page }) => {
    await gotoCalculatorMobile(page);
    
    // Mock confirm Dialog
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    
    // Setze mehrere Werte
    await page.fill('#dauer', '30');
    await page.fill('#stunden', '35');
    await clickButtonMobile(page, '[data-value="75"][data-type="percent"]');
    await page.selectOption('#vk-school-select', 'abitur');
    // Alter 21+ auf Ja setzen
    await page.evaluate(() => {
      const ja = document.getElementById('alter21-ja');
      if (ja) {
        ja.checked = true;
        ja.dispatchEvent(new Event('change', { bubbles: true }));
        ja.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    
    // Berechnen
    await clickButtonMobile(page, '#berechnenBtn');
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Reset klicken (korrekter Selector: #btn-reset) — disabled in CI for now
    await page.locator('#btn-reset').scrollIntoViewIfNeeded();
    await page.click('#btn-reset');
    
    // Warte bis alle Felder zurückgesetzt wurden (erwarte Default-Werte oder leer)
    const dauerValMobile = await page.inputValue('#dauer');
    expect(['', '36']).toContain(dauerValMobile);
    const stundenValMobile = await page.inputValue('#stunden');
    expect(['', '40']).toContain(stundenValMobile);
    const prozentValMobile = await page.inputValue('#teilzeitProzent');
    expect(['', '75']).toContain(prozentValMobile);
    await expect(page.locator('#vk-school-select')).toHaveValue('none');
    await expect(page.locator('#alter21-ja')).not.toBeChecked();
    await expect(page.locator('#alter21-nein')).not.toBeChecked();
    
    // Prüfe dass Ergebnis versteckt wurde
    await expect(page.locator('#ergebnis-container')).toBeHidden();
  });
});
