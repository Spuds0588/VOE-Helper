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
  // Editor-only choices riding beside the printed text fields (both drive
  // the strike-through X and the Item 8 note).
  const readExtras = () => ({
    verificationPart:
      (document.querySelector('input[name="partChoice"]:checked') || {}).value === 'three'
        ? 'three' : 'two',
    borrowerAuthAttached: el('borrowerAuthAttached').checked
  });

  // ---------- draft persistence (debounced) ----------
  let draftTimer = null;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const draft = {};
      for (const f of FIELDS) draft[f] = el(f).value;
      try {
        draft.partChoice = readExtras().verificationPart;
        draft.borrowerAuthAttached = readExtras().borrowerAuthAttached ? 'yes' : '';
      } catch { /* page-context preview */ }
      chrome.storage.local.set({ wvoeDraft: draft }).catch(() => {});
    }, 400);
  };
  for (const f of FIELDS) el(f).addEventListener('input', saveDraft);
  // Editor-only choices persist too (change events, not input).
  for (const r of document.querySelectorAll('input[name="partChoice"]'))
    r.addEventListener('change', saveDraft);
  el('borrowerAuthAttached').addEventListener('change', saveDraft);

  // ---------- restore + prefill ----------
  // Prefill stamps are consumed by BOTH the load path and a storage
  // listener: a second right-click while the panel is ALREADY OPEN used to
  // be ignored here — the running panel kept the previous employer's text
  // (the "text wasn't populating right" report, 2026-10-27). Switching to a
  // DIFFERENT employer also clears the previous employer's contact lines so
  // a stale address/phone can never print on the new employer's form.
  function applyCatalogPrefill(rec) {
    const prevName = el('employerName').value.trim();
    el('employerName').value = rec.name || '';
    const lines = [];
    if (rec.provider) lines.push('Electronic VOE provider: ' + rec.provider);
    if (rec.provider_code) lines.push('Employer Code: ' + rec.provider_code);
    else lines.push('(no published code — fill manually if one is known)');
    if (rec.notes) lines.push('Note: ' + rec.notes.slice(0, 200));
    el('providerBlock').value = lines.join('\n');
    if (rec.name !== prevName) el('employerContact').value = '';
    setStatus('idle', 'Pre-filled from catalog: ' + rec.name);
    renderContact('wvoeContact', rec);
    saveDraft();
  }
  function applyRawName(raw) {
    const prevName = el('employerName').value.trim();
    const name = String(raw).trim();
    if (!name) return;
    el('employerName').value = name;
    if (name !== prevName) el('employerContact').value = '';
    setStatus('idle', 'Employer name carried from your right-click selection');
    saveDraft();
  }
  // One-shot stamp consumer; opts.atLoad keeps the historical load-path
  // semantics (a raw-name stamp only fills a still-empty name field).
  async function consumeStamps({ atLoad = false } = {}) {
    const { wvoePendingPrefill, wvoePendingRawName, employers = [] } =
      await chrome.storage.local.get(
        ['wvoePendingPrefill', 'wvoePendingRawName', 'employers']);
    if (wvoePendingPrefill) {
      const rec = employers.find((e) => e && e.id === wvoePendingPrefill);
      // one-shot either way: a stamp is consumed exactly once
      await chrome.storage.local.remove(
        ['wvoePendingPrefill', 'wvoePendingRawName']).catch(() => {});
      if (rec) applyCatalogPrefill(rec);
      else setStatus('error', 'catalog row gone: ' + wvoePendingPrefill);
      return;
    }
    if (wvoePendingRawName) {
      await chrome.storage.local.remove('wvoePendingRawName').catch(() => {});
      if (!atLoad || !el('employerName').value.trim()) applyRawName(wvoePendingRawName);
    }
  }
  chrome.storage.local.get(['wvoeDraft'])
    .then(({ wvoeDraft } = {}) => {
      // 1. restore whatever the processor had typed before
      if (wvoeDraft && typeof wvoeDraft === 'object') {
        for (const f of FIELDS) {
          if (typeof wvoeDraft[f] === 'string') el(f).value = wvoeDraft[f];
        }
        // Editor-only choices (strike-through part + authorization note)
        if (wvoeDraft.partChoice === 'three') el('partThree').checked = true;
        else el('partTwo').checked = true;
        el('borrowerAuthAttached').checked = wvoeDraft.borrowerAuthAttached === 'yes';
      }
      // 2. pending prefill stamps (service worker on toast click)
      return consumeStamps({ atLoad: true });
    })
    .catch((err) => {
      console.error('[VOE Helper sidepanel] restore failed:', err);
      setStatus('error', 'restore failed reading storage');
    });

  // Default date = today when not yet filled.
  if (!el('date').value) el('date').value = new Date().toISOString().slice(0, 10);

  // ---------- lender profiles (user: setup once, pick forever after) ----------
  // Saved {label, block, default number} trios live in chrome.storage; the
  // dropdown fills the bundled lender block + lender's number fields. Margins
  // per loan stay editable — a loan # typed into the number field is per-form.
  const lenderSelect = el('lenderSelect');
  const lenderEditor = el('lenderEditor');
  let lenderProfiles = [];
  let editingLenderId = null;
  function renderLenderOptions(selectedId) {
    lenderSelect.innerHTML = '';
    const base = document.createElement('option');
    base.value = ''; base.textContent = '— pick a saved lender —';
    lenderSelect.appendChild(base);
    for (const p of lenderProfiles) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      lenderSelect.appendChild(o);
    }
    const n = document.createElement('option');
    n.value = '__new'; n.textContent = '+ New lender…';
    lenderSelect.appendChild(n);
    if (selectedId) lenderSelect.value = selectedId; else lenderSelect.value = '';
  }
  function applyLender(p) {
    if (!p) return;
    if (p.block) el('verifierBlock').value = p.block;
    if (p.number && !el('lenderNumber').value.trim()) el('lenderNumber').value = p.number;
    saveDraft();
  }
  function openLenderEditor(p) {
    editingLenderId = (p && p.id) || null;
    el('lenderLabel').value = (p && p.label) || '';
    el('lenderBlockText').value = (p && p.block) || '';
    el('lenderDefaultNumber').value = (p && p.number) || '';
    el('lenderDelete').hidden = !p;
    lenderEditor.hidden = false;
  }
  lenderSelect.addEventListener('change', () => {
    const v = lenderSelect.value;
    if (v === '__new') { openLenderEditor(null); return; }
    lenderEditor.hidden = true;  // picking hides any half-open editor
    if (v) applyLender(lenderProfiles.find(x => x.id === v));
  });
  el('lenderManage').addEventListener('click', () => {
    openLenderEditor(lenderProfiles.find(x => x.id === lenderSelect.value) || null);
  });
  el('lenderCancel').addEventListener('click', () => { lenderEditor.hidden = true; });
  el('lenderSave').addEventListener('click', async () => {
    const label = el('lenderLabel').value.trim();
    const block = el('lenderBlockText').value.trim();
    if (!label || !block) {
      setStatus('error', 'a lender needs a name and a block (Item 2 “From”)');
      return;
    }
    const rec = {
      id: editingLenderId || ('lnd-' + Date.now()),
      label, block,
      number: el('lenderDefaultNumber').value.trim()
    };
    const i = lenderProfiles.findIndex(x => x.id === rec.id);
    if (i >= 0) lenderProfiles[i] = rec; else lenderProfiles.push(rec);
    try {
      await chrome.storage.local.set({ lenderProfiles, selectedLenderId: rec.id });
    } catch { /* page-context preview: storage unavailable */ }
    renderLenderOptions(rec.id);
    applyLender(rec);
    lenderEditor.hidden = true;
    setStatus('ok', "Lender saved — it's in the menu for every form now");
  });
  el('lenderDelete').addEventListener('click', async () => {
    if (!editingLenderId) return;
    lenderProfiles = lenderProfiles.filter(x => x.id !== editingLenderId);
    try {
      await chrome.storage.local.set({ lenderProfiles, selectedLenderId: null });
    } catch { /* page-context preview */ }
    el('verifierBlock').value = '';
    el('lenderNumber').value = '';
    renderLenderOptions('');
    lenderEditor.hidden = true;
    saveDraft();
    setStatus('idle', 'Lender deleted');
  });
  (async () => {
    // Setup-once restore: the last picked lender re-applies on open.
    let saved = [], selectedId = null;
    try {
      const got = await chrome.storage.local.get(['lenderProfiles', 'selectedLenderId']);
      saved = got.lenderProfiles || [];
      selectedId = got.selectedLenderId || null;
    } catch { /* page-context preview */ }
    lenderProfiles = saved;
    renderLenderOptions(selectedId || '');
    applyLender(saved.find((p) => p.id === selectedId));
  })();

  // ---------- employer address/phone via stacked auto-fill engines ----------
  // Reduce inputs: the pipeline runs keyless Photon last no matter what;
  // Google Places (address + phone, BYOK key) and Geoapify (free tier BYOK,
  // contact data) are tried first when their key is present. A failing
  // engine falls through to the next so the button never dead-ends.
  const gKeyIn = el('googlePlacesKey');
  const geoKeyIn = el('geoapifyKey');
  (async () => {
    try {
      const { googlePlacesKey: gk = '', geoapifyKey: gpk = '' } =
        await chrome.storage.local.get(['googlePlacesKey', 'geoapifyKey']);
      if (gk) gKeyIn.value = gk;
      if (gpk) geoKeyIn.value = gpk;
    } catch { /* page-context preview */ }
  })();
  gKeyIn.addEventListener('input', () => {
    chrome.storage.local.set({ googlePlacesKey: gKeyIn.value.trim() }).catch(() => {});
  });
  geoKeyIn.addEventListener('input', () => {
    chrome.storage.local.set({ geoapifyKey: geoKeyIn.value.trim() }).catch(() => {});
  });
  async function fetchOk(url, opts) {
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ('HTTP ' + r.status);
      throw new Error(msg);
    }
    return data;
  }
  // Engine 1 — Google Places (New): address + national phone, one request.
  async function engineGoogle(name, key) {
    const data = await fetchOk('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // FieldMask governs cost: only the two fields Item 1 needs.
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber'
      },
      body: JSON.stringify({ textQuery: name })
    });
    const p = data && data.places && data.places[0];
    if (!p) throw new Error('no matching place');
    const lines = [];
    if (p.formattedAddress) lines.push(p.formattedAddress);
    if (p.nationalPhoneNumber) lines.push(p.nationalPhoneNumber);
    return { lines, lacksPhone: !p.nationalPhoneNumber, engine: 'Google Places' };
  }
  // Engine 2 — Geoapify (free-forever BYOK): place search then details.
  async function engineGeoapify(name, key) {
    const search = await fetchOk(
      'https://api.geoapify.com/v2/places?categories=commercial&name='
       + encodeURIComponent(name) + '&limit=1&apiKey=' + encodeURIComponent(key));
    const f = search && search.features && search.features[0];
    const pid = f && f.properties && (f.properties.place_id || f.properties.datasource);
    if (!pid) throw new Error('no matching place');
    const det = await fetchOk(
      'https://api.geoapify.com/v2/place-details?id=' + encodeURIComponent(pid)
       + '&apiKey=' + encodeURIComponent(key));
    const pr = (det && det.properties) || {};
    const c = pr.contact || {};
    const lines = [];
    if (pr.formatted_address) lines.push(pr.formatted_address);
    else if (pr.street && pr.housenumber) lines.push(pr.housenumber + ' ' + pr.street);
    const phone = c.phone || pr.phone || (pr.phone_number && pr.phone_number);
    if (phone) lines.push(String(phone));
    return { lines, lacksPhone: !phone, engine: 'Geoapify' };
  }
  // Engine 3 — Photon (keyless OpenStreetMap). Address parts only; phone
  // just when the OSM record tags it — stated in the status, never silent.
  async function enginePhoton(name) {
    const data = await fetchOk(
      'https://photon.komoot.io/api/?q=' + encodeURIComponent(name) + '&limit=1');
    const f = data && data.features && data.features[0];
    const p = (f && f.properties) || {};
    if (!p.name) throw new Error('no matching place');
    const lines = [];
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    if (street) lines.push(street);
    const cityline = [p.postcode, p.city, p.state].filter(Boolean).join(' ');
    if (cityline) lines.push(cityline);
    const phone = (p.phone || (p.extra && p.extra.phone)) && String(p.phone || p.extra.phone);
    if (phone) lines.push(phone);
    return { lines, lacksPhone: !phone, engine: 'Photon (OpenStreetMap)' };
  }
  el('employerLookup').addEventListener('click', async () => {
    const name = el('employerName').value.trim();
    if (!name) {
      setStatus('error', 'type the employer name first, then look it up');
      return el('employerName').focus();
    }
    let { googlePlacesKey: gk = '', geoapifyKey: gpk = '' } = {};
    try {
      ({ googlePlacesKey: gk = '', geoapifyKey: gpk = '' } =
        await chrome.storage.local.get(['googlePlacesKey', 'geoapifyKey']));
    } catch { /* page-context preview */ }
    const engines = [];
    if (gk) engines.push([() => engineGoogle(name, gk), 'Google Places']);
    if (gpk) engines.push([() => engineGeoapify(name, gpk), 'Geoapify']);
    engines.push([() => enginePhoton(name), 'Photon (OpenStreetMap)']);
    const tried = [];
    for (const [run, label] of engines) {
      setStatus('busy', 'Looking up ' + name + ' via ' + label + '…');
      try {
        const { lines, lacksPhone, engine } = await run();
        if (lines.length) {
          el('employerContact').value = lines.join('\n');
          saveDraft();
          setStatus('ok', 'Filled via ' + engine + (lacksPhone
            ? ' — address only; a Google or Geoapify key would pull the phone too'
            : ' — glance-check before printing (Item 1)'));
          return;
        }
        tried.push(label + ': no usable fields');
      } catch (err) {
        console.error('[VOE Helper sidepanel] ' + label + ' lookup failed:', err);
        tried.push(label + ': ' + (err && err.message ? err.message : String(err)));
      }
    }
    setStatus('error', 'no match from ' + tried.join(' · ') + ' — type the address by hand');
  });

  // ---------- community lane: report the confirmed WVOE contact ----------
  // Carries the employer name across to the sweep view's record-and-share
  // flow (route + verbatim submission address in the local library and in
  // the shared issue lane). Manual edits still flow into the draft.
  el('shareContactLink').addEventListener('click', () => {
    const name = el('employerName').value.trim();
    applyView('sweep');
    if (name && !sweepName.value) sweepName.value = name;
    (async () => {
      try {
        const cur = (await chrome.storage.local.get('voeSweepState')).voeSweepState || {};
        await chrome.storage.local.set({
          voeSweepState: { ...cur, query: name || cur.query || '' },
          panelView: 'sweep'
        });
      } catch { /* page-context preview */ }
    })();
  });

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
      const { inputs, sizes } = wvoeComposeInputs(values, readExtras());
      const bytes = await window.pdfmeGenerate({
        template: {
          basePdf,
          schemas: voeForm1005Schema(sizes)
        },
        inputs: [inputs]
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
    draft.partChoice = readExtras().verificationPart;
    draft.borrowerAuthAttached = readExtras().borrowerAuthAttached ? 'yes' : '';
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

  // ---- view switching (tabs + gear + SW-stamped panelView) ----
  const viewWvoe = el('view-wvoe');
  const viewSweep = el('view-sweep');
  const viewSettings = el('view-settings');
  let voeSweepStateRef = null;
  function applyView(mode) {
    const sweep = mode === 'sweep';
    const settings = mode === 'settings';
    viewWvoe.hidden = sweep || settings;
    viewSweep.hidden = !sweep;
    viewSettings.hidden = !settings;
    // each view owns its sticky action bar; other bars must not linger
    el('actionbar-wvoe').hidden = sweep || settings;
    el('tab-wvoe').dataset.active = String(!sweep && !settings);
    el('tab-sweep').dataset.active = String(sweep);
    el('settingsBtn').dataset.active = String(settings);
  }
  el('settingsBtn').addEventListener('click', () => {
    const backOff = el('settingsBtn').dataset.active === 'true';
    applyView(backOff ? 'wvoe' : 'settings');
    chrome.storage.local.set({ panelView: backOff ? 'wvoe' : 'settings' }).catch(() => {});
  });
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
    if (panelView === 'sweep') applyView('sweep');
    if (panelView === 'settings') applyView('settings');
    if (panelView === 'sweep') {
      applyView('sweep');
      if (voeSweepStateRef?.query && !sweepName.value) {
        sweepName.value = voeSweepStateRef.query;
        showSweepContact(sweepName.value.trim());
      }
    }
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      // live relay: a second right-click while the panel is already open
      // must update the form, not leave the previous employer's text
      if ((changes.wvoePendingPrefill && changes.wvoePendingPrefill.newValue)
          || (changes.wvoePendingRawName && changes.wvoePendingRawName.newValue)) {
        consumeStamps().catch((err) => {
          console.error('[VOE Helper sidepanel] live prefill failed:', err);
          setStatus('error', 'live prefill failed reading storage');
        });
      }
      if (changes.panelView) {
        const mode = changes.panelView.newValue;
        if (mode === 'sweep' || mode === 'wvoe' || mode === 'settings') applyView(mode);
        if (mode === 'sweep' && voeSweepStateRef?.query && !sweepName.value) {
          sweepName.value = voeSweepStateRef.query;
          showSweepContact(sweepName.value.trim());
        }
      }
    }
  });
})();
