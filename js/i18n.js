/* i18n.js - shared text lookup for the simulations:
 * the active translation (window.translations, loaded by main.js), else English,
 * never the bare key (empty until loaded). 'translations-loaded' is dispatched on
 * document whenever texts change, so canvas and generated content can redraw. */
(function () {
  let fallback = {};
  fetch('assets/i18n/en.json', { cache: 'no-cache' })
    .then(response => response.json())
    .then(data => { fallback = data; document.dispatchEvent(new Event('translations-loaded')); })
    .catch(() => {});
  window.ectT = function (key, vars) {
    let text = (window.translations && window.translations[key]) || fallback[key] || '';
    for (const [name, value] of Object.entries(vars || {})) text = text.split(`{${name}}`).join(value);
    return text;
  };
})();
