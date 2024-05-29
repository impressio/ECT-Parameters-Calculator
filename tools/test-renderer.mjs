import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const index = JSON.parse(await fs.readFile(path.join(root,'assets/kompendium/index.json'),'utf8'));
const bytes = await fs.readFile(path.join(root,'assets/kompendium/ect_markdown.wasm'));
// The renderer is downloaded on the first visit to the compendium: catch unintended growth (1.52 MB after the size optimizations)
assert.ok(bytes.length < 1_650_000, `ect_markdown.wasm har vuxit till ${bytes.length} byte`);
// Search text: one plain-text entry per chapter, in index order
const search = JSON.parse(await fs.readFile(path.join(root,'assets/kompendium/search.json'),'utf8'));
assert.equal(search.length, index.documents.length); assert.ok(search.every(text => typeof text === 'string' && text.length > 0));
assert.ok(index.documents.every(doc => !('text' in doc)), 'index.json ska inte innehålla söktext');
const {instance} = await WebAssembly.instantiate(bytes,{});
const wasm = instance.exports, encoder = new TextEncoder(), decoder = new TextDecoder();
let images = 0, tasks = 0, diagrams = 0;
const used = new Set();
for (const doc of index.documents) {
  const markdown = await fs.readFile(path.join(root,'kompendium',doc.file),'utf8');
  // Every section (##) is preceded by a horizontal rule, as in the other chapters
  { let code = false, previous = '';
    for (const line of markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').split('\n')) {
      if (line.startsWith('```')) code = !code;
      if (!code && line.startsWith('## ')) assert.equal(previous, '---', `${doc.file}: linje saknas före "${line}"`);
      if (line.trim()) previous = line.trim();
    } }
  const input = encoder.encode(JSON.stringify({markdown,current:doc.file,files:index.files,documents:index.documents}));
  const pointer = wasm.alloc(input.length);
  let outPointer = 0, outLength = 0;
  try {
    new Uint8Array(wasm.memory.buffer,pointer,input.length).set(input);
    const packed = BigInt.asUintN(64,wasm.render_json(pointer,input.length)); outPointer = Number(packed >> 32n); outLength = Number(packed & 0xffffffffn);
    const result = JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer,outPointer,outLength)));
    assert.equal(result.error,undefined,`${doc.file}: ${result.error}`);
    assert.match(result.html,/<h1\b/,doc.file);
    assert.doesNotMatch(result.html,/\[\[|ECTMATHPLACEHOLDER|file:\/\/|\/home\//,doc.file);
    for (const match of result.html.matchAll(/href="(#\/kompendium\/[^"?]+)(?:\?section=[^"]*)?"/g)) {
      const target = decodeURIComponent(match[1].slice('#/kompendium/'.length));
      assert.ok(index.documents.some(d=>d.file===target),`${doc.file}: ${target}`);
    }
    const embeds = [...markdown.matchAll(/!\[\[[^\]]+\]\]/g)].length, rendered = [...result.html.matchAll(/<img[^>]+src="([^"]+)"/g)];
    assert.equal(rendered.length,embeds,`${doc.file}: inbäddade bilder saknas i kompendium/`);
    for (const match of rendered) {
      const file = decodeURIComponent(match[1].slice('kompendium/'.length)); assert.ok(index.files.includes(file),file); used.add(file); images++;
    }
    tasks += [...result.html.matchAll(/type="checkbox"/g)].length;
    diagrams += [...result.html.matchAll(/class="mermaid"/g)].length;
  } finally { wasm.dealloc(pointer,input.length); if(outLength) wasm.dealloc(outPointer,outLength); }
}
assert.equal(images,13);
const unused = index.files.filter(file => file.startsWith('Figurer/') && !used.has(file));
assert.deepEqual(unused,[],`Figurer/ innehåller bilder som inte är inbäddade: ${unused.join(', ')}`); assert.equal(tasks,41); assert.ok(diagrams>30);
console.log(`${index.documents.length} originalfiler renderade genom WebAssembly. ${images} bilder, ${tasks} kryssrutor och ${diagrams} diagram; alla interna länkar giltiga.`);
