// Which sources and destinations a Grid panel shows, in display order (ADR 0011). Pure.
// An edge is { members: 'all' } (every router item, in router order, following the router); a missing edge is 'all'.
// Explicit lists, hidden items, pins and Rights come later and belong here, since every geometry rule reads this order.

export const PANEL_TYPE_GRID = 'grid'; // keep in step with panelTypeGrid in internal/app/panelgrid.go

export const isGridPanel = (panel) => panel?.type === PANEL_TYPE_GRID;

const routerOrder = (list) => (list || []).map((x) => x.n).sort((a, b) => a - b);

// Every edge is 'all' until explicit lists exist.
const edgeOrder = (edge, list) => routerOrder(list);

// names is GET /names. Returns router numbers: srcs left to right, dsts top to bottom.
export const gridAxes = (panel, names) => ({
  srcs: edgeOrder(panel?.sources, names?.sources),
  dsts: edgeOrder(panel?.destinations, names?.destinations),
});
