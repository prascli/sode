// A Grid panel's Sources or Destinations column in the editor: the panel's list in panel order, with Pin, Move, Remove,
// Clear and All (follow router). Artwork, Pin, Move and Remove also act on all the selected rows together. The
// router list (editorrouterlist.js) is beside it. Rules are editorgridrules.js; each edit is one ed.setFields of the edge.
import { el, icon } from './core.js';
import { axisSpan, OVER } from './gridpanelwindow.js';
import { btn } from './formbits.js';
import { createOrderedList } from './orderedlist.js';
import { createRouterList } from './editorrouterlist.js';
import { isGridPanel } from './gridpaneledges.js';
import { myRights, onMyRights } from './editorrights.js';
import {
  edgeRows,
  pinItem,
  removeItemFrom,
  moveRow,
  clearEdge,
  followRouter,
  selectRows,
  moveRows,
  stepRows,
  pinItems,
  removeItems,
  setItemsArt,
  edgeListKey,
  PINS_MAX,
} from './editorgridrules.js';
import { createArtControl } from './editorart.js';

const FIRST = 30; // rows drawn before the list has a height

// key is the panel field and the /names list ('sources' or 'destinations'), rights the Rights key, what the item word.
export function createEdgeTab(ed, { key, rights, what }) {
  const node = el('div', 'sode-side__tab sode-edge__col');
  const edge = () => ed.fields()[key];
  const router = () => ed.routerNames()?.[key] || [];
  const set = (next) => next !== edge() && ed.setFields({ [key]: next });
  const Whats = `${what[0].toUpperCase()}${what.slice(1)}s`;

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
  let sel = { selected: new Set(), anchor: null };
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
  const selArt = selBtn('art', 'Artwork', 'Sets Icon A and Icon B on every selected row.', () => openArt(!artOpen));
  const selPin = selBtn('pin', 'Pin', `Pins the selected rows in list order, to at most ${PINS_MAX}.`, () =>
    set(pinItems(edge(), router(), myRights(), rights, many(), true)),
  );
  const selUnpin = selBtn('unpin', 'Unpin', '', () => set(pinItems(edge(), router(), myRights(), rights, many(), false)));
  const selRemove = selBtn('remove', 'Remove', 'Takes the selected rows off the panel.', () => {
    set(removeItems(edge(), many()));
    setSel({ selected: new Set(), anchor: null });
  });
  const selAll = selBtn('all', 'Select all', 'Ctrl+A in the list.', () => setSel({ selected: new Set(shown.map((r) => r.n)), anchor: sel.anchor }));
  const selNone = selBtn('none', 'Select none', 'Esc in the list.', () => setSel({ selected: new Set(), anchor: null }));
  const moves = [
    moveBtn('top', 'arrow-up-to-line', 'Move to the top (Alt+Home)', 'top'),
    moveBtn('up', 'arrow-up', 'Move up (Alt+Up)', 'up'),
    moveBtn('down', 'arrow-down', 'Move down (Alt+Down)', 'down'),
    moveBtn('end', 'arrow-down-to-line', 'Move to the end (Alt+End)', 'end'),
  ];
  const selActs = el('div', 'sode-edge__acts', selArt, selPin, selUnpin, ...moves, selRemove);
  const selPick = el('div', 'sode-edge__acts', selAll, selNone);

  // One artwork control for the whole selection: a row with its own control would be thousands.
  let artOpen = false;
  const art = createArtControl({
    ed,
    icons: true,
    set: (v) => set(setItemsArt(edge(), many(), { art: v })),
    setB: (v) => set(setItemsArt(edge(), many(), { artB: v })),
  });
  const artHead = el('p', 'sode__hint');
  artHead.id = `ed-${key}-art-head`;
  const artDone = btn('pb-btn--outline pb-btn--sm', 'Done', () => openArt(false));
  const artBox = el('div', 'sode-edge__art', artHead, art.node, artDone);
  artBox.id = `ed-${key}-art`;
  artBox.hidden = true;
  node.append(
    el(
      'div',
      'sode-edge',
      routerList.node,
      el('div', 'sode-edge__panel', state, el('div', 'sode-edge__acts', clear, all), outside, selPick, selActs, selNote, artBox, list),
    ),
  );

  let shown = [];
  let at = new Map(); // router number -> index in shown
  const rows = createOrderedList({
    rowClass: 'sode-pages__row sode-edge__row',
    toolsClass: 'sode-pages__tools',
    // A row's own Move up and Move down moves the whole selection when the row is in it.
    move: (from, to) => {
      const n = shown[from].n;
      if (many().has(n) && many().size > 1) return moveSel(to < from ? 'up' : 'down');
      set(moveRow(edge(), router(), myRights(), rights, from, to));
    },
    // Dragging a selected row drags the selection; any other row goes alone.
    drop: (from, over, after) => {
      const n = shown[from].n;
      const ns = many().has(n) ? many() : new Set([n]);
      const before = after ? (shown[over + 1]?.n ?? null) : shown[over].n;
      set(moveRows(edge(), router(), myRights(), rights, ns, before));
    },
    remove: (i) => set(removeItemFrom(edge(), shown[i].n)),
    removeTip: 'Remove',
  });

  function setSel(next, keepCur) {
    sel = next;
    if (!keepCur) cur = sel.anchor;
    if (!sel.selected.size) artOpen = false;
    drawSel();
  }
  function moveSel(dir) {
    if (!many().size) return;
    set(stepRows(edge(), router(), myRights(), rights, many(), dir));
    reveal(cur ?? [...many()][0]);
  }
  function openArt(on) {
    artOpen = on && many().size > 0;
    drawSel();
    if (artOpen) artBox.scrollIntoView({ block: 'nearest' });
  }

  // The selection bar, the artwork control and the marks on the rows drawn. A selection change draws only this.
  function drawSel() {
    const ro = ed.readOnly();
    const n = many().size;
    selNote.textContent = n ? `${n} selected.` : `Click a row to select it. Shift-click selects a range, Ctrl-click one more.`;
    for (const b of [selArt, selPin, selUnpin, selRemove, selNone, ...moves]) b.disabled = (b !== selNone && ro) || !n;
    selAll.disabled = !shown.length || n === shown.length;
    selArt.setAttribute('aria-expanded', String(artOpen));
    artBox.hidden = !artOpen;
    if (artOpen) {
      const its = [...many()].map((x) => edge()?.items?.[x] || {});
      const same = (k) => (its.every((it) => (it[k] || '') === (its[0][k] || '')) ? its[0][k] || '' : '');
      const mixed = its.some((it) => (it.art || '') !== (its[0].art || '') || (it.artB || '') !== (its[0].artB || ''));
      const off = ed.routerNames()?.numberOffset || 0;
      const one = n === 1 ? shown[at.get([...many()][0])] : null;
      const name = one ? one.name || `${what} ${one.n + off}` : `${n} ${what}s`;
      artHead.textContent =
        `Artwork for ${name}. It shows beside the name. With none set, the item's Default artwork shows.` +
        (mixed ? ' The selected rows have different artwork; a choice here sets it on all of them.' : '');
      art.update(same('art'), '', false, same('artB'), false);
    }
    for (const li of made.values()) markRow(li);
  }
  function markRow(li) {
    const n = Number(li.dataset.id);
    li.toggleAttribute('data-selected', many().has(n));
    li.classList.toggle('is-cur', n === cur);
  }

  // Every Panel tab keystroke repaints the sidebar, and an edge can hold thousands of rows, so a repaint with the
  // same inputs draws nothing.
  let drawn = [];
  function paint(force) {
    const ro = ed.readOnly();
    // A Buttons panel never shows the tab, so it holds no rows.
    if (!isGridPanel(ed.fields())) {
      drawn = [];
      shown = [];
      at = new Map();
      made = new Map();
      sel = { selected: new Set(), anchor: null };
      return list.replaceChildren();
    }
    routerList.paint();
    const now = [edge(), router(), myRights(), ro, ed.routerNames(), ed.panel()?.id];
    if (!force && now.every((x, i) => x === drawn[i])) return;
    // Another panel starts with nothing selected.
    if (now[5] !== drawn[5]) sel = { selected: new Set(), anchor: null };
    drawn = now;
    const off = ed.routerNames()?.numberOffset || 0;
    const v = edgeRows(edge(), router(), myRights(), rights);
    shown = v.rows;
    at = new Map(shown.map((r, i) => [r.n, i]));
    // Rows that left the list leave the selection.
    if ([...sel.selected].some((x) => !at.has(x)))
      sel = { selected: new Set([...sel.selected].filter((x) => at.has(x))), anchor: at.has(sel.anchor) ? sel.anchor : null };
    if (!at.has(cur)) cur = sel.anchor;
    state.textContent = `${v.rows.length} ${what}${v.rows.length === 1 ? '' : 's'}${v.all ? ', all from the router' : ''}. ${v.pins} of ${PINS_MAX} pinned.`;
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
    const body = [el('span', 'sode-pages__num', String(r.n + off)), el('span', 'sode-pages__name', r.name || `${what} ${r.n + off}`)];
    if (r.pinned) body.push(el('span', 'sode__hint', 'pinned'));
    const own = edge()?.items?.[r.n];
    if (own?.art || own?.artB) body.push(el('span', 'sode__hint', 'artwork'));
    if (r.gone) body.push(el('span', 'sode__hint', 'not on router'));
    const li = rows.row({
      i,
      n: shown.length,
      id: String(r.n),
      readOnly: shownRo,
      body: [el('div', 'sode-pages__head', ...body)],
      actions: [
        {
          icon: 'image',
          tip: 'Artwork',
          act: 'art',
          // On a selected row it opens for the whole selection; on any other row it selects that row first.
          run: () => {
            if (!many().has(r.n)) setSel({ selected: new Set([r.n]), anchor: r.n });
            openArt(!artOpen || !many().has(r.n));
          },
        },
        {
          icon: r.pinned ? 'pin-off' : 'pin',
          tip: r.pinned ? 'Unpin' : shownFull ? `At most ${PINS_MAX} pinned` : 'Pin',
          act: 'pin',
          off: !r.pinned && shownFull,
          run: () => set(pinItem(edge(), r.n, !r.pinned)),
        },
      ],
    });
    li.querySelector('[data-act="pin"]').setAttribute('aria-pressed', String(r.pinned));
    markRow(li);
    return li;
  }
  function drawRows() {
    const n = shown.length;
    // A hidden tab has no height to measure, so it draws the first rows until it shows.
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
    setSel(selectRows(sel, shown, n, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey }), true);
    cur = n;
    drawSel();
    list.focus({ preventScroll: true });
  });
  list.addEventListener('keydown', (e) => {
    if (e.target !== list || !shown.length) return;
    const k = edgeListKey(e);
    if (!k) return;
    e.preventDefault();
    if (k.all) return setSel({ selected: new Set(shown.map((r) => r.n)), anchor: sel.anchor ?? shown[0].n }, true);
    if (k.none) return setSel({ selected: new Set(), anchor: null }, true);
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
    if (k.extend && from !== undefined) {
      const selected = new Set();
      for (let x = Math.min(from, j); x <= Math.max(from, j); x++) selected.add(shown[x].n);
      setSel({ selected, anchor: sel.anchor }, true);
    } else setSel({ selected: new Set([n]), anchor: n }, true);
    cur = n;
    reveal(n);
    drawSel();
  });
  list.addEventListener('scroll', drawRows, { passive: true });
  // Shown, resized or a new font size: the rows that fit, and their height, can change.
  new ResizeObserver(() => {
    pitch = 0;
    drawRows();
    if (pitch) drawRows();
  }).observe(list);
  onMyRights(() => paint());

  return { node, update: () => paint() };
}
