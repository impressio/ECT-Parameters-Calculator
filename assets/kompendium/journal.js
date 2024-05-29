/* journal.js - web form for the ECT journal (Psykiatri Affektiva, version 3.0, 2020-06-05).
 * The form is built from FIELDS below; on download the answers are drawn onto the original PDF
 * (kompendium/Blanketter/ECT-journal.pdf) with pdf-lib in the browser, and the filled PDF is saved.
 * Nothing is stored or sent: the inputs have autocomplete off, the data only lives in the page until it is left,
 * and pdf-lib and the template are served by this site (no third-party requests while a journal is made).
 *
 * Positions are PDF points from the top left of the A4 page (595 x 842), read from the original with
 * pdftotext -bbox-layout. box: [x0, y0, x1, y1] of the checkbox glyph's line box; text: start x, baseline y,
 * right edge, and for multi-line fields the baselines of the following lines (they start at x = 24). */
import { datePicker, dateError, todayIso } from './datum.js';

const PDF_LIB = './vendor/pdf-lib.esm.min.js';   // pdf-lib, MIT; version and checksum in vendor/pdf-lib.LICENSE.txt
const TEMPLATE = 'kompendium/Blanketter/ECT-journal.pdf';
const PAGE_HEIGHT = 841.89;
const RIGHT = 578;
const FONT_SIZE = 10;   // all filled-in text, letters and digits alike (pt); text is never shrunk
const HEADER = { inneliggande: [197, 70.1, 210.5, 94.4], poliklinisk: [386.9, 70.1, 400.4, 94.4] };   // on both pages

// Boxes in the left column (x 14.2) and in the right column (x 359.3) share their geometry; only the line differs
const left = y => [14.2, y, 23.1, y + 14.2];
const right = y => [359.3, y, 368.2, y + 14.2];

