import { loadRenderer } from './wasm-loader.js';
import { createContentExpander } from './expand-content.js';

const base = new URL('../../', import.meta.url);
const view = document.getElementById('compendium-view');
const calculator = document.getElementById('calculator-view');
const stylesheet = document.getElementById('compendium-styles');
const routeFor = (file, section = '') => '#/kompendium/' + file.split('/').map(encodeURIComponent).join('/') + (section ? '?section=' + encodeURIComponent(section) : '');
let indexPromise, index, renderRust, shell, requestNumber = 0, abort, calculatorLanguage;
const mathReady = new Promise(resolve => {
  if (window.MathJax?.startup?.promise) resolve(window.MathJax.startup.promise);
  else {
    const script = document.getElementById('MathJax-script');
    script.addEventListener('load', () => resolve(window.MathJax?.startup?.promise));
    script.addEventListener('error', () => resolve(null));
  }
});
let mermaidPromise;
function loadIndex() {
  indexPromise ||= fetch(new URL('assets/kompendium/index.json', base)).then(response => {
    if (!response.ok) throw new Error('Kapitelregistret kunde inte laddas.');
    return response.json();
  }).catch(error => { indexPromise = undefined; throw error; });
  return indexPromise;
}
function makeLink(label, href) {
  const a = document.createElement('a'); a.textContent = label; a.href = href; return a;
}
function setupShell() {
  if (shell) return;
  view.innerHTML = `<a class="skip-link" href="#innehall">Till innehållet</a>
    <header class="topbar"><a class="brand" href="#/kompendium/">ECT-kompendium</a>
    <nav aria-label="Huvudnavigation"><a href="?lang=sv">Till kalkylatorn</a><button type="button" id="chapter-toggle" aria-expanded="false" aria-controls="chapter-nav">Kapitel</button></nav></header>
    <div class="reading-layout"><aside id="chapter-nav" aria-label="Kapitelnavigation">
    <label for="chapter-search">Sök i kompendiet</label><input id="chapter-search" type="search" placeholder="Sök ämne eller begrepp…" autocomplete="off">
    <p id="search-status" role="status"></p><ul id="search-results" hidden></ul><nav id="chapter-list" aria-label="Kapitel"></nav></aside>
    <main id="innehall" class="reading-content"><p class="chapter-kicker"></p><article tabindex="-1" aria-live="polite"></article>
    <nav class="page-navigation" aria-label="Föregående och nästa kapitel"></nav>
    <p><a id="markdown-source">Öppna Markdown-filen</a></p>
    <footer>Utbildnings- och referensmaterial. Klinisk tillämpning följer aktuell lokal rutin och individuell ordination.</footer></main></div>`;
  shell = {
    article: view.querySelector('article'), list: view.querySelector('#chapter-list'), sidebar: view.querySelector('#chapter-nav'),
    toggle: view.querySelector('#chapter-toggle'), search: view.querySelector('#chapter-search'), results: view.querySelector('#search-results'), status: view.querySelector('#search-status')
  };
  shell.expander = createContentExpander(view);
  shell.toggle.addEventListener('click', () => {
    const open = shell.toggle.getAttribute('aria-expanded') !== 'true';
    shell.toggle.setAttribute('aria-expanded', String(open)); shell.sidebar.classList.toggle('is-open', open);
  });
  view.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault(); shell.article.focus(); shell.article.scrollIntoView({block:'start'});
  });
  shell.search.addEventListener('input', () => {
    const terms = shell.search.value.trim().toLocaleLowerCase('sv').split(/\s+/).filter(Boolean);
    shell.results.hidden = !terms.length; shell.list.hidden = !!terms.length; shell.results.replaceChildren();
    if (!terms.length) { shell.status.textContent = ''; return; }
    const hits = index.documents.filter(doc => terms.every(term => `${doc.title} ${doc.text}`.toLocaleLowerCase('sv').includes(term)));
    for (const hit of hits) { const li = document.createElement('li'); li.append(makeLink(hit.title, routeFor(hit.file))); shell.results.append(li); }
    shell.status.textContent = `${hits.length} kapitel hittades`;
  });
}
function buildNavigation() {
  shell.list.replaceChildren();
  for (const group of new Set(index.documents.map(doc => doc.group))) {
    const details = document.createElement('details'); details.open = true;
    const summary = document.createElement('summary'); summary.textContent = group;
    const ul = document.createElement('ul');
    for (const doc of index.documents.filter(doc => doc.group === group)) {
      const li = document.createElement('li'), link = makeLink(doc.title, routeFor(doc.file)); link.dataset.file = doc.file; li.append(link); ul.append(li);
    }
    details.append(summary, ul); shell.list.append(details);
  }
}
async function decorate(doc, version) {
  const article = shell.article;
  for (const a of article.querySelectorAll('a[href^="#"]')) {
    if (!a.getAttribute('href').startsWith('#/kompendium/')) a.href = routeFor(doc.file, a.getAttribute('href').slice(1));
  }
  for (const checkbox of article.querySelectorAll('input[type="checkbox"]')) checkbox.closest('li')?.classList.add('task-list-item');
  for (const table of article.querySelectorAll('table')) {
    const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0;
    wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','Tabell'); table.before(wrapper); wrapper.append(table);
  }
  for (const image of article.querySelectorAll('img')) {
    image.loading = 'lazy'; image.decoding = 'async';
    if (image.parentElement.tagName === 'A') image.parentElement.classList.add('figure-link');
  }
  shell.expander.enhance(article);
  const diagrams = [...article.querySelectorAll('pre.mermaid')];
  if (diagrams.length) {
    try {
      mermaidPromise ||= import('https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.esm.min.mjs').then(({default:mermaid}) => {
        const fontFamily = getComputedStyle(article).fontFamily;
        mermaid.initialize({
          startOnLoad:false, securityLevel:'strict', theme:'neutral', fontFamily,
          themeVariables:{fontSize:'16px',fontFamily},
          themeCSS:`text, foreignObject * { font-family:${fontFamily} !important; font-size:16px !important; }`,
          // Sekvensdiagrammens deltagarrutor visas bara överst, inte en gång till nederst.
          sequence:{mirrorActors:false,actorFontFamily:fontFamily,actorFontSize:16,messageFontFamily:fontFamily,messageFontSize:16,noteFontFamily:fontFamily,noteFontSize:16}
        }); return mermaid;
      }).catch(error => {mermaidPromise = undefined; throw error;});
      const mermaid = await mermaidPromise;
      if (version !== requestNumber) return;
      for (const node of diagrams) {
        const source = node.textContent;
        try { await mermaid.run({nodes:[node]}); }
        catch { node.textContent = source; node.classList.remove('mermaid'); }
        if (version !== requestNumber) return;
      }
    } catch { /* Diagramkällan förblir läsbar utan nätanslutning. */ }
  }
  shell.expander.refresh();
  await mathReady;
  if (version === requestNumber && window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([article]);
  if (version === requestNumber) shell.expander.refresh();
}
async function navigate() {
  const version = ++requestNumber; abort?.abort();
  shell?.expander.close();
  const active = location.hash === '#/kompendium' || location.hash.startsWith('#/kompendium/');
  if (active && !calculator.hidden) calculatorLanguage = document.documentElement.lang;
  calculator.hidden = active; view.hidden = !active; stylesheet.disabled = !active;
  if (!active) {
    if (calculatorLanguage) document.documentElement.lang = calculatorLanguage;
    document.title = calculator.querySelector('.brand [data-i18n="title"]').textContent;
    window.dispatchEvent(new Event('resize')); return;
  }
  document.documentElement.lang = 'sv'; setupShell();
  window.MathJax?.typesetClear?.([shell.article]);
  shell.article.textContent = 'Laddar kompendiet…'; shell.article.setAttribute('aria-busy','true');
  try {
    [index, renderRust] = await Promise.all([loadIndex(), loadRenderer()]);
    if (version !== requestNumber) return;
    if (!shell.list.childElementCount) buildNavigation();
    const route = new URL(location.hash.slice(1), 'https://route.invalid');
    const file = decodeURIComponent(route.pathname.slice('/kompendium/'.length)) || index.home;
    const doc = index.documents.find(doc => doc.file === file);
    if (!doc) throw new Error('Kapitlet kunde inte hittas.');
    abort = new AbortController();
    const source = new URL('kompendium/' + file.split('/').map(encodeURIComponent).join('/'), base);
    const response = await fetch(source, {signal:abort.signal});
    if (!response.ok) throw new Error('Markdown-filen kunde inte laddas.');
    const markdown = await response.text();
    if (version !== requestNumber) return;
    const html = renderRust({ markdown, current:file, files:index.files, documents:index.documents.map(({file,title,aliases}) => ({file,title,aliases})) });
    shell.article.innerHTML = html; shell.article.removeAttribute('aria-busy');
    document.title = `${doc.title} · ECT-kompendium`;
    view.querySelector('.chapter-kicker').textContent = doc.group;
    view.querySelector('#markdown-source').href = source;
    for (const link of shell.list.querySelectorAll('a')) {
      if (link.dataset.file === file) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    const number = index.documents.indexOf(doc), pages = view.querySelector('.page-navigation'); pages.replaceChildren();
    for (const [label,chapter] of [['Föregående',index.documents[number-1]],['Nästa',index.documents[number+1]]]) {
      if (chapter) {const link = makeLink(chapter.title, routeFor(chapter.file)); const small = document.createElement('small'); small.textContent = label; link.prepend(small); pages.append(link);}
      else pages.append(document.createElement('span'));
    }
    shell.sidebar.classList.remove('is-open'); shell.toggle.setAttribute('aria-expanded','false');
    shell.article.focus({preventScroll:true}); window.scrollTo(0,0);
    await decorate(doc,version);
    if (version !== requestNumber) return;
    const heading = route.searchParams.get('section');
    if (heading) document.getElementById(heading)?.scrollIntoView({block:'start'});
  } catch (error) {
    if (version !== requestNumber || error.name === 'AbortError') return;
    shell.article.removeAttribute('aria-busy'); shell.article.replaceChildren();
    const message = document.createElement('p'); message.textContent = 'Kapitlet kunde inte visas. Kontrollera anslutningen och försök igen.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Försök igen'; retry.addEventListener('click',navigate);
    shell.article.append(message,retry); console.error('Kompendiet:',error);
  }
}
window.addEventListener('hashchange',navigate);
navigate();
