// Exporterar hela kompendiet till en PDF i e-boksformat (A5) för genomläsning och granskning.
//   npm run export:pdf                  skriver export/ECT-kompendium.pdf
//   npm run export:pdf -- FIL.pdf       annan fil
// Kapitlen renderas av webbplatsen själv i Chromium (headless), så diagram (Mermaid), formler (MathJax) och tabeller
// ser ut som på webben. Varje kapitel kopieras in i en bok med titelsida, innehållsförteckning och en titelsida per
// avsnitt; länkar mellan kapitlen pekar inom PDF:en, och PDF:en får bokmärken och sidnummer.
// Kräver chromium och nätanslutning (Mermaid, MathJax och typsnittet hämtas som på webbplatsen).
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || join(root, 'export', 'ECT-kompendium.pdf'));
const SITE = 'https://ect.matty.se/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf', '.docx': 'application/octet-stream' };

// Static server for the repository (the site is served exactly as on GitHub Pages)
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const base = `http://127.0.0.1:${server.address().port}/`;

const profile = await mkdtemp(join(tmpdir(), 'kompendium-pdf-'));
const port = 9300 + Math.floor(Math.random() * 500);
const browser = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => {
  const exited = new Promise(done => browser.once('exit', done));
  browser.kill(); server.close(); await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
};

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await new Promise(r => setTimeout(r, 200));
    target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json()).catch(() => undefined);
  }
  if (!target) throw new Error('Chromium startade inte.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = event => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expression => {
    const { result, exceptionDetails } = (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result;
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1200, deviceScaleFactor: 1, mobile: false });
  const index = JSON.parse(await readFile(join(root, 'assets/kompendium/index.json'), 'utf8'));
  const commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD']).toString().trim();
  await send('Page.navigate', { url: `${base}#/kompendium/` });
  await evaluate(`new Promise(r => { const t = setInterval(() => { if (document.querySelector('#compendium-view article') && !document.querySelector('#compendium-view article[aria-busy]')) { clearInterval(t); r(); } }, 200); })`);

  // Render each chapter in the site and copy it into the book, which lives outside the compendium view
  await evaluate(`(() => { const book = document.createElement('div'); book.id = 'bok'; book.hidden = true; document.body.append(book); })()`);
  const routeOf = file => '#/kompendium/' + file.split('/').map(encodeURIComponent).join('/');
  for (const [n, doc] of index.documents.entries()) {
    await evaluate(`location.hash = ${JSON.stringify(routeOf(doc.file))}`);
    await evaluate(`new Promise((resolve, reject) => {
      const start = Date.now();
      const t = setInterval(() => {
        const article = document.querySelector('#compendium-view article');
        const ready = document.title.startsWith(${JSON.stringify(doc.title + ' ·')}) && !article.hasAttribute('aria-busy')
          && !article.querySelector('pre.mermaid:not([data-processed])');
        if (ready) {
          clearInterval(t);
          // Formulas: let MathJax finish typesetting the chapter (does nothing when there are none)
          const math = window.MathJax?.startup?.promise ? MathJax.startup.promise.then(() => MathJax.typesetPromise([article])) : Promise.resolve();
          math.then(() => setTimeout(resolve, 400), reject);
        }
        else if (Date.now() - start > 30000) { clearInterval(t); reject(new Error('Kapitlet renderades inte: ' + ${JSON.stringify(doc.file)})); }
      }, 150);
    })`);
    await evaluate(`(() => {
      const n = ${n}, doc = ${JSON.stringify(doc)}, files = ${JSON.stringify(index.documents.map(d => d.file))};
      const book = document.getElementById('bok');
      if (!book.querySelector('[data-group="' + CSS.escape(doc.group) + '"]')) {
        const part = document.createElement('section'); part.className = 'bok-del'; part.dataset.group = doc.group;
        part.id = 'del-' + book.querySelectorAll('.bok-del').length;
        const h = document.createElement('h1'); h.textContent = doc.group; part.append(h); book.append(part);
      }
      const chapter = document.createElement('section'); chapter.className = 'bok-kapitel'; chapter.id = 'kapitel-' + n;
      const article = document.querySelector('#compendium-view article').cloneNode(true);
      article.removeAttribute('tabindex'); article.removeAttribute('aria-live');
      // Heading ids are unique per chapter; prefix them so that they are unique in the book
      for (const el of article.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')) el.id = 'k' + n + '-' + el.id;
      // Diagrams: Mermaid numbers its ids per chapter (svg, markers, clip paths), so in the book they would collide and
      // a diagram could point to another chapter's clip path or styles. Prefix every id in each svg and its references.
      for (const svg of article.querySelectorAll('svg')) {
        const ids = [...svg.querySelectorAll('[id]'), ...(svg.id ? [svg] : [])].map(el => el.id);
        if (!ids.length) continue;
        const rename = new Map(ids.map(old => [old, 'k' + n + '-' + old]));
        const pattern = new RegExp('#(' + [...rename.keys()].sort((a, b) => b.length - a.length).map(id => id.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w-])', 'g');
        const fix = text => text.replace(pattern, (_, id) => '#' + rename.get(id));
        for (const el of [svg, ...svg.querySelectorAll('*')]) {
          if (el.id && rename.has(el.id)) el.id = rename.get(el.id);
          for (const attr of [...el.attributes]) {
            if (attr.name === 'id') continue;
            if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') el.setAttribute(attr.name, attr.value.split(/\s+/).map(id => rename.get(id) || id).join(' '));
            else if (attr.value.includes('#')) el.setAttribute(attr.name, fix(attr.value));
          }
          if (el.tagName.toLowerCase() === 'style') el.textContent = fix(el.textContent);
        }
      }
      // Links between chapters point into the book; other relative links point to the site
      for (const a of article.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        if (href.startsWith('#/kompendium/')) {
          const url = new URL(href.slice(1), 'https://x.invalid');
          const file = decodeURIComponent(url.pathname.slice('/kompendium/'.length));
          const target = files.indexOf(file), section = url.searchParams.get('section');
          a.setAttribute('href', target < 0 ? ${JSON.stringify(SITE)} + href : section ? '#k' + target + '-' + section : '#kapitel-' + target);
        } else if (!/^(https?:|mailto:|#)/.test(href)) a.setAttribute('href', ${JSON.stringify(SITE)} + href);
        if (a.classList.contains('figure-link')) a.removeAttribute('href');
      }
      // Forms work only on the website
      for (const slot of article.querySelectorAll('.blankett-ect-lista, .blankett-ect-journal')) {
        const note = document.createElement('p'); note.className = 'bok-hanvisning';
        note.innerHTML = 'Formuläret finns på webbplatsen: <a href="' + ${JSON.stringify(SITE)} + ${JSON.stringify('')} + location.hash + '">' + ${JSON.stringify(SITE.replace(/^https:\/\//, ''))} + '</a>';
        slot.replaceWith(note);
      }
      article.querySelectorAll('.expand-content').forEach(el => el.remove());
      article.querySelectorAll('details').forEach(el => el.open = true);
      const kicker = document.createElement('p'); kicker.className = 'bok-grupp'; kicker.textContent = doc.group;
      chapter.append(kicker, article);
      book.append(chapter);
    })()`);
    process.stdout.write(`\r${n + 1}/${index.documents.length} ${doc.title}`.padEnd(70));
  }
  process.stdout.write('\n');

  // Title page, table of contents and print layout; the book replaces the page
  const date = new Date().toLocaleDateString('sv-SE');
  await evaluate(`(() => {
    const book = document.getElementById('bok'), docs = ${JSON.stringify(index.documents)};
    const title = document.createElement('section'); title.className = 'bok-titel';
    title.innerHTML = '<h1>ECT-kompendium</h1><p class="bok-undertitel">Elektrokonvulsiv terapi: ett praktiskt kompendium för ECT-behandlare</p>'
      + '<p class="bok-meta">Granskningsexemplar ${date}<br>Version ${commit}<br>${SITE.replace(/^https:\/\//, '').replace(/\/$/, '')}</p>';
    const toc = document.createElement('nav'); toc.className = 'bok-innehall';
    toc.innerHTML = '<h1>Innehåll</h1>';
    let list;
    docs.forEach((doc, n) => {
      if (!list || list.dataset.group !== doc.group) {
        const h = document.createElement('h2'); h.textContent = doc.group; toc.append(h);
        list = document.createElement('ol'); list.dataset.group = doc.group; toc.append(list);
      }
      const li = document.createElement('li'), a = document.createElement('a'); a.href = '#kapitel-' + n; a.textContent = doc.title; li.append(a); list.append(li);
    });
    book.prepend(title, toc);
    document.title = 'ECT-kompendium';
    document.body.replaceChildren(book); book.hidden = false;
    document.getElementById('compendium-styles').disabled = false;
    const style = document.createElement('style');
    style.textContent = \`
      @page { size: A5; margin: 16mm 14mm 18mm; }
      html, body { background: white; }
      body { font-size: 10pt; }
      #bok { color: var(--ink); }
      #bok article { font-size: 10pt; line-height: 1.5; padding: 0; border: 0; }
      #bok article h1 { font-size: 18pt; margin: 0 0 12pt; }
      #bok article h2 { font-size: 13pt; margin: 18pt 0 8pt; break-after: avoid; }
      #bok article h3, #bok article h4 { font-size: 11pt; margin: 12pt 0 6pt; break-after: avoid; }
      #bok article p, #bok article li { orphans: 3; widows: 3; }
      #bok article table { font-size: 8.5pt; min-width: 0; width: 100%; break-inside: auto; }
      #bok article th, #bok article td { padding: 4pt 5pt; }
      #bok article tr { break-inside: avoid; }
      #bok .table-scroll { overflow: visible; }
      #bok .diagram-source { overflow: visible; break-inside: avoid; margin: 10pt 0; }
      #bok .diagram-source > summary { display: none; }
      #bok .diagram-source pre.mermaid { padding: 0; margin: 0; }
      #bok .diagram-source svg { max-width: 100% !important; height: auto; }
      #bok img { max-width: 100%; height: auto; break-inside: avoid; }
      #bok mjx-container[display=true] { overflow: visible; }
      #bok blockquote { break-inside: avoid; }
      #bok pre { white-space: pre-wrap; font-size: 8.5pt; }
      #bok a { color: #075d95; }
      .bok-titel { break-after: page; height: 170mm; display: flex; flex-direction: column; justify-content: center; }
      .bok-titel h1 { font-size: 26pt; margin: 0 0 8pt; }
      .bok-undertitel { font-size: 12pt; margin: 0 0 30pt; }
      .bok-meta { color: var(--muted); font-size: 9.5pt; line-height: 1.6; }
      .bok-innehall { break-after: page; font-size: 9.5pt; }
      .bok-innehall h1 { font-size: 18pt; margin: 0 0 10pt; }
      .bok-innehall h2 { font-size: 10pt; margin: 10pt 0 2pt; break-after: avoid; }
      .bok-innehall ol { margin: 0; padding-left: 1.2em; list-style: none; }
      .bok-innehall li { margin: 1pt 0; }
      .bok-del { break-before: page; break-after: page; height: 170mm; display: flex; align-items: center; }
      .bok-del h1 { font-size: 22pt; }
      .bok-kapitel { break-before: page; }
      .bok-grupp { color: var(--muted); font-size: 8.5pt; margin: 0 0 4pt; }
      .bok-hanvisning { padding: 8pt 10pt; border-left: 3px solid #075d95; background: #f3f8fc; }
    \`;
    document.head.append(style);
  })()`);
  await new Promise(r => setTimeout(r, 1500));
  // Every diagram must have been drawn with a size; report the ones that would be missing from the PDF
  const empty = await evaluate(`[...document.querySelectorAll('#bok .diagram-source')].map(d => {
    const svg = d.querySelector('svg'), box = svg?.getBoundingClientRect();
    return { chapter: d.closest('.bok-kapitel')?.querySelector('h1')?.textContent, svg: !!svg, w: Math.round(box?.width || 0), h: Math.round(box?.height || 0),
      attrs: svg ? [svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox'), svg.getAttribute('style')].join(' | ') : d.textContent.slice(0, 80) };
  }).filter(d => !d.svg || d.h < 20)`);
  if (empty.length) console.warn('Diagram utan storlek:', JSON.stringify(empty, null, 1));
  const footer = '<div style="width:100%;font-family:Inter,sans-serif;font-size:7pt;color:#6b6b6b;text-align:center;"><span class="pageNumber"></span></div>';
  const { result } = await send('Page.printToPDF', {
    preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer,
    generateDocumentOutline: true, generateTaggedPDF: true,
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(result.data, 'base64'));
  console.log('sparad', output);
} finally {
  await cleanup();
}
