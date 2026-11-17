// Draws a Grid panel, virtualised on both axes (gridpanelwindow.js picks what shows). The Source bar is across
// the top and the Destination bar down the side. Pinned items sit in sticky bands at those edges.
// A node is moved to another crosspoint or name as the grid scrolls, so nodes hold no state of their own.
// Everything shown comes from the view that paint is given. docs/agents/panels.md has the layer plan.
import { el, icon } from './core.js';
import { iconHref } from './sprite.js';
import { pieFill } from './gridpanellevels.js';
import { axisSpan, spanMax, indexAt, slotAt, pageOf, placeAt, scrollFor, centreFor, wheelAcross, pinsShown, OVER } from './gridpanelwindow.js';

const HIT_MS = 1400; // keep in step with the sode-gridpanel-hit animations in gridpanel.css (3 x 0.45s).
const GLIDE_MAX_MS = 3000; // a glide across 2500 sources takes about 1.5 s

// A node that starts the panel pulse (sode-panel-pulse) joins the others in phase. Every pulse counts from the
// timeline's time zero. One read per task, since getAnimations brings the style up to date.
const joining = new Set();
export function joinPulse(node) {
  if (!joining.size)
    queueMicrotask(() => {
      for (const n of joining) for (const a of n.getAnimations()) if (a.animationName === 'sode-panel-pulse') a.startTime = 0;
      joining.clear();
    });
  joining.add(node);
}

// A name node keeps one Text child, so a rename or a move is not a childList change.
const setText = (n, t) => {
  if (n.firstChild.data !== t) n.firstChild.data = t;
};
const setData = (n, k, v) => {
  if (v === undefined) {
    if (k in n.dataset) delete n.dataset[k];
  } else if (n.dataset[k] !== v) n.dataset[k] = v;
};
const pick = (n, on) => {
  setData(n, 'picked', on ? '' : undefined);
  const a = on ? 'true' : 'false';
  if (n.getAttribute('aria-selected') !== a) n.setAttribute('aria-selected', a);
};
const setVar = (n, k, v) => {
  const s = String(v);
  if (n.style.getPropertyValue(k) !== s) n.style.setProperty(k, s);
};

function paintXp(xp, s, d, view) {
  const on = view.pie(s, d);
  const fill = pieFill(view.levels, on);
  const [pie, ring] = xp.children;
  // The browser rewrites a style it reads back, so the last value set is kept on the node.
  if (pie._fill !== fill) {
    pie._fill = fill;
    pie.style.background = fill;
  }
  // data-s staged is the attribute the panel pulse watches (panels.css). A route left out does not pulse.
  const staged = view.staged(s, d);
  // The staged ring is a pie of the staged levels, in the same slices as the pie.
  const ringFill = staged.length ? pieFill(view.levels, staged) : '';
  if (ring._fill !== ringFill) {
    ring._fill = ringFill;
    ring.style.background = ringFill;
  }
  // A picked row or column is washed in its role colour (gridpanel.css).
  setData(xp, 'row', view.picked('dsts', d) ? '' : undefined);
  setData(xp, 'col', view.picked('srcs', s) ? '' : undefined);
  const out = staged.length > 0 && view.leftOut(s, d);
  const prot = view.protected(d);
  const st = out ? 'left-out' : staged.length ? 'staged' : undefined;
  // A staged crosspoint runs the pulse itself (gridpanel.css).
  const starts = st === 'staged' && xp.dataset.s !== 'staged';
  setData(xp, 's', st);
  if (starts) joinPulse(xp);
  setData(xp, 'on', on.length ? on.join(',') : undefined);
  if (xp.getAttribute('aria-disabled') !== String(prot)) xp.setAttribute('aria-disabled', String(prot));
  const state = out ? ', staged, left out of the take' : staged.length ? ', staged. Right-click or Alt-click to unstage' : '';
  const label = `${view.names.source(s)} to ${view.names.destination(d)}${on.length ? `, levels ${view.levelText(on)}` : ''}${prot ? ', protected' : ''}${state}`;
  if (xp.getAttribute('aria-label') !== label) xp.setAttribute('aria-label', label);
}

