import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cwd = path.join(root, 'tools/markdown-renderer');
for (const args of [['test','--locked'],['build','--locked','--release','--target','wasm32-unknown-unknown']]) {
  const result = spawnSync('cargo', args, { cwd, stdio:'inherit' });
  if (result.status !== 0) throw new Error(result.error?.message || `Rust-bygget avbröts (${result.status}).`);
}
await fs.copyFile(path.join(cwd,'target/wasm32-unknown-unknown/release/ect_markdown.wasm'), path.join(root,'assets/kompendium/ect_markdown.wasm'));
const metadata = spawnSync('cargo', ['metadata','--locked','--offline','--filter-platform','wasm32-unknown-unknown','--format-version','1'], {cwd, encoding:'utf8', maxBuffer:16*1024*1024});
if (metadata.status !== 0) throw new Error('Bibliotekslicenserna kunde inte sammanställas.');
const notices = ['ECT Markdown renderer: third-party library licenses\n'];
for (const pkg of JSON.parse(metadata.stdout).packages.filter(pkg => pkg.source)) {
  const directory = path.dirname(pkg.manifest_path);
  notices.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version} - ${pkg.license || 'See upstream license'}\n${pkg.repository || ''}\n`);
  for (const file of await fs.readdir(directory, {withFileTypes:true})) {
    if (file.isFile() && /^(LICENSE|COPYING|COPYRIGHT|NOTICE)([._-]|$)/i.test(file.name)) notices.push(`\n${file.name}\n${await fs.readFile(path.join(directory,file.name),'utf8')}\n`);
  }
}
await fs.writeFile(path.join(root,'assets/kompendium/THIRD_PARTY_LICENSES.txt'),notices.join(''));
console.log('Rust-renderaren har byggts och kopierats till webbplatsen.');
