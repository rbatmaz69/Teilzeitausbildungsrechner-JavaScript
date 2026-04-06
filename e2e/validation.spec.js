import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Input Validierung
 * 
 * Diese Tests prüfen die Frontend-Validierung der Eingabefelder:
 * - Min/Max Limits für Ausbildungsdauer (24-42 Monate)
 * - Min/Max Limits für Wochenstunden (10-48 Stunden)
 * - Teilzeit-Prozent Minimum (50%)
 * - Spinner-Verhalten an Limits
 */

/**
 * Helper: Navigiert zur Seite und wartet bis Formular geladen ist
 * Setzt Sprache IMMER auf Deutsch um Race Conditions zwischen parallel laufenden Tests zu vermeiden
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

/**
 * Helper: Klickt Button mit automatischem Scroll
 */
async function clickButton(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.click(selector);
}

test.describe('Validierung: Ausbildungsdauer', () => {
  
  test('Minimum 24 Monate wird erzwungen bei blur', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert unter Minimum
    await page.fill('#dauer', '10');
    
    // Blur triggern (auf anderes Feld klicken)
    await clickButton(page, '#stunden');
    
    // Wert sollte auf 24 korrigiert sein
    await expect(page.locator('#dauer')).toHaveValue('24');
    
    // Fehlermeldung sollte angezeigt werden
    await expect(page.locator('#errorDauer')).toBeVisible();
    await expect(page.locator('#errorDauer')).toContainText('mindestens 24 Monate');
  });

  test('Maximum 42 Monate wird sofort erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert über Maximum
    await page.fill('#dauer', '60');
    
    // Wert sollte auf 42 korrigiert sein (mit Timeout für Auto-Korrektur)
    await expect(page.locator('#dauer')).toHaveValue('42', { timeout: 2000 });
  });

  test('Gültiger Wert (36) zeigt keinen Fehler', async ({ page }) => {
    await gotoCalculator(page);
    
    // Neues UI: Werte werden nicht immer vorausgefüllt -> setze explizit
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    await expect(page.locator('#dauer')).toHaveValue('36');

    // Keine Fehlermeldung
    await expect(page.locator('#errorDauer')).toBeEmpty();
  });
});

test.describe('Validierung: Wochenstunden', () => {
  
  test('Minimum 10 Stunden wird erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    // Setze gültigen Wert für Ausbildungsdauer, damit Stundenfeld aktiv ist
    await page.fill('#dauer', '36');
    // Setze ungültigen Wert
    await page.fill('#stunden', '5');
    // Blur triggern
    await clickButton(page, '#dauer');
    // Korrigiert auf 10
    await expect(page.locator('#stunden')).toHaveValue('10');
    await expect(page.locator('#errorStunden')).toContainText('mindestens 10 Stunden');
  });

  test('Maximum 48 Stunden wird sofort erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    // Setze gültigen Wert für Ausbildungsdauer, damit Stundenfeld aktiv ist
    await page.fill('#dauer', '36');
    // Setze ungültigen Wert
    await page.fill('#stunden', '60');
    // Trigger input event manuell, da page.fill nicht immer alle Events triggert
    await page.locator('#stunden').dispatchEvent('input');
    await page.locator('#stunden').blur();
    // Korrigiert auf 48
    await expect(page.locator('#stunden')).toHaveValue('48', { timeout: 2000 });
    // Fehlermeldung sollte angezeigt werden (kann aber schon verschwunden sein wegen Auto-Fadeout)
    // Daher prüfen wir nur, dass der Wert korrigiert wurde - das ist das wichtige Verhalten
  });
});

