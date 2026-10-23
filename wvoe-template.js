// VOE Helper — shared WVOE template (loaded by wvoe.html and sidepanel.html).
//
// pdfme v4 notes established during the M1 spike: coordinates in mm on an A4
// blank page (basePdf.padding is mandatory), each schema needs top-level
// name/width/height plus position, and generate() renders only the
// inputs-keyed values — template `content` is the designer default, not
// auto-rendered text.
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

const WVOE_FIELDS = ['date', 'verifierBlock', 'employerName', 'employerContact',
                     'providerBlock', 'employmentTitle'];
