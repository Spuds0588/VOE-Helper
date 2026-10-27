// VOE Helper — shared WVOE template + field registry (loaded by wvoe.html and
// sidepanel.html).
//
// Since 2026-10-23 the generator prints onto the OFFICIAL Fannie Mae
// "Request for Verification of Employment" (Form 1005) bundled at
// assets/fannie-mae-form-1005.pdf — fetched as a Uint8Array at render time and
// passed as template.basePdf (pdfme v4 custom-PDF mode). pdfme notes from the
// M1 spike still apply: coordinates in mm from the page's TOP-left, generate()
// renders only the inputs-keyed values.
//
// Field placement was measured on the bundled form with `pdftotext -bbox`
// (poppler points ÷ 2.834645 = mm; the form is US Letter, 215.9 mm wide):
// the overlays cover only Part I (the lender's REQUEST section, items 1-2,
// 5-7) plus a courtesy prefill of item 10 "Present Position". Everything the
// employer must answer (Part II/III/IV) is left blank on purpose.
const VOE_FORM1005_ASSET = 'assets/fannie-mae-form-1005.pdf';

function voeForm1005Schema(sizes = {}) {
  // Auto-shrink: each multiline region takes the largest size whose
  // estimated print height fits its fixed cell (helpers below).
  const sz = {
    employerFull: sizes.employerFull || 8.5,
    verifierBlock: sizes.verifierBlock || 8.5,
    applicantName: sizes.applicantName || 8,
    employmentTitle: sizes.employmentTitle || 8
  };
  return [[ // page 1
    // Item 1 — To (Name and address of employer). ONE composed box spanning
    // the whole cell (x≈9.5-105.8, y 61.7-79.7): the employer name lines and
    // the contact lines flow together. Two separate boxes used to OVERPRINT
    // whenever the name wrapped past its single line (seen 2026-10-27 with
    // realistic catalog-length names) — a merged box cannot collide with
    // itself. employerFontSize arrives per render from wvoeEmployerFontSize.
    { name: 'employerFull', type: 'text',
      position: { x: 10.5, y: 61.8, width: 94.5, height: 17.9 },
      width: 94.5, height: 17.9, fontSize: sz.employerFull, lineHeight: 1.22, content: '' },
    // Part II / Part III strike-through convention: the part the employer
    // is NOT to fill gets a bold X on its header row (industry standard).
    // Default Part II is enforced in the editors, so markPartThree prints
    // by default and markPartTwo prints only when Part III is chosen.
    { name: 'markPartTwo', type: 'text',
      position: { x: 9.6, y: 109.8, width: 14, height: 7 },
      width: 14, height: 7, fontSize: 11, content: '' },
    { name: 'markPartThree', type: 'text',
      position: { x: 9.6, y: 211.2, width: 14, height: 7 },
      width: 14, height: 7, fontSize: 11, content: '' },
    // Item 8 — Signature of Applicant cell (x≈127-206, y 99.5-110). When
    // the loan is verified through the bundled borrower authorization
    // instead of a wet signature on each VOE, print the note here.
    { name: 'applicantAuthNote', type: 'text',
      position: { x: 130, y: 103.5, width: 73, height: 5.5 },
      width: 73, height: 5.5, fontSize: 8, content: '' },
    { name: 'verifierBlock', type: 'text',
      position: { x: 107.5, y: 61.8, width: 98, height: 17.8 },
      width: 98, height: 17.8, fontSize: sz.verifierBlock, lineHeight: 1.3, content: '' },
    // Item 5 — Date (right of the "3. Signature of Lender" label).
    { name: 'date', type: 'text',
      position: { x: 145.5, y: 83.2, width: 17, height: 5.5 },
      width: 17, height: 5.5, fontSize: 9, content: '' },
    // Item 6 — Lender's Number (Optional): y sits under the “(Optional)"
    // sub-label (it occupies the first line of the cell). 7.5pt keeps a
    // normal “Loan #nnnnnn” on one line — at 9pt it wrapped into the band
    // below (2026-10-27 render).
    { name: 'lenderNumber', type: 'text',
      position: { x: 165.5, y: 86.2, width: 40, height: 5.5 },
      width: 40, height: 5.5, fontSize: 7.5, content: '' },
    // Item 7 — Name and Address of Applicant (include employee/badge number):
    // left cell of the row under the lender signature block (x≈9.5-127,
    // y 99.5-110.2; item 8's signature cell stays empty for a wet signature).
    // 8pt wraps two lines inside the cell; 9pt clipped the second line.
    { name: 'applicantName', type: 'text',
      position: { x: 10.5, y: 100.3, width: 113, height: 9.5 },
      width: 113, height: 9.5, fontSize: 8, lineHeight: 1.3, content: '' },
    // Item 10 — Present Position (Part II): courtesy prefill; the employer
    // section is otherwise left for the employer to complete. Width to the
    // item 11 boundary; 8pt keeps two-line titles inside the 6mm row.
    { name: 'employmentTitle', type: 'text',
      position: { x: 84, y: 117, width: 61, height: 6 },
      width: 61, height: 6, fontSize: 8, lineHeight: 1.3, content: '' }
  ], [ // page 2 — previous-employment + authorized-signature sections only;
       // deliberately no overlays.
  ]];
}

