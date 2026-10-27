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

function voeForm1005Schema(employerFontSize = 8.5) {
  return [[ // page 1
    // Item 1 — To (Name and address of employer). ONE composed box spanning
    // the whole cell (x≈9.5-105.8, y 61.7-79.7): the employer name lines and
    // the contact lines flow together. Two separate boxes used to OVERPRINT
    // whenever the name wrapped past its single line (seen 2026-10-27 with
    // realistic catalog-length names) — a merged box cannot collide with
    // itself. employerFontSize arrives per render from wvoeEmployerFontSize.
    { name: 'employerFull', type: 'text',
      position: { x: 10.5, y: 61.8, width: 94.5, height: 17.9 },
      width: 94.5, height: 17.9, fontSize: employerFontSize, lineHeight: 1.22, content: '' },
    // Item 2 — From (Name and address of lender), right column x≈106.9-206.4.
    { name: 'verifierBlock', type: 'text',
      position: { x: 107.5, y: 61.8, width: 98, height: 17.8 },
      width: 98, height: 17.8, fontSize: 8, lineHeight: 1.3, content: '' },
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

// Item 1's box is exactly the height between the label row and the
// "I certify" band; long value sets need a smaller font to stay inside it.
// Rough Helvetica wrap estimate: avg glyph ≈ 0.56 em.
function wvoeEstimateLines(text, fontSize, widthMm) {
  const charMm = fontSize * 0.3528 * 0.56;
  const perLine = Math.max(8, Math.floor(widthMm / charMm));
  let n = 0;
  for (const raw of String(text).split('\n')) {
    n += Math.max(1, Math.ceil(raw.length / perLine));
  }
  return n;
}
// Largest font whose estimated print height stays within the 17.9 mm cell
// (line step = fontSize · lineHeight 1.22 · 0.3528 mm/pt).
function wvoeEmployerFontSize(name, contact) {
  const text = ((name || '') + '\n' + (contact || ''));
  for (const size of [8.5, 7.5, 6.5]) {
    const lines = wvoeEstimateLines(text, size, 94.5);
    const used = lines * size * 1.22 * 0.3528;
    if (used <= 17.6) return size;
  }
  return 6.5; // pathological: keep readable, never shrink below this
}
// Item 1 prints as ONE composed value ('employerFull'): the required name on
// the first line(s) and the contact/address lines under it. The collected
// field names (employerName, employerContact) stay the panel's input
// vocabulary; this helper composes just before rendering. Copy-safe: returns
// a new object (the caller still reads values.employerName for the guard
// and the download filename).
function wvoeComposeInputs(values) {
  const composed = Object.assign({}, values);
  const parts = [];
  const name = (values.employerName || '').trim();
  if (name) parts.push(name.replace(/\s+/g, ' '));
  const contact = (values.employerContact || '').trim();
  if (contact) parts.push(contact.replace(/[ \t]*\n[ \t]*/g, '\n'));
  if (parts.length) composed.employerFull = parts.join('\n');
  delete composed.employerName;
  delete composed.employerContact;
  return { inputs: composed,
           employerFontSize: wvoeEmployerFontSize(name, contact) };
}
