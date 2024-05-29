// Builds assets/kompendium/index.json (chapter metadata) and assets/kompendium/search.json (plain
// text per chapter, in the same order; loaded only when the reader searches) from the Markdown
// sources in kompendium/. Files ignored by the repository's .gitignore (e.g. Referenser/) are left out.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(repo, 'kompendium');
const assets = path.join(repo, 'assets/kompendium');

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'sv'))) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}
const candidates = await listFiles(source);
if (candidates.some(name => /[\x00-\x1f]/.test(name))) throw new Error('Kontrolltecken i filnamn stöds inte.');
// Ask Git which files the repository ignores, so nested rules and negations work.
const check = spawnSync('git', ['-C', repo, '-c', 'core.quotePath=false', 'check-ignore', '--no-index', '--', ...candidates.map(f => `kompendium/${f}`)],
  { encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
if (![0, 1].includes(check.status)) throw new Error(check.stderr || 'Git ignore-kontrollen misslyckades.');
const ignored = new Set(check.stdout.split('\n').filter(Boolean).map(line => (line.startsWith('"') ? JSON.parse(line) : line).replace(/^kompendium\//, '')));
const files = candidates.filter(name => !ignored.has(name));
const docs = [];
for (const file of files.filter(name => name.endsWith('.md'))) {
  const raw = await fs.readFile(path.join(source, file), 'utf8');
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const stem = path.posix.basename(file).slice(0, -3);
  const title = (front?.[1].match(/^title:\s*(.+)$/m)?.[1] || stem).replace(/^['"]|['"]$/g, '');
  const aliasesBlock = front?.[1].match(/^aliases:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m)?.[1] || '';
  const aliases = [...aliasesBlock.matchAll(/^\s*-\s*(.+)$/gm)].map(m => m[1].replace(/^['"]|['"]$/g, ''));
  docs.push({ file, title, aliases, md: raw.slice(front?.[0].length || 0), group: path.posix.dirname(file) });
}
const home = docs.find(doc => doc.title === 'Introduktion');
if (!home) throw new Error('Startkapitlet (Introduktion) saknas.');
const documents = docs.map(doc => ({ file: doc.file, title: doc.title, group: doc.group, aliases: doc.aliases }));
// Search text: the chapter without its reference list and related links (author initials such as "Mankad MV" would
// otherwise match short searches like "mV" in nearly every chapter); all references remain searchable in the sources chapter
const search = docs.map(doc => doc.md.split(/\n## (?:Referenser|Relaterade länkar)\s*\n/)[0].replace(/```[\s\S]*?```/g, '').replace(/[\[\]#*_`>$]/g, ' ').replace(/\s+/g, ' ').trim());
await fs.mkdir(assets, { recursive: true });
await fs.writeFile(path.join(assets, 'index.json'), JSON.stringify({ home: home.file, files, documents }));
await fs.writeFile(path.join(assets, 'search.json'), JSON.stringify(search));
console.log(`Index byggt: ${files.length} filer, varav ${docs.length} kapitel. ${ignored.size} filer undantogs av .gitignore.`);
