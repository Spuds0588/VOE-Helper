// VOE Helper — WVOE side panel (user pivot, 2026-10-23).
//
// The processor works inside their web LOS; the side panel collects the
// manual-WVOE values alongside it — no tab switch, no modal focus steal.
// Values persist to chrome.storage wvoeDraft (debounced); "Download PDF"
// generates the final file right here with the same pdfme bundle; opening
// the two-pane preview is a chrome.tabs.create — the only context switch,
// and it is user-initiated.
(() => {
  const FIELDS = WVOE_FIELDS;
  const el = (id) => document.getElementById(id);
  const status = el('status');
  const setStatus = (state, text) => {
    status.dataset.state = state;
    status.textContent = text;
  };

  // ---------- generation (official Fannie Mae Form 1005) ----------
  // The bundled assets/fannie-mae-form-1005.pdf is the base; the schema in
  // wvoe-template.js overlays the lender's Part I fields (measured positions).
  let form1005BytesPromise = null;
  function loadForm1005() {
    if (!form1005BytesPromise) {
      form1005BytesPromise =
        fetch(chrome.runtime.getURL(VOE_FORM1005_ASSET))
          .then(r => {
            if (!r.ok) throw new Error('Form 1005 asset HTTP ' + r.status);
            return r.arrayBuffer();
          })
          .then(buf => new Uint8Array(buf));
      // A failed fetch must not be cached — the next Generate retries.
      form1005BytesPromise.catch(() => { form1005BytesPromise = null; });
    }
    return form1005BytesPromise;
  }

  const collectValues = () => {
    const values = {};
    for (const f of FIELDS) {
      const v = el(f).value.trim();
      if (v && WVOE_PRINTED_FIELDS.includes(f)) values[f] = v;
    }
    return values;
  };

  // ---------- draft persistence (debounced) ----------
  let draftTimer = null;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const draft = {};
      for (const f of FIELDS) draft[f] = el(f).value;
      chrome.storage.local.set({ wvoeDraft: draft }).catch(() => {});
    }, 400);
  };
  for (const f of FIELDS) el(f).addEventListener('input', saveDraft);

  // ---------- restore + prefill ----------
  chrome.storage.local.get(['wvoeDraft', 'wvoePendingPrefill', 'employers'])
    .then(({ wvoeDraft, wvoePendingPrefill, employers = [] } = {}) => {
      // 1. restore whatever the processor had typed before
      if (wvoeDraft && typeof wvoeDraft === 'object') {
        for (const f of FIELDS) {
          if (typeof wvoeDraft[f] === 'string') el(f).value = wvoeDraft[f];
        }
      }
      // 2. pending prefill (stamped by the service worker on toast click)
      if (wvoePendingPrefill) {
        const rec = employers.find((e) => e && e.id === wvoePendingPrefill);
        if (rec) {
          el('employerName').value = rec.name || '';
          const lines = [];
          if (rec.provider) lines.push('Electronic VOE provider: ' + rec.provider);
          if (rec.provider_code) lines.push('Employer Code: ' + rec.provider_code);
          else lines.push('(no published code — fill manually if one is known)');
          if (rec.notes) lines.push('Note: ' + rec.notes.slice(0, 200));
          el('providerBlock').value = lines.join('\n');
          // one-shot: clear so a later bare-panel open doesn't re-apply
          chrome.storage.local.remove('wvoePendingPrefill').catch(() => {});
          setStatus('idle', 'Pre-filled from catalog: ' + rec.name);
          renderContact('wvoeContact', rec);
          saveDraft();
        } else {
          setStatus('error', 'catalog row gone: ' + wvoePendingPrefill);
        }
      }
    })
    .catch((err) => {
      console.error('[VOE Helper sidepanel] restore failed:', err);
      setStatus('error', 'restore failed reading storage');
    });

  // Default date = today when not yet filled.
  if (!el('date').value) el('date').value = new Date().toISOString().slice(0, 10);

  // ---------- generate + download (panel is self-sufficient) ----------
  el('generate').addEventListener('click', async () => {
    const btn = el('generate');
    btn.disabled = true;
    setStatus('busy', 'Generating…');
    try {
      const values = collectValues();
      if (Object.keys(values).length === 0) {
        setStatus('error', 'nothing to generate — fill at least one field');
        return;
      }
      // Form 1005 is addressed to an employer; without Item 1 the form is
      // unusable, so require a recipient before rendering.
      if (!values.employerName) {
        setStatus('error', 'employer name needed — Item 1 “To” can\u2019t be blank');
        return el('employerName').focus();
      }
      const basePdf = (await loadForm1005()).slice(0); // fresh copy per render
      const bytes = await window.pdfmeGenerate({
        template: {
          basePdf,
          schemas: voeForm1005Schema()
        },
        inputs: [values]
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      // File each loan distinctly: WVOE-<employer>-<date>.pdf.
      const stamp = (values.date || '').replace(/[^0-9-]/g, '');
      const slug = (values.employerName || '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'WVOE-' + (slug ? slug + '-' : '') + (stamp || 'undated') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('ok', 'WVOE PDF generated + downloaded');
    } catch (err) {
      console.error('[VOE Helper sidepanel] generate failed:', err);
      setStatus('error', 'generation failed: ' +
        (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- open the big two-pane preview (deliberate context switch) ----------
  el('openPreview').addEventListener('click', async () => {
    try {
      await saveDraftImmediate();
      chrome.tabs.create({ url: chrome.runtime.getURL('wvoe.html') });
    } catch (err) {
      console.error('[VOE Helper sidepanel] open preview failed:', err);
      setStatus('error', 'could not open preview tab');
    }
  });

  function saveDraftImmediate() {
    const draft = {};
    for (const f of FIELDS) draft[f] = el(f).value;
    return chrome.storage.local.set({ wvoeDraft: draft });
  }

  // ================= manual provider sweep view =================
  // Reveals a top-down list: clicking a card MOVES THE CURRENT TAB (the one
  // the sweep was opened on) to that provider's public search page. Coming
  // back, "Save this route" records the found provider as THE local route
  // for the employer name string — one or two clicks total.
  const sweepName = el('sweepName');
  const saveProvider = el('saveProvider');
  const saveCode = el('saveCode');
  const sweepStatus = el('sweepStatus');
  const setSweepStatus = (state, text) => {
    sweepStatus.dataset.state = state;
    sweepStatus.textContent = text;
  };

  // Provider logos as owned-style monogram badges (each provider's own
  // accent color); the name is set in the panel's UI font next to it.
  const PROVIDERS = [
    { key: 'truework', name: 'Truework', glyph: 'tw', color: '#2563eb',
      label: 'Truework — quickstart ordering',
      url: 'https://app.truework.com/requester/quickstart',
      prefillParam: 'companyName',
      desc: 'When this tab arrives, the employer name is already typed in the search box; you still pick the employer.' },
    { key: 'twn', name: 'The Work Number', glyph: 'tw', color: '#6d28d9',
      label: 'The Work Number — employee portal',
      former: 'previously TALX / TALX UC',
      url: 'https://employees.theworknumber.com/',
      desc: 'Public consumer front door; verifier ordering is behind the logged-in VsPortal — no public prefill.' },
    { key: 'tc', name: 'Thomas & Co.', glyph: 'T&', color: '#0f766e',
      label: 'Thomas & Company — tncverify portal',
      url: 'https://tncverify.com/',
      desc: 'Employee login exposes a public Company Code field; codes also circulate on employer EWV flyers.' },
    { key: 'experian', name: 'Experian', glyph: 'ex', color: '#0284c7',
      label: 'Experian Employer Services',
      url: 'https://www.experian.com/employer-services',
      desc: 'TRAP: employer-page codes there are EMPLOYEE access codes, not verifier codes.' }
  ];
  const providerByKey = (k) => PROVIDERS.find(p => p.key === k) || null;
  const normKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // ---- card rendering + navigation ----
  const cardsBox = el('sweepCards');
  for (const p of PROVIDERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sweep-card';
    b.id = 'sweep-card-' + p.key;
    b.innerHTML =
      '<span class="glyph" aria-hidden="true"></span>' +
      '<span class="what"><span class="nm"><span></span></span><span class="former"></span><span class="ds"></span></span>' +
      '<span class="arrow" aria-hidden="true">↗</span>';
    b.querySelector('.glyph').textContent = p.glyph;
    b.querySelector('.glyph').style.background = p.color;
    b.querySelector('.what .nm span').textContent = p.name;
    // Subtle grey "previously …" line for providers that changed names —
    // only when one is documented in the catalog notes.
    if (p.former) b.querySelector('.what .former').textContent = p.former;
    else b.querySelector('.what .former').remove();
    b.querySelector('.what .ds').textContent = p.desc;
    b.addEventListener('click', (ev) => openProvider(p, ev.currentTarget));
    cardsBox.appendChild(b);
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    saveProvider.appendChild(opt);
  }

  async function resolveTargetTabId(state) {
    // tabId may arrive as a number (SW relay) or a string (storage round-trip);
    // chrome.tabs.update requires a number.
    if (state && state.tabId) {
      const n = Number(state.tabId);
      if (Number.isFinite(n)) return n;
    }
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return t?.id ?? null;
  }

  async function openProvider(p, cardEl) {
    let state = null;
    try {
      state = (await chrome.storage.local.get('voeSweepState')).voeSweepState || {};
    } catch { /* ignore */ }
    const name = sweepName.value.trim();
    const url = p.prefillParam && name
      ? p.url + '?' + p.prefillParam + '=' + encodeURIComponent(name)
      : p.url;
    const tabId = await resolveTargetTabId(state);
    if (!tabId || !chrome.tabs?.update) {
      setSweepStatus('error', 'no current tab to move to this search');
      return;
    }
    try {
      await chrome.tabs.update(tabId, { url, active: true });
    } catch (e) {
      console.error('[VOE Helper sweep] navigate failed:', e);
      setSweepStatus('error', 'could not move the current tab');
      return;
    }
    const last = { ...state, lastProvider: p.key, lastUrl: url, tabId };
    chrome.storage.local.set({ voeSweepState: last }).catch(() => {});
    document.querySelectorAll('.sweep-card').forEach(c =>
      c.dataset.opened = 'false');
    if (cardEl) cardEl.dataset.opened = 'true';
    saveProvider.value = p.key;
    setSweepStatus('idle', 'Opened  ' + p.label + " — if it's a hit, Save below.");
  }

  // ---- save the found provider as THE local route ----
  async function saveRoute(openIssue) {
    const name = sweepName.value.trim();
    const p = providerByKey(saveProvider.value);
    if (!name || !p) {
      setSweepStatus('error', 'need an employer name and a provider (click a card or pick one)');
      return null;
    }
    const code = saveCode.value.trim();
    const state = (await chrome.storage.local.get('voeSweepState')).voeSweepState || {};
    const today = new Date().toISOString().slice(0, 10);
    const url = state.lastUrl || p.url;
    // Community lane: wherever the provider/employer page publishes a place
    // to send manual WVOEs, share it (email / fax / mail address).
    const mail = el('saveMail').value.trim();
    const fax = el('saveFax').value.trim();
    const email = el('saveEmail').value.trim();
    const rec = {
      id: 'usr-' + normKey(name),
      name,
      provider: p.label.split(' — ')[0],
      provider_code: code || '',
      aliases: [],
      portal_url: p.url,
      notes: (code ? ('User-verified during VOE Helper sweep panel; employer code read verbatim on the provider page ' + url + ' (' + today + ').')
                   : ('User-confirmed route during VOE Helper sweep panel (page: ' + url + ', ' + today + '); no employer code observed.')),
      custom: true
    };
    if (mail) rec.wvoe_mail = mail;
    if (fax) rec.wvoe_fax = fax;
    if (email) rec.wvoe_email = email;
    const { customEmployers = [] } = await chrome.storage.local.get('customEmployers');
    const kept = customEmployers.filter(e => normKey(e.name) !== normKey(name));
    kept.push(rec);
    await chrome.storage.local.set({ customEmployers: kept });
    setSweepStatus('ok', 'Saved locally — the matcher routes \u201c' + name + '\u201d to '
      + rec.provider + ' immediately (survives the 24h upstream sync).');
    renderContact('sweepContact', rec);
    if (openIssue) openReportIssue(rec, url, today);
    return rec;
  }

  // ---- "send the WVOE here" line (catalog or locally saved contacts) ----
  function contactLines(rec) {
    const parts = [];
    if (rec.wvoe_email) parts.push('email ' + rec.wvoe_email);
    if (rec.wvoe_fax) parts.push('fax ' + rec.wvoe_fax);
    if (rec.wvoe_mail) parts.push('mail ' + rec.wvoe_mail);
    return parts;
  }
  function renderContact(id, rec) {
    const box = el(id);
    if (!box) return;
    const parts = contactLines(rec);
    if (parts.length) {
      box.hidden = false;
      box.textContent = 'Send manual WVOE to: ' + parts.join('  ·  ');
    } else {
      box.hidden = true;
      box.textContent = '';
    }
  }

  function openReportIssue(rec, url, today) {
    const contacts = contactLines(rec);
    const body = [
      '**Manual sweep match recorded locally via the VOE panel.**',
      '',
      '- Employer name: ' + rec.name,
      '- Provider: ' + rec.provider,
      '- Employer code (verbatim): ' + (rec.provider_code || '_(none observed)_'),
      '- Source (page the panel sent the tab to): ' + url,
      '- Date verified: ' + today,
      ...contacts.length ? [
        '- Where can manual WVOEs be sent (as published): ' + contacts.join('  ·  ') ] : [],
      '',
      'Ground rule #4 applies to the repo catalog: a maintainer should re-read',
      'the cited page before this enters verified_seeds.jsonl. The local record',
      'already routes the user\'s install; this issue exists to merge the row',
      'upstream.',
      '',
      '_(panel-stamped; interpreted by maintainer)_'
    ].join('\n');
    const params = new URLSearchParams();
    params.set('template', 'match-report.md');
    params.set('title', 'Match report: ' + rec.name);
    params.set('body', body);
    chrome.tabs.create(
      { url: 'https://github.com/Spuds0588/VOE-Helper/issues/new?' + params.toString() });
  }

  el('saveRoute').addEventListener('click', () => saveRoute(false));
  el('saveReport').addEventListener('click', () => saveRoute(true));

  // ---- sweep view: surface any known WVOE submission address for the name ----
  async function showSweepContact(name) {
    const key = normKey(name);
    if (!key) { renderContact('sweepContact', {}); return; }
    const { employers = [], customEmployers = [] } =
      await chrome.storage.local.get(['employers', 'customEmployers']);
    const probe = customEmployers.concat(employers);
    const rec = probe.find(e => e && (normKey(e.name) === key ||
      (e.aliases || []).some(a => normKey(a) === key)));
    renderContact('sweepContact', rec || {});
  }
  sweepName.addEventListener('input', () => { showSweepContact(sweepName.value.trim()); });

  // ---- view switching (tabs + SW-stamped panelView) ----
  const viewWvoe = el('view-wvoe');
  const viewSweep = el('view-sweep');
  let voeSweepStateRef = null;
  function applyView(mode) {
    const sweep = mode === 'sweep';
    viewWvoe.hidden = sweep;
    viewSweep.hidden = !sweep;
    // each view owns its sticky action bar; the other's bar must not linger
    el('actionbar-wvoe').hidden = sweep;
    el('tab-wvoe').dataset.active = String(!sweep);
    el('tab-sweep').dataset.active = String(sweep);
  }
  el('tab-wvoe').addEventListener('click', () => {
    applyView('wvoe');
    chrome.storage.local.set({ panelView: 'wvoe' }).catch(() => {});
  });
  el('tab-sweep').addEventListener('click', () => {
    applyView('sweep');
    chrome.storage.local.set({ panelView: 'sweep' }).catch(() => {});
  });
  chrome.storage.local.get(['panelView', 'voeSweepState']).then(({ panelView, voeSweepState } = {}) => {
    voeSweepStateRef = voeSweepState || null;
    if (panelView === 'sweep') {
      applyView('sweep');
      if (voeSweepStateRef?.query && !sweepName.value) {
        sweepName.value = voeSweepStateRef.query;
        showSweepContact(sweepName.value.trim());
      }
    }
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.panelView) return;
    const mode = changes.panelView.newValue;
    if (mode === 'sweep' || mode === 'wvoe') applyView(mode);
    if (mode === 'sweep' && voeSweepStateRef?.query && !sweepName.value) {
      sweepName.value = voeSweepStateRef.query;
      showSweepContact(sweepName.value.trim());
    }
  });
})();
