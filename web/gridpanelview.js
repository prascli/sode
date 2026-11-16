// Draws a Grid panel. The Source bar is across the top and the Destination bar down the side, with a crosspoint and
// level pie for each pair. build makes the nodes when the shown items change. paint changes only what moved, so the
// one-second redraw mutates nothing on an idle grid. Every crosspoint is a node until the grid is virtualised.
import { el } from './core.js';
import { pieFill } from './gridpanellevels.js';

const setText = (n, t) => {
  if (n.textContent !== t) n.textContent = t;
};
const pick = (n, on) => {
  setData(n, 'picked', on ? '' : undefined);
  const a = on ? 'true' : 'false';
  if (n.getAttribute('aria-selected') !== a) n.setAttribute('aria-selected', a);
};
const setData = (n, k, v) => {
  if (v === undefined) {
    if (k in n.dataset) delete n.dataset[k];
  } else if (n.dataset[k] !== v) n.dataset[k] = v;
};

// host is the run's grid element. onPress({ src, dst }) is a crosspoint press. onName(kind, n, e) is a click on a
// name, kind 'srcs' or 'dsts'. onAt({ src, dst } or null) gives the crosspoint under the pointer.
export function buildGridPanel(host, { srcs, dsts }, { onPress, onName, onAt }) {
  host.replaceChildren();
  host.removeAttribute('style');
  host.classList.add('sode-gridpanel');
  const field = el('div', 'sode-gridpanel__field');
  field.style.setProperty('--sode-cols', srcs.length);
  field.setAttribute('role', 'grid');
  field.setAttribute('aria-label', 'Crosspoints');
  const corner = el('div', 'sode-gridpanel__corner');
  const srcNodes = new Map();
  const dstNodes = new Map();
  const xps = [];
  const xpAt = new Map();
  const head = el('div', 'sode-gridpanel__row');
  head.setAttribute('role', 'row');
  head.append(corner);
  for (const s of srcs) {
    const n = el('div', 'pb-xpt pb-xpt--source sode-gridpanel__src');
    n.setAttribute('role', 'columnheader');
    n.dataset.src = s;
    srcNodes.set(s, n);
    head.append(n);
  }
  field.append(head);
  for (const d of dsts) {
    const row = el('div', 'sode-gridpanel__row');
    row.setAttribute('role', 'row');
    const name = el('div', 'pb-xpt pb-xpt--dest sode-gridpanel__dst');
    name.setAttribute('role', 'rowheader');
    name.dataset.dst = d;
    dstNodes.set(d, name);
    row.append(name);
    for (const s of srcs) {
      const xp = el('button', 'sode-gridpanel__xp', el('span', 'sode-gridpanel__pie'));
      xp.type = 'button';
      xp.tabIndex = -1;
      xp.dataset.src = s;
      xp.dataset.dst = d;
      xps.push(xp);
      xpAt.set(`${s}:${d}`, xp);
      row.append(xp);
    }
    field.append(row);
  }
  const at = (xp) => ({ src: Number(xp.dataset.src), dst: Number(xp.dataset.dst) });
  field.addEventListener('click', (e) => {
    const xp = e.target.closest('.sode-gridpanel__xp');
    if (xp) return onPress(at(xp));
    const name = e.target.closest('.sode-gridpanel__src, .sode-gridpanel__dst');
    if (name) onName(name.dataset.src ? 'srcs' : 'dsts', Number(name.dataset.src ?? name.dataset.dst), e);
  });
  // A Shift-click would otherwise extend a text selection on the page.
  field.addEventListener('mousedown', (e) => {
    if (e.shiftKey) e.preventDefault();
  });
  field.addEventListener('pointerover', (e) => {
    const xp = e.target.closest('.sode-gridpanel__xp');
    onAt(xp ? at(xp) : null);
  });
  field.addEventListener('pointerleave', () => onAt(null));
  const scroll = el('div', 'pb-grid-body sode-gridpanel__scroll', field);
  host.append(el('div', 'pb-grid sode-gridpanel__frame', scroll));
  return { field, srcNodes, dstNodes, xps, xpAt, marked: [] };
}

// The routes a press would stage: each target crosspoint numbered in order and its names outlined. pairs is
// [{ src, dst }] or empty; over marks a press the 128 cap would refuse. Only the nodes marked last time are touched.
export function previewGridPanel(g, pairs, over) {
  for (const n of g.marked) {
    delete n.dataset.n;
    delete n.dataset.target;
  }
  g.marked = [];
  pairs.forEach(({ src, dst }, i) => {
    const xp = g.xpAt.get(`${src}:${dst}`);
    if (xp) {
      xp.dataset.n = i + 1;
      g.marked.push(xp);
    }
    for (const name of [g.srcNodes.get(src), g.dstNodes.get(dst)]) {
      if (!name) continue;
      name.dataset.target = '';
      g.marked.push(name);
    }
  });
  setData(g.field, 'over', over && pairs.length ? '' : undefined);
}

// view: { names (namesFrom), levels (GET /tally levels), levelText(list), pie(src, dst) -> levels on,
// staged(src, dst) -> levels staged, picked(kind, n) }.
export function paintGridPanel(g, view) {
  for (const [s, n] of g.srcNodes) {
    setText(n, view.names.source(s));
    pick(n, view.picked('srcs', s));
  }
  for (const [d, n] of g.dstNodes) {
    setText(n, view.names.destination(d));
    pick(n, view.picked('dsts', d));
  }
  for (const xp of g.xps) {
    const s = Number(xp.dataset.src);
    const d = Number(xp.dataset.dst);
    const on = view.pie(s, d);
    const fill = pieFill(view.levels, on);
    const pie = xp.firstChild;
    // The browser rewrites a style it reads back, so the last value set is kept on the node.
    if (pie._fill !== fill) {
      pie._fill = fill;
      pie.style.background = fill;
    }
    // data-s staged is the attribute the panel pulse watches (panels.css).
    const staged = view.staged(s, d);
    setData(xp, 's', staged.length ? 'staged' : undefined);
    setData(xp, 'on', on.length ? on.join(',') : undefined);
    const label = `${view.names.source(s)} to ${view.names.destination(d)}${on.length ? `, levels ${view.levelText(on)}` : ''}${staged.length ? ', staged' : ''}`;
    if (xp.getAttribute('aria-label') !== label) xp.setAttribute('aria-label', label);
  }
}