// Fields collected in the panel / full-page editor (also drives draft storage
// and restore). providerBlock is reference-only: Form 1005 has no slot for
// electronic-provider info, so it is collected and stored but never printed.
const WVOE_FIELDS = ['date', 'verifierBlock', 'lenderNumber', 'employerName',
                     'employerContact', 'applicantName', 'employmentTitle',
                     'providerBlock'];

// Only these land on the printed Form 1005.
const WVOE_PRINTED_FIELDS = ['employerName', 'employerContact', 'verifierBlock',
                             'date', 'lenderNumber', 'applicantName',
                             'employmentTitle'];

// Generic auto-shrink: largest font whose estimated print height (Helvetica
// wrap estimate, avg glyph ≈ 0.56 em, line step = fontSize · lineHeight ·
// 0.3528 mm/pt) fits the fixed cell. Generous estimate over-measures on
// purpose — an extra margin beats bleeding onto the neighboring row.
function wvoeEstimateLines(text, fontSize, widthMm) {
  const charMm = fontSize * 0.3528 * 0.56;
  const perLine = Math.max(8, Math.floor(widthMm / charMm));
  let n = 0;
  for (const raw of String(text).split('\n')) {
    n += Math.max(1, Math.ceil(raw.length / perLine));
  }
  return n;
}
function wvoeFitFontSize(text, widthMm, heightMm, lineHeight, sizes) {
  for (const size of sizes) {
    const lines = wvoeEstimateLines(text, size, widthMm);
    const used = lines * size * lineHeight * 0.3528;
    if (used <= heightMm - 0.5) return size;
  }
  return sizes[sizes.length - 1]; // floor: keep readable, no smaller step
}
// Item 1 prints as ONE composed value ('employerFull'): the required name on
// the first line(s) and the contact/address lines under it. The collected
// field names (employerName, employerContact) stay the panel's input
// vocabulary; this helper composes just before rendering. Copy-safe: returns
// a new object (the caller still reads values.employerName for the guard
// and the download filename). extras carries the editor-only choices:
// verificationPart ('two' default | 'three') drives the strike-through X,
// borrowerAuthAttached prints the Item 8 authorization note.
function wvoeComposeInputs(values, extras) {
  const composed = Object.assign({}, values);
  const parts = [];
  const name = (values.employerName || '').trim();
  if (name) parts.push(name.replace(/\s+/g, ' '));
  const contact = (values.employerContact || '').trim();
  if (contact) parts.push(contact.replace(/[ \t]*\n[ \t]*/g, '\n'));
  if (parts.length) composed.employerFull = parts.join('\n');
  delete composed.employerName;
  delete composed.employerContact;
  const ext = extras || {};
  // Strike-through X: the NON-selected part's header gets marked. The
  // editors enforce a default of Part II, so an absent choice still marks
  // Part III (never leave both fillable).
  const part = (ext.verificationPart === 'three') ? 'three' : 'two';
  composed[part === 'two' ? 'markPartThree' : 'markPartTwo'] = 'X';
  if (ext.borrowerAuthAttached) {
    composed.applicantAuthNote = 'Borrower authorization is attached.';
  }
  return {
    inputs: composed,
    sizes: {
      employerFull: wvoeFitFontSize(name + '\n' + contact, 94.5, 17.9, 1.22, [8.5, 7.5, 6.5]),
      verifierBlock: wvoeFitFontSize(values.verifierBlock || '', 98, 17.8, 1.3, [10, 8.5, 7.5, 6.5]),
      applicantName: wvoeFitFontSize(values.applicantName || '', 113, 9.5, 1.3, [9, 8, 7]),
      employmentTitle: wvoeFitFontSize(values.employmentTitle || '', 61, 6, 1.3, [9, 8, 7])
    }
  };
}
