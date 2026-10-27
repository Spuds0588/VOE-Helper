// VOE Helper - Core Service Worker
const CONFIG = {
  GITHUB_SYNC_URL: 'https://raw.githubusercontent.com/Spuds0588/VOE-Helper/main/employers.json',
  ALARM_NAME: 'VOE_DATABASE_SYNC',
  SYNC_INTERVAL_MINUTES: 1440 // 24 Hours
};

// Lifecycle: Install & Update Handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[VOE Helper] Extension Lifecycle Event: ${details.reason}`);

  // Create Context Menu Item — one entry for everything: selection right
  // away; otherwise the element the user right-clicked (tracked position,
  // see click-tracker.js) supplies the query.
  chrome.contextMenus.create({
    id: 'voe-lookup-selection',
    title: 'Lookup VOE provider on this page',
    contexts: ['selection', 'page', 'frame', 'link', 'editable', 'image', 'video', 'audio']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[VOE Helper] Context Menu Setup Error:', chrome.runtime.lastError.message);
    } else {
      console.log('[VOE Helper] Context menu registered successfully.');
    }
  });

  // Seed storage from local bundle if empty
  await initializeStorage();

  // Schedule daily background sync
  chrome.alarms.create(CONFIG.ALARM_NAME, { periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES });
  console.log(`[VOE Helper] Sync alarm scheduled for every ${CONFIG.SYNC_INTERVAL_MINUTES} minutes.`);
});

// Alarm Handler: Remote Database Reconciliation
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CONFIG.ALARM_NAME) return;
  console.log('[VOE Helper] Alarm triggered: Reconciling database from remote...');
  await syncRemoteDatabase();
});

// Initialize Storage from bundled employers.json
async function initializeStorage() {
  try {
    const existing = await chrome.storage.local.get(['employers', 'lastSync']);
    if (!existing.employers || existing.employers.length === 0) {
      console.log('[VOE Helper] Local storage empty. Loading local employers.json seed...');
      const response = await fetch(chrome.runtime.getURL('employers.json'));
      const employers = await response.json();
      await chrome.storage.local.set({ employers, lastSync: Date.now() });
      console.log(`[VOE Helper] Database seeded with ${employers.length} default records.`);
    } else {
      console.log(`[VOE Helper] Storage valid. Record count: ${existing.employers.length}. Last sync: ${new Date(existing.lastSync).toISOString()}`);
    }
  } catch (err) {
    console.error('[VOE Helper] Storage initialization failed:', err);
  }
}

