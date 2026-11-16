// Draws a Grid panel. The Source bar is across the top and the Destination bar down the side, with a crosspoint and
// level pie for each pair. build makes the nodes when the shown items change. paint changes only what moved, so the
// one-second redraw mutates nothing on an idle grid. Every crosspoint is a node until the grid is virtualised.
import { el } from './core.js';
import { pieFill } from './gridpanellevels.js';

const setText = (n, t) => {
  if (n.textContent !== t) n.textContent = t;
};
const setData = (n, k, v) => {
  if (v === undefined) {
    if (k in n.dataset) delete n.dataset[k];
  } else if (n.dataset[k] !== v) n.dataset[k] = v;
};

// host is the run's grid element; onPress({ src, dst }) is a crosspoint press.
export function buildGridPanel(host, { srcs, dsts }, onPress) {
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
      row.append(xp);
    }
    field.append(row);
  }
  field.addEventListener('click', (e) => {
    const xp = e.target.closest('.sode-gridpanel__xp');
    if (xp) onPress({ src: Number(xp.dataset.src), dst: Number(xp.dataset.dst) });
  });
  const scroll = el('div', 'pb-grid-body sode-gridpanel__scroll', field);
  host.append(el('div', 'pb-grid sode-gridpanel__frame', scroll));
  return { srcNodes, dstNodes, xps };
}

// view: { names (namesFrom), levels (GET /tally levels), levelText(list), pie(src, dst) -> levels on,
// staged(src, dst) -> levels staged }.
export function paintGridPanel(g, view) {
  for (const [s, n] of g.srcNodes) setText(n, view.names.source(s));
  for (const [d, n] of g.dstNodes) setText(n, view.names.destination(d));
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
