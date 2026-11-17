// Big scroll bars that Sode draws itself (design rule in AGENTS.md, docs/agents/web-layout.md).
// Firefox cannot size a native bar, and macOS overlay bars hide until a scroll. So the bar is a
// track and thumb next to the scroller. The native bar is hidden by [data-bigscroll] in base.css.
import { thumbFor, thumbAt, dragTo, pageDir, wheelPx } from './bigscrollrules.js';

// Every scroller a user needs on the pages that run bigScrollAll. A selector that matches no
// scroller costs nothing; keep in step with the list in docs/agents/web-layout.md.
// [selector, axis, size]: size is 'big' (default) or 'little'. The first match wins, so little
// entries go before a broader big one.
export const SCROLLERS = [
  ['.sode__search .sode__menu', 'y', 'little'],
  ['.sode__menu', 'y'],
  ['.sode__found', 'y'],
  ['.sode__scroll', 'y'],
  ['#settings-toc', 'y'],
  ['.pb-modal__body', 'y'],
  ['.sode__preset-list', 'y'],
  ['.sode__key-list', 'y', 'little'],
  ['[data-sets] > .sode__sets-run', 'x', 'little'],
  ['.sode__sets-run', 'x'],
  ['.sode__box--levels .sode__levels', 'x'],
  ['.sode-log__scroll', 'x'],
  ['.sode-ed__side', 'y'],
  ['.sode-edge__list', 'y'],
  ['.sode-rlist', 'y'],
  ['.sode-side__icons', 'y'],
  ['.sode-find__list', 'y'],
  ['.sode-tpl__list', 'y'],
  ['.sode-ov__people', 'y'],
  ['.sode-ov__keys', 'y'],
];

const PAGE = 0.9; // a track press pages by this much of the view, so a line stays in sight
const HOLD_MS = 350; // a held press starts repeating after this
const REPEAT_MS = 60;
const bars = new WeakMap(); // scroller -> its handle
const owners = new WeakMap(); // bar -> its scroller