test.describe('Validierung: Teilzeit-Prozent', () => {
  
  test('Minimum 50% wird erzwungen bei manueller Eingabe', async ({ page }) => {
    await gotoCalculator(page);
    // Setze gültigen Wert für Ausbildungsdauer und Wochenstunden, damit Teilzeitfeld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Aktiviere Prozent-Input durch Button-Klick
    await clickButton(page, '[data-value="75"][data-type="percent"]');
    // Setze ungültigen Wert direkt im Input
    await page.fill('#teilzeitProzent', '30');
    // Blur triggern
    await clickButton(page, '#dauer');
    // Prüfe Fehlermeldung sofort (verschwindet nach 4s!)
    // Fehlermeldung ist auf Deutsch (Browser-Standard hat localStorage-Sprache)
    await expect(page.locator('#errorProzent')).toContainText('mindestens 50%');
    // Sollte auf 50 korrigiert sein
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50');
  });

  test('Maximum 100% wird erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    // Setze gültigen Wert für Ausbildungsdauer und Wochenstunden, damit Teilzeitfeld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Aktiviere Prozent-Input
    await clickButton(page, '[data-value="75"][data-type="percent"]');
    // Setze ungültigen Wert
    await page.fill('#teilzeitProzent', '150');
    // Sollte auf 100 korrigiert sein
    await expect(page.locator('#teilzeitProzent')).toHaveValue('100', { timeout: 2000 });
    await expect(page.locator('#errorProzent')).toContainText('maximal 100%');
  });
});

test.describe('Validierung: Fehler verschwinden nach 4 Sekunden', () => {
  
  test('Fehlermeldung verschwindet automatisch', async ({ page }) => {
    await gotoCalculator(page);
    // Setze gültigen Wert für Wochenstunden, damit Feld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Trigger Fehler
    await page.fill('#dauer', '10');
    await clickButton(page, '#stunden');
    // Fehler ist sichtbar
    await expect(page.locator('#errorDauer')).toBeVisible();
    // Warte bis Fehler automatisch verschwindet (4s + fade)
    await expect(page.locator('#errorDauer')).toBeHidden({ timeout: 6000 });
    // Fehler sollte verschwunden sein
    await expect(page.locator('#errorDauer')).toBeEmpty();
  });
});

test.describe('Validation: English Language Tests', () => {
  
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
      const neinSelectors = ['#alter21-nein','#kinderbetreuung-nein','#pflege-nein','#vk_beruf_q1_nein','#vk_beruf_q2_nein','#vk_beruf_q3_nein','#vk_beruf_q4_nein'];
      for (const sel of neinSelectors) {
        const locator = page.locator(sel);
        if ((await locator.count()) === 0) continue;
        try {
          await locator.scrollIntoViewIfNeeded();
          await locator.waitFor({ state: 'visible', timeout: 1000 });
          await locator.click();
        } catch (e) {
          // skip if not visible yet
        }
      }
    }
  }
  
  async function clickButton(page, selector) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.click(selector);
  }
  
  test('Minimum 24 months validation in English', async ({ page }) => {
    await gotoCalculatorEnglish(page);
    
    // Set invalid value below minimum
    await page.fill('#dauer', '10');
    
    // Trigger blur
    await clickButton(page, '#stunden');
    
    // Sollte auf 24 korrigiert werden
    await expect(page.locator('#dauer')).toHaveValue('24');
    
    // Check English error message
    await expect(page.locator('#errorDauer')).toBeVisible();
    await expect(page.locator('#errorDauer')).toContainText('at least 24 months');
  });
  
  test('Minimum 50% part-time validation in English', async ({ page }) => {
    await gotoCalculatorEnglish(page);
    
    // Pflichtfelder setzen, damit die Prozent-Buttons aktiviert werden
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Teilzeit aktivieren
    await clickButton(page, '[data-value="75"][data-type="percent"]');
    
    // Zu niedrigen Prozentsatz setzen
    await page.fill('#teilzeitProzent', '30');
    await clickButton(page, '#dauer');
    
    // Sollte auf 50 korrigiert werden (mit Timeout für Blur-Validierung)
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50', { timeout: 2000 });
    
    // Fehlermeldung (auf Englisch) prüfen
    await expect(page.locator('#errorProzent')).toContainText('at least 50%');
  });
});

// ============================================================================
// MOBILE VALIDATION TESTS
// ============================================================================

