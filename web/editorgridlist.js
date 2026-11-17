// A Grid panel's Sources or Destinations list in the editor: the panel's items in list order, each with a grip, Pin,
// Move and Remove. Add from the router is under it (editorrouterlist.js). Pin, Move and Remove act on every selected
// row; the Cell tab sets the selected rows' artwork (editorcell.js). Rules are editorgridrules.js; each edit is one
// ed.setFields of the edge.
import { el, icon } from './core.js';
import { axisSpan, OVER } from './gridpanelwindow.js';
import { btn } from './formbits.js';
import { createOrderedList } from './orderedlist.js';
import { createRouterList } from './editorrouterlist.js';
import { isGridPanel } from './gridpaneledges.js';
import { myRights, onMyRights } from './editorrights.js';
import { artNode } from './panelview.js';
import { edgeRows, moveRow, clearEdge, followRouter, selectRows, moveRows, stepRows, pinItems, removeItems, edgeListKey, PINS_MAX } from './editorgridrules.js';

const FIRST = 30; // rows drawn before the list has a height
const NONE = () => ({ selected: new Set(), anchor: null });

// key is the panel field and the /names list ('sources' or 'destinations'). rights is the Rights key, what the item
// word, side the edge of the grid it is drawn on. onPick runs when the selection changes.
export function createEdgeList(ed, { key, rights, what, side, onPick }) {
  const edge = () => ed.fields()[key];
  const router = () => ed.routerNames()?.[key] || [];
  const set = (next) => next !== edge() && ed.setFields({ [key]: next });
  const Whats = `${what[0].toUpperCase()}${what.slice(1)}s`;
  const plural = (n) => `${n} ${what}${n === 1 ? '' : 's'}`;

  const count = el('span', 'sode-edge__count');
  const state = el('p', 'sode__hint');
  state.id = `ed-${key}-state`;
  const outside = el('p', 'sode__hint');
  outside.id = `ed-${key}-outside`;
  const clear = btn('pb-btn--outline pb-btn--sm', 'Clear', () => set(clearEdge(edge(), myRights(), rights)));
  clear.id = `ed-${key}-clear`;
  const all = btn('pb-btn--outline pb-btn--sm', 'All (follow router)', () => set(followRouter(edge())));
  all.id = `ed-${key}-all`;
  all.dataset.pbTip = `Shows every ${what} the router has, in router order, and the ones the router adds later.`;
  const list = el('ol', 'sode-pages__list sode-edge__list');
  list.id = `ed-${key}-list`;
  list.tabIndex = 0;
  list.setAttribute('aria-label', `${Whats} on the panel`);
  const routerList = createRouterList({
    key,
    what,
    kind: rights,
    edge,
    router,
    rights: myRights,
    off: () => ed.routerNames()?.numberOffset || 0,
    readOnly: () => ed.readOnly(),
    set,
  });

  // The selection: router numbers, so it stays through moves and edits. cur is the keyboard's row.
  let sel = NONE();
  let cur = null;
  const many = () => sel.selected;

  const selNote = el('p', 'sode__hint');
  selNote.id = `ed-${key}-sel`;
  selNote.setAttribute('role', 'status');
  const selBtn = (id, text, tip, fn) => {
    const b = btn('pb-btn--outline pb-btn--sm', text, fn);
    b.id = `ed-${key}-sel-${id}`;
    if (tip) b.dataset.pbTip = tip;
    return b;
  };
  const moveBtn = (id, name, tip, dir) => {
    const b = btn('pb-btn--ghost pb-btn--icon pb-btn--sm', '', () => moveSel(dir));
    b.append(icon(name));
    b.id = `ed-${key}-sel-${id}`;
    b.setAttribute('aria-label', tip);
    b.dataset.pbTip = tip;
    return b;
  };
  const pinSel = (on) => set(pinItems(edge(), router(), myRights(), rights, many(), on));
  const removeSel = () => {
    set(removeItems(edge(), many()));
    setSel(NONE());
  };
  const selPin = selBtn('pin', 'Pin', `Pins the selected rows in list order, to at most ${PINS_MAX}.`, () => pinSel(true));
  const selUnpin = selBtn('unpin', 'Unpin', '', () => pinSel(false));
  const selRemove = selBtn('remove', 'Remove', 'Takes the selected rows off the panel.', removeSel);
  const selAll = selBtn('all', 'Select all', 'Ctrl+A in the list.', () => setSel({ selected: new Set(shown.map((r) => r.n)), anchor: sel.anchor }));
  const selNone = selBtn('none', 'Select none', 'Esc in the list.', () => setSel(NONE()));
  const moves = [
    moveBtn('top', 'arrow-up-to-line', 'Move to the top (Alt+Home)', 'top'),
    moveBtn('up', 'arrow-up', 'Move up (Alt+Up or Cmd+Shift+Up)', 'up'),
    moveBtn('down', 'arrow-down', 'Move down (Alt+Down or Cmd+Shift+Down)', 'down'),
    moveBtn('end', 'arrow-down-to-line', 'Move to the end (Alt+End)', 'end'),
  ];
  const head = el(
    'div',
    'sode-edge__head',
    el('h2', 'sode-edge__h', Whats, count),
    el('span', 'sode__hint', side),
    el('span', 'sode-panels__spacer'),
    el('span', 'sode-edge__group', all, clear),
  );
  const acts = el(
    'div',
    'sode-edge__acts',
    selAll,
    selNone,
    el('span', 'sode-edge__sep'),
    selPin,
    selUnpin,
    el('span', 'sode-edge__group', ...moves),
    selRemove,
  );
  const add = el('section', 'sode-edge__add', el('h3', 'sode-side__h', 'Add from the router'), routerList.node);
  const node = el('section', 'sode-edge', head, state, outside, acts, selNote, list, add);
  node.id = `ed-${key}-col`;

  let shown = [];
  let at = new Map(); // router number -> index in shown
  // Pin and Remove on a row in a selection of several act on the whole selection, as Move does.
  const inMany = (n) => many().has(n) && many().size > 1;
  const rows = createOrderedList({
    rowClass: 'sode-pages__row sode-edge__row',
    toolsClass: 'sode-pages__tools',
    move: (from, to) => {
      const n = shown[from].n;
      if (inMany(n)) return moveSel(to < from ? 'up' : 'down');
      set(moveRow(edge(), router(), myRights(), rights, from, to));
    },
    // Dragging a selected row drags the selection; any other row goes alone.
    drop: (from, over, after) => {
      const ns = dragSet(from);
      const before = after ? (shown[over + 1]?.n ?? null) : shown[over].n;
      set(moveRows(edge(), router(), myRights(), rights, ns, before));
    },
    grip: (i) => {
      const ns = dragSet(i);
      return ns.size > 1 ? plural(ns.size) : shown[i].name || `${what} ${shown[i].n + shownOff}`;
    },
    dragging: (i) => {
      dragged = i < 0 ? null : dragSet(i);
      list.classList.toggle('is-dragging', !!dragged);
      for (const li of made.values()) markRow(li);
    },
    remove: (i) => {
      const n = shown[i].n;
      set(removeItems(edge(), inMany(n) ? many() : new Set([n])));
      if (inMany(n)) setSel(NONE());
    },
    removeTip: 'Remove',
  });
  let dragged = null; // router numbers being dragged
  const dragSet = (i) => (many().has(shown[i].n) ? many() : new Set([shown[i].n]));

  function setSel(next, keepCur) {
    sel = next;
    if (!keepCur) cur = sel.anchor;
    drawSel();
    onPick?.();
  }
  function moveSel(dir) {
    if (!many().size) return;
    set(stepRows(edge(), router(), myRights(), rights, many(), dir));
    reveal(cur ?? [...many()][0]);
  }

  // The selection bar and the marks on the rows drawn. A selection change draws only this.
  function drawSel() {
    const ro = ed.readOnly();
    const n = many().size;
    selNote.textContent = n ? `${n} selected. The Cell tab sets their artwork.` : `Click a row to select it. Shift-click selects a range, Cmd-click one more.`;
    for (const b of [selPin, selUnpin, selRemove, ...moves]) b.disabled = ro || !n;
    selNone.disabled = !n;
    selAll.disabled = !shown.length || n === shown.length;
    for (const li of made.values()) markRow(li);
  }
  function markRow(li) {
    const n = Number(li.dataset.id);
    li.toggleAttribute('data-selected', many().has(n));
    li.toggleAttribute('data-dragged', !!dragged?.has(n));
    li.classList.toggle('is-cur', n === cur);
  }

  // Every Panel tab keystroke repaints the sidebar, and an edge can hold thousands of rows, so a repaint with the
  // same inputs draws nothing.
  let drawn = [];
  function paint(force) {
    const ro = ed.readOnly();
    // A Buttons panel never shows the list, so it holds no rows.
    if (!isGridPanel(ed.fields())) {
      drawn = [];
      shown = [];
      at = new Map();
      made = new Map();
      sel = NONE();
      return list.replaceChildren();
    }
    routerList.paint();
    const now = [edge(), router(), myRights(), ro, ed.routerNames(), ed.panel()?.id, ed.art()];
    if (!force && now.every((x, i) => x === drawn[i])) return;
    // Another panel starts with nothing selected.
    if (now[5] !== drawn[5]) sel = NONE();
    drawn = now;
    const off = ed.routerNames()?.numberOffset || 0;
    const v = edgeRows(edge(), router(), myRights(), rights);
    shown = v.rows;
    at = new Map(shown.map((r, i) => [r.n, i]));
    // Rows that left the list leave the selection.
    if ([...sel.selected].some((x) => !at.has(x))) {
      sel = { selected: new Set([...sel.selected].filter((x) => at.has(x))), anchor: at.has(sel.anchor) ? sel.anchor : null };
      queueMicrotask(() => onPick?.());
    }
    if (!at.has(cur)) cur = sel.anchor;
    count.textContent = String(v.rows.length);
    state.textContent =
      v.rows.length || v.all
        ? `${plural(v.rows.length)}${v.all ? ', all from the router' : ''}. ${v.pins} of ${PINS_MAX} pinned.`
        : `No ${what}s yet. Add them from the router below, or use All (follow router).`;
    outside.textContent = v.outside ? `${v.outside} item${v.outside === 1 ? '' : 's'} outside your Rights, kept.` : '';
    outside.hidden = !v.outside;
    clear.disabled = ro || (!v.all && !v.rows.length);
    all.disabled = ro || v.all;
    shownOff = off;
    shownRo = ro;
    shownFull = v.pins >= PINS_MAX;
    made = new Map();
    drawRows();
    drawSel();
  }

  // Only the rows in view have nodes, as in the router list. An edge can hold thousands, and each row has about 20
  // elements and 10 listeners. Rows are one height, so margins stand in for the rows not drawn.
  let shownOff = 0;
  let shownRo = false;
  let shownFull = false;
  let made = new Map(); // row index -> its li, for the rows of the last paint
  let pitch = 0; // px from the top of one row to the next
  let span = { lo: 0, hi: 0 };
  function makeRow(r, i) {
    const off = shownOff;
    const own = edge()?.items?.[r.n];
    const art = own?.art || own?.artB ? artNode({ art: own.art, artB: own.artB }, ed.art()) : null;
    const body = [
      el('span', 'sode-pages__num', String(r.n + off)),
      ...(art ? [el('span', 'sode-edge__art', art)] : []),
      el('span', 'sode-pages__name', r.name || `${what} ${r.n + off}`),
    ];
    if (r.gone) body.push(el('span', 'sode__hint', 'not on router'));
    const li = rows.row({
      i,
      n: shown.length,
      id: String(r.n),
      readOnly: shownRo,
      body: [el('div', 'sode-pages__head', ...body)],
      actions: [
        {
          icon: r.pinned ? 'pin-off' : 'pin',
          tip: r.pinned ? 'Unpin' : shownFull ? `At most ${PINS_MAX} pinned` : 'Pin to the edge',
          act: 'pin',
          off: !r.pinned && shownFull,
          run: () => set(pinItems(edge(), router(), myRights(), rights, inMany(r.n) ? many() : new Set([r.n]), !r.pinned)),
        },
      ],
    });
    li.querySelector('[data-act="pin"]').setAttribute('aria-pressed', String(r.pinned));
    markRow(li);
    return li;
  }
  function drawRows() {
    const n = shown.length;
    // A hidden list has no height to measure, so it draws the first rows until it shows.
    if (!pitch && n && list.firstElementChild?.offsetHeight) {
      pitch = list.firstElementChild.offsetHeight + (parseFloat(getComputedStyle(list).rowGap) || 0);
    }
    const view = list.clientHeight;
    const next = pitch && view ? axisSpan({ n, pins: 0, size: pitch, head: 0, offset: list.scrollTop, view, over: OVER }) : { lo: 0, hi: Math.min(n, FIRST) };
    if (next.lo === span.lo && next.hi === span.hi && made.size) return;
    span = next;
    // A redraw replaces the buttons of a row it makes again, so focus goes back to the same act on the same item.
    // The item is found by its router number, since a move can put it at another index.
    const had = list.contains(document.activeElement) && document.activeElement !== list ? document.activeElement : null;
    const back = had && { act: had.dataset.act, id: had.closest('li')?.dataset.id };
    const keep = new Map();
    for (let i = next.lo; i < next.hi; i++) keep.set(i, made.get(i) || makeRow(shown[i], i));
    made = keep;
    // Margins, not the list's padding: with border-box sizing, padding past max-height makes the list taller.
    for (const li of keep.values()) li.style.margin = '';
    const rowsIn = [...keep.values()];
    if (pitch && rowsIn.length) {
      rowsIn[0].style.marginTop = `${next.lo * pitch}px`;
      rowsIn[rowsIn.length - 1].style.marginBottom = `${(n - next.hi) * pitch}px`;
    }
    list.replaceChildren(...rowsIn);
    if (back && !list.contains(document.activeElement)) list.querySelector(`li[data-id="${back.id}"] [data-act="${back.act}"]`)?.focus();
  }

  // Scrolls the least that shows the item's row.
  function reveal(n) {
    const i = at.get(n);
    if (i === undefined || !pitch) return;
    const top = i * pitch;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + pitch > list.scrollTop + list.clientHeight) list.scrollTop = top + pitch - list.clientHeight;
    drawRows();
  }

  // Shift-click would also mark the page's text.
  list.addEventListener('mousedown', (e) => e.shiftKey && !e.target.closest('button') && e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li || e.target.closest('button')) return;
    const n = Number(li.dataset.id);
    cur = n;
    setSel(selectRows(sel, shown, n, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey }), true);
    list.focus({ preventScroll: true });
  });
  list.addEventListener('keydown', (e) => {
    if (e.target !== list || !shown.length) return;
    const k = edgeListKey(e);
    if (!k) return;
    e.preventDefault();
    if (k.all) return setSel({ selected: new Set(shown.map((r) => r.n)), anchor: sel.anchor ?? shown[0].n }, true);
    if (k.none) return setSel(NONE(), true);
    if (k.move) return ed.readOnly() || moveSel(k.move);
    const i = at.get(cur) ?? -1;
    if (k.toggle) {
      if (i < 0) return;
      return setSel(selectRows(sel, shown, cur, { toggle: true }), true);
    }
    const page = Math.max(1, Math.floor(list.clientHeight / (pitch || 1)) - 1);
    const to = { up: i - 1, down: i + 1, home: 0, end: shown.length - 1, pageUp: i - page, pageDown: i + page }[k.go];
    const j = i < 0 ? 0 : Math.max(0, Math.min(shown.length - 1, to));
    const n = shown[j].n;
    const from = at.get(sel.anchor);
    cur = n;
    if (k.extend && from !== undefined) {
      const selected = new Set();
      for (let x = Math.min(from, j); x <= Math.max(from, j); x++) selected.add(shown[x].n);
      setSel({ selected, anchor: sel.anchor }, true);
    } else setSel({ selected: new Set([n]), anchor: n }, true);
    reveal(n);
  });
  list.addEventListener('scroll', drawRows, { passive: true });
  // Shown, resized or a new font size: the rows that fit, and their height, can change.
  new ResizeObserver(() => {
    pitch = 0;
    drawRows();
    if (pitch) drawRows();
  }).observe(list);
  onMyRights(() => paint());

  return {
    node,
    update: () => paint(),
    // The selected rows in list order, for the Cell tab.
    picked: () => shown.filter((r) => many().has(r.n)),
    edge,
    set,
    what,
    clearPicks: () => many().size && setSel(NONE()),
  };
}
