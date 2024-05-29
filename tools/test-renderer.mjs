import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const index = JSON.parse(await fs.readFile(path.join(root,'assets/kompendium/index.json'),'utf8'));
const bytes = await fs.readFile(path.join(root,'assets/kompendium/ect_markdown.wasm'));
const {instance} = await WebAssembly.instantiate(bytes,{});
const wasm = instance.exports, encoder = new TextEncoder(), decoder = new TextDecoder();
let images = 0, tasks = 0, diagrams = 0;
for (const doc of index.documents) {
  const markdown = await fs.readFile(path.join(root,'kompendium',doc.file),'utf8');
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
    for (const match of result.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      const file = decodeURIComponent(match[1].slice('kompendium/'.length)); assert.ok(index.files.includes(file),file); images++;
    }
    tasks += [...result.html.matchAll(/type="checkbox"/g)].length;
    diagrams += [...result.html.matchAll(/class="mermaid"/g)].length;
  } finally { wasm.dealloc(pointer,input.length); if(outLength) wasm.dealloc(outPointer,outLength); }
}
assert.equal(images,8); assert.equal(tasks,33); assert.ok(diagrams>30);
console.log(`${index.documents.length} originalfiler renderade genom WebAssembly. ${images} bilder, ${tasks} kryssrutor och ${diagrams} diagram; alla interna länkar giltiga.`);
