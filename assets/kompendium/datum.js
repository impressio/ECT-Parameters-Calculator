/* datum.js - Swedish date picker for the compendium's forms.
 * Browsers draw <input type="date"> in their own UI language and size (e.g. "Clear", mm/dd/yyyy), which a page
 * cannot change; this picker is a text field for ÅÅÅÅ-MM-DD plus a calendar in Swedish with the week starting on
 * Monday. The field's value stays yyyy-mm-dd, so forms read it as before.
 * Keyboard: arrows move a day or a week, PageUp/PageDown a month, Home/End to the start or end of the week,
 * Enter or space chooses, Escape closes and returns focus to the field. */
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
const pad = n => String(n).padStart(2, '0');
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = text => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return iso(date) === text ? date : null;
};
const weekday = date => (date.getDay() + 6) % 7;   // 0 = måndag
export const todayIso = () => iso(new Date());
// Error message for a typed date, or '' when it is empty or valid
export const dateError = text => !text || fromIso(text) ? '' : 'Ange datumet som ÅÅÅÅ-MM-DD, till exempel 2026-01-01.';

let counter = 0;
export function datePicker(input, { label = 'datum' } = {}) {
  const id = `datum-${++counter}`;
  Object.assign(input, { type: 'text', inputMode: 'numeric', placeholder: 'ÅÅÅÅ-MM-DD', maxLength: 10, autocomplete: 'off' });
  input.classList.add('datum-input');
  const wrapper = document.createElement('span'); wrapper.className = 'datum';
  input.replaceWith(wrapper);
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'datum-open', title: `Välj ${label} i kalendern` });
  button.setAttribute('aria-label', `Välj ${label} i kalendern`);
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', id);
  button.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="13.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15M6.5 2v4M13.5 2v4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';
  const panel = document.createElement('div');
  Object.assign(panel, { id, className: 'datum-panel', hidden: true });
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', `Välj ${label}`);
  panel.innerHTML = `<div class="datum-head"><button type="button" class="datum-prev" aria-label="Föregående månad">‹</button>
    <p class="datum-month" aria-live="polite"></p><button type="button" class="datum-next" aria-label="Nästa månad">›</button></div>
    <table class="datum-grid" role="grid"><thead><tr>${WEEKDAYS.map(day => `<th scope="col" abbr="${day}">${day.slice(0, 2)}</th>`).join('')}</tr></thead><tbody></tbody></table>
    <div class="datum-foot"><button type="button" class="datum-today">Idag</button><button type="button" class="datum-clear">Rensa</button><button type="button" class="datum-close">Stäng</button></div>`;
  wrapper.append(input, button, panel);

  let shown = new Date(), focused = new Date();
  const title = panel.querySelector('.datum-month'), body = panel.querySelector('tbody');
  function render() {
    title.textContent = `${MONTHS[shown.getMonth()]} ${shown.getFullYear()}`;
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - weekday(first));
    const chosen = input.value, today = todayIso();
    body.replaceChildren();
    for (let week = 0; week < 6; week++) {
      const row = document.createElement('tr');
      for (let day = 0; day < 7; day++) {
        const date = new Date(start); date.setDate(start.getDate() + week * 7 + day);
        const cell = document.createElement('td'), value = iso(date);
        const choose = Object.assign(document.createElement('button'), { type: 'button', textContent: date.getDate(), tabIndex: value === iso(focused) ? 0 : -1 });
        choose.dataset.date = value;
        choose.setAttribute('aria-label', `${WEEKDAYS[weekday(date)]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`);
        if (date.getMonth() !== shown.getMonth()) choose.classList.add('datum-other');
        if (value === today) choose.setAttribute('aria-current', 'date');
        if (value === chosen) choose.setAttribute('aria-pressed', 'true');
        cell.append(choose); row.append(cell);
      }
      body.append(row);
    }
  }
  const focusDay = () => body.querySelector(`[data-date="${iso(focused)}"]`)?.focus();
  const move = date => { focused = date; if (date.getMonth() !== shown.getMonth() || date.getFullYear() !== shown.getFullYear()) shown = new Date(date.getFullYear(), date.getMonth(), 1); render(); focusDay(); };
  function open() {
    focused = fromIso(input.value) || new Date();
    shown = new Date(focused.getFullYear(), focused.getMonth(), 1);
    render(); panel.hidden = false; button.setAttribute('aria-expanded', 'true'); focusDay();
  }
  function close(returnFocus = true) {
    if (panel.hidden) return;
    panel.hidden = true; button.setAttribute('aria-expanded', 'false');
    if (returnFocus) input.focus();
  }
  const choose = value => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); close(); };

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('.datum-prev').addEventListener('click', () => { shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1); focused = new Date(shown); render(); });
  panel.querySelector('.datum-next').addEventListener('click', () => { shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1); focused = new Date(shown); render(); });
  panel.querySelector('.datum-today').addEventListener('click', () => choose(todayIso()));
  panel.querySelector('.datum-clear').addEventListener('click', () => choose(''));
  panel.querySelector('.datum-close').addEventListener('click', () => close());
  body.addEventListener('click', event => { const day = event.target.closest('[data-date]'); if (day) choose(day.dataset.date); });
  body.addEventListener('keydown', event => {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const date = new Date(focused);
    if (event.key in steps) date.setDate(date.getDate() + steps[event.key]);
    else if (event.key === 'PageUp') date.setMonth(date.getMonth() - 1);
    else if (event.key === 'PageDown') date.setMonth(date.getMonth() + 1);
    else if (event.key === 'Home') date.setDate(date.getDate() - weekday(date));
    else if (event.key === 'End') date.setDate(date.getDate() + 6 - weekday(date));
    else return;
    event.preventDefault(); move(date);
  });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(false); });
  // Typing: digits only, hyphens added after the year and the month
  input.addEventListener('input', event => {
    if (event.inputType?.startsWith('delete')) return;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = digits.length > 6 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
  });
  return input;
}
