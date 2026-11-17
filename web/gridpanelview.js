// Draws a Grid panel, virtualised on both axes (gridpanelwindow.js picks what shows). The Source bar is across
// the top and the Destination bar down the side. Pinned items sit in sticky bands at those edges.
// A node is moved to another crosspoint or name as the grid scrolls, so nodes hold no state of their own.
// Everything shown comes from the view that paint is given. docs/agents/panels.md has the layer plan.
import { el, icon } from './core.js';
import { iconHref } from './sprite.js';
import { pieFill } from './gridpanellevels.js';
import { axisSpan, spanMax, indexAt, slotAt, pageOf, placeAt, scrollFor, OVER } from './gridpanelwindow.js';

const PULSE_MS = 2000; // keep in step with --panel-pulse-s in panels.css
// A newly pulsing node starts in step with the others. All count from time zero.
export const pulseDelay = () => `${-(document.timeline.currentTime % PULSE_MS)}ms`;

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
  const pie = xp.firstChild;
  // The browser rewrites a style it reads back, so the last value set is kept on the node.
  if (pie._fill !== fill) {
    pie._fill = fill;
    pie.style.background = fill;
  }
  // data-s staged is the attribute the panel pulse watches (panels.css). A route left out does not pulse.
  const staged = view.staged(s, d);
  const out = staged.length > 0 && view.leftOut(s, d);
  const prot = view.protected(d);
  const st = out ? 'left-out' : staged.length ? 'staged' : undefined;
  // A staged crosspoint runs the pulse itself (gridpanel.css). The delay puts it in step with the others.
  if (st === 'staged' && xp.dataset.s !== 'staged') xp.style.animationDelay = pulseDelay();
  setData(xp, 's', st);
  setData(xp, 'on', on.length ? on.join(',') : undefined);
  if (xp.getAttribute('aria-disabled') !== String(prot)) xp.setAttribute('aria-disabled', String(prot));
  const state = out ? ', staged, left out of the take' : staged.length ? ', staged' : '';
  const label = `${view.names.source(s)} to ${view.names.destination(d)}${on.length ? `, levels ${view.levelText(on)}` : ''}${prot ? ', protected' : ''}${state}`;
  if (xp.getAttribute('aria-label') !== label) xp.setAttribute('aria-label', label);
}

const makeXp = () => {
  const xp = el('button', 'sode-gridpanel__xp', el('span', 'sode-gridpanel__pie'));
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
  svg.hidden = img.hidden = mask.hidden = true;
  img.alt = '';
  return row;
};
const makeSrc = () => {
  const n = makeName('pb-xpt--source sode-gridpanel__src', 'columnheader')();
  n.append(makeArt());
  return n;
};
// After the name's Text: the protected mark (the lock never stands alone), the current sources the grid does not
// show, then the artwork. Made once, so a paint changes only Text data and hidden.
const makeDst = () => {
  const n = makeName('pb-xpt--dest sode-gridpanel__dst', 'rowheader')();
  const prot = el('small', 'sode-gridpanel__prot', icon('lock'), document.createTextNode(''));
  const other = el('small', 'sode-gridpanel__other', document.createTextNode(''));
  prot.hidden = other.hidden = true;
  n.append(prot, other, makeArt());
  return n;
};

