// Hämtar pdf-lib till assets/kompendium/vendor/ (ECT-journalens PDF skapas med den i webbläsaren).
//   npm run vendor:pdf-lib            version enligt package.json
//   npm run vendor:pdf-lib -- 1.18.0  en annan version; package.json uppdateras
// Filen hämtas från npm-paketet via jsDelivr. Dess SHA-256 och licenstexten skrivs i pdf-lib.LICENSE.txt, så att
// varje byte som ändras syns i Git och kan granskas innan den används.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const version = process.argv[2] || pkg.devDependencies['pdf-lib'];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Ogiltig version: ${version}`);

const get = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
};
const source = `https://cdn.jsdelivr.net/npm/pdf-lib@${version}/dist/pdf-lib.esm.min.js`;
const code = Buffer.from(await (await get(source)).arrayBuffer());
const license = await (await get(`https://cdn.jsdelivr.net/npm/pdf-lib@${version}/LICENSE.md`)).text();
if (!code.includes('PDFDocument')) throw new Error('Filen ser inte ut som pdf-lib.');
const sha = createHash('sha256').update(code).digest('hex');

await writeFile(new URL('assets/kompendium/vendor/pdf-lib.esm.min.js', root), code);
await writeFile(new URL('assets/kompendium/vendor/pdf-lib.LICENSE.txt', root),
  `pdf-lib ${version} (https://github.com/Hopding/pdf-lib), file pdf-lib.esm.min.js from\n${source}\nSHA-256 ${sha}\n\n${license.trim()}\n\n` +
  'The bundle also contains tslib (Copyright (c) Microsoft Corporation, Apache License 2.0; its notice is kept at the top of the file) ' +
  'and pako (Copyright (C) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn, MIT License; zlib port, (C) 1995-2013 Jean-loup Gailly and Mark Adler).\n');
if (pkg.devDependencies['pdf-lib'] !== version) {
  pkg.devDependencies['pdf-lib'] = version;
  await writeFile(new URL('package.json', root), JSON.stringify(pkg, null, 2) + '\n');
}
console.log(`pdf-lib ${version}, ${code.length} byte, SHA-256 ${sha}`);