const FIELDS = [
  { section: 'Behandling', items: [
    { id: 'serie', type: 'radio', label: 'Behandlingsform', options: [
      { value: 'inneliggande', label: 'Inneliggande ECT', header: true },
      { value: 'poliklinisk', label: 'Poliklinisk indexserie', header: true }] },
  ] },
  { section: 'Patient', items: [
    { id: 'personnummer', type: 'pnr', label: 'Personnummer (ÅÅÅÅMMDD-NNNN)', page: 1, x: 112, y: 125.5, right: 232 },
    { id: 'namn', type: 'text', label: 'Namn', page: 1, x: 57, y: 155.5, right: 232 },
    { id: 'avdelning', type: 'text', label: 'Avdelning/klinik', page: 1, x: 344, y: 125.5, right: RIGHT },
    { id: 'lakare', type: 'text', label: 'Ordinerande specialistläkare', page: 1, x: 416, y: 155.5, right: RIGHT },
  ] },
  { section: 'Indikation för ECT enligt ICD-10', items: [
    { id: 'indikation', type: 'checks', page: 1, options: [
      { value: 'F321', label: 'Medelsvår depressiv episod F321', frame: [12, 190.5, 156.5, 205] },   // saknar kryssruta i originalet
      { value: 'F322', label: 'Svår depressiv episod utan psykotiska symptom F322', box: left(207.1) },
      { value: 'F323', label: 'Svår depressiv episod med psykotiska symptom F323', box: left(223.1) },
      { value: 'F331', label: 'Recidiverande depression, medelsvår episod F331', box: left(239.1) },
      { value: 'F332', label: 'Recidiverande depression, svår episod utan psykotiska symptom F332', box: left(255.1) },
      { value: 'F333', label: 'Recidiverande depression, svår episod med psykotiska symptom F333', box: left(271.1) },
      { value: 'F313', label: 'Bipolär sjukdom, lindrig eller medelsvår depressiv episod F313', box: left(287.1) },
      { value: 'F314', label: 'Bipolär sjukdom, svår depressiv episod utan psykotiska symptom F314', box: left(303.1) },
      { value: 'F315', label: 'Bipolär sjukdom, svår depressiv episod med psykotiska symptom F315', box: left(319.1) },
      { value: 'F311', label: 'Bipolär sjukdom, manisk episod utan psykotiska symptom F311', box: left(335.1) },
      { value: 'F312', label: 'Bipolär sjukdom, manisk episod med psykotiska symptom F312', box: left(351.1) },
      { value: 'F259', label: 'Schizoaffektivt syndrom F259', box: left(367.1) },
      { value: 'F209', label: 'Schizofreni F209', box: left(383.1) },
      { value: 'F530', label: 'Postpartum depression F530', box: left(399.1) },
      { value: 'F531', label: 'Postpartum psykos F531', box: left(415.1) },
      { value: 'F063', label: 'Organiskt förstämningssyndrom F063', box: left(431.1) },
      { value: 'F061', label: 'Organisk katatoni F061', box: left(447.1) },
      { value: 'G210', label: 'Malignt neuroleptikasyndrom G210', box: left(463.1) },
      { value: 'G209', label: 'Parkinsons sjukdom G209', box: left(479.1) },
      { value: 'annan', label: 'Annan indikation', box: left(495.1) }] },
    { id: 'annan_indikation', type: 'text', label: 'Annan indikation, vilken', page: 1, x: 105, y: 506.5, right: 350 },
  ] },
  { section: 'Sjukdomsgrad enligt CGI', items: [
    { id: 'cgi', type: 'radio', page: 1, options: [
      { value: '1', label: 'Lindrigt sjuk', box: right(190.1) },
      { value: '2', label: 'Måttligt sjuk', box: right(205.1) },
      { value: '3', label: 'Påtagligt sjuk', box: right(220.1) },
      { value: '4', label: 'Allvarligt sjuk', box: right(235.1) },
      { value: '5', label: 'Bland de mest extremt sjuka patienterna', box: right(250.1) }] },
  ] },
  { section: 'Suicidförsök', items: [
    { id: 'suicid', type: 'radio', label: 'Har patienten någonsin gjort något suicidförsök?', page: 1, options: [
      { value: 'nej', label: 'Nej', box: right(304.1) },
      { value: '1-2', label: '1-2 gånger', box: right(319.1) },
      { value: '3+', label: '3 gånger eller fler', box: right(334.1) },
      { value: 'saknas', label: 'Uppgift saknas, otillräcklig information', box: right(349.1) }] },
    { id: 'suicid12', type: 'radio', label: 'Om 1-2 eller 3 gånger eller fler: suicidförsök de senaste 12 månaderna?', page: 1, options: [
      { value: 'nej', label: 'Nej', box: right(410.1) },
      { value: '1-2', label: '1-2 gånger', box: right(425.1) },
      { value: '3+', label: '3 gånger eller fler', box: right(440.1) },
      { value: 'saknas', label: 'Uppgift saknas, otillräcklig information', box: right(455.1) }] },
  ] },
  { section: 'Vårdform och tidigare ECT', items: [
    { id: 'vardform', type: 'radio', label: 'Vårdform inför första ECT-behandling', page: 1, options: [
      { value: 'HSL', label: 'HSL', box: [229.6, 526.7, 238.9, 541.6] },
      { value: 'LPT', label: 'LPT', box: [279.2, 526.7, 288.5, 541.6] },
      { value: 'LRV', label: 'LRV', box: [328.8, 526.7, 338.1, 541.6] }] },
    { id: 'tidigare_ect', type: 'radio', label: 'Har patienten genomgått tidigare ECT-behandling?', page: 1, options: [
      { value: 'saknas', label: 'Uppgift saknas', box: [294.8, 546.4, 304.1, 561.3] },
      { value: 'nej', label: 'Nej', box: [396.1, 546.4, 405.4, 561.3] },
      { value: 'ja', label: 'Ja', box: [439.5, 546.4, 448.8, 561.3] }] },
    { id: 'senast_ar', type: 'year', label: 'Om ja, senast år', page: 1, x: 511, y: 558.5, right: RIGHT, size: 'short' },
    { id: 'att_beakta', type: 'text', label: 'Att beakta vid tidigare ECT-behandling/anmärkningsvärd iakttagelse då', page: 1, x: 352, y: 578.5, right: RIGHT },
  ] },
  { section: 'Läkemedel', items: [
    { id: 'antiepileptikum', type: 'radio', label: 'Aktuell eller nyligen avslutad behandling med antiepileptikum', page: 1, options: [
      { value: 'nej', label: 'Nej', box: [454.7, 585.6, 464.0, 600.4] },
      { value: 'ja', label: 'Ja', box: [497.5, 585.6, 506.8, 600.4] }] },
    { id: 'bensodiazepin', type: 'radio', label: 'Aktuell eller nyligen avslutad behandling med bensodiazepin', page: 1, options: [
      { value: 'nej', label: 'Nej', box: [454.7, 607.5, 464.0, 622.4] },
      { value: 'ja', label: 'Ja', box: [497.5, 607.5, 506.8, 622.4] }] },
  ] },
  { section: 'Självskattningar före första ECT-behandlingen', items: [
    { id: 'cprs', type: 'radio', label: 'CPRS-minnes-självskattning', page: 1, options: [
      { value: 'kan_inte', label: 'Patienten klarar inte av att genomföra självskattning och/eller saknar sjukdomsinsikt', box: left(651.7) },
      { value: 'ja', label: 'Ja, se anteckning dokumenterad i Melior', box: left(667.7) }] },
    { id: 'madrs', type: 'radio', label: 'MADRS-S', page: 1, options: [
      { value: 'kan_inte', label: 'Patienten klarar inte av att genomföra självskattning och/eller saknar sjukdomsinsikt', box: left(713.5) },
      { value: 'ja', label: 'Ja, svar på delfrågor och totalpoäng finns dokumenterade i Melior', box: left(729.5) }] },
    { id: 'eq5d', type: 'radio', label: 'EQ-5D', page: 1, options: [
      { value: 'kan_inte', label: 'Patienten klarar inte av att genomföra självskattning och/eller saknar sjukdomsinsikt', box: left(774.1) },
      { value: 'ja', label: 'Ja, svar på delfrågor och totalpoäng finns dokumenterade i Melior', box: left(790.1) }] },
  ] },
  { section: 'Somatisk anamnes (sida 2)', items: [
    { id: 'tidigare_somatiska', type: 'area', label: 'Tidigare somatiska sjukdomar', page: 2, x: 203, y: 181.5, right: RIGHT, more: [194, 205.5] },
    { id: 'aktuella_somatiska', type: 'area', label: 'Aktuella somatiska tillstånd', page: 2, x: 191, y: 223.5, right: RIGHT, more: [236, 247.5] },
    { id: 'allergi', type: 'radio', label: 'Känd allergi, överkänslighet', page: 2, options: [
      { value: 'nej', label: 'Nej', box: [205.1, 253.9, 214.4, 268.7] },
      { value: 'ja', label: 'Ja', box: [247.9, 253.9, 257.2, 268.7] }] },
    { id: 'allergi_mot', type: 'text', label: 'Om ja, allergi mot', page: 2, x: 297, y: 265.5, right: RIGHT },
    { id: 'blodsmitta', type: 'radio', label: 'Känd blodsmitta', page: 2, options: [
      { value: 'nej', label: 'Nej', box: [205.1, 296.1, 214.4, 311.0] },
      { value: 'ja', label: 'Ja', box: [247.9, 296.1, 257.2, 311.0] }] },
    { id: 'anestesi', type: 'radio', label: 'Tidigare anestesi', page: 2, options: [
      { value: 'nej', label: 'Nej', box: [205.1, 338.1, 214.4, 352.9] },
      { value: 'oklart', label: 'Oklart', box: [249.4, 338.1, 258.8, 352.9] },
      { value: 'ja', label: 'Ja', box: [318.8, 338.1, 328.1, 352.9] }] },
    { id: 'anestesi_anm', type: 'text', label: 'Tidigare anestesi, eventuell anmärkning', page: 2, x: 452, y: 349.5, right: RIGHT },
  ] },
  { section: 'Allmäntillstånd och somatiskt status (sida 2)', items: [
    { id: 'ekg', type: 'radio', label: 'Aktuellt EKG', page: 2, options: [
      { value: 'nej', label: 'Nej', box: [108.4, 408.4, 117.7, 423.2] },
      { value: 'ja', label: 'Ja', box: [151.2, 408.4, 160.5, 423.2] }] },
    { id: 'ekg_anm', type: 'text', label: 'EKG, eventuell anmärkning', page: 2, x: 335, y: 419.5, right: RIGHT },
    { id: 'hjarta', type: 'area', label: 'Status hjärta inklusive blodtryck/puls', page: 2, x: 248, y: 461.5, right: RIGHT, more: [474, 485.5] },
    { id: 'lungor', type: 'area', label: 'Status lungor', page: 2, x: 103, y: 503.5, right: RIGHT, more: [516, 527.5] },
    { id: 'neurolog', type: 'area', label: 'Neurologstatus', page: 2, x: 114, y: 545.5, right: RIGHT, more: [558, 569.5] },
    { id: 'tand', type: 'area', label: 'Tandstatus', page: 2, x: 86, y: 587.5, right: RIGHT, more: [599] },
  ] },
  { section: 'Värden och provsvar (sida 2)', items: [
    { id: 'vikt', type: 'number', row: 'prov', label: 'Vikt (kg)', page: 2, center: 157.3, y: 641, size: 'short' },
    { id: 'bmi', type: 'number', row: 'prov', label: 'BMI', page: 2, center: 210.9, y: 641, size: 'short' },
    { id: 'na', type: 'number', row: 'prov', label: 'Na', page: 2, center: 264.5, y: 641, size: 'short' },
    { id: 'k', type: 'number', row: 'prov', label: 'K', page: 2, center: 318.1, y: 641, size: 'short' },
    { id: 'ca', type: 'number', row: 'prov', label: 'Ca', page: 2, center: 371.7, y: 641, size: 'short' },
    { id: 'krea', type: 'number', row: 'prov', label: 'Krea', page: 2, center: 425.3, y: 641, size: 'short' },
    { id: 'hb', type: 'number', row: 'prov', label: 'Hb', page: 2, center: 478.9, y: 641, size: 'short' },
    { id: 'glukos', type: 'number', row: 'prov', label: 'P/B-glukos', page: 2, center: 543.2, y: 641, size: 'short' },
    { id: 'provdatum', type: 'date', label: 'Datum för provtagning', page: 2, x: 14.2, y: 658 },
  ] },
  { section: 'Synpunkter (sida 2)', items: [
    { id: 'konsult', type: 'area', label: 'Konsulterad internmedicinares/anestesiologs synpunkter', page: 2, x: 373, y: 677.5, right: RIGHT, more: [690, 702, 714] },
    { id: 'ovriga', type: 'area', label: 'Övriga synpunkter', page: 2, x: 135, y: 733.5, right: RIGHT, more: [746, 758, 770] },
    { id: 'underskrift_datum', type: 'date', label: 'Datum för underskrift', page: 2, x: 368, y: 789.5, today: true },
    { id: 'lakare_namn', type: 'text', label: 'Undersökande läkares namn', page: 2, x: 430, y: 789.5, right: RIGHT },
  ] },
];

