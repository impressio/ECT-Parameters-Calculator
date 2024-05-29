import { loadRenderer } from './wasm-loader.js';
import { createContentExpander } from './expand-content.js';

const base = new URL('../../', import.meta.url);
const view = document.getElementById('compendium-view');
const calculator = document.getElementById('calculator-view');
const stylesheet = document.getElementById('compendium-styles');
const routeFor = (file, section = '') => '#/kompendium/' + file.split('/').map(encodeURIComponent).join('/') + (section ? '?section=' + encodeURIComponent(section) : '');
let indexPromise, index, renderRust, shell, requestNumber = 0, abort, calculatorLanguage;
// Rendered chapters (HTML) by file, so returning to a chapter or opening a prefetched one needs neither a
// download nor a new render; the link metadata for the renderer is built once per index.
const rendered = new Map();
let linkData, searchText, searchPromise;
const mathReady = new Promise(resolve => {
  if (window.MathJax?.startup?.promise) resolve(window.MathJax.startup.promise);
  else {
    const script = document.getElementById('MathJax-script');
    script.addEventListener('load', () => resolve(window.MathJax?.startup?.promise));
    script.addEventListener('error', () => resolve(null));
  }
});
let mermaidPromise;
// Diagramtextens storlek (px); Mermaid mäter etiketterna i den storleken.
const DIAGRAM_FONT = 16;
// Krymper diagramtext som inte får plats i sina rutor. Mermaid mäter etiketterna när diagrammet ritas, men Chrome och
// Edge på Android kan visa texten större än när den mättes, så att den sticker ut ur rutorna. All text i diagrammet
// får samma storlek, den största som får plats i alla rutor.
const fitLabels = container => {
  const range = document.createRange();
  const labels = [...container.querySelectorAll('svg foreignObject')].filter(label => label.firstElementChild);
  const fits = () => labels.every(label => {
    range.selectNodeContents(label.firstElementChild);
    const box = label.getBoundingClientRect(), text = range.getBoundingClientRect();
    return text.width <= box.width + 1 && text.height <= box.height + 1;
  });
  const apply = size => { for (const label of labels) for (const element of label.querySelectorAll('*')) element.style.setProperty('font-size', `${size}px`, 'important'); };
  if (fits()) return;
  // Största storlek som får plats i alla rutor (intervallhalvering mellan 6 px och normal storlek).
  let low = 6, high = DIAGRAM_FONT;
  for (let step = 0; step < 7; step++) {
    const middle = (low + high) / 2;
    apply(middle);
    if (fits()) low = middle; else high = middle;
  }
  apply(low);
};
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
    <header class="topbar"><a class="brand" href="#/kompendium/"><img src="assets/icons/favicon.ico" class="brand-logo" alt=""><span>ECT-kompendium</span></a>
    <nav aria-label="Huvudnavigation"><a class="compendium-link" href="?lang=sv">Till kalkylatorn</a><button type="button" id="chapter-toggle" aria-expanded="false" aria-controls="chapter-nav">Kapitel</button></nav></header>
    <div class="reading-layout"><aside id="chapter-nav" aria-label="Kapitelnavigation">
    <label for="chapter-search">Sök i kompendiet</label><input id="chapter-search" type="search" placeholder="Sök ämne eller begrepp…" autocomplete="off">
    <p id="search-status" role="status"></p><ul id="search-results" hidden></ul><nav id="chapter-list" aria-label="Kapitel"></nav></aside>
    <main id="innehall" class="reading-content"><p class="chapter-kicker"></p><article tabindex="-1" aria-live="polite"></article>
    <nav class="page-navigation" aria-label="Föregående och nästa kapitel"></nav></main></div>`;
  shell = {
    article: view.querySelector('article'), list: view.querySelector('#chapter-list'), sidebar: view.querySelector('#chapter-nav'),
    toggle: view.querySelector('#chapter-toggle'), search: view.querySelector('#chapter-search'), results: view.querySelector('#search-results'), status: view.querySelector('#search-status')
  };
  shell.expander = createContentExpander(view);
  shell.toggle.addEventListener('click', () => {
    const open = shell.toggle.getAttribute('aria-expanded') !== 'true';
    shell.toggle.setAttribute('aria-expanded', String(open)); shell.sidebar.classList.toggle('is-open', open);
  });
  // Close the chapter list (narrow screens) with Escape or a click outside it
  const closeList = () => { shell.sidebar.classList.remove('is-open'); shell.toggle.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && shell.sidebar.classList.contains('is-open')) { closeList(); shell.toggle.focus(); } });
  document.addEventListener('pointerdown', event => {
    if (shell.sidebar.classList.contains('is-open') && !shell.sidebar.contains(event.target) && !shell.toggle.contains(event.target)) closeList();
  });
  view.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault(); shell.article.focus(); shell.article.scrollIntoView({block:'start'});
  });
  // Search: every word of the query must occur in the chapter (title and text). Chapters where each word starts
  // a word come first; chapters where a word only occurs inside other words (e.g. "mv" in "omvårdnad") are listed
  // separately. A word with a capital letter (mV, mA, EEG) is matched case-sensitively; otherwise case is ignored.
  shell.search.addEventListener('input', async () => {
    const query = shell.search.value;
    const terms = query.trim().split(/\s+/).filter(Boolean)
      .map(term => ({ text: term, exact: term !== term.toLocaleLowerCase('sv'), lower: term.toLocaleLowerCase('sv') }));
    shell.results.hidden = !terms.length; shell.list.hidden = !!terms.length; shell.results.replaceChildren();
    if (!terms.length) { shell.status.textContent = ''; return; }
    // The chapter texts are downloaded on the first search only, then lowercased once
    if (!searchText) {
      shell.status.textContent = 'Laddar söktexten…';
      searchPromise ||= Promise.all([loadIndex(), fetch(new URL('assets/kompendium/search.json', base)).then(response => {
        if (!response.ok) throw new Error('Söktexten kunde inte laddas.');
        return response.json();
      })]).then(([loaded, texts]) => {
        index = loaded;
        return loaded.documents.map((doc, i) => { const raw = `${doc.title} ${texts[i] || ''}`; return { raw, lower: raw.toLocaleLowerCase('sv') }; });
      }).catch(error => { searchPromise = undefined; throw error; });
      try { searchText = await searchPromise; }
      catch { if (shell.search.value === query) shell.status.textContent = 'Sökningen kunde inte laddas. Försök igen.'; return; }
      if (shell.search.value !== query) return;   // a newer keystroke runs its own search
    }
    // 2: the word starts a word somewhere in the text, 1: it only occurs inside words, 0: not found
    const wordChar = /[\p{L}\p{N}]/u;
    const match = (doc, term) => {
      const text = term.exact ? doc.raw : doc.lower, needle = term.exact ? term.text : term.lower;
      let found = 0;
      for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
        if (at === 0 || !wordChar.test(text[at - 1])) return 2;
        found = 1;
      }
      return found;
    };
    const starts = [], inside = [];
    index.documents.forEach((doc, i) => {
      const levels = terms.map(term => match(searchText[i], term));
      if (levels.every(level => level === 2)) starts.push(doc);
      else if (levels.every(level => level > 0)) inside.push(doc);
    });
    const list = (docs) => { for (const hit of docs) { const li = document.createElement('li'); li.append(makeLink(hit.title, routeFor(hit.file))); shell.results.append(li); } };
    list(starts);
    if (inside.length) {
      const head = document.createElement('li'); head.className = 'search-group'; head.textContent = 'Även inuti ord'; shell.results.append(head);
      list(inside);
    }
    shell.status.textContent = `${starts.length + inside.length} kapitel hittades` + (inside.length ? `, varav ${inside.length} bara inuti andra ord` : '');
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
  for (const checkbox of article.querySelectorAll('input[type="checkbox"]')) { const item = checkbox.closest('li'); item?.classList.add('task-list-item'); item?.parentElement.classList.add('task-list'); }
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
          themeVariables:{fontSize:`${DIAGRAM_FONT}px`,fontFamily},
          // max-height stänger av Chromes textförstoring (font boosting) i etiketterna; den förstorar bara block utan angiven höjd.
          themeCSS:`text, foreignObject * { font-family:${fontFamily} !important; font-size:${DIAGRAM_FONT}px !important; } foreignObject * { max-height:1000000px; }`,
          // Sekvensdiagrammens deltagarrutor visas bara överst, inte en gång till nederst.
          sequence:{mirrorActors:false,actorFontFamily:fontFamily,actorFontSize:DIAGRAM_FONT,messageFontFamily:fontFamily,messageFontSize:DIAGRAM_FONT,noteFontFamily:fontFamily,noteFontSize:DIAGRAM_FONT}
        }); return mermaid;
      }).catch(error => {mermaidPromise = undefined; throw error;});
      const mermaid = await mermaidPromise;
      // Mermaid mäter texten när diagrammet ritas; webbfonten ska vara laddad så att rutorna mäts med rätt font.
      const font = getComputedStyle(article).fontFamily;
      await Promise.all(['400','600'].map(weight => document.fonts.load(`${weight} ${DIAGRAM_FONT}px ${font}`))).catch(() => {});
      await document.fonts.ready;
      if (version !== requestNumber) return;
      for (const node of diagrams) {
        const source = node.textContent;
        try { await mermaid.run({nodes:[node]}); fitLabels(node); }
        catch { node.textContent = source; node.classList.remove('mermaid'); }
        if (version !== requestNumber) return;
      }
    } catch { /* Diagramkällan förblir läsbar utan nätanslutning. */ }
  }
  shell.expander.refresh();
  // Typeset only chapters with formulas ($…$, $$…$$, \(…\) or \[…\]); most chapters have none
  if (!/\$|\\\(|\\\[/.test(article.textContent)) return;
  await mathReady;
  if (version === requestNumber && window.MathJax?.typesetPromise) await window.MathJax.typesetPromise([article]);
  if (version === requestNumber) shell.expander.refresh();
}
// Fetch and render a chapter once; later calls reuse the result. A failed fetch is not cached.
function renderChapter(file, signal) {
  if (!rendered.has(file)) {
    linkData ||= { files: index.files, documents: index.documents.map(({file, title, aliases}) => ({file, title, aliases})) };
    const source = new URL('kompendium/' + file.split('/').map(encodeURIComponent).join('/'), base);
    rendered.set(file, fetch(source, {signal}).then(response => {
      if (!response.ok) throw new Error('Markdown-filen kunde inte laddas.');
      return response.text();
    }).then(markdown => renderRust({ markdown, current: file, ...linkData }))
      .catch(error => { rendered.delete(file); throw error; }));
  }
  return rendered.get(file);
}
// Prepare the previous and next chapter while the browser is idle, for quick page-by-page reading
function prefetchNeighbors(number) {
  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 500));
  idle(() => { for (const chapter of [index.documents[number + 1], index.documents[number - 1]]) if (chapter) renderChapter(chapter.file).catch(() => {}); });
}
// The page footer is shared with the calculator: Swedish in the compendium, the calculator's language otherwise
let swedish;
async function localizeFooter(active) {
  const strings = active ? (swedish ??= await fetch(new URL('assets/i18n/sv.json', base)).then(r => r.json()).catch(() => null)) : window.translations;
  if (!strings || active !== !view.hidden) return;
  for (const element of document.querySelectorAll('footer.footer [data-i18n]')) {
    const text = strings[element.dataset.i18n]; if (text) element.innerHTML = text;
  }
}
document.addEventListener('translations-loaded', () => { if (!view.hidden) localizeFooter(true); });
async function navigate() {
  const version = ++requestNumber; abort?.abort();
  shell?.expander.close();
  const active = location.hash === '#/kompendium' || location.hash.startsWith('#/kompendium/');
  if (active && !calculator.hidden) calculatorLanguage = document.documentElement.lang;
  calculator.hidden = active; view.hidden = !active; stylesheet.disabled = !active;
  localizeFooter(active);
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
    const html = await renderChapter(file, abort.signal);
    if (version !== requestNumber) return;
    shell.article.innerHTML = html; shell.article.removeAttribute('aria-busy');
    document.title = `${doc.title} · ECT-kompendium`;
    view.querySelector('.chapter-kicker').textContent = doc.group;
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
    prefetchNeighbors(number);
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