// Draws a bar for scroller on axis 'x' or 'y'. size 'little' draws a thinner bar for small,
// secondary lists; the page's bar is always big. The page's own scroller (document.scrollingElement)
// gets a fixed bar at the window's edge. Returns { update, stop, bar }, or null for a scroller out
// of the page. Once drawn, nothing is added or removed while the scroller scrolls: only the thumb's
// transform changes (the Grid needs this).
export function bigScroll(scroller, axis = 'y', size = 'big') {
  const had = bars.get(scroller);
  if (had) return had;
  const page = scroller === document.scrollingElement;
  if (!page && !scroller.parentElement?.isConnected) return null;
  const y = axis === 'y';
  const little = size === 'little' && !page;
  const width = little ? 'var(--sode-littlescroll-w)' : 'var(--sode-bigscroll-w)';
  const thumb = document.createElement('div');
  thumb.className = 'sode-bigscroll__thumb';
  const bar = document.createElement('div');
  bar.className = `sode-bigscroll sode-bigscroll--${axis}${page ? ' sode-bigscroll--page' : ''}${little ? ' sode-bigscroll--little' : ''}`;
  // Pointer only: keys already scroll, and the bar must not reach tab order or screen readers.
  bar.setAttribute('aria-hidden', 'true');
  bar.hidden = true;
  bar.append(thumb);
  scroller.dataset.bigscroll = axis;
  if (page) document.body.append(bar);
  else {
    const host = scroller.parentElement;
    if (getComputedStyle(host).position === 'static') host.classList.add('sode-bigscroll-host');
    scroller.after(bar);
  }

  let geo = null; // { track, len, travel, max } from the last layout read
  let at = -1;
  let raf = 0;
  let laid = false;
  let pad = null; // the scroller's own end padding in px, read once while it is drawn

  const view = () => (y ? scroller.clientHeight : scroller.clientWidth);
  const content = () => (y ? scroller.scrollHeight : scroller.scrollWidth);
  const pos = () => (y ? scroller.scrollTop : scroller.scrollLeft);
  const setPos = (v) => (y ? (scroller.scrollTop = v) : (scroller.scrollLeft = v));

  function place() {
    if (page) return;
    let t = scroller.offsetTop + scroller.clientTop;
    let l = scroller.offsetLeft + scroller.clientLeft;
    const box = bar.offsetParent;
    // A host with display: contents leaves the bar's containing block elsewhere.
    if (box && box !== scroller.offsetParent) {
      const sr = scroller.getBoundingClientRect();
      const br = box.getBoundingClientRect();
      t = sr.top - br.top - box.clientTop + box.scrollTop + scroller.clientTop;
      l = sr.left - br.left - box.clientLeft + box.scrollLeft + scroller.clientLeft;
    }
    const s = bar.style;
    const want = y
      ? [`${t}px`, `${l + scroller.clientWidth - bar.offsetWidth}px`, `${scroller.clientHeight}px`, '']
      : [`${t + scroller.clientHeight - bar.offsetHeight}px`, `${l}px`, '', `${scroller.clientWidth}px`];
    if (s.top !== want[0]) s.top = want[0];
    if (s.left !== want[1]) s.left = want[1];
    if (s.height !== want[2]) s.height = want[2];
    if (s.width !== want[3]) s.width = want[3];
  }

  // The gutter is the bar's own room, so the thumb never covers a row's end. It is there only while
  // the bar shows, as with a classic bar.
  function gutter(on) {
    if (on === laid) return;
    laid = on;
    if (page) {
      if (on) document.documentElement.dataset.bigscrollOn = '';
      else delete document.documentElement.dataset.bigscrollOn;
      return;
    }
    const side = y ? 'paddingRight' : 'paddingBottom';
    if (pad === null) pad = getComputedStyle(scroller)[side];
    scroller.style[side] = on ? `calc(${pad} + ${width})` : '';
  }

  function layout() {
    raf = 0;
    // The phone layout keeps native bars (base.css).
    const phone = document.documentElement.dataset.layout === 'phone';
    const shown = !phone && (page || scroller.getClientRects().length > 0);
    const max = content() - view();
    const want = shown && max > 1;
    gutter(want);
    if (bar.hidden !== !want) bar.hidden = !want;
    if (!want) {
      geo = null;
      return;
    }
    place();
    const track = y ? bar.clientHeight : bar.clientWidth;
    const min = parseFloat(getComputedStyle(thumb)[y ? 'minHeight' : 'minWidth']) || 0;
    const { len, travel } = thumbFor(view(), content(), track, min);
    const size = `${len}px`;
    if (thumb.style[y ? 'height' : 'width'] !== size) thumb.style[y ? 'height' : 'width'] = size;
    geo = { track, len, travel, max: content() - view() };
    at = -1;
    move();
  }

  function move() {
    if (!geo) return;
    const off = thumbAt(pos(), geo.max, geo.travel);
    if (off === at) return;
    at = off;
    thumb.style.transform = y ? `translateY(${off}px)` : `translateX(${off}px)`;
  }

  const update = () => {
    if (!raf) raf = requestAnimationFrame(layout);
  };
  let moving = 0;
  const onScroll = () => {
    if (!moving)
      moving = requestAnimationFrame(() => {
        moving = 0;
        move();
      });
  };

  // Drag and track presses. pointerdown and mousedown both keep focus where it is, so an open
  // match list stays open.
  let drag = null;
  let hold = 0;
  const along = (e) => {
    const r = bar.getBoundingClientRect();
    return y ? e.clientY - r.top : e.clientX - r.left;
  };
  function pageStep(pt) {
    if (!geo) return false;
    const d = pageDir(pt, at, geo.len);
    if (!d) return false;
    setPos(pos() + d * view() * PAGE);
    return true;
  }
  function stopHold() {
    clearTimeout(hold);
    hold = 0;
  }
  function onDown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0 || !geo) return;
    bar.setPointerCapture(e.pointerId);
    const pt = along(e);
    if (e.target === thumb) {
      drag = { from: pos(), start: pt, pt };
      bar.classList.add('sode-bigscroll--drag');
      return;
    }
    drag = { pt };
    if (!pageStep(pt)) return;
    const again = () => {
      if (drag && pageStep(drag.pt)) hold = setTimeout(again, REPEAT_MS);
    };
    hold = setTimeout(again, HOLD_MS);
  }
  function onMove(e) {
    if (!drag) return;
    drag.pt = along(e);
    if (drag.from !== undefined && geo) setPos(dragTo(drag.from, drag.pt - drag.start, geo.max, geo.travel));
  }
  function onUp() {
    drag = null;
    stopHold();
    bar.classList.remove('sode-bigscroll--drag');
  }
  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  // Over the window's edge the wheel reaches the page by itself; next to an element it would not.
  function onWheel(e) {
    if (page) return;
    e.preventDefault();
    const d = wheelPx(e.deltaX, e.deltaY, e.deltaMode, axis, view());
    setPos(pos() + d);
  }

  bar.addEventListener('pointerdown', onDown);
  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
  bar.addEventListener('pointercancel', onUp);
  bar.addEventListener('lostpointercapture', onUp);
  bar.addEventListener('mousedown', swallow);
  bar.addEventListener('click', swallow);
  bar.addEventListener('wheel', onWheel, { passive: false });

  const target = page ? window : scroller;
  target.addEventListener('scroll', onScroll, { passive: true });
  // A sticky scroller moves with the page without a resize.
  const sticky = !page && getComputedStyle(scroller).position === 'sticky';
  if (sticky) window.addEventListener('scroll', update, { passive: true });
  const ro = new ResizeObserver(update);
  ro.observe(bar);
  let mo;
  if (page) {
    // The body is often one window high with the page overflowing it, so its children are watched.
    const watch = () => {
      for (const c of document.body.children) ro.observe(c);
      update();
    };
    mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true });
    watch();
    window.addEventListener('resize', update);
  } else {
    ro.observe(scroller);
    ro.observe(scroller.parentElement);
    // Rows drawn into a capped list change scrollHeight with no resize of the list.
    mo = new MutationObserver(update);
    mo.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
  }
  update();

  function stop() {
    if (bars.get(scroller) !== handle) return;
    bars.delete(scroller);
    cancelAnimationFrame(raf);
    cancelAnimationFrame(moving);
    stopHold();
    ro.disconnect();
    mo.disconnect();
    target.removeEventListener('scroll', onScroll);
    if (sticky) window.removeEventListener('scroll', update);
    if (page) window.removeEventListener('resize', update);
    gutter(false);
    delete scroller.dataset.bigscroll;
    bar.remove();
  }
  const handle = { update, stop, bar };
  bars.set(scroller, handle);
  owners.set(bar, scroller);
  return handle;
}

