// A Grid panel's Sources or Destinations tab in the editor: the panel's list in panel order, with Pin, Move, Remove,
// Clear and All (follow router). The router list (editorrouterlist.js) is beside it. Rules are editorgridrules.js;
// each edit is one ed.setFields of the edge.
import { el } from './core.js';
import { btn } from './formbits.js';
import { createOrderedList } from './orderedlist.js';
import { createRouterList } from './editorrouterlist.js';
import { isGridPanel } from './gridpaneledges.js';
import { myRights, onMyRights } from './editorrights.js';
import { edgeRows, pinItem, removeItemFrom, moveRow, clearEdge, followRouter, PINS_MAX } from './editorgridrules.js';

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
  node.append(el('div', 'sode-edge', routerList.node, el('div', 'sode-edge__panel', state, el('div', 'sode-edge__acts', clear, all), outside, list)));

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
  function paint() {
    const ro = ed.readOnly();
    // A Buttons panel never shows the tab, so it holds no rows.
    if (!isGridPanel(ed.fields())) {
      drawn = [];
      return list.replaceChildren();
    }
    routerList.paint();
    const now = [edge(), router(), myRights(), ro, ed.routerNames()];
    if (now.every((x, i) => x === drawn[i])) return;
    drawn = now;
    const off = ed.routerNames()?.numberOffset || 0;
    const v = edgeRows(edge(), router(), myRights(), rights);
    shown = v.rows;
    const full = v.pins >= PINS_MAX;
    state.textContent = `${v.rows.length} ${what}${v.rows.length === 1 ? '' : 's'}${v.all ? ', all from the router' : ''}. ${v.pins} of ${PINS_MAX} pinned.`;
    outside.textContent = v.outside ? `${v.outside} item${v.outside === 1 ? '' : 's'} outside your Rights, kept.` : '';
    outside.hidden = !v.outside;
    clear.disabled = ro || (!v.all && !v.rows.length);
    all.disabled = ro || v.all;
    // A repaint replaces the buttons, so focus goes back to the same act on the same row.
    const had = list.contains(document.activeElement) ? document.activeElement.dataset : null;
    const back = had && { act: had.act, i: had.i };
    list.replaceChildren(
      ...v.rows.map((r, i) => {
        const body = [el('span', 'sode-pages__num', String(r.n + off)), el('span', 'sode-pages__name', r.name || `${what} ${r.n + off}`)];
        if (r.pinned) body.push(el('span', 'sode__hint', 'pinned'));
        if (r.gone) body.push(el('span', 'sode__hint', 'not on router'));
        const li = rows.row({
          i,
          n: v.rows.length,
          id: String(r.n),
          readOnly: ro,
          body: [el('div', 'sode-pages__head', ...body)],
          actions: [
            {
              icon: r.pinned ? 'pin-off' : 'pin',
              tip: r.pinned ? 'Unpin' : full ? `At most ${PINS_MAX} pinned` : 'Pin',
              act: 'pin',
              off: !r.pinned && full,
              run: () => set(pinItem(edge(), r.n, !r.pinned)),
            },
          ],
        });
        li.querySelector('[data-act="pin"]').setAttribute('aria-pressed', String(r.pinned));
        return li;
      }),
    );
    if (back) list.querySelector(`[data-act="${back.act}"][data-i="${back.i}"]`)?.focus();
  }
  onMyRights(paint);

  return { node, update: paint };
}
