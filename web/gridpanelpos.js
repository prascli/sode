// Where the view is in a Grid panel, on the phone layout only. A phone draws its scroll bars only while a scroll
// runs. The corner gives the shown ranges, and the body's bottom and right edges get a track and a thumb. There are
// two kinds until the owner picks one on a real phone, set by ?pos= on the page URL. 'strips' are thin and display
// only. A finger drags 'thumbs' for fast travel. g is the drawn grid (gridpanelview.js), frame its scroller's parent.
// A scroll writes only thumb transforms and, when a range changes, text node data (TestChromeGridPanelScale).
import { el, icon } from './core.js';
import { thumbOf, offsetFor, rangeText } from './gridpanelposrules.js';

export function gridPosition(g, frame, kind, isPhone) {
  const thumbs = kind === 'thumbs';
  const bar = (axis) => {
    const thumb = el('div', 'sode-gridpanel__pos-thumb');
    const track = el('div', `sode-gridpanel__pos sode-gridpanel__pos--${axis}`, thumb);
    track.setAttribute('aria-hidden', 'true');
    track.dataset.kind = kind;
    return { track, thumb, axis, len: 0, key: '', trackKey: '' };
  };
  const bars = { srcs: bar('x'), dsts: bar('y') };
  frame.append(bars.srcs.track, bars.dsts.track);

  const head = g.field.querySelector('.sode-gridpanel__head');
  const line = (k, name) => {
    const text = document.createTextNode('');
    const n = el('span', `sode-gridpanel__range sode-gridpanel__range--${k}`, icon(name), text);
    n.setAttribute('aria-hidden', 'true');
    // Before the words: the Destinations word stays the corner's last child.
    head?.querySelector('.sode-gridpanel__label--src')?.before(n);
    return { n, text };
  };
  const ranges = { srcs: line('src', 'arrow-right'), dsts: line('dst', 'arrow-down') };

  let shown = null;
  const place = () => {
    if (!isPhone()) return;
    shown = g.shown();
    const box = g.bodyBox();
    const f = frame.getBoundingClientRect();
    for (const k of ['srcs', 'dsts']) {
      const b = bars[k];
      const s = shown[k];
      const x = b.axis === 'x';
      b.len = x ? box.right - box.left : box.bottom - box.top;
      // The track: along the body's bottom or right edge, in frame px. CSS moves it inside that edge by its width.
      const left = (x ? box.left : box.right) - f.left;
      const top = (x ? box.bottom : box.top) - f.top;
      const tk = `${left},${top},${b.len}`;
      if (tk !== b.trackKey) {
        b.trackKey = tk;
        b.track.style.left = `${left}px`;
        b.track.style.top = `${top}px`;
        b.track.style[x ? 'width' : 'height'] = `${b.len}px`;
      }
      b.track.hidden = !(s.max > 0);
      const t = thumbOf(s, b.len);
      const key = `${Math.round(t.size)},${Math.round(t.at)}`;
      if (key !== b.key) {
        b.key = key;
        b.thumb.style[x ? 'width' : 'height'] = `${t.size}px`;
        b.thumb.style.transform = x ? `translateX(${t.at}px)` : `translateY(${t.at}px)`;
      }
      const r = ranges[k];
      const words = rangeText(s);
      if (r.text.data !== words) r.text.data = words;
    }
  };
  const off = g.onDraw(place);

  // Thumbs only: a drag moves the view; touch-action none on the thumb keeps the browser from panning under it.
  let drag = null; // { k, id, start, from }
  const down = (k) => (e) => {
    if (!thumbs || !shown) return;
    e.preventDefault();
    const b = bars[k];
    b.thumb.setPointerCapture(e.pointerId);
    b.track.dataset.drag = '';
    drag = { k, id: e.pointerId, start: k === 'srcs' ? e.clientX : e.clientY, from: shown[k].offset };
  };
  const move = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const s = shown[drag.k];
    const d = (drag.k === 'srcs' ? e.clientX : e.clientY) - drag.start;
    const to = offsetFor(s, bars[drag.k].len, drag.from, d);
    if (drag.k === 'srcs') g.scroll.scrollLeft = to;
    else g.scroll.scrollTop = to;
  };
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    delete bars[drag.k].track.dataset.drag;
    drag = null;
  };
  const listen = [];
  for (const k of ['srcs', 'dsts']) {
    const t = bars[k].thumb;
    listen.push([t, 'pointerdown', down(k)], [t, 'pointermove', move], [t, 'pointerup', up], [t, 'pointercancel', up]);
  }
  for (const [t, ev, fn] of listen) t.addEventListener(ev, fn);
  place();

  return {
    place,
    stop() {
      off();
      for (const [t, ev, fn] of listen) t.removeEventListener(ev, fn);
      for (const b of Object.values(bars)) b.track.remove();
      for (const r of Object.values(ranges)) r.n.remove();
    },
  };
}
