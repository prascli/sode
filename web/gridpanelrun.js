// The Grid panel body of a panel run (panelrun.js). It reads and sends only through ctx, the run's /api/v1 adapter.
// So another adapter can drive the same view. ctx is { ui, embedded, call, callJSON, post, poll, ready, instance, touched }.
// The rules are pure modules (gridpanel*.js); this file joins them to the DOM.
import { envFrom, namesFrom } from './panelrules.js';
import { gridAxes } from './gridpaneledges.js';
import { createStage, pressCrosspoint, confirmRoutes, dropStaged, startSend, afterTake, stageText } from './gridpanelstage.js';
import { stageLevels, pieOn } from './gridpanellevels.js';
import { gridKeyAction } from './gridpanelkeys.js';
import { planOf } from './gridpanelplan.js';
import { gridConfirm } from './gridpanelconfirm.js';
import { buildGridPanel, paintGridPanel } from './gridpanelview.js';
import { pinsOf } from './gridpanelwindow.js';
import { levelTextOf } from './levels.js';

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
  let g = null;
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
  };

  const render = () => {
    if (g) paintGridPanel(g, view);
    const text = stageText(st.error) || (Date.now() - note.at < NOTE_MS ? note.text : '');
    say(ui.status, text);
    ui.status.classList.toggle('sode-panel__status--ok', !st.error && !!text && note.ok);
  };

  // The view moves its nodes to the new items only when the shown sources or destinations change.
  const rebuild = () => {
    const axes = gridAxes(panel, namesReply);
    const key = JSON.stringify(axes);
    if (key === axesKey) return;
    axesKey = key;
    const all = { ...axes, srcPins: pinsOf(panel.sources, axes.srcs), dstPins: pinsOf(panel.destinations, axes.dsts) };
    if (g) g.setAxes(all);
    else g = buildGridPanel(ui.grid, all, onPress);
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

  const confirm = document.getElementById('confirm')
    ? gridConfirm({
        tally: () => tally,
        onTake: (plan) => send(plan.routes),
        onClose: () => {},
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
    const r = pressCrosspoint(st, xp, stageLevels(panel.settings, tally, panel.rights));
    st = r.st;
    if (r.send) send(r.send);
    else render();
  }

  const onKey = (e) => {
    if (confirm?.isOpen()) return confirm.key(e);
    // The page lock's sign-in and dialogs take their keys first.
    if (e.defaultPrevented) return;
    const act = gridKeyAction(e, { staged: st.staged.length, inControl: inControl(ui.grid) });
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    if (act === 'confirm') openConfirm();
    else if (act === 'drop') {
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
      rebuild();
    },
    pending: () => ({ staged: st.staged.length > 0, busy: st.busy }),
    apply(p) {
      panel = p;
      st = stateOf(p, st);
      axesKey = '';
      rebuild();
      render();
    },
    renamed: render,
    stop() {
      document.removeEventListener('keydown', onKey, true);
      g?.stop();
      if (confirm?.isOpen()) confirm.close();
    },
  };
}
