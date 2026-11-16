// The plan a Grid panel's confirm shows, from the routes it will send. Pure. Names are the current Router names.
// names is namesFrom (panelrules.js). Items keep the order their destination was first staged.
export function planOf(routes, names) {
  const items = new Map();
  for (const r of routes) {
    if (!items.has(r.dst)) items.set(r.dst, { dst: r.dst, dstName: names.destination(r.dst), groups: [] });
    items.get(r.dst).groups.push({ src: r.src, srcName: names.source(r.src), levels: r.levels });
  }
  return { verb: 'take', items: [...items.values()] };
}