// ───────── Personnummer ─────────
// Swedish personal identity number with 12 digits: ÅÅÅÅMMDD-NNNN. The date must exist (for a coordination number
// the day is increased by 60) and the last digit is the Luhn check digit over the 10 digits ÅÅMMDDNNN.
const formatPnr = value => {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
};
function pnrError(value) {
  if (!value) return '';
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{4})$/.exec(value);
  if (!match) return 'Ange personnumret med 12 siffror och bindestreck: ÅÅÅÅMMDD-NNNN.';
  const [, year, month, dayText, last] = match;
  const day = Number(dayText) > 60 ? Number(dayText) - 60 : Number(dayText);
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, day));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== day)
    return 'Personnumrets datum finns inte.';
  if (date > new Date() || Number(year) < 1880) return 'Personnumrets födelseår är inte rimligt.';
  const ten = (year.slice(2) + month + dayText + last).split('').map(Number);
  const sum = ten.slice(0, 9).reduce((total, digit, i) => { const v = digit * (i % 2 ? 1 : 2); return total + (v > 9 ? v - 9 : v); }, 0);
  if ((10 - (sum % 10)) % 10 !== ten[9]) return 'Personnumrets kontrollsiffra stämmer inte.';
  return '';
}

// ───────── Form ─────────
const element = (tag, props = {}, ...children) => { const el = Object.assign(document.createElement(tag), props); el.append(...children); return el; };

