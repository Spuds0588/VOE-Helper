// VOE Helper - Core Service Worker
const CONFIG = {
  GITHUB_SYNC_URL: 'https://raw.githubusercontent.com/Spuds0588/VOE-Helper/main/employers.json',
  ALARM_NAME: 'VOE_DATABASE_SYNC',
  SYNC_INTERVAL_MINUTES: 1440 // 24 Hours
};

// Lifecycle: Install & Update Handlers
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[VOE Helper] Extension Lifecycle Event: ${details.reason}`);

  // Create Context Menu Item
  chrome.contextMenus.create({
    id: 'voe-lookup-selection',
    title: 'Lookup VOE Provider for "%s"',
    contexts: ['selection']
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

  const { employers = [] } = await chrome.storage.local.get('employers');
  const startTime = performance.now();

  // Two-Pass Matcher: pass 1 exact name/alias (code-bearing wins), pass 2 substring
  const firstPass = (e) => {
    const nameNorm = normalize(e.name);
    if (nameNorm === query) return true;
    return e.aliases && e.aliases.some(a => normalize(a) === query);
  };
  const secondPass = (e) => {
    const nameNorm = normalize(e.name);
    return query.length >= 4 && (nameNorm.includes(query) || query.includes(nameNorm));
  };

  let match = employers.find(firstPass);
  if (!match) match = employers.find(secondPass);

  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`[VOE Helper] Search completed in ${duration}ms. Result:`, match ? match.name : 'NO_MATCH');

  return match || null;
}

// Context Menu Event Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'voe-lookup-selection' || !tab?.id) return;

  const rawSelection = (info.selectionText || '').trim();
  console.log(`[VOE Helper] Event on tab ${tab.id}. Selected text: "${rawSelection}"`);

  if (!rawSelection) {
    console.warn('[VOE Helper] Empty selection received. Action ignored.');
    return;
  }

  const result = await findEmployer(rawSelection);

  // Inject UI Toast into target tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectToastUI,
      args: [rawSelection, result]
    });
    console.log(`[VOE Helper] Injected toast into tab ${tab.id}`);
  } catch (err) {
    console.error(`[VOE Helper] Failed to inject UI script into tab ${tab.id}:`, err);
  }
});

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
    .not-found-text {
      color: #4b5563;
      font-size: 12px;
      margin: 8px 0 0 0;
    }
  `;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'toast-card';

  // Everything interpolated below goes through innerHTML; selection text is
  // attacker-controlled page content and index fields are remotely synced,
  // so all dynamic values are HTML-escaped first.
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  if (match) {
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
      <a class="btn-portal" href="${esc(match.portal_url)}" target="_blank" rel="noopener noreferrer">Open Verification Portal</a>
    `;
  } else {
    container.innerHTML = `
      <div class="header">
        <h4 class="title" style="color: #b91c1c;">No Provider Found</h4>
        <button class="btn-close" id="close">✕</button>
      </div>
      <p class="not-found-text">
        No electronic VOE clearinghouse registered for "<strong>${esc(queryText)}</strong>". Initiate a manual Written VOE (Form 1005).
      </p>
    `;
  }

  shadow.appendChild(container);

  // Shadow Event Handlers
  shadow.getElementById('close').onclick = () => host.remove();

  const copyBtn = shadow.getElementById('copy-btn');
  if (copyBtn && match?.provider_code) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(match.provider_code);
      copyBtn.innerText = 'Copied!';
      setTimeout(() => (copyBtn.innerText = 'Copy Code'), 1500);
    };
  }

  // Auto Dismiss after 9 seconds
  setTimeout(() => {
    if (document.body.contains(host)) host.remove();
  }, 9000);
}