// Sync Remote Database from GitHub Raw
async function syncRemoteDatabase() {
  try {
    const response = await fetch(CONFIG.GITHUB_SYNC_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const remoteData = await response.json();

    if (Array.isArray(remoteData) && remoteData.length > 0) {
      await chrome.storage.local.set({ employers: remoteData, lastSync: Date.now() });
      console.log(`[VOE Helper] Sync complete. Updated to ${remoteData.length} records.`);
    } else {
      console.warn('[VOE Helper] Remote payload invalid or empty. Storage not modified.');
    }
  } catch (err) {
    console.warn('[VOE Helper] Remote sync failed (using existing local cache):', err.message);
  }
}

// Clean and normalize strings for matching
const normalize = (val) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Query Engine
async function findEmployer(rawQuery) {
  const query = normalize(rawQuery);
  console.log(`[VOE Helper] Executing search for: "${rawQuery}" (Normalized: "${query}")`);

  // Locally saved provider rows (the sweep panel's "save this provider as
  // _the_ route for this employer name") live in the separate
  // 'customEmployers' key so the 24h GitHub-raw sync — which overwrites
  // 'employers' wholesale — can never delete them. They are scanned FIRST
  // (the user explicitly declared the route) while upstream coded rows still
  // beat an uncoded local row on the same name via the pass-1 tie rule.
  const { employers = [], customEmployers = [] } =
    await chrome.storage.local.get(['employers', 'customEmployers']);
  const allEmployers = [...customEmployers, ...employers];
  const startTime = performance.now();

  // Two-Pass Matcher: pass 1 exact name/alias (code-bearing wins), pass 2 substring
  const firstPass = (e) => {
    const nameNorm = normalize(e.name);
    if (nameNorm === query) return true;
    return e.aliases && e.aliases.some(a => normalize(a) === query);
  };

  // Pass-1 tie rule: on exact name/alias ties, a record carrying a provider_code
  // wins over an uncoded row (first coded match wins; uncoded exact matches only
  // stand when no coded exact match exists anywhere). Substring matches keep
  // their lower precedence below every exact/alias match.
  let match = null;
  for (let i = 0; i < allEmployers.length; i++) {
    if (!firstPass(allEmployers[i])) continue;
    if (!match || (!match.provider_code && allEmployers[i].provider_code)) match = allEmployers[i];
    if (match.provider_code) break;
  }

  // Pass-2 substring tiers: a fragment or sentence selection resolves to the
  // most plausible candidate, not merely the first scan hit. First tier with
  // any candidate wins:
  //   1. employer key appears inside the selection, coded row
  //   2. employer key appears inside the selection, uncoded row
  //   3. selection appears inside the employer key, coded row
  //   4. selection appears inside an uncoded employer key (keys >= 6 chars)
  // Keys run over name + aliases; coded keys need >= 3 chars, uncoded >= 4.
  // Within a tier the LONGEST matching key wins — shortest keys are where
  // coincidental mid-word substrings live ("uc" inside "truck").
  if (!match && query.length >= 4) {
    let tier = 99, keyLen = 0;
    for (const e of allEmployers) {
      const coded = !!e.provider_code;
      const keys = [normalize(e.name), ...(e.aliases || []).map(normalize)]
        .filter(k => k && k.length >= (coded ? 3 : 4));
      for (const k of keys) {
        if (k.includes(query)) {
          const t = coded ? 3 : (k.length >= 6 ? 4 : 5);
          if (t < tier || (t === tier && k.length > keyLen)) {
            tier = t; keyLen = k.length; match = e;
          }
        } else if (query.includes(k)) {
          const t = coded ? 1 : 2;
          if (t < tier || (t === tier && k.length > keyLen)) {
            tier = t; keyLen = k.length; match = e;
          }
        }
      }
    }
  }
  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`[VOE Helper] Search completed in ${duration}ms. Result:`, match ? match.name : 'NO_MATCH');

  return match || null;
}

// Clipboard handoff: the injected toast runs inside a HOST PAGE that can
// impose its own clipboard-write policy (prompts, permissions-policy blocks).
// Writing from the extension's own offscreen document is extension-context
// clipboard access under the clipboardWrite permission — no host page can
// gate it, and no prompt is ever shown.
async function copyViaOffscreen(text) {
  const ctxs = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });
  if (!ctxs.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Write the employer code to the clipboard on user click'
    });
  }
  const res = await chrome.runtime.sendMessage({ target: 'voe-offscreen', type: 'copy', text });
  return !!res?.ok;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'COPY_CODE' && typeof msg.text === 'string' && msg.text.length <= 128) {
    copyViaOffscreen(msg.text).then(ok => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;  // async sendResponse
  }
  if (msg?.type === 'OPEN_WVOE_PANEL') {
    // Side-panel relay from the toast (function injectToastUI cannot call
    // chrome.sidePanel.* itself). Stamp any pending prefill first so the
    // panel loads with the matched row, then open it pinned to the sender's
    // tab — this runs from a click-initiated message (user gesture). If the
    // gesture is rejected by an older Chrome, log and leave the manual WVOE
    // path reachable via the extension page.
    (async () => {
      try {
        await chrome.storage.local.set({
          wvoePendingPrefill: msg.matchId || null,
          // Raw right-click/selection text — consumed one-shot into the
          // Employer name field when there is no catalog row behind the
          // match, so an uncatalogued employer still flows into Item 1.
          wvoePendingRawName: (msg.matchId || msg.query) ? String(msg.query || '') : null,
          panelView: 'wvoe'
        });
        await openSidePanel(sender);
      } catch (e) {
        console.error('[VOE Helper] side panel open failed:', e);
      }
    })();
    return true;  // async work; no sendResponse
  }
  if (msg?.type === 'OPEN_VOESWEEP_PANEL') {
    // Manual VOE provider sweep, also in the side panel (user, 2026-10-23):
    // the processor clicks provider cards top-down and the CURRENT tab (the
    // LOS window they started in) moves to each search page — no new-tab
    // pile-up. Stamp the failed query + the target tab id so the panel can
    // navigate THEIR tab and "save this provider" for the employer string.
    (async () => {
      try {
        await chrome.storage.local.set({
          voeSweepState: {
            query: String(msg.query || ''),
            tabId: sender.tab?.id ?? null,
            lastProvider: null,
            lastUrl: null
          },
          panelView: 'sweep'
        });
        await openSidePanel(sender);
      } catch (e) {
        console.error('[VOE Helper] sweep panel open failed:', e);
      }
    })();
    return true;
  }
});

