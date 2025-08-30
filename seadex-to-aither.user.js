// ==UserScript==
// @name        Insert Aither Buttons on SeaDex
// @namespace   Dattebayo13
// @match       *://releases.moe/*
// @version     1.0.0
// @author      Dattebayo13
// @grant       GM_xmlhttpRequest
// @icon        https://aither.cc/favicon/favicon.svg
// @connect     aither.cc
// @description Adds buttons linking to Aither torrents on SeaDex
// @require     https://cdn.jsdelivr.net/gh/CoeJoder/waitForKeyElements.js@v1.3/waitForKeyElements.js
// @run-at      document-idle
// ==/UserScript==

(function () {
  'use strict';

  const AITHER_API_KEY = '';

  function isDetailPage() {
    return /^\/\d+\/?$/.test(location.pathname);
  }

  async function fetchFilename(nyaaUrl) {
    try {
      const apiUrl = `https://releases.moe/api/collections/torrents/records?filter=(url=%22${encodeURIComponent(nyaaUrl)}%22)`;
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      return data.items?.[0]?.files?.[0]?.name || null;
    } catch (err) {
      console.error('Failed to fetch filename:', err);
      return null;
    }
  }

  function fetchAitherLink(filename) {
    return new Promise((resolve) => {
      const url = new URL('https://aither.cc/api/torrents/filter');
      url.searchParams.set('perPage', '16');
      url.searchParams.set('file_name', filename);

      GM_xmlhttpRequest({
        method: 'GET',
        url: url.toString(),
        headers: {
          Authorization: `Bearer ${AITHER_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        onload: (resp) => {
          try {
            const data = JSON.parse(resp.responseText).data || [];
            resolve(data[0]?.attributes?.details_link || null);
          } catch {
            resolve(null);
          }
        },
        onerror: () => resolve(null)
      });
    });
  }

  function createAitherButton(nyaaBtn, detailsLink) {
    const btn = nyaaBtn.cloneNode(true);
    btn.classList.add('aither-button');
    btn.classList.remove('pointer-events-none');
    btn.href = detailsLink;

    btn.childNodes[0].src = 'https://aither.cc/favicon/favicon.svg';
    btn.childNodes[2].textContent = 'Aither';

    return btn;
  }

  async function addAitherButton(card) {
    const btnContainer = card.querySelector('.grid.grid-cols-2');
    const nyaaBtn = btnContainer?.querySelector('a[href*="nyaa.si"]');
    if (!btnContainer || !nyaaBtn) return;
    if (btnContainer.classList.contains('aither-processed')) return;

    btnContainer.classList.add('aither-processed');

    const filename = await fetchFilename(nyaaBtn.href);
    if (!filename) return;

    const detailsLink = await fetchAitherLink(filename);
    if (!detailsLink) return;

    const aitherBtn = createAitherButton(nyaaBtn, detailsLink);
    btnContainer.appendChild(aitherBtn);
  }

  function resetAitherButtons() {
    document.querySelectorAll('.grid.grid-cols-2.aither-processed').forEach(container => {
      const oldBtn = container.querySelector('.aither-button');
      if (oldBtn) oldBtn.remove();
      container.classList.remove('aither-processed');
    });
  }

  function init() {
    resetAitherButtons();
    waitForKeyElements('.rounded-xl.border.bg-card', addAitherButton, false);
  }

  if (isDetailPage()) {
    init();

    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isDetailPage()) init();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

})();
