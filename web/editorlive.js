// The editor's Test it live: the saved panel runs in place of the grid and sidebar (panelrun.js, embedded), over
// the editor's own session. It is not an instance of the panel, so it sends no keepalive.
// A Grid panel gets a bar over it that marks it as a preview. Its drawer holds the editor's own Sources and
// Destinations lists (editorgridlist.js), moved in for the run and back after it. Their edits show at once.
import { el, icon } from './core.js';
import { sessionFetch } from './sessionkey.js';
import { runPanel } from './panelrun.js';
import { liveUi } from './panelmount.js';
import { makeTabs } from './tabs.js';
import { btn } from './formbits.js';

// host holds the live panel, body is the editor it replaces, button is the toolbar's Test it live. ed is
// { save, dirty, readOnly, edges, lists }: edges() is { sources, destinations, rev } as the editor has them,
// lists() the two list columns.
export function createLive(host, body, button, ed) {
  const label = button.textContent;
  let run = null;
  let grid = null; // the bar and drawer of a Grid panel's run
  const api = {
    on: () => !!run,
    // page is the Page being edited, where the run opens.
    start(id, page = '', isGrid = false) {
      api.stop();
      grid = isGrid ? gridParts(ed) : null;
      const ui = liveUi(host, () => api.stop(), grid);
      host.hidden = false;
      body.hidden = true;
      button.textContent = 'Back to editing';
      run = runPanel(id, { ui, call: sessionFetch, page });
      grid?.started(run);
      ui.back.focus();
    },
    stop() {
      if (!run) return;
      run.stop();
      run = null;
      grid?.stop();
      grid = null;
      host.replaceChildren();
      host.hidden = true;
      body.hidden = false;
      button.textContent = label;
    },
    // The editor's fields or save state changed.
    changed: () => grid?.changed(),
  };
  return api;
}

function gridParts(ed) {
  const [srcs, dsts] = ed.lists();
  const home = srcs.parentNode;
  const ro = ed.readOnly();

  const state = el('span', 'sode-live__state');
  state.id = 'ed-live-state';
  state.setAttribute('role', 'status');
  const save = btn('pb-btn--ok pb-btn--sm', 'Save', async () => {
    save.disabled = true;
    const err = await ed.save();
    save.disabled = false;
    paint(err);
  });
  save.id = 'ed-live-save';
  const open = btn('pb-btn--outline pb-btn--sm', '', () => setOpen(!opened));
  open.id = 'ed-live-lists';
  open.append(icon('panel-right-open'), el('span', null, 'Edit lists'));
  open.dataset.pbTip = 'Change the order of the sources and destinations, pin, add and remove them';
  open.setAttribute('aria-controls', 'ed-live-drawer');
  open.hidden = ro;
  const bar = el(
    'div',
    'pb-banner pb-banner--info sode-live__bar',
    el('span', 'pb-badge pb-badge--info', 'Preview'),
    el('span', 'sode-live__what', 'A take here changes the router. List changes show at once.'),
    el('span', 'sode-panels__spacer'),
    state,
    save,
    open,
  );
  bar.id = 'ed-live-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Test it live');

  const close = btn('pb-btn--ghost pb-btn--icon pb-btn--sm', '', () => {
    setOpen(false);
    open.focus();
  });
  close.id = 'ed-live-close';
  close.append(icon('x'));
  close.setAttribute('aria-label', 'Close the lists');
  close.dataset.pbTip = 'Close the lists';
  const holder = (col) => el('div', 'sode-live__tab', col);
  const tabs = makeTabs([
    { id: 'ed-live-srcs', text: 'Sources', panel: holder(srcs) },
    { id: 'ed-live-dsts', text: 'Destinations', panel: holder(dsts) },
  ]);
  const panes = [srcs.parentNode, dsts.parentNode];
  const aside = el(
    'aside',
    'pb-drawer pb-drawer--right pb-drawer--wide sode-live__drawer',
    el('div', 'pb-drawer__body', el('div', 'sode-live__drawer-head', el('h2', 'sode-live__drawer-h', 'Edit lists'), close), tabs.node, ...panes),
  );
  aside.id = 'ed-live-drawer';
  aside.setAttribute('aria-label', 'Sources and destinations');
  // Esc in a list drops its selection (editorgridlist.js); Esc anywhere else in the drawer closes it.
  aside.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    setOpen(false);
    open.focus();
  });

  let opened = false;
  function setOpen(on) {
    opened = on;
    aside.classList.toggle('pb-drawer--open', on);
    // A closed drawer is zero wide, but its controls could still take focus.
    aside.inert = !on;
    open.setAttribute('aria-expanded', String(on));
  }
  setOpen(false);

  let run = null;
  let shown = ed.edges();
  function paint(err = '') {
    const dirty = ed.dirty();
    save.hidden = !dirty;
    state.textContent = err || (dirty ? 'Unsaved changes' : '');
  }
  paint();

  return {
    bar,
    aside,
    started(r) {
      run = r;
    },
    changed() {
      paint();
      const now = ed.edges();
      if (now.sources === shown.sources && now.destinations === shown.destinations && now.rev === shown.rev) return;
      const saved = now.rev !== shown.rev;
      shown = now;
      // A rev goes with the lists only after a save, so the run marks that copy as seen and shows no banner for it.
      run?.show({ sources: now.sources, destinations: now.destinations, ...(saved ? { rev: now.rev } : {}) });
    },
    stop() {
      home.append(srcs, dsts);
    },
  };
}