async function openSidePanel(sender) {
  let flags = sender.tab?.id ? { tabId: sender.tab.id } : null;
  if (!flags) {
    // Sender without a tab (extension page): pin the panel to the focused
    // window.
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    flags = t?.windowId ? { windowId: t.windowId } : null;
  }
  if (!flags || !chrome.sidePanel?.open) throw new Error('no side panel target');
  await chrome.sidePanel.open(flags);
}

// Default side panel content: defined once so sidePanel.open() has a panel
// to show even before setOptions is ever called.
chrome.sidePanel.setOptions({ path: 'sidepanel.html' }).catch(e =>
  console.error('[VOE Helper] sidePanel.setOptions failed:', e));

// Clicking the toolbar icon opens the side panel (user report 2026-10-23: the
// panel was only reachable via the icon's right-click context menu).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(e =>
  console.error('[VOE Helper] sidePanel.setPanelBehavior failed:', e));

// Context Menu Event Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'voe-lookup-selection' || !tab?.id) return;

  // Query resolution: selection text wins; with nothing selected take the
  // text inside the element the user right-clicked (click-tracker.js — no
  // more select-then-right-click dance to look an employer up).
  let query = (info.selectionText || '').trim();
  let source = 'selection';
  if (!query) {
    try {
      const target = { tabId: tab.id, world: 'MAIN' };
      if (typeof info.frameId === 'number') target.frameIds = [info.frameId];
      target.func = finderForTrackedPoint;
      const [res] = await chrome.scripting.executeScript({ target });
      query = (res && res.result ? String(res.result.text) : '').trim();
      source = 'right-click element';
    } catch (err) {
      console.error('[VOE Helper] element-under-cursor lookup failed:', err);
    }
  }
  console.log(`[VOE Helper] Event on tab ${tab.id}. Query ("${source}"): "${query}"`);

  if (!query) {
    console.warn('[VOE Helper] No query available (no selection, no element text under the right-click). Action ignored.');
    return;
  }

  const result = await findEmployer(query);

  // Inject UI Toast into target tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectToastUI,
      args: [query, result]
    });
    console.log(`[VOE Helper] Injected toast into tab ${tab.id}`);
  } catch (err) {
    console.error(`[VOE Helper] Failed to inject UI script into tab ${tab.id}:`, err);
  }
});

// Runs in the page's MAIN world: turns the click-tracker.js coordinates into
// the search string — the deepest child element at the right-click point.
// Returns null when the stamp is stale (> 5s), the point hits nothing, or
// there is no text (e.g. an input field).
function finderForTrackedPoint() {
  // Staleness window is generous (browsing the popup menu takes seconds;
  // automated suites pause too). A stale point only risks hitting a
  // different element after scroll — acceptable vs refusing the lookup.
  // Navigation re-runs the tracker at document_start anyway.
  const p = window.__voeRightClick;
  if (!p || Date.now() - p.t > 15000) return null;
  let el = document.elementFromPoint(p.x, p.y);
  if (!el) return null;
  // Descend while there is exactly one child that carries text — most rows
  // are nested <div>/<span>/<b> wrappers around the visible employer name.
  while (el.children.length === 1) {
    const child = el.firstElementChild;
    if (!(child.textContent || '').trim()) break;
    el = child;
  }
  const text = (el.textContent || '').trim();
  return text ? { text: text.slice(0, 200) } : null;
}

