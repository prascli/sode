// Which part of a Grid panel is drawn, one axis at a time (gridpanelview.js draws it). Pure, all in px.
// An axis is { n, pins, size, head, offset, view, over }. It has n items of size px after a name bar head px long.
// The first pins items are pinned at the edge. It scrolls by offset in a view px long. over is extra items each end.
// Items are display order indices (gridAxes), never router numbers.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Items drawn past each end of the view, so a fast scroll shows fewer blank items.
export const OVER = 4;

// The scrolling items to draw as [lo, hi). Pinned items are drawn apart, so lo is never under pins.
export function axisSpan({ n, pins, size, head, offset, view, over = 0 }) {
  const lo = Math.floor(offset / size) + pins - over;
  const hi = Math.ceil((offset + view - head) / size) + over;
  return { lo: clamp(lo, pins, n), hi: clamp(hi, pins, n) };
}

// The most items axisSpan gives at any offset: those past the pinned band, a part item more, over each side.
export function spanMax({ n, pins, size, head, view, over = 0 }) {
  return clamp(Math.ceil((view - head) / size) - pins + 1 + 2 * over, 0, n - pins);
}

// The item under px, a point measured from the view's start; -1 on the name bar or past the last item.
export function indexAt(px, { n, pins, size, head, offset }) {
  if (px < head) return -1;
  const i = px - head < pins * size ? Math.floor((px - head) / size) : Math.floor((px - head + offset) / size);
  return i < n ? i : -1;
}

// The offset that shows item i whole, clear of the name bar and pinned band, moving as little as it can.
export function scrollFor(i, { pins, size, head, offset, view }) {
  if (i < pins) return offset;
  const start = head + i * size;
  if (start < offset + head + pins * size) return (i - pins) * size;
  if (start + size > offset + view) return start + size - view;
  return offset;
}

// gridAxes puts pinned items first, so they are the leading run of order that the edge pins.
export function pinsOf(edge, order) {
  let k = 0;
  while (k < order.length && edge?.items?.[order[k]]?.pinned === true) k++;
  return k;
}

// As indexAt, but null past the last item or before the view, so a caller can tell that from the name bar (-1).
export function slotAt(px, a) {
  if (px < 0) return null;
  if (px < a.head) return -1;
  const i = indexAt(px, a);
  return i < 0 ? null : i;
}

// The whole scrolling items one screen shows, at least one: a PageUp or PageDown moves this many.
export const pageOf = ({ pins, size, head, view }) => Math.max(1, Math.floor((view - head - pins * size) / size));

// The start of item i in content px; -1 is the name bar. The bar and pinned items are sticky, so they follow offset.
export function placeAt(i, { pins, size, head, offset }) {
  if (i < 0) return offset;
  return i < pins ? offset + head + i * size : head + i * size;
}