const makeXp = () => {
  const xp = el('button', 'sode-gridpanel__xp', el('span', 'sode-gridpanel__pie'), el('span', 'sode-gridpanel__stage'));
  xp.type = 'button';
  xp.tabIndex = -1;
  return xp;
};
const makeName = (cls, role) => () => {
  const n = el('div', `pb-xpt ${cls}`);
  n.setAttribute('role', role);
  n.append(document.createTextNode(''));
  return n;
};
// The artwork beside a name: Icon A as a sprite icon, an image or a mask, then Icon B. A mask is a library SVG in
// the text colour. All four exist from the start and a paint shows some, so a scroll changes attributes and never
// childList. The last child of a name; it comes before the text in the layout (CSS order).
const makeArt = () => {
  const row = el(
    'span',
    'sode-gridpanel__art',
    icon('circle', false),
    el('img', 'sode-gridpanel__art-a'),
    el('span', 'sode-gridpanel__art-a sode-gridpanel__art-mask'),
    el('span', 'sode-gridpanel__art-b', document.createTextNode('')),
  );
  row.setAttribute('aria-hidden', 'true');
  row.hidden = true;
  const [svg, img, mask] = row.children;
  svg.setAttribute('class', 'pb-icon sode-gridpanel__art-a');
  img.hidden = mask.hidden = true;
  svg.setAttribute('hidden', '');
  img.alt = '';
  return row;
};
const makeSrc = () => {
  const n = makeName('pb-xpt--source sode-gridpanel__src', 'columnheader')();
  n.append(makeArt());
  return n;
};
// After the name's Text: the protected mark (the lock never stands alone) and the staged word. Then the current
// sources the grid does not show, then the artwork. Made once, so a paint changes only Text data and hidden.
const makeDst = () => {
  const n = makeName('pb-xpt--dest sode-gridpanel__dst', 'rowheader')();
  const prot = el('small', 'sode-gridpanel__prot', icon('lock'), document.createTextNode(''));
  const held = el('small', 'sode-gridpanel__held', document.createTextNode(''));
  const other = el('small', 'sode-gridpanel__other', document.createTextNode(''));
  prot.hidden = held.hidden = other.hidden = true;
  n.append(prot, held, other, makeArt());
  return n;
};

// The attribute, not the property: the art row's svg has no hidden property.
const show = (n, on) => {
  if (n.hasAttribute('hidden') === on) n.toggleAttribute('hidden', !on);
};
// art is { icon, url, mask, b } from view.art (a part can be missing), or null.
function paintArt(row, art) {
  const [svg, img, mask, b] = row.children;
  setText(b, art?.b || '');
  show(b, !!art?.b);
  show(svg, !!art?.icon);
  if (art?.icon) {
    const href = iconHref(art.icon);
    const use = svg.firstChild;
    if (use.getAttribute('href') !== href) use.setAttribute('href', href);
  }
  show(img, !!art?.url);
  if (art?.url && img.getAttribute('src') !== art.url) img.setAttribute('src', art.url);
  show(mask, !!art?.mask);
  if (art?.mask && mask.dataset.u !== art.mask) {
    mask.dataset.u = art.mask;
    mask.style.maskImage = `url("${art.mask}")`;
  }
  show(row, !!(art && (art.icon || art.url || art.mask || art.b)));
}

// A mark not shown is hidden and has empty text, so the node's text is the name alone.
function paintDstMarks(n, d, view) {
  const [, prot, held, other] = n.childNodes;
  const p = view.protected(d);
  n.classList.toggle('pb-xpt--protected', p);
  if (prot.hidden === p) prot.hidden = !p;
  if (prot.lastChild.data !== (p ? ' Protected' : '')) prot.lastChild.data = p ? ' Protected' : '';
  // Protected wins: a protected destination has nothing staged.
  const h = !p && view.held(d);
  setText(held, h ? 'staged' : '');
  if (held.hidden === h) held.hidden = !h;
  const o = view.other(d);
  setText(other, o.text);
  if (other.hidden !== !o.text) other.hidden = !o.text;
  setData(other, 'pbTip', o.tip || undefined);
}

