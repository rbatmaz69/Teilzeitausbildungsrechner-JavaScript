/**
 * Initialisiert die Verkürzungsgründe-Steuerung.
 *
 * Bindet Tooltips, sorgt für korrektes Checkbox-Verhalten und synchronisiert
 * die Anzeige der Vorkenntnis-Monate mit der aktuellen Sprache.
 */
document.addEventListener('DOMContentLoaded', () => {
  const alter = document.getElementById('alter');
  const vkForm = document.getElementById('vk-form');
  const kinderbetreuungJa = document.getElementById('kinderbetreuung-ja');
  const kinderbetreuungNein = document.getElementById('kinderbetreuung-nein');
  const pflegeJa = document.getElementById('pflege-ja');
  const pflegeNein = document.getElementById('pflege-nein');
  // Berufliche Qualifikationen
  const berufQ1Ja = document.getElementById('vk_beruf_q1_ja');
  const berufQ1Nein = document.getElementById('vk_beruf_q1_nein');
  const berufQ2Ja = document.getElementById('vk_beruf_q2_ja');
  const berufQ2Nein = document.getElementById('vk_beruf_q2_nein');
  const berufQ2Duration = document.getElementById('vk_beruf_q2_dauer_months');
  const berufQ2DurationContainer = document.getElementById('vk_beruf_q2_duration_container');
  const berufQ3Ja = document.getElementById('vk_beruf_q3_ja');
  const berufQ3Nein = document.getElementById('vk_beruf_q3_nein');
  const berufQ4Ja = document.getElementById('vk_beruf_q4_ja');
  const berufQ4Nein = document.getElementById('vk_beruf_q4_nein');
  const vkSchoolSelect = document.getElementById('vk-school-select');

  // ========== LOCALSTORAGE: LADEN UND SPEICHERN ==========
  const STORAGE_KEY_VK = 'teilzeitrechner_verkuerzungsgruende';

  /**
   * Lade gespeicherte Verkürzungsgründe-Werte beim Start
   */
  const ladeGespeichertePersistenz = () => {
    try {
      const gespeichert = localStorage.getItem(STORAGE_KEY_VK);
      if (gespeichert) {
        const werte = JSON.parse(gespeichert);

        // Lade Alter
        if (werte.alter !== undefined && werte.alter !== null && werte.alter !== '') {
          if (alter) alter.value = werte.alter;
        }

        // Lade Schulabschluss
        if (werte.schoolSelect !== undefined && werte.schoolSelect !== null) {
          if (vkSchoolSelect) vkSchoolSelect.value = werte.schoolSelect;
        }

        // Lade Checkboxen (Kinderbetreuung)
        if (werte.kinderbetreuungJa && kinderbetreuungJa) kinderbetreuungJa.checked = true;
        if (werte.kinderbetreuungNein && kinderbetreuungNein) kinderbetreuungNein.checked = true;

        // Lade Checkboxen (Pflege)
        if (werte.pflegeJa && pflegeJa) pflegeJa.checked = true;
        if (werte.pflegeNein && pflegeNein) pflegeNein.checked = true;

        // Lade Checkboxen (Berufliche Qualifikationen)
        if (werte.berufQ1Ja && berufQ1Ja) berufQ1Ja.checked = true;
        if (werte.berufQ1Nein && berufQ1Nein) berufQ1Nein.checked = true;

        if (werte.berufQ2Ja && berufQ2Ja) berufQ2Ja.checked = true;
        if (werte.berufQ2Nein && berufQ2Nein) berufQ2Nein.checked = true;
        if (werte.berufQ2Duration !== undefined && werte.berufQ2Duration !== null && berufQ2Duration) {
          berufQ2Duration.value = werte.berufQ2Duration;
          // Zeige den Duration Container wenn Q2 = Ja geprüft ist
          if (berufQ2Ja?.checked && berufQ2DurationContainer) {
            berufQ2DurationContainer.style.display = 'block';
          }
        }

        if (werte.berufQ3Ja && berufQ3Ja) berufQ3Ja.checked = true;
        if (werte.berufQ3Nein && berufQ3Nein) berufQ3Nein.checked = true;

        if (werte.berufQ4Ja && berufQ4Ja) berufQ4Ja.checked = true;
        if (werte.berufQ4Nein && berufQ4Nein) berufQ4Nein.checked = true;
      }
    } catch (fehler) {
      console.error('Fehler beim Laden der Verkürzungsgründe:', fehler);
    }
  };

  /**
   * Speichere Verkürzungsgründe-Werte in localStorage
   */
  const speichereVerkuerzungsgruende = () => {
    try {
      const werte = {
        alter: alter ? alter.value : '',
        schoolSelect: vkSchoolSelect ? vkSchoolSelect.value : 'none',
        kinderbetreuungJa: kinderbetreuungJa ? kinderbetreuungJa.checked : false,
        kinderbetreuungNein: kinderbetreuungNein ? kinderbetreuungNein.checked : false,
        pflegeJa: pflegeJa ? pflegeJa.checked : false,
        pflegeNein: pflegeNein ? pflegeNein.checked : false,
        berufQ1Ja: berufQ1Ja ? berufQ1Ja.checked : false,
        berufQ1Nein: berufQ1Nein ? berufQ1Nein.checked : false,
        berufQ2Ja: berufQ2Ja ? berufQ2Ja.checked : false,
        berufQ2Nein: berufQ2Nein ? berufQ2Nein.checked : false,
        berufQ2Duration: berufQ2Duration ? berufQ2Duration.value : '',
        berufQ3Ja: berufQ3Ja ? berufQ3Ja.checked : false,
        berufQ3Nein: berufQ3Nein ? berufQ3Nein.checked : false,
        berufQ4Ja: berufQ4Ja ? berufQ4Ja.checked : false,
        berufQ4Nein: berufQ4Nein ? berufQ4Nein.checked : false
      };
      localStorage.setItem(STORAGE_KEY_VK, JSON.stringify(werte));
    } catch (fehler) {
      console.error('Fehler beim Speichern der Verkürzungsgründe:', fehler);
    }
  };

  // Mache speichereVerkuerzungsgruende global verfügbar für script_eingabe.js
  window.speichereVerkuerzungsgruende = speichereVerkuerzungsgruende;

  // Lade gespeicherte Werte beim Start
  ladeGespeichertePersistenz();

  /* ========== Tooltips (touch-optimiert) ========== */
  document.querySelectorAll('.info-btn').forEach(schaltflaeche => {
    const kurzinfo = schaltflaeche.closest('.tile')?.querySelector('.tooltip');
    if (!kurzinfo) return;
    kurzinfo.textContent = schaltflaeche.dataset.tooltip || '';
    schaltflaeche.addEventListener('click', ereignis => {
      ereignis.preventDefault(); ereignis.stopPropagation();
      const geoeffnet = kurzinfo.classList.toggle('show');
      if (geoeffnet) {
        document.querySelectorAll('.tooltip').forEach(tooltip => { if (tooltip !== kurzinfo) tooltip.classList.remove('show'); });
        schaltflaeche.setAttribute('aria-expanded','true');
      } else {
        schaltflaeche.setAttribute('aria-expanded','false');
      }
    });
  });

  // Außerhalb klicken → Tooltips schließen
  document.body.addEventListener('click', ereignis => {
    if (!(ereignis.target instanceof Element) || !ereignis.target.classList.contains('info-btn')) {
      document.querySelectorAll('.tooltip').forEach(tooltip => tooltip.classList.remove('show'));
      document.querySelectorAll('.info-btn[aria-expanded="true"]').forEach(schaltflaeche => schaltflaeche.setAttribute('aria-expanded','false'));
    }
  });

  // Ermöglicht das Aktivieren von Checkboxen mit Enter-Taste
  document.querySelectorAll('.tile input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkbox.click();
      }
    });
  });

  // Alter-Eingabe validieren
  const errorAlter = document.getElementById('errorAlter');
  /* global uebersetzung */
  let alterErrorTimeout = null;
  
  alter.addEventListener('keydown', (ev) => {
    const forbidden = ['e', 'E', '+', '-', '.', ','];
    if (forbidden.includes(ev.key)) ev.preventDefault();
  });

  // Prevent form submission via Enter inside inputs (keeps values intact)
  if (vkForm) {
    vkForm.addEventListener('submit', (e) => {
      e.preventDefault();
    });
  }
  
  alter.addEventListener('input', () => {
    let v = alter.value.replace(/[^0-9]/g, '');
    alter.value = v;
    
    // Max-Validierung sofort: Wenn > 99, auf 99 setzen und Fehler anzeigen
    const alterInt = parseInt(v);
    if (!isNaN(alterInt) && alterInt > 99) {
      alter.value = 99;
      alter.classList.add('error');
      if (errorAlter) errorAlter.textContent = uebersetzung("errors.alterMax", "Der Wert darf maximal 99 betragen");
      
      // Fehler nach 4 Sekunden entfernen
      clearTimeout(alterErrorTimeout);
      alterErrorTimeout = setTimeout(() => {
        alter.classList.remove('error');
        if (errorAlter) errorAlter.textContent = '';
      }, 4000);
    }
  });
  
  alter.addEventListener('blur', () => {
    const alterInt = parseInt(alter.value);

    if (isNaN(alterInt) || alterInt < 0) {
      alter.value = null;
    } else if (alterInt > 99) {
      alter.value = 99;
    }
  });

  // Schulabschluss ändern
  if (vkSchoolSelect) {
    vkSchoolSelect.addEventListener('change', () => {
      // Schulabschluss wird erst beim Button-Klick gespeichert
    });
  }

  // Ereignis-Listener für familiäre Verpflichtungen - Ja/Nein-Gruppen
  // Kinderbetreuung: Mutual exclusivity zwischen Ja und Nein
  if (kinderbetreuungJa && kinderbetreuungNein) {
    kinderbetreuungJa.addEventListener("change", () => {
      if (kinderbetreuungJa.checked) {
        kinderbetreuungNein.checked = false;
      }
    });
    
    kinderbetreuungNein.addEventListener("change", () => {
      if (kinderbetreuungNein.checked) {
        kinderbetreuungJa.checked = false;
      }
    });
  }

  // Pflege: Mutual exclusivity zwischen Ja und Nein
  if (pflegeJa && pflegeNein) {
    pflegeJa.addEventListener("change", () => {
      if (pflegeJa.checked) {
        pflegeNein.checked = false;
      }
    });
    
    pflegeNein.addEventListener("change", () => {
      if (pflegeNein.checked) {
        pflegeJa.checked = false;
      }
    });
  }

  // Berufliche Fragen: Mutual exclusivity & Q2 Duration show/hide
  function setupYesNo(jaEl, neinEl) {
    if (!jaEl || !neinEl) return;
    jaEl.addEventListener('change', () => {
      if (jaEl.checked) neinEl.checked = false;
    });
    neinEl.addEventListener('change', () => {
      if (neinEl.checked) jaEl.checked = false;
    });
  }

  setupYesNo(berufQ1Ja, berufQ1Nein);
  setupYesNo(berufQ2Ja, berufQ2Nein);
  setupYesNo(berufQ3Ja, berufQ3Nein);
  setupYesNo(berufQ4Ja, berufQ4Nein);

  // Show/Hide duration input for Q2
  if (berufQ2Ja && berufQ2DurationContainer && berufQ2Duration) {
    berufQ2Ja.addEventListener('change', () => {
      if (berufQ2Ja.checked) {
        berufQ2DurationContainer.style.display = 'block';
      } else {
        berufQ2DurationContainer.style.display = 'none';
        berufQ2Duration.value = '';
      }
    });
    berufQ2Nein && berufQ2Nein.addEventListener('change', () => {
      if (berufQ2Nein.checked) {
        berufQ2DurationContainer.style.display = 'none';
        berufQ2Duration.value = '';
      }
    });

    // Numeric input: block invalid keys
    berufQ2Duration.addEventListener('keydown', (ev) => {
      const forbidden = ['e', 'E', '+', '-'];
      if (forbidden.includes(ev.key)) ev.preventDefault();
    });
    
    const errorBerufQ2Dauer = document.getElementById('errorBerufQ2Dauer');
    let q2DauerErrorTimeout = null;
    
    berufQ2Duration.addEventListener('input', () => {
      let v = berufQ2Duration.value.replace(/[^0-9]/g, '');
      berufQ2Duration.value = v;
      
      // Max-Validierung sofort: Wenn > 48, auf 48 setzen und Fehler anzeigen
      const dauer = parseInt(v);
      if (!isNaN(dauer) && dauer > 48) {
        berufQ2Duration.value = 48;
        berufQ2Duration.classList.add('error');
        if (errorBerufQ2Dauer) errorBerufQ2Dauer.textContent = uebersetzung("errors.berufQ2DauerMax", "Der Wert darf maximal 48 Monate betragen");
        
        // Fehler nach 4 Sekunden entfernen
        clearTimeout(q2DauerErrorTimeout);
        q2DauerErrorTimeout = setTimeout(() => {
          berufQ2Duration.classList.remove('error');
          if (errorBerufQ2Dauer) errorBerufQ2Dauer.textContent = '';
        }, 4000);
      }
    });
    
    berufQ2Duration.addEventListener('blur', () => {
      // Werte werden erst beim Button-Klick gespeichert
    });
  }

  /* ========== "Was ist das?" Modal ========== */
  const infoButton = document.getElementById('vk-info-btn');
  const infoModal = document.getElementById('vk-info-modal');
  const infoCloseButton = infoModal?.querySelector('.vk-info-close');
  const infoOverlay = infoModal?.querySelector('.vk-info-overlay');
  const infoContent = infoModal?.querySelector('.vk-info-content');
  let previousActiveElement = null;

  if (!infoButton || !infoModal) return;

  /**
   * Öffnet das Modal und setzt den Focus auf den ersten fokussierbaren Element.
   */
  function oeffneModal() {
    previousActiveElement = document.activeElement;
    infoModal.removeAttribute('hidden');
    document.body.classList.add('modal-open');
    
    // Focus auf den Close-Button setzen
    setTimeout(() => {
      infoCloseButton?.focus();
    }, 100);
  }

  /**
   * Schließt das Modal und gibt den Focus zurück.
   */
  function schliesseModal() {
    infoModal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    
    // Focus zurück auf den Button setzen
    if (previousActiveElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
  }

  /**
   * Prüft, ob ein Klick außerhalb des Modal-Contents war.
   */
  function istKlickAusserhalb(event) {
    return infoContent && !infoContent.contains(event.target);
  }

  // Button-Klick: Modal öffnen
  infoButton.addEventListener('click', (event) => {
    event.preventDefault();
    oeffneModal();
  });

  // Close-Button: Modal schließen
  infoCloseButton?.addEventListener('click', (event) => {
    event.preventDefault();
    schliesseModal();
  });

  // Overlay-Klick: Modal schließen
  infoOverlay?.addEventListener('click', (event) => {
    if (istKlickAusserhalb(event)) {
      schliesseModal();
    }
  });

  // Escape-Taste: Modal schließen
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !infoModal.hasAttribute('hidden')) {
      schliesseModal();
    }
  });

  // Focus-Trap: Verhindert, dass Focus außerhalb des Modals geht
  function handleTabKey(event) {
    if (infoModal.hasAttribute('hidden')) return;

    const focusableElements = infoModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  infoModal.addEventListener('keydown', handleTabKey);
});

