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

function voeForm1005Schema() {
  return [[ // page 1
    // Item 1 — To (Name and address of employer). Box spans x≈9.5-105.8 mm,
    // fill from under the label line down to the item 3-6 row (y 61.7-80.0).
    { name: 'employerName', type: 'text',
      position: { x: 10.5, y: 61.8, width: 94.5, height: 6 },
      width: 94.5, height: 6, fontSize: 11, content: '' },
    { name: 'employerContact', type: 'text',
      position: { x: 10.5, y: 68.2, width: 94.5, height: 11.6 },
      width: 94.5, height: 11.6, fontSize: 8, lineHeight: 1.3, content: '' },
    // Item 2 — From (Name and address of lender), right column x≈106.9-206.4.
    { name: 'verifierBlock', type: 'text',
      position: { x: 107.5, y: 61.8, width: 98, height: 17.8 },
      width: 98, height: 17.8, fontSize: 8, lineHeight: 1.3, content: '' },
    // Item 5 — Date (right of the "3. Signature of Lender" label).
    { name: 'date', type: 'text',
      position: { x: 145.5, y: 83.2, width: 17, height: 5.5 },
      width: 17, height: 5.5, fontSize: 9, content: '' },
    // Item 6 — Lender's Number (Optional): y sits under the “(Optional)"
    // sub-label (it occupies the first line of the cell).
    { name: 'lenderNumber', type: 'text',
      position: { x: 165.5, y: 86.2, width: 40, height: 5.5 },
      width: 40, height: 5.5, fontSize: 9, content: '' },
    // Item 7 — Name and Address of Applicant (include employee/badge number):
    // left cell of the row under the lender signature block (x≈9.5-127,
    // y 99.5-110.2; item 8's signature cell stays empty for a wet signature).
    { name: 'applicantName', type: 'text',
      position: { x: 10.5, y: 100.3, width: 113, height: 9.5 },
      width: 113, height: 9.5, fontSize: 9, content: '' },
    // Item 10 — Present Position (Part II): courtesy prefill; the employer
    // section is otherwise left for the employer to complete.
    { name: 'employmentTitle', type: 'text',
      position: { x: 84, y: 117, width: 55, height: 6 },
      width: 55, height: 6, fontSize: 9, content: '' }
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