// A pool draws the cells of one layer: a key per cell, nodes reused for cells that come into view.
// put(node, i, j) points a node at the cell of display indices i (row) and j (column).
function pool(host, make, put) {
  const live = new Map();
  const spare = [];
  return {
    live,
    // cells is [[i, j], ...]; a node whose cell went is given to a new one, and only a shortfall makes nodes.
    sync(cells) {
      const want = new Map(cells.map(([i, j]) => [`${i},${j}`, [i, j]]));
      for (const [k, n] of live) {
        if (!want.has(k)) {
          live.delete(k);
          spare.push(n);
        }
      }
      for (const [k, [i, j]] of want) {
        if (live.has(k)) continue;
        let n = spare.pop();
        if (!n) host.append((n = make()));
        n.hidden = false;
        put(n, i, j);
        live.set(k, n);
      }
      // A spare node stays in the DOM, hidden, for the next scroll.
      for (const n of spare) if (!n.hidden) n.hidden = true;
    },
    // Makes nodes up to k, so a scroll never makes one. Called on a resize or new axes, never on a scroll.
    reserve(k) {
      for (let have = live.size + spare.length; have < k; have++) {
        const n = make();
        n.hidden = true;
        host.append(n);
        spare.push(n);
      }
    },
    clear() {
      for (const n of live.values()) spare.push(n);
      live.clear();
    },
  };
}

const range = (lo, hi) => Array.from({ length: Math.max(0, hi - lo) }, (_, k) => lo + k);
const cross = (rows, cols) => rows.flatMap((i) => cols.map((j) => [i, j]));