function buildForm() {
  const form = element('form', { className: 'journal-form', autocomplete: 'off', noValidate: true });
  for (const group of FIELDS) {
    const fieldset = element('fieldset', {}, element('legend', { textContent: group.section }));
    for (const item of group.items) {
      const name = `journal-${item.id}`;
      if (item.type === 'radio' || item.type === 'checks') {
        const box = element('div', { className: 'journal-options', role: item.type === 'radio' ? 'radiogroup' : 'group' });
        if (item.label) { const label = element('p', { className: 'journal-question', id: `${name}-label`, textContent: item.label }); fieldset.append(label); box.setAttribute('aria-labelledby', label.id); }
        for (const option of item.options) {
          const input = element('input', { type: item.type === 'radio' ? 'radio' : 'checkbox', name, value: option.value });
          box.append(element('label', {}, input, ` ${option.label}`));
        }
        fieldset.append(box);
      } else {
        const input = item.type === 'area' ? element('textarea', { rows: 2 }) : element('input', { type: 'text' });
        Object.assign(input, { id: name, name, autocomplete: 'off', spellcheck: item.type === 'area' });
        if (item.size === 'short') input.className = 'journal-short';
        if (item.today) input.value = todayIso();
        const field = element('div', { className: 'journal-field' }, element('label', { htmlFor: name, textContent: item.label }), input);
        if (item.type === 'date') { datePicker(input, { label: item.label.toLowerCase() }); input.dataset.date = ''; }
        if (item.type === 'pnr') {
          // Digits only; the hyphen is inserted after the date. The check runs when the field is left and before the PDF is made.
          Object.assign(input, { inputMode: 'numeric', maxLength: 13, placeholder: 'ÅÅÅÅMMDD-NNNN', className: 'journal-pnr' });
          const message = element('span', { className: 'journal-error', id: `${name}-fel`, role: 'alert' });
          input.setAttribute('aria-describedby', message.id);
          const check = () => { const error = pnrError(input.value); input.setCustomValidity(error); message.textContent = error; input.setAttribute('aria-invalid', String(!!error)); return !error; };
          input.addEventListener('input', () => { input.value = formatPnr(input.value); if (input.getAttribute('aria-invalid') === 'true') check(); });
          input.addEventListener('blur', check);
          input.check = check;
          field.append(message);
        }
        if (item.type === 'number') {
          // Lab values: digits and one decimal comma (a point becomes a comma), at most 7 characters
          Object.assign(input, { inputMode: 'decimal', maxLength: 7, placeholder: '0,0' });
          input.addEventListener('input', () => {
            const [whole, ...rest] = input.value.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
            input.value = rest.length ? `${whole},${rest.join('')}` : whole;
          });
        }
        if (item.type === 'year') {
          Object.assign(input, { inputMode: 'numeric', maxLength: 4, placeholder: 'ÅÅÅÅ', pattern: '(19[3-9]\\d|20\\d\\d)' });
          input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); });
        }
        // Fields with the same row (the lab values) stand side by side, as in the journal's table
        if (item.row) {
          let row = fieldset.lastElementChild;
          if (!row?.classList.contains('journal-row')) { row = element('div', { className: 'journal-row' }); fieldset.append(row); }
          row.append(field);
        } else fieldset.append(field);
      }
    }
    form.append(fieldset);
  }
  const status = element('p', { className: 'blankett-status', role: 'status' });
  form.append(element('div', { className: 'journal-actions' },
    element('p', { className: 'journal-privacy', textContent: 'Uppgifterna lämnar inte den här datorn. PDF:en skapas här i webbläsaren, utan att något skickas över internet eller nätverket, och sparas där webbläsaren sparar nedladdade filer.' }),
    element('button', { type: 'submit', textContent: 'Skapa ifylld ECT-journal (PDF)' }),
    element('button', { type: 'reset', className: 'journal-reset', textContent: 'Töm formuläret' }), status));
  return { form, status };
}

