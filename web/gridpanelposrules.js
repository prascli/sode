// The phone's position tracks on a Grid panel (gridpanelpos.js). Pure. s is one axis of the grid's shown().
export const POS_KINDS = ['strips', 'thumbs'];
const THUMB_MIN = 44; // px: a finger's size, and the shortest thumb either kind draws

// The thumb's length and place along a track of len px.
export function thumbOf(s, len) {
  const view = s.max > 0 ? len * (len / (len + s.max)) : len;
  const size = Math.min(len, Math.max(THUMB_MIN, view));
  const at = s.max > 0 ? ((len - size) * Math.min(s.offset, s.max)) / s.max : 0;
  return { size, at };
}

// The scroll offset for a thumb moved by d px from where it was at offset `from`. Pure.
export const offsetFor = (s, len, from, d) => {
  const room = len - thumbOf(s, len).size;
  return room > 0 ? Math.max(0, Math.min(s.max, from + (d * s.max) / room)) : from;
};

export const rangeText = (s) => (s.n ? `${s.first}–${s.last}/${s.n}` : '');
