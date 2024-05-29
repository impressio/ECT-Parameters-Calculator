// Renderar Mermaid-diagram till vektor-PDF för boken (anropas av publish/build.py).
//   node publish/mermaid.mjs IN.json UTKATALOG
// IN.json: [{ "id": "...", "source": "..." }]. Varje diagram ritas av Mermaid (samma version och tema som webbplatsen)
// i Chromium och skrivs ut som en PDF-sida i exakt diagrammets storlek: UTKATALOG/<id>.pdf. Storlekarna (punkter)
// och eventuella fel skrivs till UTKATALOG/diagram.json. Texten i diagrammen förblir text (sökbar, skarp).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [input, outdir] = process.argv.slice(2);
const diagrams = JSON.parse(await readFile(input, 'utf8'));
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.esm.min.mjs';
const FONT = '"Noto Sans", sans-serif';
const page = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white} body{font-family:${FONT};font-size:16px}</style>
<body><div id="out"></div><script type="module">
import mermaid from '${MERMAID}';
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: ${JSON.stringify(FONT)},
  themeVariables: { fontSize: '16px', fontFamily: ${JSON.stringify(FONT)} },
  themeCSS: 'text, foreignObject * { font-family: ${FONT.replace(/"/g, "\\'")} !important; font-size: 16px !important; }',
  // Bokens layout: tätare mellan rutorna och radbrutna meddelanden i sekvensdiagram, så att diagrammen ryms på sidan
  flowchart: { nodeSpacing: 30, rankSpacing: 32, padding: 10 },
  sequence: { mirrorActors: false, wrap: true, width: 140, actorMargin: 30, messageMargin: 24, noteMargin: 8 } });
window.draw = async (id, source) => {
  const { svg } = await mermaid.render(id, source);
  const out = document.getElementById('out'); out.innerHTML = svg;
  const el = out.querySelector('svg');
  const max = parseFloat(el.style.maxWidth) || el.getBoundingClientRect().width;
  el.removeAttribute('width'); el.style.maxWidth = 'none'; el.style.width = max + 'px'; el.style.height = 'auto'; el.style.display = 'block';
  await document.fonts.ready;
  const box = el.getBoundingClientRect();
  return { width: Math.ceil(box.width) + 2, height: Math.ceil(box.height) + 2 };
};
window.ready = true;
</script>`;

const server = createServer((request, response) => response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page));
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const profile = await mkdtemp(join(tmpdir(), 'mermaid-'));
const port = 9800 + Math.floor(Math.random() * 150);
const browser = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const results = {};
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
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description?.split('\n')[0] || exceptionDetails.text);
    return result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 2400, height: 2000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await evaluate(`new Promise((resolve, reject) => { const t0 = Date.now(); const t = setInterval(() => { if (window.ready) { clearInterval(t); resolve(); } else if (Date.now() - t0 > 30000) { clearInterval(t); reject(new Error('Mermaid laddades inte')); } }, 100); })`);
  for (const diagram of diagrams) {
    try {
      const size = await evaluate(`draw(${JSON.stringify('m' + diagram.id.replace(/\W/g, ''))}, ${JSON.stringify(diagram.source)})`);
      const { result } = await send('Page.printToPDF', { paperWidth: size.width / 96, paperHeight: size.height / 96, marginTop: 0, marginBottom: 0,
        marginLeft: 0, marginRight: 0, printBackground: true, pageRanges: '1', preferCSSPageSize: false });
      await writeFile(join(outdir, `${diagram.id}.pdf`), Buffer.from(result.data, 'base64'));
      results[diagram.id] = { width: size.width * 0.75, height: size.height * 0.75 };   // CSS px to pt
    } catch (error) {
      results[diagram.id] = { error: String(error.message || error) };
    }
  }
  ws.close();
} finally {
  const exited = new Promise(done => browser.once('exit', done));
  browser.kill(); server.close(); await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
await writeFile(join(outdir, 'diagram.json'), JSON.stringify(results, null, 1));
