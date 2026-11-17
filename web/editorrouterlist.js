// Add from the router, under a Grid panel's Sources or Destinations list: the router's items the panel does not have,
// narrowed by Find. One highlight, moved by the arrows; hover does not move it. Only the rows in view have nodes,
// since a router can have thousands. Rules are editorgridrules.js.
import { el, icon } from './core.js';
import { btn } from './formbits.js';
import { axisSpan, spanMax, OVER } from './gridpanelwindow.js';
import { routerRows, findRows, addItems } from './editorgridrules.js';

const ROW_REM = 2; // keep in step with .sode-rlist__row in panels.css

// o: { key, what, edge(), router(), rights(), kind, off(), readOnly(), set(edge) }.
export function createRouterList(o) {
  const { key, what } = o;
  const find = el('input', 'pb-input');
  find.id = `ed-${key}-find`;
  find.type = 'search';
  find.autocomplete = 'off';
  find.spellcheck = false;
  find.placeholder = 'Find: name, 12 or 101-140';
  find.setAttribute('role', 'combobox');
  find.setAttribute('aria-expanded', 'true');
  find.setAttribute('aria-controls', `ed-${key}-router`);
  find.setAttribute('aria-label', `Find ${what}s on the router`);
  find.dataset.pbTip = 'Enter adds the highlighted one, Shift+Enter adds every match. Up and Down move the highlight.';
  const count = el('span', 'sode-edge__count');
  count.id = `ed-${key}-shown`;
  const addAll = btn('pb-btn--outline pb-btn--sm', '', () => addMatches());
  addAll.id = `ed-${key}-add`;
  addAll.dataset.pbTip = `Adds every match at the end of the list, in router order (Shift+Enter).`;
  const box = el('div', 'sode-rlist');
  box.id = `ed-${key}-router`;
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', `${what[0].toUpperCase()}${what.slice(1)}s on the router`);
  const field = el('div', 'sode-rlist__field');
  box.append(field);
  const search = el('div', 'pb-input-group sode-rlist__find', find, el('span', 'pb-input-group__addon', icon('search')));
  const node = el(
    'section',
    'sode-edge__part sode-edge__add',
    el('div', 'sode-edge__head', el('h3', 'sode-edge__h3', 'Add from the router', count)),
    el('div', 'sode-rlist__bar', search, addAll),
    box,
  );

  let text = '';
  let hi = 0; // the highlighted row, an index in shown
  let rows = [];
  let shown = [];
  let rowsKey = [];
  let shownKey = [];
  const pool = [];
  const texts = new WeakMap(); // row -> its Text nodes
  let rowPx = 0;

  function compute() {
    const now = [o.router(), o.edge(), o.rights()];
    if (!now.every((x, i) => x === rowsKey[i])) {
      rowsKey = now;
      rows = routerRows(now[0], now[1], now[2], o.kind);
    }
    const s = [rows, text, o.off()];
    if (!s.every((x, i) => x === shownKey[i])) {
      shownKey = s;
      shown = findRows(rows, text, s[2]);
    }
    // An add takes the row out, so the next one slides into the highlight.
    hi = Math.max(0, Math.min(hi, shown.length - 1));
  }

  function makeRow() {
    const num = document.createTextNode('');
    const name = document.createTextNode('');
    const r = el('div', 'sode-rlist__row', icon('plus'), el('span', 'sode-pages__num', num), el('span', 'sode-pages__name', name));
    r.setAttribute('role', 'option');
    r.hidden = true;
    texts.set(r, { num, name });
    field.append(r);
    return r;
  }

  // Pooled rows move from item to item, so everything a row shows is set here from state.
  function drawRows() {
    rowPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * ROW_REM || rowPx;
    const view = box.clientHeight;
    field.style.setProperty('--sode-rows', String(shown.length));
    find.removeAttribute('aria-activedescendant');
    if (!view || !rowPx) return;
    const axis = { n: shown.length, pins: 0, size: rowPx, head: 0, offset: box.scrollTop, view, over: OVER };
    const need = spanMax(axis);
    while (pool.length < need) pool.push(makeRow());
    const { lo, hi: end } = axisSpan(axis);
    const off = o.off();
    pool.forEach((r, k) => {
      const i = lo + k;
      const row = i < end ? shown[i] : null;
      r.hidden = !row;
      if (!row) return r.removeAttribute('data-n');
      r.dataset.n = String(row.n);
      r.id = `ed-${key}-opt-${row.n}`;
      r.style.setProperty('--sode-i', String(i));
      r.setAttribute('aria-selected', String(i === hi));
      if (i === hi) find.setAttribute('aria-activedescendant', r.id);
      const t = texts.get(r);
      setText(t.num, String(row.n + off));
      setText(t.name, row.name || `${what} ${row.n + off}`);
    });
  }
  const setText = (t, s) => t.data !== s && (t.data = s);

  function drawState() {
    count.textContent = text ? `${shown.length} of ${rows.length}` : String(rows.length);
    addAll.hidden = !text || !shown.length;
    addAll.textContent = `Add all ${shown.length}`;
    addAll.disabled = o.readOnly();
  }

  function paint() {
    compute();
    drawRows();
    drawState();
  }

  const add = (ns) => o.readOnly() || o.set(addItems(o.edge(), o.router(), new Set(ns)));
  function addMatches() {
    if (text && shown.length) add(shown.map((r) => r.n));
  }

  // Scrolls the least that shows the highlighted row.
  function reveal() {
    const top = hi * rowPx;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + rowPx > box.scrollTop + box.clientHeight) box.scrollTop = top + rowPx - box.clientHeight;
    drawRows();
  }

  find.addEventListener('input', () => {
    text = find.value;
    hi = 0;
    box.scrollTop = 0;
    paint();
  });
  find.addEventListener('keydown', (e) => {
    if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key];
    if (step && shown.length) {
      e.preventDefault();
      hi = Math.max(0, Math.min(shown.length - 1, hi + step));
      return reveal();
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) return addMatches();
    if (shown[hi]) add([shown[hi].n]);
  });
  box.addEventListener('click', (e) => {
    const r = e.target.closest('[data-n]');
    if (!r) return;
    hi = Number(r.style.getPropertyValue('--sode-i')) || 0;
    add([Number(r.dataset.n)]);
  });
  box.addEventListener('scroll', drawRows, { passive: true });
  // A list with no height yet (a Buttons panel, or before layout) draws nothing until it has one.
  new ResizeObserver(drawRows).observe(box);

  return { node, paint };
}