const show = (n, on) => {
  if (n.hidden === on) n.hidden = !on;
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
  const [, prot, other] = n.childNodes;
  const p = view.protected(d);
  n.classList.toggle('pb-xpt--protected', p);
  if (prot.hidden === p) prot.hidden = !p;
  if (prot.lastChild.data !== (p ? ' Protected' : '')) prot.lastChild.data = p ? ' Protected' : '';
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

// host is the run's grid element; axes is gridAxes plus srcPins and dstPins. onPress({ src, dst }) is a crosspoint
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
  const head = el('div', 'sode-gridpanel__head');
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
  svg.hidden = true;
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
  host.append(el('div', 'pb-grid sode-gridpanel__frame', scroll));

  let ax = axes;
  let srcAt = new Map(); // router number to display index
  let dstAt = new Map();
  let view = null;
  // The press preview (g.preview): numbered crosspoints by "s:d" and outlined names.
  let mark = { xps: new Map(), skip: new Set(), srcs: new Set(), dsts: new Set() };
  const marked = new Set(); // crosspoint nodes that carry a number
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
  const paintSrc = (n, s) => {
    if (view) {
      setText(n, view.names.source(s));
      pick(n, view.picked('srcs', s));
      setData(n, 'found', view.found('srcs', s) ? '' : undefined);
      paintArt(n.lastChild, view.art('srcs', s));
    }
    markName(n, mark.srcs.has(s));
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
  };
  const xpPut = (n, i, j) => {
    place(n, i, j);
    const s = ax.srcs[j];
    const d = ax.dsts[i];
    n.dataset.src = s;
    n.dataset.dst = d;
    if (view) paintXp(n, s, d, view);
    markXp(n, s, d);
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
  const axis = (cols, m = metricsNow()) => ({
    n: cols ? ax.srcs.length : ax.dsts.length,
    pins: (cols ? ax.srcPins : ax.dstPins) || 0,
    size: px.xp,
    head: cols ? px.w : px.h,
    offset: cols ? m.left : m.top,
    view: cols ? m.cw : m.ch,
    over: OVER,
  });
  const spans = (m = metricsNow()) => ({ rows: axisSpan(axis(false, m)), cols: axisSpan(axis(true, m)) });
  // A client point in scroller px, from its padding edge.
  const local = (x, y, m = metricsNow()) => ({ x: x - m.x, y: y - m.y });

  // Display position { i, j } of the cursor, -1 on a bar. A bar or pinned item is sticky, so each draw places it again.
  let cur = { i: -1, j: -1 };
  let curKey = '';
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
    setData(cursor, 'bar', cur.i < 0 || cur.j < 0 ? '' : undefined);
    cursor.hidden = hide;
  };

  const reserve = () => {
    const m = metricsNow();
    const r = spanMax(axis(false, m));
    const c = spanMax(axis(true, m));
    const rp = ax.dstPins || 0;
    const cp = ax.srcPins || 0;
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
    const rp = range(0, ax.dstPins || 0);
    const cp = range(0, ax.srcPins || 0);
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
    srcAt = new Map(ax.srcs.map((n, j) => [n, j]));
    dstAt = new Map(ax.dsts.map((n, i) => [n, i]));
    setVar(field, '--sode-cols', ax.srcs.length);
    setVar(field, '--sode-rows', ax.dsts.length);
    setVar(field, '--sode-col-pins', ax.srcPins || 0);
    setVar(field, '--sode-row-pins', ax.dstPins || 0);
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
    reserve();
    draw();
  });
  ro.observe(scroll);
  ro.observe(probe);
  const xpOf = (xp) => ({ src: Number(xp.dataset.src), dst: Number(xp.dataset.dst) });
  field.addEventListener('click', (e) => {
    const xp = e.target.closest('.sode-gridpanel__xp');
    if (xp) return onPress(xpOf(xp));
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
      return { left: m.x + px.w + (ax.srcPins || 0) * px.xp, top: m.y + px.h + (ax.dstPins || 0) * px.xp, right: m.x + m.cw, bottom: m.y + m.ch };
    },
    // Draws the Drawn line from a to b, in crosspoint units, or hides it for null.
    line(seg) {
      svg.hidden = !seg;
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
    cursor(c) {
      cur = c;
      setData(cursor, 'i', String(c.i));
      setData(cursor, 'j', String(c.j));
      placeCursor();
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
    },
    previewing: () => mark.xps.size > 0 || mark.srcs.size > 0 || mark.skip.size > 0,
    stop() {
      ro.disconnect();
      scroll.removeEventListener('scroll', onScroll);
      scroll.removeEventListener('pointermove', onMove);
      listeners.clear();
    },
  };
}
