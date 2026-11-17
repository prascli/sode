// A Grid panel by touch and on the phone layout, and its Take button. Pure. A phone has no hover and
// no modifier keys.

const first = (picked, order) => order.find((n) => picked.includes(n));

// The press point of the numbered targets while no crosspoint is under the cursor, so picks show their Diagonal
// without hover. It is the first shown picked source and destination, else the cursor's column or row, else the
// first item. cur is a cursor (gridpanelcursor.js), axes the shown axes. Null with no shown picks.
export function restPoint(picks, axes, cur) {
  const src = first(picks.srcs, axes.srcs);
  const dst = first(picks.dsts, axes.dsts);
  if (src === undefined && dst === undefined) return null;
  return {
    src: src ?? axes.srcs[cur.j] ?? axes.srcs[0],
    dst: dst ?? axes.dsts[cur.i] ?? axes.dsts[0],
  };
}

// The Take button, on every layout: Enter for a phone, and the staged count beside the Levels box. Instant mode
// holds nothing staged, so it has none. Armed is the look of a Take with routes waiting.
export function takeButton({ mode, staged, busy }) {
  const shown = mode === 'take';
  const n = shown ? staged : 0;
  return { shown, disabled: !n || busy, armed: !!n && !busy, count: n ? String(n) : '' };
}

// pickName's mods for a click on a name. On the phone a tap adds or removes one name, as Cmd-click does, and a
// long-press (given as shiftKey) adds a range.
export const tapMods = (e, phone) => ({ range: !!e.shiftKey, toggle: phone || !!(e.metaKey || e.ctrlKey) });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The chip and the hint beside Clear and Take: what Esc and Clear drop next (picks, then staged routes) and the next
// step. srcs and dsts count picked names; staged counts staged routes.
export function pickNote({ srcs, dsts, staged }) {
  if (srcs || dsts) {
    const parts = [dsts && plural(dsts, 'destination'), srcs && plural(srcs, 'source')].filter(Boolean);
    return { chip: `${parts.join(', ')} picked`, hint: 'Click a crosspoint in a picked row or column for a Diagonal. Esc drops the picks.' };
  }
  if (staged) return { chip: `${staged} staged`, hint: 'Press Take or Enter to send the staged routes. Esc drops them.' };
  return { chip: '', hint: 'Click names to pick rows and columns. Shift-click picks a range.' };
}
