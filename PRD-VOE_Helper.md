# VOE Helper - Master Developer & Product Specification

This master document serves as the single source of truth for engineering, product, and data harvesting for **VOE Helper**. It contains four sections:
1. **Product Requirements Document (PRD)**
2. **Implementation Guide & Architecture**
3. **Developer Task List**
4. **AGENTS.md (Data Extraction Pipeline)**

---

# 1. Product Requirements Document (PRD)

## 1.1 Executive Summary
VOE Helper is a zero-latency Manifest V3 Chrome Extension engineered for mortgage loan processors, underwriters, and verification specialists. It resolves company names into actionable Verification of Employment/Income (VOE/VOI) providers and specific Employer Codes in under 50ms without leaving the active workflow.

## 1.2 Problem Statement
Loan processors spend 3 to 7 minutes per loan file manually cross-referencing multiple verification portals (The Work Number/Equifax, Truework, Thomas & Company) to determine who holds an applicant's payroll records. This creates tab sprawl, increases processing costs, and leads to wasted verification order fees when processors query the wrong platform.

## 1.3 Target Audience
* Primary: Mortgage Loan Processors and Junior Underwriters.
* Secondary: Background check verification specialists and auto-loan verification agents.
* Working Environments: Web-based Loan Origination Systems (Encompass Web, Blend, Arive, LendingPad), web mail (Gmail/Outlook), and browser-based 1003 PDF viewers.

## 1.4 Scope: In-Scope vs. Out-of-Scope (YAGNI Enforcement)

### In-Scope (Version 1.0)
* **Text Selection Context Menu:** Instant right-click lookup on any highlighted employer text.
* **In-Page Overlay Toast:** Lightweight, non-intrusive floating card in the active viewport displaying provider name, employer code, and deep link.
* **One-Click Code Copy:** Native clipboard injection for identified employer codes.
* **Offline-First Local Search:** In-memory lookups against a local JSON database stored in `chrome.storage.local`.
* **Automated Daily Sync:** Background reconciliation against a remote, raw JSON repository hosted on GitHub.
* **Verbose Diagnostic Logging:** Structured browser console logging prefix (`[VOE Helper]`) for debugging.

### Out-of-Scope (Deferred to V2/V3)
* **Automatic DOM / LOS Scraping:** No continuous mutation observers or auto-flagging on specific LOS domains (prevents UI breakage, DOM drift, and false positives).
* **Automated Form 1005 (WVOE) PDF Population:** No automated PDF generation or address normalization.
* **Hunter.io / Third-Party Contact Lookup:** No external paid API dependencies or BYOK modules.
* **Cross-Origin Iframe Embedding:** No embedded provider portals inside the extension.

## 1.5 User Journey & User Stories
1. **User Story 1 (Lookup):** As a loan processor reviewing an applicant's W-2 inside an LOS or PDF viewer, I want to highlight the employer name, right-click, and select "Lookup VOE Provider", so that I instantly know which portal holds the verification data.
2. **User Story 2 (Code Retrieval):** As a processor submitting an order on The Work Number, I want to click "Copy Code" on the result card, so that I don't have to manually re-type a 6-digit employer code.
3. **User Story 3 (Unmatched Fallback):** As an underwriter querying an employer not covered by major electronic clearinghouses, I want to see a clear "No Provider Found" notification with a fallback prompt to initiate a manual Written VOE (Form 1005).

## 1.6 Data Schema (`employers.json`)
The local database must conform strictly to the following JSON schema:

```json
[
  {
    "id": "twn-11116",
    "name": "The Home Depot",
    "aliases": ["Home Depot", "Home Depot USA", "Home Depot Inc"],
    "provider": "The Work Number",
    "provider_code": "11116",
    "portal_url": "https://theworknumber.com",
    "notes": "Requires full employee SSN.",
    "updated_at": "2026-10-01"
  }
]
```

## 1.7 Performance & Reliability Metrics
* **Local Lookup Latency:** < 10ms from context menu click to toast rendering.
* **Extension Footprint:** Initial bundle size < 5MB (including 30,000+ employer records).
* **Match Precision:** > 95% on normalized exact and alias matches.
* **Fault Tolerance:** If remote GitHub sync fails (network outage, GitHub rate limits), the extension silently continues operating on the locally cached dataset.

