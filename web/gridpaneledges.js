// Which sources and destinations a Grid panel shows, in display order (ADR 0011). Pure.
// An edge is { members: 'all' } (every router item, in router order, following the router); a missing edge is 'all'.
// Explicit lists, hidden items and pins come later and belong here, since every geometry rule reads this order.
import { rightsAllow } from './panelrules.js';

export const PANEL_TYPE_GRID = 'grid'; // keep in step with panelTypeGrid in internal/app/panelgrid.go

export const isGridPanel = (panel) => panel?.type === PANEL_TYPE_GRID;

const routerOrder = (list) => (list || []).map((x) => x.n).sort((a, b) => a - b);

// Every edge is 'all' until explicit lists exist.
const edgeOrder = (edge, list) => routerOrder(list);

// Left out: items outside the viewer's Rights (panel.rights, so "all" is per viewer) and items the router no longer
// reports. A Hidden viewer's GET /names already leaves out what is outside the Rights.
const shown = (order, list, rights, kind) => {
  const on = new Set((list || []).map((x) => x.n));
  return order.filter((n) => on.has(n) && rightsAllow(rights, kind, n));
};

// names is GET /names. Returns router numbers: srcs left to right, dsts top to bottom.
export const gridAxes = (panel, names) => ({
  srcs: shown(edgeOrder(panel?.sources, names?.sources), names?.sources, panel?.rights, 'sources'),
  dsts: shown(edgeOrder(panel?.destinations, names?.destinations), names?.destinations, panel?.rights, 'dsts'),
});
