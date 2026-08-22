/**
 * Backipedia – Service Worker (Manifest V3)
 *
 * Handles cross-origin API requests that the content script cannot make
 * directly (Wayback Machine fallback, revision metadata caching).
 */

// --- Message routing -------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'FETCH_REVISION':
      handleFetchRevision(message.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true; // async response

    case 'FETCH_WAYBACK':
      handleFetchWayback(message.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case 'GET_SETTINGS':
      chrome.storage.sync.get({ defaultYear: 2022, enabled: true }, (settings) => {
        sendResponse(settings);
      });
      return true;

    case 'SAVE_SETTINGS':
      chrome.storage.sync.set(message.payload, () => {
        sendResponse({ ok: true });
      });
      return true;

    default:
      sendResponse({ error: `Unknown message type: ${message.type}` });
      return false;
  }
});

// --- API helpers ------------------------------------------------------------

/**
 * Fetch a specific revision of a Wikipedia article via the MediaWiki API.
 * @param {{ title: string, revisionId?: number, year?: number }} payload
 */
async function handleFetchRevision({ title, revisionId, year }) {
  const lang = new URL(chrome.runtime.getURL('')).hostname; // fallback
  const apiBase = 'https://en.wikipedia.org/w/api.php';

  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: title,
    format: 'json',
    origin: '*',
  });

  if (revisionId) {
    params.set('rvids', String(revisionId));
  } else if (year) {
    params.set('rvstart', `${year}-12-31T23:59:59Z`);
    params.set('rvlimit', '1');
  }

  const res = await fetch(`${apiBase}?${params.toString()}`);
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);

  const data = await res.json();
  const pages = data?.query?.pages;
  const page = pages && Object.values(pages)[0];

  if (!page || page.missing) {
    return { found: false, title };
  }

  const rev = page.revisions?.[0];
  return {
    found: true,
    title: page.title,
    revisionId: rev?.revid,
    timestamp: rev?.timestamp,
    user: rev?.user,
  };
}

/**
 * Attempt to retrieve a page snapshot from the Wayback Machine.
 * @param {{ url: string, year?: number }} payload
 */
async function handleFetchWayback({ url, year }) {
  const timestamp = year ? `${year}0101000000` : '';
  const apiBase = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`;

  const res = await fetch(apiBase);
  if (!res.ok) throw new Error(`Wayback API error: ${res.status}`);

  const data = await res.json();
  const snapshot = data?.archived_snapshots?.closest;

  if (!snapshot) {
    return { found: false, url };
  }

  return {
    found: true,
    url: snapshot.url,
    timestamp: snapshot.timestamp,
    status: snapshot.status,
  };
}
