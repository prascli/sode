// The Grid panel body of a panel run (panelrun.js). It reads and sends only through ctx, the run's /api/v1 adapter.
// So another adapter can drive the same view. ctx is { ui, embedded, call, callJSON, post, poll, ready, instance, touched }.
// The rules are pure modules (gridpanel*.js); this file joins them to the DOM.
import { envFrom, namesFrom } from './panelrules.js';
import { gridAxes } from './gridpaneledges.js';
import { createStage, stageRoutes, stagedCount, confirmRoutes, cancelConfirm, dropStaged, startSend, afterTake, stageText } from './gridpanelstage.js';
import { createPicks, pickName, pickCount, dropPicks, diagonal } from './gridpanelpick.js';
import { stageLevels, offeredLevels, boxFill, pieOn } from './gridpanellevels.js';
import { gridKeyAction } from './gridpanelkeys.js';
import { planOf } from './gridpanelplan.js';
import { gridConfirm } from './gridpanelconfirm.js';
import { buildGridPanel, paintGridPanel, previewGridPanel } from './gridpanelview.js';
import { pinsOf } from './gridpanelwindow.js';
import { levelTextOf, parseLevelsIn } from './levels.js';
import { levelBox } from './levelbox.js';
import { el } from './core.js';

const NOTE_MS = 4000;

const say = (n, text) => {
  if (n.textContent !== text) n.textContent = text;
  n.hidden = !text;
};

const stateOf = (p, was) => {
  const st = createStage({ mode: p.settings?.mode });
  // Instant mode holds nothing staged.
  return was && st.mode === 'take' ? { ...st, staged: was.staged, busy: was.busy } : { ...st, busy: !!was?.busy };
};

// A focused field or header button keeps its own Enter; the crosspoints are the grid's.
const inControl = (grid) => {
  const a = document.activeElement;
  return !!a && a !== document.body && !grid.contains(a) && a.matches('button, input, select, textarea, a[href], [contenteditable]');
};

