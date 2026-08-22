/**
 * Backipedia – Popup Script
 *
 * Reads/writes user settings via chrome.storage.sync.
 */

(() => {
  'use strict';

  const yearSelect = document.getElementById('year-select');
  const enabledToggle = document.getElementById('enabled-toggle');

  // Load saved settings
  chrome.storage.sync.get({ defaultYear: 2022, enabled: true }, (settings) => {
    yearSelect.value = String(settings.defaultYear);
    enabledToggle.checked = settings.enabled;
  });

  // Persist on change
  function save() {
    chrome.storage.sync.set({
      defaultYear: Number(yearSelect.value),
      enabled: enabledToggle.checked,
    });
  }

  yearSelect.addEventListener('change', save);
  enabledToggle.addEventListener('change', save);
})();
