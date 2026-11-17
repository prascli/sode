// Drawn line gestures on a Grid panel (spec #432): a mouse or pen drag on the crosspoints, or a touch long-press.
// g is the drawn grid (gridpanelview.js). on: { start(a), move(b), end(b), cancel() }, points in crosspoint units.
// Touch is way A of the prototype on branch prototype/panels (grid/touch.html). touch-action cannot change after
// pointerdown. So touch uses Touch Events, and a non-passive touchmove calls preventDefault only after the long-press
// timer. A plain touch drag stays a native scroll.
import { isLine } from './gridpanelline.js';

const LONG_MS = 450;
const SLOP_PX = 10; // a touch that moves this far before the timer is a scroll
const EDGE_SPEED = 0.25; // auto-scroll px per frame for each px inside the edge zone

export function lineGestures(g, on) {
  const { scroll } = g;
  let down = null; // { a, id }: a mouse or pen press on a crosspoint, not yet past the click threshold.
  let active = null; // { kind: 'pointer' | 'touch', x, y }: a line draws; x and y are the last client point.
  let timer = 0;
  let touchAt = null; // the client point of a pending long-press
  let eat = false; // the click that follows a line's release
  let raf = 0;

  const units = (x, y) => g.unitsAt(x, y);
  const begin = (kind, a, x, y) => {
    active = { kind, x, y };
    on.start(a);
    raf = requestAnimationFrame(edge);
  };
  const stop = () => {
    active = null;
    down = null;
    clearTimeout(timer);
    timer = 0;
    touchAt = null;
    cancelAnimationFrame(raf);
  };
  const moveTo = (x, y) => {
    active.x = x;
    active.y = y;
    on.move(units(x, y));
  };
  const finish = (x, y) => {
    const b = units(x, y);
    stop();
    on.end(b);
  };
  const cancel = () => {
    const was = active;
    stop();
    if (was) on.cancel();
  };

  // Near an edge of the body the grid scrolls, faster the further in; the end point is read again after it.
  function edge() {
    if (!active) return;
    const box = g.bodyBox();
    const zone = g.metrics().xp;
    const by = (p, lo, hi) => (p < lo + zone ? -(lo + zone - p) : p > hi - zone ? p - (hi - zone) : 0) * EDGE_SPEED;
    const dx = by(active.x, box.left, box.right);
    const dy = by(active.y, box.top, box.bottom);
    if (dx || dy) {
      scroll.scrollBy(dx, dy);
      on.move(units(active.x, active.y));
    }
    raf = requestAnimationFrame(edge);
  }

  // Mouse and pen. Capture starts only past the click threshold: with capture the click goes to the scroller, so a
  // plain press must not have it.
  const onDown = (e) => {
    eat = false;
    if (e.pointerType === 'touch' || e.button !== 0 || active || !g.hit(e.clientX, e.clientY)) return;
    down = { a: units(e.clientX, e.clientY), id: e.pointerId };
  };
  const onMove = (e) => {
    if (active?.kind === 'pointer') return moveTo(e.clientX, e.clientY);
    if (!down || e.pointerId !== down.id) return;
    if (!isLine(down.a, units(e.clientX, e.clientY))) return;
    scroll.setPointerCapture(e.pointerId);
    const { a } = down;
    down = null;
    begin('pointer', a, e.clientX, e.clientY);
    moveTo(e.clientX, e.clientY);
  };
  const onUp = (e) => {
    down = null;
    if (active?.kind !== 'pointer') return;
    eat = true;
    finish(e.clientX, e.clientY);
  };
  const onPointerCancel = (e) => {
    if (e.pointerType === 'touch') return;
    down = null;
    if (active?.kind === 'pointer') cancel();
  };
  const onClick = (e) => {
    if (!eat) return;
    eat = false;
    e.stopPropagation();
    e.preventDefault();
  };

  // Touch. A stylus draws through the pointer path; its touchmove is held so the page does not pan under it.
  const stylus = (e) => [...e.changedTouches].some((t) => t.touchType === 'stylus');
  const onTouchStart = (e) => {
    if (stylus(e)) return;
    if (e.touches.length !== 1) return cancel();
    const t = e.touches[0];
    if (active || !g.hit(t.clientX, t.clientY)) return;
    touchAt = { x: t.clientX, y: t.clientY };
    timer = setTimeout(() => {
      timer = 0;
      if (touchAt) begin('touch', units(touchAt.x, touchAt.y), touchAt.x, touchAt.y);
    }, LONG_MS);
  };
  // Non-passive, so it costs a scroll on every touch move: it returns at once when nothing is pending.
  const onTouchMove = (e) => {
    if (!timer && !active && !down) return;
    if (stylus(e)) {
      if ((down || active) && e.cancelable) e.preventDefault();
      return;
    }
    const t = e.touches[0];
    if (active?.kind === 'touch') {
      if (e.cancelable) e.preventDefault();
      return moveTo(t.clientX, t.clientY);
    }
    if (timer && Math.hypot(t.clientX - touchAt.x, t.clientY - touchAt.y) > SLOP_PX) {
      clearTimeout(timer);
      timer = 0;
      touchAt = null;
    }
  };
  const onTouchEnd = (e) => {
    clearTimeout(timer);
    timer = 0;
    touchAt = null;
    if (active?.kind !== 'touch') return;
    // No compatibility mouse events and click after a line.
    if (e.cancelable) e.preventDefault();
    const t = e.changedTouches[0];
    finish(t.clientX, t.clientY);
  };
  const onTouchCancel = () => {
    if (timer || active?.kind === 'touch') cancel();
  };
  // A long-press opens the context menu on Android; while one is pending or drawing, it is the line's.
  const onMenu = (e) => {
    if (timer || active?.kind === 'touch') e.preventDefault();
  };

  const listen = [
    [scroll, 'pointerdown', onDown],
    [scroll, 'pointermove', onMove],
    [scroll, 'pointerup', onUp],
    [scroll, 'pointercancel', onPointerCancel],
    [scroll, 'click', onClick, { capture: true }],
    [scroll, 'touchstart', onTouchStart, { passive: true }],
    [scroll, 'touchmove', onTouchMove, { passive: false }],
    [scroll, 'touchend', onTouchEnd, { passive: false }],
    [scroll, 'touchcancel', onTouchCancel],
    [scroll, 'contextmenu', onMenu],
    [window, 'blur', cancel],
  ];
  for (const [t, k, f, o] of listen) t.addEventListener(k, f, o);
  return {
    // Esc in the run.
    cancel,
    drawing: () => !!active,
    stop() {
      stop();
      for (const [t, k, f, o] of listen) t.removeEventListener(k, f, o);
    },
  };
}