// host is the run's grid element; axes is gridAxes plus srcPins and dstPins. onPress({ src, dst }, e) is a crosspoint
// press. onName(kind, n, e) is a click on a name, kind 'srcs' or 'dsts'. onPoint(clientX, clientY) is each pointer
// move over the scroller. onJump(kind, n) is a right-click: kind 'xp' with n { src, dst }, or 'srcs' or 'dsts' with a
// router number. Returns the drawn grid (docs/agents/panels.md).
export function buildGridPanel(host, axes, { onPress, onName, onPoint, onJump }) {
  host.replaceChildren();
  host.removeAttribute('style');
  host.classList.add('sode-gridpanel');
  const layer = (cls) => el('div', `sode-gridpanel__layer ${cls}`);
  const body = layer('sode-gridpanel__body');
  const overlay = layer('sode-gridpanel__overlay');
  const top = layer('sode-gridpanel__top');
  const side = layer('sode-gridpanel__side');
  const corner = layer('sode-gridpanel__corner');
  // Where the bars meet: the run puts the search boxes here (gridpanelfindbox.js).
  // The run puts the search boxes first, so the Destinations word stays last, next to the Destination bar.
  const label = (kind, word, arrow) => el('span', `sode-gridpanel__label sode-gridpanel__label--${kind}`, word, icon(arrow));
  const head = el('div', 'sode-gridpanel__head', label('dst', 'Destinations', 'arrow-down'));
  corner.append(head);
  // The cursor (gridpanelcursor.js) is one node, moved by transform only. It is not in the overlay: on a bar or a
  // pinned item it must draw above the sticky bands.
  const cursor = el('div', 'sode-gridpanel__cursor', el('span', 'sode-gridpanel__ring'));
  cursor.setAttribute('aria-hidden', 'true');
  // The Drawn line, in content px (gridpanelline.js has the geometry).
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('sode-gridpanel__lines');
  svg.setAttribute('aria-hidden', 'true');
  const lineNode = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lineNode.classList.add('sode-gridpanel__line');
  svg.append(lineNode);
  // An svg element has no hidden property: only the attribute hides it.
  svg.setAttribute('hidden', '');
  overlay.append(svg);
  const field = el('div', 'sode-gridpanel__field', body, overlay, side, top, corner, cursor);
  field.setAttribute('role', 'group');
  field.setAttribute('aria-label', 'Crosspoints');
  // The probe is the Destination bar width by the Source bar height, with one crosspoint inside. CSS sets the
  // sizes in rem, and the window maths needs px.
  const probeXp = el('div', 'sode-gridpanel__probe-xp');
  const probe = el('div', 'sode-gridpanel__probe', probeXp);
  const scroll = el('div', 'pb-grid-body sode-gridpanel__scroll', field, probe);
  // Focus goes back here from a search box, so an embedded run (which needs focus in the grid) gets its keys.
  scroll.tabIndex = -1;
  // The Sources row over the grid. It starts where the Source bar does.
  const bar = el('div', 'sode-gridpanel__bar', label('src', 'Sources', 'arrow-right'));
  host.append(bar, el('div', 'pb-grid sode-gridpanel__frame', scroll));

  let ax = axes;
  let srcAt = new Map(); // router number to display index
  let dstAt = new Map();
  let view = null;
  // The press preview (g.preview): numbered crosspoints by "s:d" and outlined names.
  let mark = { xps: new Map(), skip: new Set(), srcs: new Set(), dsts: new Set() };
  const marked = new Set(); // crosspoint nodes that carry a number
  let cur = { i: -1, j: -1 }; // The cursor's display position, -1 on a bar.
  // What g.glide or g.jump went to, { srcs, dsts, seq } with router numbers (null for none), until its pulse ends. The
  // crosspoint pulses when both are set. seq is 0 or 1 and picks one of two equal animations. Thus a new glide restarts
  // the pulse on a node that still has the last one. Set when the scroll ends, so every part pulses in one phase.
  let hit = null;
  let seq = 1;
  let hitEnd = null; // { timer, done } of the glide or pulse in progress
  const hitOf = (kind, n) => (hit && hit[kind] === n ? String(hit.seq) : undefined);
  const hitXp = (s, d) => (hit && hit.srcs === s && hit.dsts === d ? String(hit.seq) : undefined);
  const paintHits = () => {
    for (const p of [pools.srcs, pools.srcPinned]) for (const n of p.live.values()) setData(n, 'hit', hitOf('srcs', Number(n.dataset.src)));
    for (const p of [pools.dsts, pools.dstPinned]) for (const n of p.live.values()) setData(n, 'hit', hitOf('dsts', Number(n.dataset.dst)));
    for (const p of xpPools) for (const n of p.live.values()) setData(n, 'hit', hitXp(Number(n.dataset.src), Number(n.dataset.dst)));
  };
  // Scrolls to `to` ({ left, top }, either one) smoothly, then pulses `next` ({ srcs, dsts }) for HIT_MS.
  const goTo = (to, next) => {
    const m = read();
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hitEnd) {
      clearTimeout(hitEnd.timer);
      scroll.removeEventListener('scrollend', hitEnd.done);
    }
    hit = null;
    paintHits();
    const done = () => {
      scroll.removeEventListener('scrollend', done);
      clearTimeout(hitEnd.timer);
      seq = 1 - seq;
      hit = { ...next, seq };
      paintHits();
      hitEnd.timer = setTimeout(() => {
        hit = null;
        hitEnd = null;
        paintHits();
      }, HIT_MS);
    };
    hitEnd = { timer: 0, done };
    // No scrollend comes for a move under a pixel or on a browser without the event, so a timer ends it too.
    const still = Object.entries(to).every(([k, v]) => Math.abs(v - (k === 'left' ? m.left : m.top)) < 1);
    if (still) return done();
    hitEnd.timer = setTimeout(done, GLIDE_MAX_MS);
    scroll.addEventListener('scrollend', done);
    scroll.scrollTo({ ...to, behavior: calm ? 'instant' : 'smooth' });
  };
  let px = { xp: 1, w: 1, h: 1 };
  const listeners = new Set();

  const measure = () => {
    const r = probe.getBoundingClientRect();
    px = { xp: probeXp.getBoundingClientRect().width || 1, w: r.width || 1, h: r.height || 1 };
  };
  const place = (n, i, j) => {
    setVar(n, '--sode-i', i);
    setVar(n, '--sode-j', j);
  };
  const markXp = (n, s, d) => {
    const k = mark.xps.get(`${s}:${d}`);
    const skip = mark.skip.has(`${s}:${d}`);
    setData(n, 'n', k === undefined ? undefined : String(k));
    setData(n, 'skip', skip ? '' : undefined);
    if (k === undefined && !skip) marked.delete(n);
    else marked.add(n);
  };
  const markName = (n, on) => setData(n, 'target', on ? '' : undefined);
  // The names of the crosspoint under the cursor; none while the cursor is on a bar.
  const cueOf = () => (cur.i >= 0 && cur.j >= 0 ? { src: ax.srcs[cur.j], dst: ax.dsts[cur.i] } : {});
  const cueName = (n, on) => setData(n, 'cue', on ? '' : undefined);
  const cueNames = () => {
    const c = cueOf();
    for (const p of [pools.srcs, pools.srcPinned]) for (const n of p.live.values()) cueName(n, Number(n.dataset.src) === c.src);
    for (const p of [pools.dsts, pools.dstPinned]) for (const n of p.live.values()) cueName(n, Number(n.dataset.dst) === c.dst);
  };
  const paintSrc = (n, s) => {
    if (view) {
      setText(n, view.names.source(s));
      pick(n, view.picked('srcs', s));
      setData(n, 'found', view.found('srcs', s) ? '' : undefined);
      paintArt(n.lastChild, view.art('srcs', s));
    }
    markName(n, mark.srcs.has(s));
    cueName(n, cueOf().src === s);
    setData(n, 'hit', hitOf('srcs', s));
  };
  const paintDst = (n, d) => {
    if (view) {
      setText(n, view.names.destination(d));
      pick(n, view.picked('dsts', d));
      setData(n, 'found', view.found('dsts', d) ? '' : undefined);
      paintDstMarks(n, d, view);
      paintArt(n.lastChild, view.art('dsts', d));
    }
    markName(n, mark.dsts.has(d));
    cueName(n, cueOf().dst === d);
    setData(n, 'hit', hitOf('dsts', d));
  };
  const xpPut = (n, i, j) => {
    place(n, i, j);
    const s = ax.srcs[j];
    const d = ax.dsts[i];
    n.dataset.src = s;
    n.dataset.dst = d;
    if (view) paintXp(n, s, d, view);
    markXp(n, s, d);
    setData(n, 'hit', hitXp(s, d));
  };
  const srcPut = (n, i, j) => {
    place(n, 0, j);
    const s = ax.srcs[j];
    n.dataset.src = s;
    paintSrc(n, s);
  };
  const dstPut = (n, i) => {
    place(n, i, 0);
    const d = ax.dsts[i];
    n.dataset.dst = d;
    paintDst(n, d);
  };
  const pools = {
    body: pool(body, makeXp, xpPut),
    top: pool(top, makeXp, xpPut),
    side: pool(side, makeXp, xpPut),
    corner: pool(corner, makeXp, xpPut),
    srcs: pool(top, makeSrc, srcPut),
    dsts: pool(side, makeDst, dstPut),
    srcPinned: pool(corner, makeSrc, srcPut),
    dstPinned: pool(corner, makeDst, dstPut),
  };
  const xpPools = [pools.body, pools.top, pools.side, pools.corner];

  // The scroller's metrics. Each read can force a layout, so a draw reads them once (frame) and all it calls share them.
  let frame = null;
  const read = () => {
    const r = scroll.getBoundingClientRect();
    return {
      left: scroll.scrollLeft,
      top: scroll.scrollTop,
      cw: scroll.clientWidth,
      ch: scroll.clientHeight,
      x: r.left + scroll.clientLeft,
      y: r.top + scroll.clientTop,
    };
  };
  const metricsNow = () => frame || read();
  // The pins drawn as pinned on each edge (pinsShown), set by setAxes and a resize.
  let pinned = { srcs: 0, dsts: 0 };
  const pinsNow = (m = metricsNow()) => ({
    srcs: pinsShown({ pins: ax.srcPins || 0, size: px.xp, head: px.w, view: m.cw }),
    dsts: pinsShown({ pins: ax.dstPins || 0, size: px.xp, head: px.h, view: m.ch }),
  });
  const axis = (cols, m = metricsNow()) => ({
    n: cols ? ax.srcs.length : ax.dsts.length,
    pins: cols ? pinned.srcs : pinned.dsts,
    size: px.xp,
    head: cols ? px.w : px.h,
    offset: cols ? m.left : m.top,
    view: cols ? m.cw : m.ch,
    over: OVER,
  });
  const spans = (m = metricsNow()) => ({ rows: axisSpan(axis(false, m)), cols: axisSpan(axis(true, m)) });
  // A client point in scroller px, from its padding edge.
  const local = (x, y, m = metricsNow()) => ({ x: x - m.x, y: y - m.y });

  // A bar or pinned item is sticky, so each draw places the cursor again.
  let curKey = '';
  let ringOn = false;
  const placeCursor = () => {
    const m = metricsNow();
    const ra = axis(false, m);
    const ca = axis(true, m);
    const x = placeAt(cur.j, ca);
    const y = placeAt(cur.i, ra);
    const w = cur.j < 0 ? px.w : px.xp;
    const h = cur.i < 0 ? px.h : px.xp;
    const band = cur.i < ra.pins || cur.j < ca.pins;
    // Above the bands, a part that scrolls is hidden once it is under them, so it does not cover a name.
    const under = (k, a, at) => k >= a.pins && at + a.size <= a.offset + a.head + a.pins * a.size;
    const hide = band && (under(cur.i, ra, y) || under(cur.j, ca, x));
    const key = `${x},${y},${w},${h},${band},${hide}`;
    if (key === curKey) return;
    curKey = key;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    cursor.style.width = `${w}px`;
    cursor.style.height = `${h}px`;
    setData(cursor, 'band', band ? '' : undefined);
    const bar = cur.i < 0 || cur.j < 0;
    setData(cursor, 'bar', bar ? '' : undefined);
    cursor.hidden = hide;
    // A ring shown again starts its animation again.
    const on = !hide && !bar;
    if (on && !ringOn) joinPulse(cursor.firstChild);
    ringOn = on;
  };

  const reserve = () => {
    const m = metricsNow();
    const r = spanMax(axis(false, m));
    const c = spanMax(axis(true, m));
    const rp = pinned.dsts;
    const cp = pinned.srcs;
    pools.body.reserve(r * c);
    pools.top.reserve(rp * c);
    pools.side.reserve(r * cp);
    pools.srcs.reserve(c);
    pools.dsts.reserve(r);
  };

  const draw = () => {
    frame = read();
    try {
      drawIn();
    } finally {
      frame = null;
    }
  };
  const drawIn = () => {
    const { rows, cols } = spans();
    const rs = range(rows.lo, rows.hi);
    const cs = range(cols.lo, cols.hi);
    const rp = range(0, pinned.dsts);
    const cp = range(0, pinned.srcs);
    pools.body.sync(cross(rs, cs));
    pools.top.sync(cross(rp, cs));
    pools.side.sync(cross(rs, cp));
    pools.corner.sync(cross(rp, cp));
    pools.srcs.sync(cs.map((j) => [0, j]));
    pools.dsts.sync(rs.map((i) => [i, 0]));
    pools.srcPinned.sync(cp.map((j) => [0, j]));
    pools.dstPinned.sync(rp.map((i) => [i, 0]));
    placeCursor();
    for (const f of listeners) f();
  };

  const setAxes = (next) => {
    ax = next;
    pinned = pinsNow();
    srcAt = new Map(ax.srcs.map((n, j) => [n, j]));
    dstAt = new Map(ax.dsts.map((n, i) => [n, i]));
    setVar(field, '--sode-cols', ax.srcs.length);
    setVar(field, '--sode-rows', ax.dsts.length);
    setVar(field, '--sode-col-pins', pinned.srcs);
    setVar(field, '--sode-row-pins', pinned.dsts);
    for (const p of Object.values(pools)) p.clear();
    reserve();
    draw();
  };

  const onScroll = () => draw();
  scroll.addEventListener('scroll', onScroll, { passive: true });
  // A new window or layout size changes how many items show, and a font size change changes px.
  const ro = new ResizeObserver(() => {
    measure();
    curKey = '';
    // A size that changes how many pins fit redraws as new axes would; a scroll never gets here.
    const p = pinsNow();
    if (p.srcs !== pinned.srcs || p.dsts !== pinned.dsts) return setAxes(ax);
    reserve();
    draw();
  });
  ro.observe(scroll);
  ro.observe(probe);
  const xpOf = (xp) => ({ src: Number(xp.dataset.src), dst: Number(xp.dataset.dst) });
  // A press does not focus a crosspoint or a name: a focused button would draw its focus box at the next key. Focus
  // goes to the scroller, so an embedded run still gets its keys.
  field.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.sode-gridpanel__xp, .sode-gridpanel__src, .sode-gridpanel__dst')) return;
    e.preventDefault();
    scroll.focus({ preventScroll: true });
  });
  field.addEventListener('click', (e) => {
    const xp = e.target.closest('.sode-gridpanel__xp');
    if (xp) return onPress(xpOf(xp), e);
    const name = e.target.closest('.sode-gridpanel__src, .sode-gridpanel__dst');
    if (name) onName(name.dataset.src ? 'srcs' : 'dsts', Number(name.dataset.src ?? name.dataset.dst), e);
  });
  // Nodes move between items on a scroll, so the item is read from the node at the click.
  field.addEventListener('contextmenu', (e) => {
    // Android sends a long-press as a menu; on touch a long-press is a line or a range (gridpanelgesture.js).
    if (e.pointerType === 'touch') return e.preventDefault();
    const xp = e.target.closest('.sode-gridpanel__xp');
    const name = !xp && e.target.closest('.sode-gridpanel__src, .sode-gridpanel__dst');
    if (!xp && !name) return;
    e.preventDefault();
    if (xp) onJump?.('xp', xpOf(xp));
    else onJump?.(name.dataset.src ? 'srcs' : 'dsts', Number(name.dataset.src ?? name.dataset.dst));
  });
  // A Shift-click would otherwise extend a text selection on the page.
  field.addEventListener('mousedown', (e) => {
    if (e.shiftKey && !head.contains(e.target)) e.preventDefault();
  });
  // Over the search boxes the cursor stays where Find put it.
  // A finger has no hover: its moves are a scroll or a line, so the cursor stays and the targets show from the picks.
  const onMove = (e) => e.pointerType === 'touch' || head.contains(e.target) || onPoint(e.clientX, e.clientY);
  scroll.addEventListener('pointermove', onMove, { passive: true });
  // Not passive, so a wheel over the horizontal scroll bar can scroll across instead of down. Chrome makes the rest of
  // a wheel turn async once its first event goes by.
  const onWheel = (e) => {
    const m = metricsNow();
    const bar = { left: m.x, right: m.x + m.cw, top: m.y + m.ch, bottom: m.y + scroll.offsetHeight, line: px.xp, page: m.cw };
    const dx = wheelAcross(e, bar);
    if (!dx) return;
    e.preventDefault();
    scroll.scrollLeft += dx;
  };
  scroll.addEventListener('wheel', onWheel, { passive: false });
  measure();
  setAxes(axes);

  const at = (map, n) => map.get(n) ?? -1;
  const nodeOf = (src, dst) => {
    const k = `${at(dstAt, dst)},${at(srcAt, src)}`;
    for (const p of xpPools) {
      const n = p.live.get(k);
      if (n) return n;
    }
    return null;
  };
  return {
    scroll,
    field,
    overlay,
    head,
    get axes() {
      return ax;
    },
    setAxes,
    // Cell px sizes: xp is one crosspoint, w the Destination bar width, h the Source bar height.
    metrics: () => ({ ...px }),
    spans,
    // A client point in crosspoint units (gridpanelline.js), display order. A pinned band does not scroll.
    unitsAt(x, y) {
      const m = metricsNow();
      const p = local(x, y, m);
      const unit = (v, a) => {
        const k = (v - a.head) / a.size;
        return k < a.pins ? k : k + a.offset / a.size;
      };
      return { x: unit(p.x, axis(true, m)), y: unit(p.y, axis(false, m)) };
    },
    // The scroller's body in client px: past the name bars and the pinned bands, inside the scrollbars.
    bodyBox() {
      const m = metricsNow();
      return { left: m.x + px.w + pinned.srcs * px.xp, top: m.y + px.h + pinned.dsts * px.xp, right: m.x + m.cw, bottom: m.y + m.ch };
    },
    // Draws the Drawn line from a to b, in crosspoint units, or hides it for null.
    line(seg) {
      svg.toggleAttribute('hidden', !seg);
      if (!seg) return;
      const set = (k, v) => lineNode.setAttribute(k, String(v));
      set('x1', px.w + seg.a.x * px.xp);
      set('y1', px.h + seg.a.y * px.xp);
      set('x2', px.w + seg.b.x * px.xp);
      set('y2', px.h + seg.b.y * px.xp);
    },
    // The display cell { i, j } under a client point, -1 on a bar, or null past the last item or on a scrollbar.
    cellAt(x, y) {
      const m = metricsNow();
      const p = local(x, y, m);
      if (p.x >= m.cw || p.y >= m.ch) return null;
      const j = slotAt(p.x, axis(true, m));
      const i = slotAt(p.y, axis(false, m));
      return i === null || j === null ? null : { i, j };
    },
    // Places the cursor at display cell { i, j }. Only the cursor node changes.
    // keys is true when a key moved it: only then does the cursor draw its box on a bar.
    cursor(c, keys = false) {
      cur = c;
      setData(cursor, 'keys', keys ? '' : undefined);
      setData(cursor, 'i', String(c.i));
      setData(cursor, 'j', String(c.j));
      placeCursor();
      cueNames();
    },
    // Whole scrolling rows and columns one screen shows.
    page() {
      const m = metricsNow();
      return { rows: pageOf(axis(false, m)), cols: pageOf(axis(true, m)) };
    },
    // Scrolls as little as it can to show display cell { i, j } whole; a bar (-1) keeps that axis where it is.
    // Fresh metrics, since a draw's listener can scroll.
    reveal({ i, j }) {
      if (j >= 0) scroll.scrollLeft = scrollFor(j, axis(true, read()));
      if (i >= 0) scroll.scrollTop = scrollFor(i, axis(false, read()));
    },
    // Find: scrolls one axis so display item k of kind ('srcs' or 'dsts') is in the middle, smoothly, then pulses its
    // name.
    glide(kind, k) {
      const cols = kind === 'srcs';
      const to = centreFor(k, axis(cols, read()));
      goTo({ [cols ? 'left' : 'top']: to }, { srcs: cols ? ax.srcs[k] : null, dsts: cols ? null : ax.dsts[k] });
    },
    // A jump: scrolls so display cell { i, j } is in the middle on both axes, smoothly, then pulses the crosspoint and
    // its two names. A bar (-1) keeps that axis where it is.
    jump({ i, j }) {
      const m = read();
      const to = {};
      if (j >= 0) to.left = centreFor(j, axis(true, m));
      if (i >= 0) to.top = centreFor(i, axis(false, m));
      goTo(to, { srcs: j >= 0 ? ax.srcs[j] : null, dsts: i >= 0 ? ax.dsts[i] : null });
    },
    // The crosspoint under a client point, or null on a name, a gap or outside.
    hit(x, y) {
      const m = metricsNow();
      const p = local(x, y, m);
      const j = indexAt(p.x, axis(true, m));
      const i = indexAt(p.y, axis(false, m));
      return i < 0 || j < 0 ? null : { src: ax.srcs[j], dst: ax.dsts[i], i, j };
    },
    // The drawn crosspoint node of src and dst, or null when it is out of view.
    node: (src, dst) => nodeOf(src, dst),
    // f() runs after each draw: a scroll, a resize or new axes.
    onDraw(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    // view: { names (namesFrom), levels (GET /tally levels), levelText(list), pie(src, dst) -> levels on,
    // staged(src, dst) -> levels staged, picked(kind, n), found(kind, n), leftOut(src, dst), protected(dst) }.
    // view.held(dst) is true when a route to dst is staged.
    // view.other(dst) is { text, tip }, and view.art(kind, n) is { icon, url, mask, b } or null.
    // kind is 'srcs' or 'dsts'. Only drawn nodes are painted.
    paint(v) {
      view = v;
      for (const p of xpPools) for (const n of p.live.values()) paintXp(n, Number(n.dataset.src), Number(n.dataset.dst), v);
      for (const p of [pools.srcs, pools.srcPinned]) for (const n of p.live.values()) paintSrc(n, Number(n.dataset.src));
      for (const p of [pools.dsts, pools.dstPinned]) for (const n of p.live.values()) paintDst(n, Number(n.dataset.dst));
    },
    // The routes a press would stage, numbered, and their names outlined. pairs is [{ src, dst }] in press order, or
    // empty; over marks a press past the cap. skipped is the protected pairs a Drawn line passes over. Only drawn nodes that carry a mark, or get one, are touched.
    preview(pairs, over, skipped = []) {
      mark = {
        xps: new Map(pairs.map(({ src, dst }, k) => [`${src}:${dst}`, k + 1])),
        skip: new Set(skipped.map(({ src, dst }) => `${src}:${dst}`)),
        srcs: new Set(pairs.map((p) => p.src)),
        dsts: new Set(pairs.map((p) => p.dst)),
      };
      for (const n of [...marked]) markXp(n, Number(n.dataset.src), Number(n.dataset.dst));
      for (const { src, dst } of [...pairs, ...skipped]) {
        const xp = nodeOf(src, dst);
        if (xp) markXp(xp, src, dst);
      }
      // The drawn names are a few dozen, so each is checked.
      for (const p of [pools.srcs, pools.srcPinned]) for (const n of p.live.values()) markName(n, mark.srcs.has(Number(n.dataset.src)));
      for (const p of [pools.dsts, pools.dstPinned]) for (const n of p.live.values()) markName(n, mark.dsts.has(Number(n.dataset.dst)));
      setData(field, 'over', over && pairs.length ? '' : undefined);
      setData(field, 'marked', mark.srcs.size || mark.dsts.size ? '' : undefined);
    },
    previewing: () => mark.xps.size > 0 || mark.srcs.size > 0 || mark.skip.size > 0,
    stop() {
      ro.disconnect();
      scroll.removeEventListener('scroll', onScroll);
      scroll.removeEventListener('pointermove', onMove);
      scroll.removeEventListener('wheel', onWheel);
      if (hitEnd) clearTimeout(hitEnd.timer);
      listeners.clear();
    },
  };
}
