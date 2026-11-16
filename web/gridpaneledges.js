// Which sources and destinations a Grid panel shows, in display order (ADR 0011). Pure.
// An edge is { members: 'all' | [n, ...], hide: [n], items: { n: { pinned, art } } }; a missing edge is 'all'.
// 'all' is every router item in router order, less hide. Display order puts pinned members first, then the rest.

export const PANEL_TYPE_GRID = 'grid'; // keep in step with panelTypeGrid in internal/app/panelgrid.go

export const isGridPanel = (panel) => panel?.type === PANEL_TYPE_GRID;

const routerOrder = (list) => (list || []).map((x) => x.n).sort((a, b) => a - b);

const membersOf = (edge, list) => {
  if (Array.isArray(edge?.members)) return edge.members;
  const hide = new Set(edge?.hide || []);
  return routerOrder(list).filter((n) => !hide.has(n));
};

// A pinned item shows only at the edge, never again at its place in the list.
const pinnedFirst = (edge, ns) => {
  const pinned = (n) => edge?.items?.[n]?.pinned === true;
  return [...ns.filter(pinned), ...ns.filter((n) => !pinned(n))];
};

const edgeOrder = (edge, list) => pinnedFirst(edge, membersOf(edge, list));

// names is GET /names. Returns router numbers in display order: srcs left to right, dsts top to bottom.
// Every geometry rule (Diagonal, Drawn line, moves) walks these lists, never router order.
export const gridAxes = (panel, names) => ({
  srcs: edgeOrder(panel?.sources, names?.sources),
  dsts: edgeOrder(panel?.destinations, names?.destinations),
});
