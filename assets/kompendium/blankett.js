/* blankett.js - forms in the compendium that download a Word template with the chosen date filled in.
 * A chapter places an empty <div class="blankett-ect-lista"></div>; this module turns it into a date field and a
 * download button. The template's date content control (tag "ect-datum", see tools/blankett.py) gets the date as
 * its value and text, so Word shows the date and can still change it in its calendar. Everything happens in the
 * browser: the template is unzipped, document.xml is edited and the file is zipped again. */
import { datePicker, dateError, todayIso } from './datum.js';

const TEMPLATES = {
  'blankett-ect-lista': { file: 'kompendium/Blanketter/ECT-lista.docx', name: 'ECT-lista', label: 'Ladda ner ECT-lista (Word)' },
};
const PLACEHOLDER = '____-____-____';   // same text as in tools/blankett.py

// CRC-32 for the zip entries
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = bytes => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Reads the entries of a zip file (stored or deflated) in their original order
async function unzip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  let end = buffer.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Mallen är ingen giltig Word-fil.');
  const entries = [];
  for (let i = 0, at = view.getUint32(end + 16, true); i < view.getUint16(end + 10, true); i++) {
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    entries.push({ name, data: method === 8 ? await pipe(data, new DecompressionStream('deflate-raw')) : data.slice() });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

// Writes the entries as a zip file with deflated data and UTF-8 names
async function zip(entries) {
  const parts = [], directory = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name), packed = await pipe(data, new CompressionStream('deflate-raw')), crc = crc32(data);
    const header = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 8, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, packed.length, 4], [22, data.length, 4], [26, nameBytes.length, 2], [28, 0, 2]]
      .forEach(([at, value, width]) => width === 4 ? header.setUint32(at, value, true) : header.setUint16(at, value, true));
    const central = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 8, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, packed.length, 4], [24, data.length, 4], [28, nameBytes.length, 2], [42, offset, 4]]
      .forEach(([at, value, width]) => width === 4 ? central.setUint32(at, value, true) : central.setUint16(at, value, true));
    parts.push(header, nameBytes, packed); directory.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const size = directory.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, entries.length, 2], [10, entries.length, 2], [12, size, 4], [16, offset, 4]]
    .forEach(([at, value, width]) => width === 4 ? end.setUint32(at, value, true) : end.setUint16(at, value, true));
  return new Blob([...parts, ...directory, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Fills in the date content control: value (w:fullDate), text, and no longer a placeholder
function fillDate(xml, iso) {
  return xml.replace(/(<w:tag w:val="ect-datum"\/>[\s\S]*?)<w:showingPlcHdr\/>/, '$1')
    .replace(/(<w:tag w:val="ect-datum"\/>[\s\S]*?)<w:date>/, `$1<w:date w:fullDate="${iso}T00:00:00Z">`)
    .replace(PLACEHOLDER, iso);   // yyyy-mm-dd, as the control's date format
}

async function download(template, iso, base) {
  const response = await fetch(new URL(template.file, base));
  if (!response.ok) throw new Error('Mallen kunde inte laddas.');
  const entries = await unzip(await response.arrayBuffer());
  const documentXml = entries.find(entry => entry.name === 'word/document.xml');
  const xml = new TextDecoder().decode(documentXml.data);
  if (!xml.includes(PLACEHOLDER)) throw new Error('Mallen saknar datumfältet.');
  documentXml.data = new TextEncoder().encode(fillDate(xml, iso));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await zip(entries));
  link.download = `${template.name} ${iso}.docx`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

export function enhanceForms(article, base) {
  for (const [className, template] of Object.entries(TEMPLATES)) {
    for (const slot of article.querySelectorAll(`.${className}`)) {
      const form = document.createElement('form'); form.className = 'blankett-form';
      const id = `${className}-datum`;
      form.innerHTML = `<label for="${id}">Behandlingsdatum</label><input id="${id}" required>
        <button type="submit"></button><p class="blankett-status" role="status"></p>`;
      const input = form.querySelector('input'), button = form.querySelector('button[type=submit]'), status = form.querySelector('.blankett-status');
      datePicker(input, { label: 'behandlingsdatum' });
      input.value = todayIso(); button.textContent = template.label;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const error = input.value ? dateError(input.value) : 'Välj ett behandlingsdatum.';
        if (error) { status.textContent = error; input.focus(); return; }
        button.disabled = true; status.textContent = 'Skapar dokumentet…';
        try { await download(template, input.value, base); status.textContent = `${template.name} ${input.value}.docx har laddats ned.`; }
        catch (error) { status.textContent = `${error.message} Försök igen.`; console.error('Blankett:', error); }
        finally { button.disabled = false; }
      });
      slot.replaceChildren(form);
    }
  }
  // The ECT journal has a full web form of its own (journal.js), loaded only where it is used
  const journals = article.querySelectorAll('.blankett-ect-journal');
  if (journals.length) return import('./journal.js').then(({ enhanceJournal }) => journals.forEach(slot => enhanceJournal(slot, base)));
}
