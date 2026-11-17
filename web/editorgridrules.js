// The Grid panel editor's Sources and Destinations tabs: the rows of an edge and each edit of it. Pure.
// An edge is { members: 'all' | [n, ...], hide, items } (gridpaneledges.js, ADR 0011). An edit gives a new edge, or the
// same edge when nothing changed.
import { allowed } from './rightsrules.js';
import { filterFn } from './filter.js';

export const PINS_MAX = 8; // per edge; keep in step with gridPinsMax in internal/app/panelgrid.go

const isAll = (edge) => !Array.isArray(edge?.members);
const pinnedIn = (edge, n) => edge?.items?.[n]?.pinned === true;
const pinCount = (edge) => Object.values(edge?.items || {}).filter((it) => it?.pinned === true).length;

// The members in panel order: an "all" edge is the router in router order, less hide.
function membersOf(edge, router) {
  if (!isAll(edge)) return edge.members;
  const hide = new Set(edge?.hide || []);
  return (router || [])
    .map((x) => x.n)
    .sort((a, b) => a - b)
    .filter((n) => !hide.has(n));
}

// router is the /names list for the edge; rights the user's own (null: no limits); kind the Rights key ('sources' or
// 'dsts'). Entries outside the Rights stay in the edge and are only counted in outside.
export function edgeRows(edge, router, rights, kind) {
  const names = new Map((router || []).map((x) => [x.n, x.name]));
  const all = membersOf(edge, router);
  const rows = all.filter((n) => allowed(rights, kind, n)).map((n) => ({ n, name: names.get(n) ?? '', pinned: pinnedIn(edge, n), gone: !names.has(n) }));
  // "all" is resolved for each viewer, so it holds nothing outside the Rights.
  return { rows, all: isAll(edge), outside: isAll(edge) ? 0 : all.length - rows.length, pins: pinCount(edge) };
}

// Sets or clears an item's pin. Other item settings (art) stay; an item with nothing left goes.
function withItem(edge, n, patch) {
  const items = { ...(edge.items || {}) };
  const it = { ...(items[n] || {}), ...patch };
  for (const k of Object.keys(it)) if (it[k] === undefined || it[k] === false) delete it[k];
  if (Object.keys(it).length) items[n] = it;
  else delete items[n];
  return { ...edge, items };
}

export function pinItem(edge, n, on) {
  const e = edge || { members: 'all' };
  if (pinnedIn(e, n) === on) return edge;
  if (on && pinCount(e) >= PINS_MAX) return edge;
  return withItem(e, n, { pinned: on || undefined });
}

// An item out of the edge loses its pin, since the server counts every pin toward PINS_MAX; its art stays.
export function removeItemFrom(edge, n) {
  const e = withItem(edge || { members: 'all' }, n, { pinned: undefined });
  if (!isAll(e)) return { ...e, members: e.members.filter((x) => x !== n) };
  const hide = e.hide || [];
  return hide.includes(n) ? e : { ...e, hide: [...hide, n] };
}

const withoutHide = (edge) => {
  const out = { ...(edge || {}) };
  delete out.hide;
  return out;
};

// from and to are places in edgeRows' rows. The row takes the place of the row at to, among every member, so
// entries outside the Rights stay where they are. A move is a reorder, so an "all" edge becomes a list.
export function moveRow(edge, router, rights, kind, from, to) {
  const shown = edgeRows(edge, router, rights, kind).rows;
  if (from === to || !shown[from] || !shown[to]) return edge;
  const list = [...membersOf(edge, router)];
  const at = list.indexOf(shown[to].n);
  list.splice(list.indexOf(shown[from].n), 1);
  list.splice(at, 0, shown[from].n);
  return { ...withoutHide(edge), members: list };
}

export function clearEdge(edge, rights, kind) {
  const keep = isAll(edge) ? [] : edge.members.filter((n) => !allowed(rights, kind, n));
  let e = { ...withoutHide(edge), members: keep, items: { ...(edge?.items || {}) } };
  for (const n of Object.keys(e.items)) if (!keep.includes(Number(n))) e = withItem(e, n, { pinned: undefined });
  return e;
}

export const followRouter = (edge) => ({ ...withoutHide(edge), members: 'all' });

// The router list beside the panel's list: router order, within the Rights, each marked when the panel has it.
export function routerRows(router, edge, rights, kind) {
  const has = new Set(membersOf(edge, router));
  return (router || [])
    .filter((x) => allowed(rights, kind, x.n))
    .sort((a, b) => a.n - b.n)
    .map((x) => ({ n: x.n, name: x.name ?? '', in: has.has(x.n) }));
}

// Find uses the main page's filter language on the numbers as shown (off is numberOffset). Text it cannot read
// matches nothing.
export function findRows(rows, text, off) {
  const f = filterFn(text, { fuzzy: true });
  return f ? rows.filter((r) => f(r.n + off, r.name)) : [];
}

// s is { selected: Set of router numbers, anchor }. They are router numbers, so they stay when Find changes. Shift adds
// the rows in shown from the anchor to n; with the anchor out of shown it adds n alone.
export function selectRows(s, shown, n, { shift = false, toggle = false } = {}) {
  const at = shown.findIndex((r) => r.n === n);
  const from = shown.findIndex((r) => r.n === s.anchor);
  if (shift && at >= 0 && from >= 0) {
    const selected = new Set(s.selected);
    for (let i = Math.min(at, from); i <= Math.max(at, from); i++) selected.add(shown[i].n);
    return { selected, anchor: s.anchor };
  }
  if (toggle) {
    const selected = new Set(s.selected);
    if (!selected.delete(n)) selected.add(n);
    return { selected, anchor: n };
  }
  return { selected: shift ? new Set([...s.selected, n]) : new Set([n]), anchor: n };
}

// Appends the selected items in router order, less the members the edge has. An "all" edge becomes a list first.
export function addItems(edge, router, selected) {
  const list = membersOf(edge, router);
  const has = new Set(list);
  const add = [...selected].filter((n) => !has.has(n)).sort((a, b) => a - b);
  if (!add.length) return edge;
  return { ...withoutHide(edge), members: [...list, ...add] };
}