export function gridBody(ctx, first) {
  const { ui } = ctx;
  let panel = first;
  let st = stateOf(panel);
  let tally = null;
  let env = envFrom({}, {});
  let names = namesFrom({});
  let namesReply = {};
  let axesKey = '';
  let axes = { srcs: [], dsts: [] };
  let g = null;
  let picks = createPicks();
  let at = null; // the crosspoint under the pointer, whose press the preview shows
  // "N staged" in the header: staged routes can be scrolled out of view.
  const count = el('span', 'pb-badge pb-badge--info sode-gridpanel__count');
  count.id = 'panel-staged';
  count.hidden = true;
  ui.head?.querySelector('.sode-panels__spacer')?.before(count);
  let note = { text: '', at: 0 }; // a result or refusal, shown for NOTE_MS

  const staged = (s, d) => st.staged.filter((x) => x.src === s && x.dst === d).map((x) => x.level);
  const view = {
    get names() {
      return names;
    },
    get levels() {
      return tally?.levels || [];
    },
    levelText: (list) => levelTextOf(list, tally?.levels || [], tally?.levelNumbering),
    pie: (s, d) => pieOn(env, s, d),
    staged,
    picked: (kind, n) => picks[kind].includes(n),
  };

  const pairsAt = (xp) => diagonal(picks, xp, axes);

  // Numbered targets only while names are picked; a press with none is the crosspoint itself.
  const preview = () => {
    const pairs = at && pickCount(picks) ? pairsAt(at) : [];
    previewGridPanel(g, pairs, pairs.length > 1 && stageRoutes(st, pairs, pressLevels()).st.error?.code === 'cap');
  };

  const render = () => {
    if (g) {
      paintGridPanel(g, view);
      preview();
    }
    const n = stagedCount(st);
    say(count, n ? `${n} staged` : '');
    const text = stageText(st.error) || (Date.now() - note.at < NOTE_MS ? note.text : '');
    say(ui.status, text);
    ui.status.classList.toggle('sode-panel__status--ok', !st.error && !!text && note.ok);
  };

  // The view moves its nodes to the new items only when the shown sources or destinations change.
  const rebuild = () => {
    const next = gridAxes(panel, namesReply);
    const key = JSON.stringify(next);
    if (key === axesKey) return;
    axesKey = key;
    axes = next;
    // Picks on names that left the panel go.
    picks = { ...picks, srcs: picks.srcs.filter((n) => next.srcs.includes(n)), dsts: picks.dsts.filter((n) => next.dsts.includes(n)) };
    at = null;
    const all = { ...axes, srcPins: pinsOf(panel.sources, axes.srcs), dstPins: pinsOf(panel.destinations, axes.dsts) };
    if (g) g.setAxes(all);
    else g = buildGridPanel(ui.grid, all, { onPress, onName, onAt });
  };

  async function send(routes) {
    st = startSend(st);
    render();
    let failed = null;
    try {
      const reply = await ctx.post('api/v1/takes', { routes });
      const bad = (reply?.results || []).filter((r) => !r.ok);
      note = bad.length
        ? { text: `Take failed on ${[...new Set(bad.map((r) => names.destination(r.dst)))].join(', ')}`, at: Date.now(), ok: false }
        : { text: `Taken: ${routes.length === 1 ? '1 route' : `${routes.length} routes`}`, at: Date.now(), ok: true };
    } catch (e) {
      failed = e.status === undefined ? 'Sode did not answer, so it is possible that the take was not sent' : e.message || 'The take was refused';
    }
    st = afterTake(st, failed);
    render();
    ctx.poll();
  }

  // The Levels box (levelbox.js). An embedded run has none, so the panel's levels setting stands in.
  const boxNode = document.getElementById('panel-levels');
  let boxKey = '';
  let filledKey = null;
  const boxSource = () =>
    tally && { levels: tally.levels, offered: offeredLevels(tally, panel.rights), numbering: tally.levelNumbering, defaultLevels: tally.defaultLevels || '' };
  const lvl = boxNode
    ? levelBox(document.getElementById('panel-lvl'), document.getElementById('panel-lvl-pick'), document.getElementById('panel-lvl-all'), boxSource, {
        hold: 'pointerdown',
      })
    : null;
  if (boxNode) boxNode.hidden = false;

  // The picker is made again when the offered levels or the numbering change. The setting fills the box on load,
  // and again only when a live update changes the setting, so typed text survives other updates.
  function syncBox() {
    if (!lvl || !tally) return;
    const key = JSON.stringify([offeredLevels(tally, panel.rights).map((l) => l.level), tally.levels.length, tally.levelNumbering]);
    if (key !== boxKey) {
      boxKey = key;
      lvl.reset();
    }
    const fk = JSON.stringify(panel.settings?.levels ?? null);
    if (fk === filledKey) return;
    filledKey = fk;
    const fill = boxFill(panel.settings, tally, panel.rights);
    if (fill) lvl.set(fill);
  }

  const pressLevels = () => {
    if (lvl) return stageLevels(lvl.levels(), tally, panel.rights);
    const src = boxSource();
    return src ? stageLevels(boxFill(panel.settings, tally, panel.rights) || parseLevelsIn('', src) || [], tally, panel.rights) : [];
  };

  const confirm = document.getElementById('confirm')
    ? gridConfirm({
        tally: () => tally,
        onTake: (plan) => send(plan.routes),
        onClose: () => {
          st = cancelConfirm(st);
          render();
        },
      })
    : null;

  function openConfirm() {
    const routes = confirmRoutes(st);
    if (!routes || !confirm || st.busy) return;
    confirm.open({ ...planOf(routes, names), routes });
  }

  function onPress(xp) {
    if (!ctx.ready() || st.busy || confirm?.isOpen()) return;
    ctx.touched();
    const r = stageRoutes(st, pairsAt(xp), pressLevels());
    st = r.st;
    if (r.send) send(r.send);
    else render();
    if (r.confirm) openConfirm();
  }

  function onName(kind, n, e) {
    if (!ctx.ready()) return;
    picks = pickName(picks, kind, n, { range: e.shiftKey, toggle: e.metaKey || e.ctrlKey }, axes[kind]);
    render();
  }

  function onAt(xp) {
    if (at?.src === xp?.src && at?.dst === xp?.dst) return;
    at = xp;
    // Only the preview: a full paint on each pointer move is too slow on a large grid.
    if (g && (pickCount(picks) || g.previewing())) preview();
  }

  const onKey = (e) => {
    if (confirm?.isOpen()) return confirm.key(e);
    // The page lock's sign-in and dialogs take their keys first.
    if (e.defaultPrevented) return;
    const act = gridKeyAction(e, { staged: st.staged.length, picks: pickCount(picks), inControl: inControl(ui.grid) });
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    if (act === 'confirm') openConfirm();
    else if (act === 'unpick') {
      picks = dropPicks(picks);
      render();
    } else if (act === 'levels') {
      const i = document.getElementById('panel-lvl');
      i?.focus();
      i?.select();
    } else if (act === 'drop') {
      st = dropStaged(st);
      render();
    }
  };
  // Capture, so the grid's Esc is handled before Kiosk mode's own (panelfull.js).
  document.addEventListener('keydown', onKey, true);

  return {
    render,
    data({ tally: t, prot, nm }) {
      tally = t;
      env = envFrom(t, prot, {}, panel.rights);
      if (nm) {
        namesReply = nm;
        names = namesFrom(nm);
      }
      syncBox();
      rebuild();
    },
    pending: () => ({ staged: st.staged.length > 0, busy: st.busy }),
    apply(p) {
      panel = p;
      st = stateOf(p, st);
      axesKey = '';
      syncBox();
      rebuild();
      render();
    },
    renamed: render,
    stop() {
      document.removeEventListener('keydown', onKey, true);
      g?.stop();
      count.remove();
      if (boxNode) boxNode.hidden = true;
      if (confirm?.isOpen()) confirm.close();
    },
  };
}
