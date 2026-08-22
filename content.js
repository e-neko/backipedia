/**
 * Backipedia – Content Script
 *
 * Injected into Wikipedia pages. Provides the "Historical View" button
 * and a lightweight panel for displaying revision metadata.
 */

(() => {
  'use strict';

  // Avoid double-injection (e.g. after SPA navigation)
  if (window.__backipediaLoaded) return;
  window.__backipediaLoaded = true;

  // --- DOM helpers ----------------------------------------------------------

  function createEl(tag, attrs = {}, text = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k.startsWith('data-')) el.setAttribute(k, v);
      else el[k] = v;
    });
    if (text) el.textContent = text;
    return el;
  }

  // --- UI injection ---------------------------------------------------------

  function injectUI() {
    const container = createEl('div', { class: 'backipedia-container' });

    const btn = createEl('button', {
      class: 'backipedia-btn',
      'data-action': 'toggle-panel',
    }, '📜 Historical View');

    const panel = createEl('div', { class: 'backipedia-panel', hidden: true });
    const panelTitle = createEl('h3', { class: 'backipedia-panel-title' }, 'Backipedia');
    const panelBody = createEl('div', { class: 'backipedia-panel-body' });
    const statusLine = createEl('p', { class: 'backipedia-status' }, 'Ready.');

    panel.append(panelTitle, panelBody, statusLine);
    container.append(btn, panel);

    // Insert near the top of the article content
    const target = document.querySelector('#mw-content-text') || document.body;
    target.prepend(container);

    // --- Event wiring -------------------------------------------------------

    btn.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) loadRevisionInfo(panelBody, statusLine);
    });
  }

  // --- Data loading ---------------------------------------------------------

  async function loadRevisionInfo(body, statusLine) {
    statusLine.textContent = 'Loading revision info…';
    body.innerHTML = '';

    const title = document.querySelector('h1#firstHeading')?.textContent?.trim()
      || document.title.replace(/ - Wikipedia$/, '');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_REVISION',
        payload: { title, year: 2022 },
      });

      if (response.error) throw new Error(response.error);

      if (!response.found) {
        statusLine.textContent = 'No historical revision found. Trying Wayback Machine…';
        const wb = await chrome.runtime.sendMessage({
          type: 'FETCH_WAYBACK',
          payload: { url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, year: 2022 },
        });
        if (wb.found) {
          body.append(
            createEl('p', {}, `Wayback snapshot: ${wb.timestamp}`),
            createEl('a', { href: wb.url, target: '_blank', rel: 'noopener' }, 'Open snapshot →')
          );
        } else {
          statusLine.textContent = 'No snapshot available.';
        }
        return;
      }

      body.append(
        createEl('p', {}, `Revision: ${response.revisionId}`),
        createEl('p', {}, `Timestamp: ${response.timestamp}`),
        createEl('p', {}, `Editor: ${response.user}`)
      );
      statusLine.textContent = 'Loaded.';
    } catch (err) {
      statusLine.textContent = `Error: ${err.message}`;
    }
  }

  // --- Init -----------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();
