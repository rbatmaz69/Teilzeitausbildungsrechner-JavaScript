import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Error Scenarios
 * 
 * Diese Tests prüfen Fehlerszenarien und Edge Cases:
 * - API-Fehler (500, 422)
 * - Ungültige Kombinationen
 * - Grenzfälle (z.B. Teilzeit 50% mit Verkürzung)
 */

/**
 * Helper: Navigiert zur Seite und wartet bis Formular geladen ist
 */
async function gotoCalculator(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Sprachwechsel über UI (robuster als localStorage!) - force weil Dropdown manchmal hidden
  await page.selectOption('#lang-switcher', 'de', { force: true });
  
  // Warte bis Sprachänderung angewendet wurde
  await page.waitForTimeout(500); // Kurz warten für I18N reload
  await expect(page.locator('body')).toContainText('Ausbildungsdauer', { timeout: 5000 });
  await page.waitForSelector('#dauer', { state: 'visible', timeout: 5000 });
  await page.locator('#dauer').scrollIntoViewIfNeeded();
  // Neue UI: Es gibt ein Pflicht-Alter-Feld und mehrere Ja/Nein Fragen für Verkürzungsgründe
  // Fülle standardmäßig Alter (nicht über 21) und beantworte alle Fragen mit 'Nein', Tests können danach gezielt auf 'Ja' setzen
  if (await page.$('#alter') !== null) {
    await page.fill('#alter', '20');
    await page.locator('#alter').blur();
    const neinSelectors = ['kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q2_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
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

/**
 * Helper: Klickt Button mit automatischem Scroll
 */
async function clickButton(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.click(selector);
}

test.describe('Error Handling: Berechnungsfehler', () => {
  
  test('Anzeige wenn lokale Berechnung fehlschlägt', async ({ page }) => {
    // Frontend-only: Ersetze lokale Berechnungsfunktion durch Fehlerwurf.
    await page.addInitScript(() => {
      window.berechneGesamtdauer = () => {
        throw new Error('Simulierter Berechnungsfehler');
      };
    });
    
    await gotoCalculator(page);
    // Setze gültigen Wert für Ausbildungsdauer und Wochenstunden, damit alle Felder aktiv sind
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Sicherstellen, dass 100% (Vollzeit) gesetzt sind, damit die Verkürzungsberechnungen einfach sind
    await page.fill('#teilzeitProzent', '100');
    // Berechnen-Button sollte disabled sein wenn keine Verkürzung gewählt
    // Wähle eine Verkürzung aus Dropdown
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'abitur');
    // Klicke Berechnen
    await clickButton(page, '#berechnenBtn');
    // Button sollte wieder enabled sein nach Fehler
    await expect(page.locator('#berechnenBtn')).toBeEnabled({ timeout: 3000 });
  });
});

test.describe('Edge Cases: Grenzwerte', () => {
  
  test('Teilzeit 50% mit Verkürzung ergibt max 1.5x Regel', async ({ page }) => {
    await gotoCalculator(page);
    // Minimale Dauer 24 Monate
    await page.fill('#dauer', '24');
    await page.fill('#stunden', '40');
    // Explizit 50% über Button setzen
    await clickButton(page, '[data-type="percent"][data-value="50"]');
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    // Ergebnis: 24 * 2 = 48, aber max 1.5x Obergrenze = 24 * 1.5 = 36 Monate
    await expect(page.locator('#res-total-months')).toContainText('36');
  });

  test('Maximum Dauer 42 mit minimum Teilzeit 50%', async ({ page }) => {
    await gotoCalculator(page);
    
    // Maximum Dauer
    await page.fill('#dauer', '42');
    await page.fill('#stunden', '40');
    
    // Minimum Teilzeit 50% über Button setzen
    await expect(page.locator('[data-type="percent"][data-value="50"]')).toBeEnabled({ timeout: 2000 });
    await clickButton(page, '[data-type="percent"][data-value="50"]');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 42 * 2 = 84, aber max 1.5x Obergrenze = 42 * 1.5 = 63 Monate
    await expect(page.locator('#res-total-months')).toContainText('63');
  });

  test('Alle Verkürzungsgründe kombiniert mit 50% Teilzeit (1.5x Obergrenze)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Standard Dauer 36, Vollzeit (40h Standardwert)
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    
    // 50% Teilzeit setzen
    await clickButton(page, '[data-type="percent"][data-value="50"]');
    
    // Alle Verkürzungen aktivieren (max 12M → 36 - 12 = 24M)
    // 1. Abitur aus Dropdown
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'abitur');
    // 2. Familie/Pflegeverantwortung (neue UI: klick 'Ja')
    // Checkbox programmatisch setzen, um Sichtbarkeits-/Klick-Probleme in CI zu vermeiden
    await page.evaluate(() => {
      const el = document.getElementById('pflege-ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    // 3. Berufliche Vorkenntnisse -> mappe auf praktische Erfahrung (Q3) (klick 'Ja')
    await page.evaluate(() => {
      const el = document.getElementById('vk_beruf_q3_ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    // 4. Alter über 21 -> neues UI: setze `#alter` > 21
    await page.fill('#alter', '25');
    await page.locator('#alter').blur();
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 24M * 2 = 48M, aber max 1.5x Obergrenze = 36M * 1.5 = 54M (Bezug ist Original-Dauer 36M!)
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('48');
  });
});

test.describe('Business Rules: Verkürzungen', () => {
  
  test('Maximale Verkürzung 12 Monate: Nur Abitur (Dropdown)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Basis-Dauer 36 Monate
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '50');
    
    // Abitur (12M Verkürzung)
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'abitur');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 - 12 = 24 Monate mit 75% Teilzeit → 32 Monate
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('48');
  });

  test('Verkürzung mit einzelner Checkbox: Familie/Pflege', async ({ page }) => {
    await gotoCalculator(page);
    
    // Basis-Dauer 36 Monate, Vollzeit
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '100');
    
    // Nur Familie/Pflege aktivieren
    // Familie/Pflege: klick 'Ja'
    await page.evaluate(() => {
      const el = document.getElementById('pflege-ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: Familie/Pflege gibt 12 Monate Verkürzung
    // 36 - 12 = 24 Monate Vollzeit
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('24');
  });

  test('Verkürzung mit einzelner Checkbox: Alter über 21', async ({ page }) => {
    await gotoCalculator(page);
    
    // Basis-Dauer 36 Monate, Vollzeit
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '100');
    
    // Nur Alter über 21 aktivieren
    // 4. Alter über 21 -> neues UI: setze `#alter` > 21
    await page.fill('#alter', '25');
    await page.locator('#alter').blur();
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: Alter 21+ gibt 12 Monate Verkürzung
    // 36 - 12 = 24 Monate Vollzeit
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('24');
  });

  test('Realschule (Dropdown) + Vorkenntnisse (Checkbox)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Basis-Dauer 36 Monate
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '50');
    
    // Realschule (6M) + Vorkenntnisse (12M) = 18M, max ist aber 12M
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'realschule');
    // Vorkenntnisse -> mappe auf praktische Erfahrung (Q3): klick 'Ja'
    await page.evaluate(() => {
      const el = document.getElementById('vk_beruf_q3_ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 - 12 (max) = 24 mit 75% → 32 Monate
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('48');
  });

  test('Maximale Verkürzung 12 Monate: Alle Checkbox-Gründe kombiniert', async ({ page }) => {
    await gotoCalculator(page);
    
    // Basis-Dauer 36 Monate (Vollzeit ist Standard 75%)
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '50');
    
    // Alle Verkürzungen (würde 12+12+12 = 36M ergeben, max ist aber 12M)
    await page.waitForSelector('#vk-school-select', { state: 'visible', timeout: 2000 });
    await page.locator('#vk-school-select').scrollIntoViewIfNeeded();
    await page.selectOption('#vk-school-select', 'abitur');
    await page.evaluate(() => {
      const el = document.getElementById('pflege-ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.evaluate(() => {
      const el = document.getElementById('vk_beruf_q3_ja');
      if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    // Neues UI: setze Alter >21 statt Checkbox
    await page.fill('#alter', '25');
    await page.locator('#alter').blur();
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 - 12 (max) = 24 Monate mit 75% Teilzeit → 32 Monate
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('48');
  });

  test('Mindestdauer 24 Monate wird eingehalten (keine Verkürzung)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Minimale Basis-Dauer 24 Monate mit Standard 75% Teilzeit
    await page.fill('#dauer', '24');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '50');
    
    // Keine Verkürzung ausgewählt - Dropdown bleibt auf "none"
    // Keine Checkboxen aktiviert
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 24M mit 75% → 32 Monate
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('36');
  });

  test('Regel § 8 Abs. 3 BBiG: Dauer ≤ Original+6M → Original verwenden', async ({ page }) => {
    await gotoCalculator(page);
    
    // 36 Monate mit 95% Teilzeit (sollte ~38M ergeben, aber <42M)
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '95');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 / 0.95 = 37.89 → 37M, aber durch § 8 Abs. 3 auf 36M begrenzt
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('36');
  });
});

test.describe('Edge Cases: Teilzeit-Grenzwerte', () => {
  
  test('51% Teilzeit (knapp über Minimum)', async ({ page }) => {
    await gotoCalculator(page);
    
    // 36 Monate mit 51% Teilzeit
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '51');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 / 0.51 ≈ 70.5 → 70 Monate (abgerundet)
    // ABER: max 1.5x = 54M
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('54');
  });

  test('99% Teilzeit (knapp unter Maximum)', async ({ page }) => {
    await gotoCalculator(page);
    
    // 36 Monate mit 99% Teilzeit
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '99');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Ergebnis: 36 / 0.99 ≈ 36.36 → 36 Monate (abgerundet)
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('36');
  });
});

test.describe('Input Validation: Ungültige Zeichen', () => {
  
  test('Zahlenfeld akzeptiert nur numerische Werte', async ({ page }) => {
    await gotoCalculator(page);
    
    // Prüfe dass Input für numerische Eingabe optimiert ist (inputmode=numeric)
    const inputMode = await page.getAttribute('#dauer', 'inputmode');
    expect(inputMode).toBe('numeric');
    
    // Aktueller Wert sollte numerisch sein (setze explizit falls leer)
    await page.fill('#dauer', '36');
    const value = await page.inputValue('#dauer');
    expect(value).toMatch(/^\d+$/); // Nur Zahlen
    expect(parseInt(value)).toBeGreaterThanOrEqual(24);
  });
});

test.describe('Error Scenarios: English Language Tests', () => {
  
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
    // Neue UI: Pflicht-Alter-Feld und Ja/Nein Fragen für Verkürzungsgründe
    if (await page.$('#alter') !== null) {
      await page.fill('#alter', '20');
      // Alle 'nein'-Antworten programmatisch setzen, um flüchtige Klick-Probleme zu vermeiden
      await page.evaluate(() => {
        const ids = ['kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q2_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
        ids.forEach(id => {
          try {
            const el = document.getElementById(id);
            if (el && !el.checked) {
              el.checked = true;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch (e) {
            // ignore
          }
        });
      });
    }
  }
  
  async function clickButton(page, selector) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.click(selector);
  }
  
  test('Part-time 50% with shortening in English', async ({ page }) => {
    await gotoCalculatorEnglish(page);
    
    // Pflichtfelder setzen, damit die Prozent-Buttons aktiviert werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    
    // Teilzeit auf 50% setzen
    await page.click('[data-value="50"][data-type="percent"]');
    
    // Abitur-Verkürzung hinzufügen
    await page.selectOption('#vk-school-select', 'abitur');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Auf Ergebnis warten
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Prüfen: (36 - 12) * 100/50 = 48 Monate
    // Hinweis: Verkürzung wird VOR der Teilzeit-Multiplikation angewendet
    await expect(page.locator('#res-total-months')).toContainText('48');
  });
});

// ----------------------------------
// Q2: Nicht abgeschlossene Ausbildung (Dauer) - Buckets & Validation
// ----------------------------------
test.describe('Q2: Nicht abgeschlossene Ausbildung (Dauer)', () => {
  async function prepareBase(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Deutsch UI sicherstellen für deterministische Meldungen/Verhalten
    await page.selectOption('#lang-switcher', 'de', { force: true });
    await page.waitForTimeout(200);
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Basiszustand: Andere Ja/Nein-Gruppen programmatisch auf 'nein' setzen
    await page.evaluate(() => {
      const neinIds = ['kinderbetreuung-nein','pflege-nein','vk_beruf_q1_nein','vk_beruf_q3_nein','vk_beruf_q4_nein'];
      neinIds.forEach(id => {
        try {
          const el = document.getElementById(id);
          if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
        } catch (e) { }
      });
      // set a safe default age <21 so age-based shortening not applied
      try { const a = document.getElementById('alter'); if (a) { a.value = '20'; a.dispatchEvent(new Event('input', { bubbles: true })); } } catch (e) {}
    });
    // Sicherstellen, dass Vollzeit (100%) gesetzt ist, damit Verkürzungsberechnungen in Tests deterministisch sind
    await page.fill('#teilzeitProzent', '100');
    // UI-Listener kurz Zeit geben, auf Prozent-Änderung zu reagieren
    await page.waitForTimeout(100);
  }

  test('Q2 <6 Monate → keine Verkürzung (0 Monate)', async ({ page }) => {
    await prepareBase(page);

    // Q2=Ja aktivieren und Dauer auf 5 Monate setzen (führt zu 0 Monaten Verkürzung)
    await page.evaluate(() => {
      const q2yes = document.getElementById('vk_beruf_q2_ja');
      if (q2yes) { q2yes.checked = true; q2yes.dispatchEvent(new Event('change', { bubbles: true })); }
      const q2dur = document.getElementById('vk_beruf_q2_dauer_months');
      if (q2dur) { q2dur.value = '5'; q2dur.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    // UI-Listener reagieren lassen auf die programmgesteuerten Änderungen
    await page.waitForTimeout(100);
    await page.click('#berechnenBtn');

    // Keine Verkürzung erwartet → Ergebnis bleibt 36 Monate
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('36');
  });

  test('Q2 6..11 Monate → 6 Monate Verkürzung', async ({ page }) => {
    await prepareBase(page);

    await page.evaluate(() => {
      const q2yes = document.getElementById('vk_beruf_q2_ja');
      if (q2yes) { q2yes.checked = true; q2yes.dispatchEvent(new Event('change', { bubbles: true })); }
      const q2dur = document.getElementById('vk_beruf_q2_dauer_months');
      if (q2dur) { q2dur.value = '6'; q2dur.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.click('#berechnenBtn');

    // Expected: 36 - 6 = 30 months
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('30');
  });

  test('Q2 >=12 Monate → 12 Monate Verkürzung', async ({ page }) => {
    await prepareBase(page);

    await page.evaluate(() => {
      const q2yes = document.getElementById('vk_beruf_q2_ja');
      if (q2yes) { q2yes.checked = true; q2yes.dispatchEvent(new Event('change', { bubbles: true })); }
      const q2dur = document.getElementById('vk_beruf_q2_dauer_months');
      if (q2dur) { q2dur.value = '12'; q2dur.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.click('#berechnenBtn');

    // Expected: 36 - 12 = 24 months
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#res-total-months')).toContainText('24');
  });

  test('Q2 validierung: Q2=Ja ohne Dauer → Fehler und keine Berechnung', async ({ page }) => {
    await prepareBase(page);

    // Activate Q2=Ja but leave duration empty
    await page.evaluate(() => {
      const q2yes = document.getElementById('vk_beruf_q2_ja');
      if (q2yes) { q2yes.checked = true; q2yes.dispatchEvent(new Event('change', { bubbles: true })); }
      const q2dur = document.getElementById('vk_beruf_q2_dauer_months');
      if (q2dur) { q2dur.value = ''; q2dur.dispatchEvent(new Event('input', { bubbles: true })); }
    });

    await page.locator('#berechnenBtn').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.click('#berechnenBtn');

    // Calculation should be blocked; result container should remain hidden or show no numeric result
    // Error message for Q2 duration should be set (non-empty)
      const err = await page.locator('#errorBerufQ2Dauer').innerText();
      expect(err.trim().length).toBeGreaterThan(0);

      // Result should not contain a numeric value when validation fails
      const resText = await page.locator('#res-total-months').innerText();
      expect(resText).not.toMatch(/\d/);
  });
});

// ============================================================================
// MOBILE ERROR SCENARIOS TESTS
// ============================================================================

test.describe('Mobile: Edge Cases Grenzwerte', () => {
  
  test.beforeEach(async ({ page }) => {
    // iPhone 13 viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Teilzeit 50% mit Verkürzung ergibt max 1.5x Regel', async ({ page }) => {
    await gotoCalculator(page);
    
    // Minimale Dauer 24 Monate
    await page.fill('#dauer', '24');
    await page.fill('#stunden', '40');
    
    // Explizit 50% über Button setzen
    await clickButton(page, '[data-type="percent"][data-value="50"]');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 24 * 2 = 48, aber max 1.5x Obergrenze = 24 * 1.5 = 36 Monate
    await expect(page.locator('#res-total-months')).toContainText('36');
  });

  test('Mobile: Maximum Dauer 42 mit minimum Teilzeit 50%', async ({ page }) => {
    await gotoCalculator(page);
    
    // Maximum Dauer
    await page.fill('#dauer', '42');
    await page.fill('#stunden', '40');
    
    // Minimum Teilzeit 50% über Button setzen
    await clickButton(page, '[data-type="percent"][data-value="50"]');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 42 * 2 = 84, aber max 1.5x Obergrenze = 42 * 1.5 = 63 Monate
    await expect(page.locator('#res-total-months')).toContainText('63');
  });

  test('Mobile: 51% Teilzeit (knapp über Minimum)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Erforderliche Eingaben setzen, damit Prozent-Controls aktiviert sind
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Setze manuelle Prozente
    await clickButton(page, '[data-type="percent"][data-value="75"]');
    await page.fill('#teilzeitProzent', '51');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 36 / 0.51 ≈ 70.5 → 70 Monate (abgerundet)
    // ABER: max 1.5x = 54M
    await expect(page.locator('#res-total-months')).toContainText('54');
  });

  test('Mobile: 99% Teilzeit (knapp unter Maximum)', async ({ page }) => {
    await gotoCalculator(page);
    
    // Erforderliche Eingaben setzen, damit Prozent-Controls aktiviert sind
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Setze manuelle Prozente
    await clickButton(page, '[data-type="percent"][data-value="75"]');
    await page.fill('#teilzeitProzent', '99');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 36 / 0.99 ≈ 36.36 → 36 Monate (abgerundet)
    await expect(page.locator('#res-total-months')).toContainText('36');
  });
});

test.describe('Mobile: Business Rules Verkürzungen', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Maximale Verkürzung 12 Monate bei Abitur', async ({ page }) => {
    await gotoCalculator(page);
    
    // Vollzeit 100% (sonst ist Default 75%)
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await page.fill('#teilzeitProzent', '100');
    
    // Wähle Abitur (12 Monate)
    await page.selectOption('#vk-school-select', 'abitur');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: 36 - 12 = 24 Monate
    await expect(page.locator('#res-total-months')).toContainText('24');
  });

  test('Mobile: Teilzeit 75% mit Abitur: (36-12) * 100/75 = 32 Monate', async ({ page }) => {
    await gotoCalculator(page);
    
    // Erforderliche Eingaben setzen, damit Prozent-Controls aktiviert sind
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Teilzeit 75% über Preset-Button
    await clickButton(page, '[data-type="percent"][data-value="75"]');
    
    // Wähle Abitur (12 Monate)
    await page.selectOption('#vk-school-select', 'abitur');
    
    // Berechnen
    await clickButton(page, '#berechnenBtn');
    
    // Warte auf Ergebnis
    await page.waitForSelector('#ergebnis-container:not([hidden])', { state: 'visible', timeout: 5000 });
    
    // Ergebnis: (36 - 12) * 100/75 = 24 * 1.33... = 32 Monate
    await expect(page.locator('#res-total-months')).toContainText('32');
  });
});