const valuesOf = form => {
  const data = new FormData(form), values = {};
  for (const [key, value] of data) {
    const id = key.slice('journal-'.length);
    values[id] = id in values ? [].concat(values[id], value) : value;
  }
  return values;
};

// ───────── PDF ─────────
// WinAnsi (the standard Helvetica) lacks some characters; replace the common ones so drawing never fails
const winAnsi = text => text.replace(/[‐‑‒–—−]/g, '-').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€‘’“”•…]/g, '?');

function mark(page, [x0, y0, x1, y1], rgb) {
  // Cross in the checkbox glyph: the glyph is about 7 pt wide, centered in the line box's left part
  const cx = x0 + 3.9, cy = PAGE_HEIGHT - (y0 + (y1 - y0) * 0.57), r = 2.9;
  const line = { thickness: 1.2, color: rgb(0, 0, 0) };
  page.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, ...line });
  page.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, ...line });
}
function headerMark(page, [x0, y0, x1, y1], rgb) {
  const cx = (x0 + x1) / 2 - 0.6, cy = PAGE_HEIGHT - (y0 + (y1 - y0) * 0.55), r = 5;
  const line = { thickness: 1.6, color: rgb(0, 0, 0) };
  page.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, ...line });
  page.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, ...line });
}

// Splits text into lines of the given widths; returns the lines and whether everything fitted
function wrap(text, font, size, widths) {
  const lines = []; let rest = text.replace(/\s+/g, ' ').trim();
  for (const width of widths) {
    if (!rest) break;
    if (font.widthOfTextAtSize(rest, size) <= width) { lines.push(rest); rest = ''; break; }
    let cut = rest.length;
    while (cut > 0 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut = rest.lastIndexOf(' ', cut - 1);
    if (cut <= 0) { cut = 1; while (font.widthOfTextAtSize(rest.slice(0, cut + 1), size) <= width) cut++; }
    lines.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  return { lines, fits: !rest };
}

function drawText(page, item, value, font, rgb) {
  const text = winAnsi(value);
  const color = rgb(0, 0, 0.45);
  const size = FONT_SIZE;
  if (item.center) {
    page?.drawText(text, { x: item.center - font.widthOfTextAtSize(text, size) / 2, y: PAGE_HEIGHT - item.y, size, font, color });
    return font.widthOfTextAtSize(text, size) <= 50;
  }
  const right = item.right || RIGHT;
  const rows = [{ x: item.x, y: item.y, width: right - item.x }, ...(item.more || []).map(y => ({ x: 24, y, width: right - 24 }))];
  const { lines, fits } = wrap(text, font, size, rows.map(row => row.width));
  if (fits) lines.forEach((line, i) => page?.drawText(line, { x: rows[i].x, y: PAGE_HEIGHT - rows[i].y, size, font, color }));
  return fits;
}

// pdf-lib and the template are loaded when the form is shown, before anything is filled in, so no request is
// made after patient data has been entered (a failed load is retried on download)
let resources;
function preload(base) {
  resources ||= Promise.all([
    import(PDF_LIB),
    fetch(new URL(TEMPLATE, base)).then(response => { if (!response.ok) throw new Error('Journalmallen kunde inte laddas.'); return response.arrayBuffer(); }),
  ]).catch(error => { resources = undefined; throw error; });
  return resources;
}

async function createPdf(values, base) {
  const [{ PDFDocument, StandardFonts, rgb }, template] = await preload(base);
  const pdf = await PDFDocument.load(template.slice(0));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  // Every text must fit at FONT_SIZE; otherwise no PDF is made and the form names the fields to shorten
  const overflow = [];
  for (const group of FIELDS) for (const item of group.items) {
    if (['radio', 'checks'].includes(item.type) || !values[item.id]) continue;
    if (!drawText(null, item, String(values[item.id]), font, rgb)) overflow.push(item);
  }
  const patientRow = { id: 'namn', label: 'Namn (patientraden på sida 2)', x: 233, y: 125.5, right: RIGHT };
  const patient = [values.personnummer, values.namn].filter(Boolean).join(', ');
  if (patient && !drawText(null, patientRow, patient, font, rgb)) overflow.push(patientRow);
  if (overflow.length) return { overflow };
  for (const group of FIELDS) for (const item of group.items) {
    const value = values[item.id];
    if (!value || (Array.isArray(value) && !value.length)) continue;
    if (item.type === 'radio' || item.type === 'checks') {
      for (const option of item.options.filter(option => [].concat(value).includes(option.value))) {
        if (option.header) pages.forEach(page => headerMark(page, HEADER[option.value], rgb));
        else if (option.frame) {
          const [x0, y0, x1, y1] = option.frame;
          pages[item.page - 1].drawRectangle({ x: x0, y: PAGE_HEIGHT - y1, width: x1 - x0, height: y1 - y0, borderWidth: 1.2, borderColor: rgb(0, 0, 0) });
        } else mark(pages[item.page - 1], option.box, rgb);
      }
    } else drawText(pages[item.page - 1], item, String(value), font, rgb);
  }
  // Page 2 repeats the patient: personal identity number and name
  if (patient) drawText(pages[1], patientRow, patient, font, rgb);
  pdf.setTitle('ECT-journal'); pdf.setAuthor(''); pdf.setCreator(''); pdf.setProducer(''); pdf.setSubject(''); pdf.setKeywords([]);
  return { bytes: await pdf.save(), overflow: [] };
}

export function enhanceJournal(slot, base) {
  preload(base).catch(() => {});
  const { form, status } = buildForm();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    const pnr = form.querySelector('.journal-pnr');
    if (pnr && !pnr.check()) { status.textContent = 'Kontrollera personnumret.'; pnr.focus(); return; }
    const year = form.querySelector('input[name="journal-senast_ar"]');
    if (year && year.value && (!/^\d{4}$/.test(year.value) || year.value < 1938 || year.value > new Date().getFullYear())) {
      status.textContent = 'Ange senaste år för tidigare ECT med fyra siffror (1938 eller senare).'; year.focus(); return;
    }
    const badDate = [...form.querySelectorAll('input[data-date]')].find(input => dateError(input.value));
    if (badDate) { status.textContent = dateError(badDate.value); badDate.focus(); return; }
    button.disabled = true; status.textContent = 'Skapar PDF…';
    try {
      const { bytes, overflow } = await createPdf(valuesOf(form), base);
      if (overflow.length) {
        status.textContent = `Texten får inte plats på blanketten i: ${overflow.map(item => item.label).join(', ')}. Korta texten; ingen PDF har skapats.`;
        form.querySelector(`#journal-${overflow[0].id}`)?.focus();
        return;
      }
      const link = element('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: 'ECT-journal.pdf' });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      status.textContent = 'ECT-journal.pdf har skapats.';
    } catch (error) { status.textContent = `${error.message || 'PDF:en kunde inte skapas.'} Försök igen.`; console.error('ECT-journal:', error); }
    finally { button.disabled = false; }
  });
  form.addEventListener('reset', () => {
    status.textContent = '';
    setTimeout(() => {   // after the browser has emptied the fields: today's date again and no old error
      for (const group of FIELDS) for (const item of group.items) if (item.today) form.querySelector(`#journal-${item.id}`).value = todayIso();
      const pnr = form.querySelector('.journal-pnr'); pnr.setCustomValidity(''); pnr.removeAttribute('aria-invalid');
      form.querySelector('.journal-error').textContent = '';
    });
  });
  slot.replaceChildren(form);
}
