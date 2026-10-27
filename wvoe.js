// VOE Helper — WVOE generator (phase 2, M2: form + prefill + live preview)
//
// Extension page, two-pane layout: LEFT pane shows a live preview of the
// generated PDF (re-rendered debounced as fields change — no download); the
// RIGHT pane is the editable form. Every field is user-editable; when the
// page is opened with ?employer=<record id> (the toast's "Generate WVOE
// Form" button), employer fields pre-fill from the matched catalog row in
// chrome.storage.local. "Download PDF" saves the final file. Everything runs
// client-side through the vendored @pdfme/generator bundle (MV3-CSP clean:
// no eval, no remote fetch; Roboto fallback font is embedded).
//
// pdfme v4 notes live in wvoe-template.js (shared with sidepanel.js).
(() => {
  const FIELDS = WVOE_FIELDS;
  const el = (id) => document.getElementById(id);
  const status = el('status');
  const setStatus = (state, text) => {
    status.dataset.state = state;
    status.textContent = text;
  };

  // ---------- shared generation core ----------
  // Printed on the official Fannie Mae Form 1005 (bundled asset; see
  // wvoe-template.js for the measured part-I placement).
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

  async function render(values) {
    const basePdf = (await loadForm1005()).slice(0); // fresh copy per render
    return window.pdfmeGenerate({
      template: {
        basePdf,
        schemas: voeForm1005Schema()
      },
      inputs: [values]
    });
  }

  // ---------- live preview (left pane) ----------
  const previewWrap = el('previewWrap');
  const previewPlaceholder = el('previewPlaceholder');
  let previewObjectUrl = null;

  function showPreviewPdf(bytes) {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    previewObjectUrl = URL.createObjectURL(blob);
    const embed = document.createElement('embed');
    embed.className = 'pdf';
    embed.type = 'application/pdf';
    embed.src = previewObjectUrl;
    previewWrap.replaceChildren(embed);
    previewWrap.dataset.previewState = 'ready';
  }

  // Debounced regeneration: 500ms after the last keystroke. Renders skip
  // (silently) while a previous render is still in flight; the trailing
  // run after the in-flight one completes keeps the preview final.
  let renderTimer = null;
  let delegation = 0; // pending-runs counter during in-flight renders

  function schedulePreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(updatePreview, 500);
  }

  async function updatePreview() {
    const values = collectValues();
    if (Object.keys(values).length === 0) return; // keep placeholder
    delegation += 1;
    previewWrap.dataset.previewState = 'busy';
    try {
      const bytes = await render(values);
      if (delegation === 1) showPreviewPdf(bytes);
    } catch (err) {
      console.error('[VOE Helper wvoe] preview render failed:', err);
    } finally {
      delegation -= 1;
      if (delegation === 0) previewWrap.dataset.previewState = 'ready';
    }
  }

  for (const f of FIELDS) {
    el(f).addEventListener('input', schedulePreview);
  }

  // ---------- catalog prefill ----------
  // The toast button opens wvoe.html?employer=<record id>.
  const employerId = new URLSearchParams(location.search).get('employer');
  if (employerId) {
    chrome.storage.local.get('employers').then(({ employers = [] } = {}) => {
      const rec = employers.find((e) => e && e.id === employerId);
      if (!rec) {
        setStatus('error', 'Employer row not found in catalog: ' + employerId);
        return;
      }
      el('employerName').value = rec.name || '';
      const lines = [];
      if (rec.provider) lines.push('Electronic VOE provider: ' + rec.provider);
      if (rec.provider_code) lines.push('Employer Code: ' + rec.provider_code);
      else lines.push('(no published code — fill manually if one is known)');
      if (rec.notes) lines.push('Note: ' + rec.notes.slice(0, 200));
      el('providerBlock').value = lines.join('\n');
      setStatus('idle', 'Pre-filled from catalog: ' + rec.name);
      updatePreview().then(schedulePreview); // immediate first preview
    }).catch((err) => {
      console.error('[VOE Helper wvoe] prefill failed:', err);
      setStatus('error', 'prefill failed reading catalog');
    });
  } else {
    // No direct ?employer= deep link: restore the values the side panel
    // collected (chrome side panel pivot — the processor fills the form next
    // to their LOS tab; this full-page view is the big preview/download).
    chrome.storage.local.get('wvoeDraft').then(({ wvoeDraft } = {}) => {
      if (!wvoeDraft || typeof wvoeDraft !== 'object') return;
      let touched = false;
      for (const f of FIELDS) {
        const v = typeof wvoeDraft[f] === 'string' ? wvoeDraft[f] : '';
        if (v && !el(f).value) { el(f).value = v; touched = true; }
      }
      if (touched) {
        setStatus('idle', 'Restored values collected in the side panel');
        updatePreview().then(schedulePreview);
      }
    }).catch(err => console.error('[VOE Helper wvoe] draft restore failed:', err));
  }

  // Live preview page is also the draft sink: keep chrome.storage in sync so
  // the side panel and this page stay consistent (debounced with input).
  const saveDraft = () => {
    const draft = {};
    for (const f of FIELDS) draft[f] = el(f).value;
    chrome.storage.local.set({ wvoeDraft: draft }).catch(() => {});
  };
  for (const f of FIELDS) el(f).addEventListener('input', () => saveDraft());

  // ---------- Download PDF (right pane action) ----------
  el('generate').addEventListener('click', async () => {
    const btn = el('generate');
    btn.disabled = true;
    setStatus('busy', 'Generating…');
    try {
      // Only non-empty fields render (pdfme renders inputs-keyed values only).
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
      const bytes = await render(values);
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
      console.error('[VOE Helper wvoe] generate failed:', err);
      setStatus('error', 'generation failed: ' + (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
    }
  });

  // Default date = today (ISO) when the field was not pre-filled.
  if (!el('date').value) {
    el('date').value = new Date().toISOString().slice(0, 10);
    schedulePreview();
  }
})();