---

# 2. Implementation Guide & Architecture

## 2.1 System Architecture

```text
[ Browser Context / Active Web Page ]
       │
       │ 1. User Highlights Employer & Right-Clicks
       ▼
[ chrome.contextMenus ]
       │
       │ 2. Triggers background service worker
       ▼
[ background.js (Service Worker) ]
       │
       ├─── Reads Cache ──────► [ chrome.storage.local (employers array) ]
       │
       │ 3. Normalizes text & computes match (<2ms)
       │
       ├─── Executes Script ──► [ Injects Isolated Shadow DOM Toast ]
       │
       └─── Daily Alarm (24h) ─► [ Fetches GitHub Raw employers.json ] ── Updates Storage
```

## 2.2 Directory Structure
```text
voe-helper/
├── manifest.json
├── background.js
├── employers.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 2.3 Production Code Base

### `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "VOE Helper",
  "version": "1.0.0",
  "description": "Instant VOE/VOI provider and employer code lookup.",
  "permissions": [
    "contextMenus",
    "storage",
    "activeTab",
    "scripting",
    "alarms"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "web_accessible_resources": [
    {
      "resources": ["employers.json"],
      "matches": ["<all_urls>"]
    }
  ],
  "action": {
    "default_title": "VOE Helper Status"
  }
}
```

### `employers.json` (Seed Database)
```json
[
  {
    "id": "twn-11116",
    "name": "The Home Depot",
    "aliases": ["Home Depot", "Home Depot USA", "Home Depot Inc"],
    "provider": "The Work Number",
    "provider_code": "11116",
    "portal_url": "https://theworknumber.com",
    "notes": "Requires employee SSN."
  },
  {
    "id": "twn-10396",
    "name": "State of California",
    "aliases": ["California State", "State of CA", "State of California - All Agencies"],
    "provider": "The Work Number",
    "provider_code": "10396",
    "portal_url": "https://theworknumber.com",
    "notes": "Requires last 6 digits of SSN + Birth MMDD."
  },
  {
    "id": "tnc-l3h518",
    "name": "L3Harris Technologies",
    "aliases": ["L3Harris", "Harris Corp", "L-3 Communications"],
    "provider": "Thomas & Company",
    "provider_code": "L3H518",
    "portal_url": "https://tncverify.com",
    "notes": "Requires Employee ID."
  },
  {
    "id": "twn-10115",
    "name": "Target Corporation",
    "aliases": ["Target", "Target Stores", "Target Brands Inc"],
    "provider": "The Work Number",
    "provider_code": "10115",
    "portal_url": "https://theworknumber.com",
    "notes": "Corporate and retail operations."
  },
  {
    "id": "tw-stripe",
    "name": "Stripe, Inc.",
    "aliases": ["Stripe", "Stripe Payments"],
    "provider": "Truework",
    "provider_code": "",
    "portal_url": "https://www.truework.com/verifications/stripe/",
    "notes": "Direct API verification enabled."
  }
]
```

### `background.js`
```javascript
// VOE Helper - Core Service Worker
const CONFIG = {
  GITHUB_SYNC_URL: 'https://raw.githubusercontent.com/org/voe-helper/main/employers.json',
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

  // 1-Line Matcher: Exact Name, Exact Alias, or Substring Inclusion
  const match = employers.find(e => {
    const nameNorm = normalize(e.name);
    if (nameNorm === query) return true;
    if (e.aliases && e.aliases.some(a => normalize(a) === query)) return true;
    if (query.length >= 4 && (nameNorm.includes(query) || query.includes(nameNorm))) return true;
    return false;
  });

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

  if (match) {
    container.innerHTML = `
      <div class="header">
        <h4 class="title">${match.name}</h4>
        <button class="btn-close" id="close">✕</button>
      </div>
      <div class="row">
        <span class="label">Provider:</span>
        <span class="val-provider">${match.provider}</span>
      </div>
      <div class="row">
        <div>
          <span class="label">Code:</span>
          <span class="code-badge">${match.provider_code || 'N/A'}</span>
        </div>
        ${match.provider_code ? `<button class="btn-copy" id="copy-btn">Copy Code</button>` : ''}
      </div>
      ${match.notes ? `<div class="notes-box">ℹ️ ${match.notes}</div>` : ''}
      <a class="btn-portal" href="${match.portal_url}" target="_blank" rel="noopener noreferrer">Open Verification Portal</a>
    `;
  } else {
    container.innerHTML = `
      <div class="header">
        <h4 class="title" style="color: #b91c1c;">No Provider Found</h4>
        <button class="btn-close" id="close">✕</button>
      </div>
      <p class="not-found-text">
        No electronic VOE clearinghouse registered for "<strong>${queryText}</strong>". Initiate a manual Written VOE (Form 1005).
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
```

---

# 3. Developer Task List

### Sprint 1: Setup & Local Scaffolding
- [x] Create project repository structure (`manifest.json`, `background.js`, `employers.json`).
- [x] Configure Manifest V3 permissions (`contextMenus`, `storage`, `activeTab`, `scripting`, `alarms`).
- [x] Build local storage seeder function inside `background.js` using local `employers.json`.
- [x] Register context menu item bound to `"contexts": ["selection"]`.

### Sprint 2: Matching Engine & Shadow DOM Toast
- [x] Implement `normalize()` string utility function.
- [x] Implement linear fuzzy/alias search against local storage array.
- [x] Build Shadow DOM template injection to prevent LOS page style leakage.
- [x] Implement one-click native clipboard copy handler for employer codes.
- [x] Implement 9-second auto-dismiss timeout and manual close button.

### Sprint 3: Resilience & Remote Sync
- [ ] Configure `chrome.alarms` listener for 24-hour periodic update check.
- [ ] Implement `syncRemoteDatabase()` to hit GitHub raw endpoint with error handling.
- [ ] Test cold boot behavior: Install extension with network disconnected to ensure local fallback functions.
- [ ] Verify execution inside iframes and across restricted pages (e.g., `chrome://` handled gracefully).

### Sprint 4: Performance Validation & Packaging
- [ ] Profile search execution time with 35,000+ records in `chrome.storage.local`. Target: < 15ms.
- [ ] Verify memory profile of the background service worker upon wake-up. Target: < 30MB RAM.
- [ ] Produce production assets (16px, 48px, 128px PNG icons).
- [ ] Run Chrome Web Store compliance audit.

---

# 4. AGENTS.md (Data Extraction Pipeline)

This guide documents the autonomous data extraction pipeline used to harvest, extract, and normalize 25,000+ employer records and codes.

## 4.1 System Overview

```text
[ Data Sources ]
  ├── 1. Truework Directory Crawl (A–Z Web Tree)
  └── 2. Search Engine Dorking (.edu / .gov / PDF Employee Guides)
              │
              ▼
    [ extraction_agent.py ]
              │
              ├── Parses DOM & Extracts PDFs
              ├── Deduplicates & Normalizes Aliases
              └── Validates Provider Codes via Regex
              │
              ▼
    [ Export to employers.json ] ──► Pushed to GitHub Repository
```

## 4.2 Data Harvest Rules

### Rule 1: The Work Number (Equifax)
* **Target:** Public HR handbooks, state employee verification guides, and `.edu` sites.
* **Extraction Target:** Numeric employer code (typically 5 to 8 digits).
* **Regex:** `\b(1\d{4,7})\b` or explicit pattern `Employer Code:?\s*(\d{5,8})`.

### Rule 2: Thomas & Company
* **Target:** Enterprise employee self-service guides, `tncverify.com` instructions.
* **Extraction Target:** Alphanumeric company code (typically 3 to 6 uppercase characters, often ending in numbers).
* **Regex:** `Company Code:?\s*([A-Z0-9]{3,8})`.

### Rule 3: Truework
* **Target:** `truework.com/directory` (Alphabetical paginated routes).
* **Ext