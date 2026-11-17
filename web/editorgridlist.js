// A Grid panel's Sources or Destinations tab in the editor: the panel's list in panel order, with Pin, Move, Remove,
// Clear and All (follow router). The router list (editorrouterlist.js) is beside it. Rules are editorgridrules.js;
// each edit is one ed.setFields of the edge.
import { el } from './core.js';
import { axisSpan, OVER } from './gridpanelwindow.js';
import { btn } from './formbits.js';
import { createOrderedList } from './orderedlist.js';
import { createRouterList } from './editorrouterlist.js';
import { isGridPanel } from './gridpaneledges.js';
import { myRights, onMyRights } from './editorrights.js';
import { edgeRows, pinItem, removeItemFrom, moveRow, clearEdge, followRouter, setItemArt, PINS_MAX } from './editorgridrules.js';
import { createArtControl } from './editorart.js';

const FIRST = 30; // rows drawn before the list has a height

// key is the panel field and the /names list ('sources' or 'destinations'), rights the Rights key, what the item word.
export function createEdgeTab(ed, { key, rights, what }) {
  const node = el('div', 'sode-side__tab');
  const edge = () => ed.fields()[key];
  const router = () => ed.routerNames()?.[key] || [];
  const set = (next) => next !== edge() && ed.setFields({ [key]: next });

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
  // One artwork control for the whole list, opened on one row at a time: a row with its own control would be thousands.
  let artN = null; // the router number the control is open on
  const artFor = (n, patch) => set(setItemArt(edge(), n, patch));
  const art = createArtControl({
    ed,
    icons: true,
    set: (v) => artFor(artN, { art: v }),
    setB: (v) => artFor(artN, { artB: v }),
  });
  const artHead = el('p', 'sode__hint');
  artHead.id = `ed-${key}-art-head`;
  const artDone = btn('pb-btn--outline pb-btn--sm', 'Done', () => {
    artN = null;
    paint(true);
  });
  const artBox = el('div', 'sode-edge__art', artHead, art.node, artDone);
  artBox.id = `ed-${key}-art`;
  artBox.hidden = true;
  node.append(el('div', 'sode-edge', routerList.node, el('div', 'sode-edge__panel', state, el('div', 'sode-edge__acts', clear, all), outside, artBox, list)));

  let shown = [];
  const rows = createOrderedList({
    rowClass: 'sode-pages__row sode-edge__row',
    toolsClass: 'sode-pages__tools',
    move: (from, to) => set(moveRow(edge(), router(), myRights(), rights, from, to)),
    remove: (i) => set(removeItemFrom(edge(), shown[i].n)),
    removeTip: 'Remove',
  });

  // Every Panel tab keystroke repaints the sidebar, and an edge can hold thousands of rows, so a repaint with the
  // same inputs draws nothing.
  let drawn = [];
  function paint(force) {
    const ro = ed.readOnly();
    // A Buttons panel never shows the tab, so it holds no rows.
    if (!isGridPanel(ed.fields())) {
      drawn = [];
      shown = [];
      made = new Map();
      return list.replaceChildren();
    }
    routerList.paint();
    const now = [edge(), router(), myRights(), ro, ed.routerNames(), artN, ed.panel()?.id];
    if (!force && now.every((x, i) => x === drawn[i])) return;
    drawn = now;
    const off = ed.routerNames()?.numberOffset || 0;
    const v = edgeRows(edge(), router(), myRights(), rights);
    shown = v.rows;
    const full = v.pins >= PINS_MAX;
    const row = v.rows.find((r) => r.n === artN);
    if (artN !== null && !row) artN = null;
    artBox.hidden = artN === null;
    if (row) {
      const it = edge()?.items?.[row.n] || {};
      artHead.textContent = `Artwork for ${row.name || `${what} ${row.n + off}`}. It shows beside the name. With none set, the item's Default artwork shows.`;
      art.update(it.art || '', '', false, it.artB || '', false);
    }
    state.textContent = `${v.rows.length} ${what}${v.rows.length === 1 ? '' : 's'}${v.all ? ', all from the router' : ''}. ${v.pins} of ${PINS_MAX} pinned.`;
    outside.textContent = v.outside ? `${v.outside} item${v.outside === 1 ? '' : 's'} outside your Rights, kept.` : '';
    outside.hidden = !v.outside;
    clear.disabled = ro || (!v.all && !v.rows.length);
    all.disabled = ro || v.all;
    shownOff = off;
    shownRo = ro;
    shownFull = full;
    made = new Map();
    drawRows();
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
          run: () => {
            artN = artN === r.n ? null : r.n;
            paint(true);
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
    // A redraw replaces the buttons of a row it makes again, so focus goes back to the same act on the same row.
    const had = list.contains(document.activeElement) ? document.activeElement.dataset : null;
    const back = had && { act: had.act, i: had.i };
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
    if (back && !list.contains(document.activeElement)) list.querySelector(`[data-act="${back.act}"][data-i="${back.i}"]`)?.focus();
  }
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