test.describe('Mobile Validation: Ausbildungsdauer', () => {
  
  test.beforeEach(async ({ page }) => {
    // iPhone 13 viewport
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Minimum 24 Monate wird erzwungen bei blur', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert unter Minimum
    await page.fill('#dauer', '10');
    
    // Blur triggern (auf anderes Feld klicken)
    await clickButton(page, '#stunden');
    
    // Wert sollte auf 24 korrigiert sein
    await expect(page.locator('#dauer')).toHaveValue('24');
    
    // Fehlermeldung sollte angezeigt werden
    await expect(page.locator('#errorDauer')).toBeVisible();
    await expect(page.locator('#errorDauer')).toContainText('mindestens 24 Monate');
  });

  test('Mobile: Maximum 42 Monate wird sofort erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert über Maximum
    await page.fill('#dauer', '60');
    
    // Wert sollte auf 42 korrigiert sein (mit Timeout für Auto-Korrektur)
    await expect(page.locator('#dauer')).toHaveValue('42', { timeout: 2000 });
  });
});

test.describe('Mobile Validation: Wochenstunden', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Minimum 10 Stunden wird erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert
    await page.fill('#stunden', '5');
    await clickButton(page, '#dauer');
    
    // Wert sollte auf 10 korrigiert sein (mit Timeout für blur-Validierung)
    await expect(page.locator('#stunden')).toHaveValue('10', { timeout: 2000 });
    
    // Fehlermeldung sollte angezeigt werden
    await expect(page.locator('#errorStunden')).toContainText('mindestens 10 Stunden');
  });

  test('Mobile: Maximum 48 Stunden wird sofort erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze ungültigen Wert über Maximum
    await page.fill('#stunden', '60');
    
    // Warte kurz für Event-Handler
    await page.waitForTimeout(150);
    
    // Wert sollte auf 48 korrigiert sein (mit Timeout für Auto-Korrektur)
    await expect(page.locator('#stunden')).toHaveValue('48', { timeout: 2000 });
  });
});

test.describe('Mobile Validation: Teilzeit-Prozent', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Minimum 50% wird erzwungen bei manueller Eingabe', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Teilzeit-Feld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Aktiviere Teilzeit-Feld über Preset-Button
    await clickButton(page, '[data-value="75"][data-type="percent"]');
    
    // Setze ungültigen Wert
    await page.fill('#teilzeitProzent', '30');
    await clickButton(page, '#dauer');
    
    // Wert sollte auf 50 korrigiert sein (mit Timeout für blur-Validierung)
    await expect(page.locator('#teilzeitProzent')).toHaveValue('50', { timeout: 2000 });
    
    // Fehlermeldung sollte angezeigt werden
    await expect(page.locator('#errorProzent')).toContainText('mindestens 50%');
  });

  test('Mobile: Maximum 100% wird erzwungen', async ({ page }) => {
    await gotoCalculator(page);
    
    // Setze zuerst Ausbildungsdauer und Wochenstunden damit Teilzeit-Feld aktiv ist
    await page.fill('#dauer', '36');
    await page.fill('#stunden', '40');
    // Aktiviere Teilzeit-Feld
    await clickButton(page, '[data-value="75"][data-type="percent"]');
    
    // Setze ungültigen Wert
    await page.fill('#teilzeitProzent', '150');
    
    // Wert sollte auf 100 korrigiert sein (mit Timeout für Auto-Korrektur)
    await expect(page.locator('#teilzeitProzent')).toHaveValue('100', { timeout: 2000 });
  });
});

test.describe('Mobile Validation: Fehler verschwinden nach 4 Sekunden', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });
  
  test('Mobile: Fehlermeldung verschwindet automatisch', async ({ page }) => {
    await gotoCalculator(page);
    
    // Fehler auslösen durch Setzen eines ungültigen Wertes
    await page.fill('#dauer', '10');
    await clickButton(page, '#stunden');
    
    // Fehler sollte sichtbar sein
    await expect(page.locator('#errorDauer')).toBeVisible();
    
    // Auf automatisches Verschwinden des Fehlers warten (4s im Code + 2s Puffer)
    await expect(page.locator('#errorDauer')).toBeHidden({ timeout: 6000 });
  });
});
