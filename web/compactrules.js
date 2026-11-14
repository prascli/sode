// Compact view's nudge: moves #patch-view so the patch boxes, not the whole block, sit at the viewport's centre.

// box: the boxes' span {left, right, top, bottom} as laid out with no nudge; view: #patch-view's box likewise.
// The nudge never pushes the block past a viewport edge, so a short window keeps the title and Presets on screen.
export function centreNudge(box, view, vw, vh) {
  const clamp = (d, lo, hi) => (lo > hi ? 0 : Math.min(Math.max(d, lo), hi));
  const dx = vw / 2 - (box.left + box.right) / 2;
  const dy = vh / 2 - (box.top + box.bottom) / 2;
  return {
    x: Math.round(clamp(dx, -view.left, vw - view.right)),
    y: Math.round(clamp(dy, -view.top, vh - view.bottom)),
  };
}