// Draws a bar on every scroller in SCROLLERS under root, now and as they are added, plus the page's
// own bar. A scroller taken out of the page loses its bar.
export function bigScrollAll(root = document.body) {
  bigScroll(document.scrollingElement, 'y');
  // One query per added or removed node: match lists and History redraw many rows per keystroke.
  const all = SCROLLERS.map(([sel]) => sel).join(',');
  const attach = (m) => {
    const [, axis, size] = SCROLLERS.find(([sel]) => m.matches(sel));
    bigScroll(m, axis, size);
  };
  const scan = (n) => {
    if (n.matches(all)) attach(n);
    if (n.firstElementChild) for (const m of n.querySelectorAll(all)) attach(m);
  };
  const drop = (n) => {
    bars.get(n)?.stop();
    if (n.firstElementChild) for (const m of n.querySelectorAll('[data-bigscroll]')) bars.get(m)?.stop();
  };
  scan(root);
  new MutationObserver((list) => {
    for (const r of list) {
      for (const n of r.removedNodes) {
        if (n.nodeType !== 1 || n.isConnected) continue;
        // A host that redraws its children can take the bar and keep the scroller.
        const s = owners.get(n);
        if (s?.isConnected && bars.has(s)) {
          s.after(n);
          bars.get(s).update();
        } else drop(n);
      }
      for (const n of r.addedNodes) if (n.nodeType === 1 && n.isConnected && !n.classList.contains('sode-bigscroll')) scan(n);
    }
  }).observe(root, { childList: true, subtree: true });
}
