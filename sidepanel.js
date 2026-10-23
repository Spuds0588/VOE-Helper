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

  const collectValues = () => {
    const values = {};
    for (const f of FIELDS) {
      const v = el(f).value.trim();
      if (v) values[f] = v;
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
      const bytes = await window.pdfmeGenerate({
        template: structuredClone(VOE_WVOE_TEMPLATE),
        inputs: [values]
      });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'voe-wvoe.pdf';
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
})();
