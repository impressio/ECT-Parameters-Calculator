// Move the original content into a native modal: SVG IDs and math stay intact.
export function createContentExpander(view) {
  const dialog = document.createElement('dialog');
  dialog.className = 'content-dialog';
  dialog.setAttribute('aria-labelledby', 'content-dialog-title');
  dialog.innerHTML = `<header class="content-dialog-toolbar"><h2 id="content-dialog-title"></h2><button type="button" aria-label="Stäng förstorad vy">Stäng ×</button></header><div class="content-dialog-body"><article class="expanded-content"></article></div>`;
  view.append(dialog);
  const title = dialog.querySelector('h2');
  const content = dialog.querySelector('.expanded-content');
  const closeButton = dialog.querySelector('button');
  let article, resizeObserver, moved;

  function restore() {
    if (!moved) return;
    const {node, placeholder, trigger} = moved; moved = undefined;
    placeholder.replaceWith(node);
    content.replaceChildren();
    document.documentElement.classList.remove('content-dialog-open');
    if (trigger?.isConnected) trigger.focus({preventScroll:true});
  }
  function close() {
    if (dialog.open) dialog.close();
    restore();
  }
  function open(node, label, trigger) {
    close();
    const bounds = node.getBoundingClientRect();
    const placeholder = document.createElement('div'); placeholder.className = 'expanded-placeholder';
    placeholder.style.width = `${bounds.width}px`; placeholder.style.height = `${bounds.height}px`;
    node.before(placeholder);
    moved = {node, placeholder, trigger};
    title.textContent = label; content.append(node);
    dialog.querySelector('.content-dialog-body').scrollTop = 0;
    dialog.querySelector('.content-dialog-body').scrollLeft = 0;
    dialog.showModal(); document.documentElement.classList.add('content-dialog-open'); closeButton.focus();
  }
  window.addEventListener('beforeprint', close);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', restore);
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
  });
  view.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !article?.contains(event.target)) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const button = event.target.closest('button.expand-content');
    const imageLink = event.target.closest('a.figure-link');
    if (imageLink) {
      const image = imageLink.querySelector('img');
      if (image) { event.preventDefault(); open(image, image.alt || 'Figur', imageLink); }
      return;
    }
    if (button) {
      event.preventDefault();
      const wrapper = button.parentElement;
      const node = wrapper.querySelector(button.dataset.kind === 'table' ? 'table' : 'svg');
      if (node) open(node, button.dataset.kind === 'table' ? 'Tabell' : 'Diagram', button);
      return;
    }
    if (event.target.closest('a,button,input,select,textarea') || window.getSelection()?.toString()) return;
    const table = event.target.closest('table');
    const wrapper = table?.closest('.table-scroll');
    if (wrapper) {
      event.preventDefault(); open(table, 'Tabell', wrapper.querySelector('button.expand-content')); return;
    }
    const svg = event.target.closest('.diagram-source svg');
    if (svg) { event.preventDefault(); open(svg, 'Diagram', svg.closest('.diagram-source').querySelector('button.expand-content')); }
  });
  function refresh() {
    if (!article?.isConnected) return;
    for (const wrapper of article.querySelectorAll('.table-scroll')) {
      wrapper.querySelector('button.expand-content').hidden = false;
    }
    // Mermaid lays out its labels at 16 px; scale the diagram so they match the chapter text (--fs-body).
    const fontSize = parseFloat(getComputedStyle(article).fontSize);
    for (const svg of [...article.querySelectorAll('.diagram-source svg'), ...content.querySelectorAll('svg')]) {
      const width = svg.viewBox.baseVal.width;
      if (width) svg.style.width = `${width * fontSize / 16}px`;
    }
    for (const wrapper of article.querySelectorAll('.diagram-source')) {
      wrapper.querySelector('button.expand-content').hidden = !wrapper.querySelector('svg');
    }
  }
  function enhance(nextArticle) {
    close(); resizeObserver?.disconnect(); article = nextArticle;
    for (const [selector, kind, label] of [
      ['.table-scroll','table','Visa tabell i full bredd'],
      ['.diagram-source','diagram','Visa diagram i full bredd']
    ]) {
      for (const wrapper of article.querySelectorAll(selector)) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'expand-content';
        button.dataset.kind = kind; button.textContent = label; button.hidden = true;
        if (kind === 'diagram') wrapper.querySelector('summary').after(button);
        else wrapper.prepend(button);
      }
    }
    for (const link of article.querySelectorAll('a.figure-link')) link.title = 'Visa figur i full bredd';
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(article);
    for (const node of article.querySelectorAll('.table-scroll, table')) resizeObserver.observe(node);
    refresh();
  }
  return {enhance, refresh, close};
}
