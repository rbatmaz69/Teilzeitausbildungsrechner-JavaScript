/*
  Barrierefreiheits-Hilfsfunktionen

  Enthält Theme-/Kontrast-Management, Fokus‑Handling, Screenreader-Unterstützung
  sowie kleine Accessibility-Utilities, die im Frontend mehrfach verwendet werden.
  Kurze Kommentare in dieser Datei erklären die einzelnen Bereiche.
*/
(function(){
  const toggle = document.getElementById('a11y-toggle');
  const menu = document.getElementById('a11y-menu');
  const readToggle = document.getElementById('a11y-read-toggle');
  const easyLanguageToggle = document.getElementById('a11y-easy-language-toggle');
  const decBtn = document.getElementById('a11y-decrease');
  const resetBtn = document.getElementById('a11y-reset');
  const incBtn = document.getElementById('a11y-increase');
  const MIN_FONT = 12;
  const MAX_FONT = 28;
  // diskrete Level: -3..+3 pro Anforderung
  const MIN_LEVEL = -3;
  const MAX_LEVEL = 3;
  // Passe die Root-Schriftgröße an, damit rem-basierter Text mit A-/A+ skaliert
  const rootEl = document.documentElement;
  const DEFAULT_ROOT_FONT = parseFloat(getComputedStyle(rootEl).fontSize) || 16;
  // 3 Stufen in beide Richtungen, so dass MIN/MAX exakt beim 3. Klick erreicht werden.
  const STEP_DOWN_PX = (DEFAULT_ROOT_FONT - MIN_FONT) / Math.max(1, Math.abs(MIN_LEVEL));
  const STEP_UP_PX = (MAX_FONT - DEFAULT_ROOT_FONT) / Math.max(1, MAX_LEVEL);
  const FONT_SIZE_KEY = 'fontSizeLevel';
  
  let currentLevel = 0; // 0 = default
  try {
    const savedLevel = localStorage.getItem(FONT_SIZE_KEY);
    if (savedLevel !== null) {
      currentLevel = parseInt(savedLevel, 10);
    }
  } catch (e) {
    console.warn('Could not load font size preference:', e);
  }

  // ==========================================
  // THEME (DARK MODE) - Verwaltung
  // ==========================================
  const THEME_KEY = 'theme';
  const themeSlider = document.getElementById('a11y-theme-slider');
  const statusRegion = document.getElementById('a11y-status');

  // ==========================================
  // ANSAGEN FÜR SCREENREADER
  // ==========================================
  function announceToScreenReader(message) {
    if (!statusRegion) return;
    // Zuerst löschen, damit Wiederholungen ebenfalls ausgelöst/angesagt werden
    statusRegion.textContent = '';
    setTimeout(() => {
      statusRegion.textContent = message;
    }, 100);
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    let effectiveTheme = theme;
    if (theme === 'auto') {
      effectiveTheme = getSystemTheme();
    }
    
    if (effectiveTheme === 'dark') {
      rootEl.setAttribute('data-theme', 'dark');
    } else {
      rootEl.removeAttribute('data-theme');
    }
    
    // Update slider position and ARIA
    if (themeSlider) {
      const position = theme === 'light' ? 0 : theme === 'auto' ? 1 : 2;
      const labels = { 'light': 'Hell', 'auto': 'Auto', 'dark': 'Dunkel' };
      themeSlider.setAttribute('aria-valuenow', position);
      themeSlider.setAttribute('aria-valuetext', labels[theme]);
      themeSlider.setAttribute('data-theme', theme);
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }
  }

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'auto';
    } catch (e) {
      console.warn('Could not load theme preference:', e);
      return 'auto';
    }
  }

  function setTheme(theme) {
    console.log('Setting theme to:', theme);
    saveTheme(theme);
    applyTheme(theme);
    
    // Theme-Änderung für Screenreader ansagen
    const themeNames = { 'light': 'Helles Design', 'auto': 'Automatisches Design', 'dark': 'Dunkles Design' };
    announceToScreenReader(themeNames[theme] + ' aktiviert');
  }

  // Theme beim Laden der Seite initialisieren
  const savedTheme = loadTheme();
  console.log('Loaded theme:', savedTheme);
  console.log('Theme slider:', themeSlider);
  applyTheme(savedTheme);

  // Theme slider interaction handlers
  if (themeSlider) {
    // Klick auf Slider-Optionen
    const options = themeSlider.querySelectorAll('.a11y-theme-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.getAttribute('data-theme');
        setTheme(theme);
      });
    });
    
    // Tastaturnavigation
    themeSlider.addEventListener('keydown', (e) => {
      const currentTheme = loadTheme();
      const themes = ['light', 'auto', 'dark'];
      const currentIndex = themes.indexOf(currentTheme);
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.max(0, currentIndex - 1);
        setTheme(themes[newIndex]);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.min(2, currentIndex + 1);
        setTheme(themes[newIndex]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setTheme('light');
      } else if (e.key === 'End') {
        e.preventDefault();
        setTheme('dark');
      }
    });
  }

  // Listen for system theme changes when in auto mode
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentTheme = loadTheme();
      if (currentTheme === 'auto') {
        applyTheme('auto');
      }
    });
  }

  // ==========================================
  // MENÜ-VERWALTUNG
  // ==========================================
  const iconDefault = document.getElementById('a11y-icon-default');
  const iconClose = document.getElementById('a11y-icon-close');

  function isEasyLanguageSupportedForCurrentLang() {
    return true;
  }

  function updateToggleIcon(isOpen) {
    if (!iconDefault || !iconClose) return;
    
    if (isOpen) {
      // Standard-Icon ausblenden und Close-Icon einblenden (Rotation)
      iconDefault.style.display = 'none';
      iconClose.style.display = 'block';
      iconClose.style.animation = 'icon-rotate-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    } else {
      // Close-Icon ausblenden und Standard-Icon einblenden (Rotation)
      iconClose.style.display = 'none';
      iconDefault.style.display = 'block';
      iconDefault.style.animation = 'icon-rotate-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    }
  }

  function updateAriaLabel(isOpen) {
    if (!toggle) return;
    const key = isOpen ? 'a11y.buttonAriaExpanded' : 'a11y.buttonAria';
    const label = window.I18N && window.I18N.t ? window.I18N.t(key) : (isOpen ? 'Barrierefreiheitsmenü schließen' : 'Barrierefreiheitsmenü öffnen');
    toggle.setAttribute('aria-label', label);
  }

  // Focus trap management
  let focusableElements = [];
  let firstFocusable = null;
  let lastFocusable = null;

  function updateFocusableElements() {
    if (!menu) return;
    // Alle fokussierbaren Elemente innerhalb des Menüs ermitteln
    focusableElements = Array.from(menu.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]:not([disabled])'
    ));
    firstFocusable = focusableElements[0];
    lastFocusable = focusableElements[focusableElements.length - 1];
  }

  function handleMenuKeydown(e) {
    // Tab-Taste nur behandeln, wenn das Menü geöffnet ist
    if (menu.getAttribute('aria-hidden') === 'true') return;

    if (e.key === 'Tab') {
      updateFocusableElements();
      if (!firstFocusable || !lastFocusable) return;

      // Beim Öffnen Fokus NICHT automatisch ins Menü springen.
      // Erst wenn der Nutzer Tab drückt, geht es ins Menü.
      if (document.activeElement === toggle) {
        e.preventDefault();
        (e.shiftKey ? lastFocusable : firstFocusable)?.focus();
        return;
      }

      // Trap focus within menu
      if (e.shiftKey) {
        // Shift+Tab: moving backwards
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          toggle?.focus();
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          toggle?.focus();
        }
      }
    }
  }

  function openMenu(){
    toggle.setAttribute('aria-expanded','true');
    menu.setAttribute('aria-hidden','false');
    updateToggleIcon(true);
    updateAriaLabel(true);
    
    // Update focusable elements; Fokus bleibt auf dem Toggle (erst Tab bewegt ins Menü)
    updateFocusableElements();
  }
  
  function closeMenu(){
    toggle.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-hidden','true');
    updateToggleIcon(false);
    updateAriaLabel(false);
    if(toggle) toggle.focus();
  }

  if(toggle) toggle.addEventListener('click', function() {
    const isOpen = menu.getAttribute('aria-hidden') === 'false';
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Handle Escape and Tab keys
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && menu && menu.getAttribute('aria-hidden') === 'false'){
      closeMenu();
    }
    // Handle Tab/Shift+Tab for focus trap
    handleMenuKeydown(e);
  });

  // ==========================================
  // EASY LANGUAGE (LEICHTE SPRACHE) TOGGLE
  // ==========================================
  const EASY_LANGUAGE_KEY = 'easyLanguage';

  function loadEasyLanguage() {
    try {
      return localStorage.getItem(EASY_LANGUAGE_KEY) === 'true';
    } catch (e) {
      console.warn('Could not load easy language preference:', e);
      return false;
    }
  }

  function saveEasyLanguage(enabled) {
    try {
      localStorage.setItem(EASY_LANGUAGE_KEY, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Could not save easy language preference:', e);
    }
  }

  function applyEasyLanguage(enabled) {
    if (enabled) {
      rootEl.setAttribute('data-easy-language', 'true');
    } else {
      rootEl.removeAttribute('data-easy-language');
    }
    
    if (easyLanguageToggle) {
      easyLanguageToggle.checked = enabled;
      easyLanguageToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    }
  }

  function toggleEasyLanguage() {
    if (!isEasyLanguageSupportedForCurrentLang()) return;
    const currentState = loadEasyLanguage();
    const newState = !currentState;
    saveEasyLanguage(newState);
    applyEasyLanguage(newState);

    // Für Screenreader ansagen
    announceToScreenReader(newState ? 'Leichte Sprache aktiviert' : 'Leichte Sprache deaktiviert');

    window.dispatchEvent(new CustomEvent('easyLanguage:changed', {
      detail: { enabled: newState }
    }));
  }

  function setEasyLanguageButtonEnabled(isGerman) {
    if (!easyLanguageToggle) return;
    if (isGerman) {
      easyLanguageToggle.removeAttribute('disabled');
      easyLanguageToggle.parentElement.style.opacity = '1';
      easyLanguageToggle.parentElement.style.cursor = 'pointer';
    } else {
      easyLanguageToggle.setAttribute('disabled', 'true');
      easyLanguageToggle.checked = false;
      easyLanguageToggle.parentElement.style.opacity = '0.5';
      easyLanguageToggle.parentElement.style.cursor = 'not-allowed';
    }
  }

  function syncEasyLanguageForCurrentLang() {
    const supported = isEasyLanguageSupportedForCurrentLang();
    setEasyLanguageButtonEnabled(supported);

    if (!supported) {
      // Leichte Sprache ist nur für Deutsch: erzwinge „aus“ ohne die gespeicherte Präferenz zu löschen.
      const wasEnabled = rootEl.getAttribute('data-easy-language') === 'true';
      applyEasyLanguage(false);
      if (wasEnabled) {
        window.dispatchEvent(new CustomEvent('easyLanguage:changed', {
          detail: { enabled: false }
        }));
      }
      return;
    }

    // Deutsch: wende gespeicherte Präferenz an
    const saved = loadEasyLanguage();
    applyEasyLanguage(saved);
  }

  // Easy Language beim Laden initialisieren (nur für Deutsch; bei Abschluss von i18n aktualisieren)
  syncEasyLanguageForCurrentLang();

  // Klick-Handler für die Leichte-Sprache-Toggle-Schaltfläche
  if (easyLanguageToggle) {
    easyLanguageToggle.addEventListener('change', () => {
      toggleEasyLanguage();
    });
    
    // Enter-Taste aktivieren, um das Toggle zu schalten
    easyLanguageToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        easyLanguageToggle.click();
      }
    });
  }

  // Wenn sich die Sprache ändert: Toggle aktivieren/deaktivieren und Zustand anwenden
  window.addEventListener('i18n:changed', () => {
    syncEasyLanguageForCurrentLang();
    // i18n rendert im Handler in script_Sprache_Auswaehlen.js bei easyLanguage:changed neu.
    if (isEasyLanguageSupportedForCurrentLang()) {
      window.dispatchEvent(new CustomEvent('easyLanguage:changed', {
        detail: { enabled: rootEl.getAttribute('data-easy-language') === 'true' }
      }));
    }
  });

  // Speech (Web Speech API) — collect visible text, exclude calendar images, read once
  let synth = window.speechSynthesis;
  let utterance = null;
  let isSpeaking = false;
  let lastUtteranceText = '';
  let lastStopTime = 0;

  function stopSpeaking(){
    if(synth && synth.speaking){
      synth.cancel();
    }
    isSpeaking = false;
    if(readToggle){
      readToggle.checked = false;
      readToggle.setAttribute('aria-checked', 'false');
    }
  }

  function startSpeaking(){
    // Prevent double-start
    if(isSpeaking) return;

    // Cooldown: avoid immediately restarting same text
    const now = Date.now();
    if(lastUtteranceText && now - lastStopTime < 2000){
      console.debug('a11y: blocked start due to recent stop');
      return;
    }

    // Use the full document body so the whole current page is read
    const container = document.body;

    const isVisible = (el) => {
      if(!el) return false;
      if(el.nodeType === Node.TEXT_NODE) return isVisible(el.parentElement);
      if(el.nodeType !== Node.ELEMENT_NODE) return false;
      const style = window.getComputedStyle(el);
      if(style.display === 'none' || style.visibility === 'hidden') return false;
      if(el.hasAttribute && el.hasAttribute('aria-hidden')) return false;
      if(el.classList && el.classList.contains('sr-only')) return false;
      const rects = el.getClientRects();
      if(!rects || rects.length === 0) return false;
      return true;
    };

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    const parts = [];
    const EXCLUDE_ANCESTOR_SELECTORS = ['.calendar-visualization', '.calendar-device', '.calendar-screen', '.calendar-days'];

    while(walker.nextNode()){
      const node = walker.currentNode;
      if(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SELECT'){
        const opt = node.options && node.options[node.selectedIndex];
        if(opt && isVisible(node)) parts.push(String(opt.textContent || opt.innerText || '').trim());
        continue;
      }
      if(node.nodeType === Node.TEXT_NODE){
        const parent = node.parentElement;
        if(!parent) continue;
        let skip = false;
        for(const sel of EXCLUDE_ANCESTOR_SELECTORS){
          if(parent.closest && parent.closest(sel)){ skip = true; break; }
        }
        if(skip) continue;
        if(!isVisible(parent)) continue;
        const txt = String(node.nodeValue || '').replace(/\s+/g,' ').trim();
        if(txt) parts.push(txt);
      }
    }

    let text = parts.join(' ').replace(/\s+/g,' ').trim();

    const MAX_CHARS = 20000;
    if(text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

    utterance = new SpeechSynthesisUtterance(text);
    lastUtteranceText = text;
    utterance.lang = document.documentElement.lang || 'de-DE';
    utterance.rate = 1;
    utterance.onend = ()=>{
      isSpeaking = false;
      lastStopTime = Date.now();
      stopSpeaking();
      console.debug('a11y: utterance ended');
    };
    utterance.onerror = ()=>{
      isSpeaking = false;
      lastStopTime = Date.now();
      stopSpeaking();
      console.debug('a11y: utterance error');
    };

    if(synth && synth.speaking) synth.cancel();
    synth.speak(utterance);
    if(readToggle){
      readToggle.checked = true;
      readToggle.setAttribute('aria-checked', 'true');
    }
    isSpeaking = true;
    announceToScreenReader('Vorlesefunktion aktiviert');
  }

  if(readToggle){
    readToggle.addEventListener('change', ()=>{
      if(readToggle.checked){
        startSpeaking();
      } else {
        stopSpeaking();
        announceToScreenReader('Vorlesefunktion deaktiviert');
      }
    });
    
    // Enter-Taste aktivieren, um das Vorlese-Toggle zu schalten
    readToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        readToggle.click();
      }
    });
  }

  // Font size
  function applyZoomForLevel(level){
    // clamp level
    if(level < MIN_LEVEL) level = MIN_LEVEL;
    if(level > MAX_LEVEL) level = MAX_LEVEL;

    const nextPx =
      level === 0
        ? DEFAULT_ROOT_FONT
        : level < 0
          ? DEFAULT_ROOT_FONT + (level * STEP_DOWN_PX)
          : DEFAULT_ROOT_FONT + (level * STEP_UP_PX);

    const clampedPx = Math.min(Math.max(nextPx, MIN_FONT), MAX_FONT);
    rootEl.style.fontSize = clampedPx + 'px';
    currentLevel = level;
    
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(currentLevel));
    } catch (e) {
      console.warn('Could not save font size preference:', e);
    }

    updateStepLabels();
    updateFontButtonStates();
  }

  function updateFontButtonStates() {
    if (!decBtn || !incBtn) return;
    
    // Update decrease button
    if (currentLevel <= MIN_LEVEL) {
      decBtn.setAttribute('aria-disabled', 'true');
      decBtn.disabled = true;
    } else {
      decBtn.removeAttribute('aria-disabled');
      decBtn.disabled = false;
    }
    
    // Update increase button
    if (currentLevel >= MAX_LEVEL) {
      incBtn.setAttribute('aria-disabled', 'true');
      incBtn.disabled = true;
    } else {
      incBtn.removeAttribute('aria-disabled');
      incBtn.disabled = false;
    }
  }

  function updateStepLabels(){
    if(!decBtn || !incBtn) return;
    // update simple button labels
    decBtn.textContent = '−';
    incBtn.textContent = '+';
    // update the central level display
    const display = document.getElementById('a11y-level-display');
    if(display){
      display.textContent = String(currentLevel);
    }
  }


  if(decBtn) decBtn.addEventListener('click', ()=>{
    const next = Math.max(currentLevel - 1, MIN_LEVEL);
    if (next < currentLevel) {
      applyZoomForLevel(next);
      announceToScreenReader('Schriftgröße verringert');
    }
  });
  if(incBtn) incBtn.addEventListener('click', ()=>{
    const next = Math.min(currentLevel + 1, MAX_LEVEL);
    if (next > currentLevel) {
      applyZoomForLevel(next);
      announceToScreenReader('Schriftgröße vergrößert');
    }
  });
  if(resetBtn) resetBtn.addEventListener('click', ()=>{
    applyZoomForLevel(0);
    announceToScreenReader('Schriftgröße zurückgesetzt');
  });

  // Labels, Button-Zustände und gespeicherten Zoom initialisieren
  applyZoomForLevel(currentLevel);
  updateStepLabels();
  updateFontButtonStates();

})();