/* ========== MODAL-INITIALISIERUNG AUSSERHALB DOMContentLoaded ========== */
// Dies stellt sicher, dass das Modal immer funktioniert, unabhängig vom Berechnungsstatus
(function initModalGlobal() {
  function tryInit() {
    const infoButton = document.getElementById('vk-info-btn');
    const infoModal = document.getElementById('vk-info-modal');
    
    if (!infoButton || !infoModal) {
      // Noch nicht im DOM, retry nach 100ms
      setTimeout(tryInit, 100);
      return;
    }

    const infoCloseButton = infoModal.querySelector('.vk-info-close');
    const infoOverlay = infoModal.querySelector('.vk-info-overlay');
    const infoContent = infoModal.querySelector('.vk-info-content');
    let previousActiveElement = null;

    function oeffneModal() {
      previousActiveElement = document.activeElement;
      infoModal.removeAttribute('hidden');
      infoModal.style.display = 'flex'; // Explizit setzen für Sicherheit
      document.body.classList.add('modal-open');
      setTimeout(() => infoCloseButton?.focus(), 100);
    }

    function schliesseModal() {
      infoModal.setAttribute('hidden', '');
      infoModal.style.display = ''; // Zurücksetzen
      document.body.classList.remove('modal-open');
      if (previousActiveElement) {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }

    function istKlickAusserhalb(event) {
      return infoContent && !infoContent.contains(event.target);
    }

    // Button-Klick: Modal öffnen (entfernt alte Listener)
    infoButton.addEventListener('click', (event) => {
      event.preventDefault();
      oeffneModal();
    }, { capture: true }); // Capture-Phase für höchste Priorität

    // Close-Button: Modal schließen
    infoCloseButton?.addEventListener('click', (event) => {
      event.preventDefault();
      schliesseModal();
    });

    // Overlay-Klick: Modal schließen
    infoOverlay?.addEventListener('click', (event) => {
      if (istKlickAusserhalb(event)) {
        schliesseModal();
      }
    });

    // Escape-Taste: Modal schließen
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !infoModal.hasAttribute('hidden')) {
        schliesseModal();
      }
    });

    // Focus-Trap
    infoModal.addEventListener('keydown', (event) => {
      if (infoModal.hasAttribute('hidden')) return;
      const focusableElements = infoModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    });
  }

  // Sofort versuchen und bei Bedarf wiederholen
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