// Client DOM Injector (Executed directly inside active page)
function injectToastUI(queryText, match) {
  const HOST_ID = 'voe-helper-shadow-host';
  const existingHost = document.getElementById(HOST_ID);
  if (existingHost) existingHost.remove();

  // Create Host Element
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.all = 'initial';
  document.body.appendChild(host);

  // Attach Shadow DOM for style encapsulation
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .toast-card {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      background: #ffffff;
      color: #1f2937;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      padding: 16px;
      z-index: 2147483647;
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      word-break: break-word;
    }
    .btn-close {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .btn-close:hover { color: #4b5563; }
    .row {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .label { color: #6b7280; }
    .val-provider { font-weight: 600; color: #2563eb; }
    .code-badge {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, monospace;
      font-weight: 600;
      color: #1f2937;
    }
    .btn-copy {
      background: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-copy:hover { background: #e0e7ff; }
    .notes-box {
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 11px;
      color: #4b5563;
      margin-bottom: 10px;
    }
    .btn-portal {
      display: block;
      width: 100%;
      text-align: center;
      background: #2563eb;
      color: #ffffff;
      padding: 7px 0;
      border-radius: 5px;
      text-decoration: none;
      font-weight: 600;
      box-sizing: border-box;
    }
    .btn-portal:hover { background: #1d4ed8; }
    .btn-wvoe {
      display: block;
      width: 100%;
      text-align: center;
      background: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
      padding: 7px 0;
      border-radius: 5px;
      text-decoration: none;
      font-weight: 600;
      font-size: 12px;
      box-sizing: border-box;
      cursor: pointer;
      margin-top: 8px;
    }
    .btn-wvoe:hover { background: #e0e7ff; }
    .not-found-text {
      color: #4b5563;
      font-size: 12px;
      margin: 8px 0 0 0;
      overflow-wrap: anywhere;
      max-height: 110px;
      overflow: auto;
    }
  `;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'toast-card';

  // Everything interpolated below goes through innerHTML; selection text is
  // attacker-controlled page content and index fields are remotely synced,
  // so all dynamic values are HTML-escaped first.
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  // Portal-link prefill (2026-10-23): Truework's requester quickstart only
  // preselects an employer via its opaque companyId triple; adding the
  // matched employer's name as a companyName param is ignored by their app
  // but is consumed by our content script (truework-prefill.js), which types
  // it into the employer-search box on load. Ordering pages of the other
  // providers have no public, safely prefillable search form.
  let portalHref = '';
  if (match) {
    if (match.portal_url.startsWith('https://app.truework.com/requester/quickstart') && !match.portal_url.includes('companyName=')) {
      portalHref = match.portal_url + '?companyName=' + encodeURIComponent(match.name);
    } else {
      portalHref = match.portal_url;
    }
    container.innerHTML = `
      <div class="header">
        <h4 class="title">${esc(match.name)}</h4>
        <button class="btn-close" id="close">✕</button>
      </div>
      <div class="row">
        <span class="label">Provider:</span>
        <span class="val-provider">${esc(match.provider)}</span>
      </div>
      <div class="row">
        <div>
          <span class="label">Code:</span>
          <span class="code-badge">${esc(match.provider_code || 'N/A')}</span>
        </div>
        ${match.provider_code ? `<button class="btn-copy" id="copy-btn">Copy Code</button>` : ''}
      </div>
      ${match.notes ? `<div class="notes-box">ℹ️ ${esc(match.notes)}</div>` : ''}
      <a class="btn-portal" href="${esc(portalHref)}" target="_blank" rel="noopener noreferrer">Open Verification Portal</a>
      ${!match.provider_code ? `<button class="btn-wvoe" id="wvoe-btn">Start Manual WVOE</button>` : ''}
    `;
  } else {
    container.innerHTML = `
      <div class="header">
        <h4 class="title" style="color: #b91c1c;">No Provider Found</h4>
        <button class="btn-close" id="close">✕</button>
      </div>
      <p class="not-found-text">
        No electronic VOE clearinghouse registered for "<strong>${esc(queryText)}</strong>". Initiate a manual Written VOE (Form 1005) or run the providers' search pages by hand.
      </p>
      <button class="btn-wvoe" id="wvoe-btn">Start Manual WVOE</button>
      <button class="btn-wvoe" id="voe-search-btn">Manual VOE Search (all providers)</button>
    `;
  }

  shadow.appendChild(container);

  // Shadow Event Handlers
  shadow.getElementById('close').onclick = () => host.remove();

  // WVOE buttons open the SIDE PANEL (user pivot 2026-10-23: the processor
  // works inside their LOS tab, so value collection must not steal a tab —
  // the panel collects the form while the LOS stays visible). Manual WVOE is
  // offered ONLY where no electronic provider match exists (user rule: coded
  // employers reject manual WVOE forms) — i.e. no-match and uncoded catalog
  // rows. The click is relayed to the service worker, which stamps any
  // pending prefill into storage and calls chrome.sidePanel.open()
  // (gesture-bearing message; chrome.sidePanel.* is not callable from a
  // content script). The manual provider sweep also opens the side panel
  // (see the voeSearchBtn handler below).
  const wvoeBtn = shadow.getElementById('wvoe-btn');
  if (wvoeBtn) {
    const senderMatchId = (typeof match === 'object' && match?.id) ? match.id : null;
    wvoeBtn.onclick = () => {
      try {
        chrome.runtime.sendMessage(
          { type: 'OPEN_WVOE_PANEL', matchId: senderMatchId, query: String(queryText || '') },
          () => { void chrome.runtime.lastError; });
      } catch (e) {
        console.error('[VOE Helper] panel open relay failed:', e);
      }
    };
  }
  const voeSearchBtn = shadow.getElementById('voe-search-btn');
  if (voeSearchBtn) {
    // Sweep panel relay (user pivot: same side-panel surface; the CURRENT tab
    // — the one the toast was raised on — is moved to each provider search
    // page top-down, then a 1-click "save this provider" back in the panel).
    voeSearchBtn.onclick = () => {
      try {
        chrome.runtime.sendMessage(
          { type: 'OPEN_VOESWEEP_PANEL', query: String(queryText || '') },
          () => { void chrome.runtime.lastError; });
      } catch (e) {
        console.error('[VOE Helper] sweep relay failed:', e);
      }
    };
  }

  const copyBtn = shadow.getElementById('copy-btn');
  if (copyBtn && match?.provider_code) {
    // Copy via the service worker's offscreen document (extension context) —
    // never the host page's clipboard policy. Never claim success it did not
    // have.
    copyBtn.onclick = async () => {
      try {
        const res = await new Promise(resolve => {
          try {
            chrome.runtime.sendMessage(
              { type: 'COPY_CODE', text: String(match.provider_code) },
              r => { void chrome.runtime.lastError; resolve(r); });
          } catch (e) {
            resolve(null);
          }
        });
        if (!res || !res.ok) console.error('[VOE Helper] offscreen copy rejected');
        copyBtn.innerText = res?.ok ? 'Copied!' : 'Copy failed';
      } catch (e) {
        copyBtn.innerText = 'Copy failed';
      }
      setTimeout(() => (copyBtn.innerText = 'Copy Code'), 1500);
    };
  }

  // Auto Dismiss after 9 seconds
  setTimeout(() => {
    if (document.body.contains(host)) host.remove();
  }, 9000);
}
