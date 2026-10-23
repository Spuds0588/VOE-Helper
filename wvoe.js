// VOE Helper — WVOE generator (phase 2, milestone M1 spike)
//
// Proves the vendored @pdfme/generator bundle produces a filled PDF from an
// extension page under the MV3 CSP (no eval, no remote fetch — bundle greps
// clean for eval/new Function/WebAssembly; the fallback font is embedded).
// Template + inputs are hardcoded for M1 per PHASE2-WVOE-form.md; field
// mapping from a matched toast row is M2.
(() => {
  // Bundled one-page WVOE template. pdfme v4 schema: coordinates in mm on an
  // A4 blank page. Template `content` strings are the designer defaults; the
  // generate() call supplies the actual field values via `inputs`.
  const VOE_WVOE_TEMPLATE = {
    basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
    schemas: [[
      { name: 'date', type: 'text',
        position: { x: 20, y: 20, width: 60, height: 8 },
        width: 60, height: 8, fontSize: 10, content: '' },
      { name: 'verifierBlock', type: 'text',
        position: { x: 20, y: 34, width: 85, height: 30 },
        width: 85, height: 30, fontSize: 10, content: '' },
      { name: 'employerName', type: 'text',
        position: { x: 20, y: 76, width: 130, height: 10 },
        width: 130, height: 10, fontSize: 14, content: '' },
      { name: 'employerContact', type: 'text',
        position: { x: 20, y: 92, width: 170, height: 16 },
        width: 170, height: 16, fontSize: 10, content: '' },
      { name: 'providerBlock', type: 'text',
        position: { x: 20, y: 120, width: 170, height: 20 },
        width: 170, height: 20, fontSize: 11, content: '' },
      { name: 'employmentTitle', type: 'text',
        position: { x: 110, y: 76, width: 80, height: 10 },
        width: 80, height: 10, fontSize: 10, content: '' }
    ]]
  };

  // M1: hardcoded field values (a catalog-coded row, Walmart 10108) so the
  // spike proves the fill path before any toast wiring exists.
  const VOE_WVOE_INPUTS = [{
    date: 'Date: 2026-10-23',
    verifierBlock: 'Verifier\nSpuds Lending LLC\nAttn: Processing\nLoan #000000',
    employerName: 'Employer: Walmart',
    employerContact: 'Wal-Mart Stores, Inc.\n702 SW 8th St, Bentonville, AR 72716\nPhone: (800) 411-2884',
    providerBlock: 'Electronic VOE provider: The Work Number\nEmployer Code: 10108\n(verify at theworknumber.com — requires employee SSN)',
    employmentTitle: 'Position: Regular PT/FT, Onbook'
  }];

  const status = document.getElementById('status');
  const setStatus = (state, text) => {
    status.dataset.state = state;
    status.textContent = text;
  };

  const generate = document.getElementById('generate');
  generate.addEventListener('click', async () => {
    generate.disabled = true;
    setStatus('busy', 'Generating…');
    try {
      const bytes = await window.pdfmeGenerate({
        template: structuredClone(VOE_WVOE_TEMPLATE),
        inputs: structuredClone(VOE_WVOE_INPUTS)
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
      console.error('[VOE Helper wvoe] generate failed:', err);
      setStatus('error', 'generation failed: ' + (err && err.message ? err.message : String(err)));
    } finally {
      generate.disabled = false;
    }
  });
})();
