// The router list on a Grid panel's Sources or Destinations tab: Find, click, Shift-click, Cmd-click and Add. Only
// the rows in view have nodes, since a router can have thousands. Rules are editorgridrules.js.
import { el } from './core.js';
import { btn } from './formbits.js';
import { axisSpan, spanMax, OVER } from './gridpanelwindow.js';
import { routerRows, findRows, selectRows, addItems } from './editorgridrules.js';

const ROW_REM = 2; // keep in step with .sode-rlist__row in panels.css

// o: { key, what, edge(), router(), rights(), kind, off(), readOnly(), set(edge) }.
export function createRouterList(o) {
  const { key, what } = o;
  const find = el('input', 'pb-input');
  find.id = `ed-${key}-find`;
  find.type = 'search';
  find.autocomplete = 'off';
  find.placeholder = 'Find: name, 12 or 101-140';
  find.setAttribute('aria-label', `Find ${what}s on the router`);
  find.dataset.pbTip = 'Numbers are as shown. Enter selects every row shown.';
  const shownNote = el('p', 'sode__hint');
  shownNote.id = `ed-${key}-shown`;
  const box = el('div', 'sode-rlist');
  box.id = `ed-${key}-router`;
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-multiselectable', 'true');
  box.setAttribute('aria-label', `${what[0].toUpperCase()}${what.slice(1)}s on the router`);
  const field = el('div', 'sode-rlist__field');
  box.append(field);
  const selNote = el('p', 'sode__hint');
  selNote.id = `ed-${key}-selected`;
  selNote.setAttribute('role', 'status');
  const all = btn('pb-btn--outline pb-btn--sm', 'Select shown', () => selectShown());
  all.id = `ed-${key}-selectshown`;
  const none = btn('pb-btn--outline pb-btn--sm', 'Select none', () => setSel({ selected: new Set(), anchor: null }));
  none.id = `ed-${key}-selectnone`;
  const add = btn('pb-btn--ok pb-btn--sm', 'Add', () => {
    o.set(addItems(o.edge(), o.router(), sel.selected));
    setSel({ selected: new Set(), anchor: null });
  });
  add.id = `ed-${key}-add`;
  add.dataset.pbTip = `Adds the selected ${what}s at the end of the panel's list, in router order. ${what[0].toUpperCase()}${what.slice(1)}s it has are skipped.`;
  const node = el('div', 'sode-rlist__wrap', find, shownNote, box, el('div', 'sode-edge__acts', add, all, none), selNote);

  let sel = { selected: new Set(), anchor: null };
  let text = '';
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
  }

  function makeRow() {
    const num = document.createTextNode('');
    const name = document.createTextNode('');
    const mark = document.createTextNode('');
    const r = el('div', 'sode-rlist__row', el('span', 'sode-pages__num', num), el('span', 'sode-pages__name', name), el('span', 'sode__hint', mark));
    r.setAttribute('role', 'option');
    r.hidden = true;
    texts.set(r, { num, name, mark });
    field.append(r);
    return r;
  }

  // Pooled rows move from item to item, so everything a row shows is set here from state.
  function drawRows() {
    rowPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * ROW_REM || rowPx;
    const view = box.clientHeight;
    field.style.setProperty('--sode-rows', String(shown.length));
    if (!view || !rowPx) return;
    const axis = { n: shown.length, pins: 0, size: rowPx, head: 0, offset: box.scrollTop, view, over: OVER };
    const need = spanMax(axis);
    while (pool.length < need) pool.push(makeRow());
    const { lo, hi } = axisSpan(axis);
    const off = o.off();
    pool.forEach((r, k) => {
      const i = lo + k;
      const row = i < hi ? shown[i] : null;
      r.hidden = !row;
      if (!row) return r.removeAttribute('data-n');
      r.dataset.n = String(row.n);
      r.style.setProperty('--sode-i', String(i));
      r.setAttribute('aria-selected', String(sel.selected.has(row.n)));
      r.classList.toggle('is-in', row.in);
      const t = texts.get(r);
      setText(t.num, String(row.n + off));
      setText(t.name, row.name || `${what} ${row.n + off}`);
      setText(t.mark, row.in ? 'in panel' : '');
    });
  }
  const setText = (t, s) => t.data !== s && (t.data = s);

  function drawState() {
    const ro = o.readOnly();
    shownNote.textContent = text ? `${shown.length} of ${rows.length} shown.` : `${rows.length} on the router.`;
    const has = new Set(shown.map((r) => r.n));
    const inPanel = new Set(rows.filter((r) => r.in).map((r) => r.n));
    const hidden = [...sel.selected].filter((n) => !has.has(n)).length;
    const fresh = [...sel.selected].filter((n) => !inPanel.has(n)).length;
    selNote.textContent = sel.selected.size
      ? `${sel.selected.size} selected${hidden ? `, ${hidden} not shown` : ''}${fresh < sel.selected.size ? `, ${sel.selected.size - fresh} in panel` : ''}.`
      : '';
    add.textContent = fresh ? `Add ${fresh}` : 'Add';
    add.disabled = ro || !fresh;
    all.disabled = !shown.length;
    none.disabled = !sel.selected.size;
  }

  function paint() {
    compute();
    drawRows();
    drawState();
  }

  function setSel(next) {
    sel = next;
    drawRows();
    drawState();
  }

  function selectShown() {
    setSel({ selected: new Set([...sel.selected, ...shown.map((r) => r.n)]), anchor: sel.anchor });
  }

  find.addEventListener('input', () => {
    text = find.value;
    box.scrollTop = 0;
    paint();
  });
  find.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    selectShown();
  });
  // Shift-click would also mark the page's text.
  box.addEventListener('mousedown', (e) => e.shiftKey && e.preventDefault());
  box.addEventListener('click', (e) => {
    const r = e.target.closest('[data-n]');
    if (!r) return;
    setSel(selectRows(sel, shown, Number(r.dataset.n), { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey }));
  });
  box.addEventListener('scroll', drawRows, { passive: true });
  // The tab is hidden until opened, and a hidden list has no height to fill.
  new ResizeObserver(drawRows).observe(box);

  return { node, paint };
}
