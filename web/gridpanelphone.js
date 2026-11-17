// A Grid panel on the phone layout (spec #432). Pure. A phone has no hover and no modifier keys.

const first = (picked, order) => order.find((n) => picked.includes(n));

// The press point of the numbered targets while no crosspoint is under the cursor, so picks show their Diagonal
// without hover: the first shown picked source and destination, else the cursor's column or row, else the first
// item. cur is a cursor (gridpanelcursor.js), axes the shown axes. Null with no shown picks.
export function restPoint(picks, axes, cur) {
  const src = first(picks.srcs, axes.srcs);
  const dst = first(picks.dsts, axes.dsts);
  if (src === undefined && dst === undefined) return null;
  return {
    src: src ?? axes.srcs[cur.j] ?? axes.srcs[0],
    dst: dst ?? axes.dsts[cur.i] ?? axes.dsts[0],
  };
}

// The phone's Take button stands in for Enter. Instant mode holds nothing staged, so it has none.
export function takeButton({ phone, mode, staged, busy }) {
  const shown = phone && mode === 'take';
  return { shown, disabled: !shown || !staged || busy };
}

// pickName's mods for a click on a name. On the phone a tap adds or removes one name, as Cmd-click does, and a
// long-press (given as shiftKey) adds a range.
export const tapMods = (e, phone) => ({ range: !!e.shiftKey, toggle: phone || !!(e.metaKey || e.ctrlKey) });
