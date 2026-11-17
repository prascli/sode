// The Source bar and Destination bar search boxes of a Grid panel. The rules are in gridpanelfind.js and
// the keys in gridpanelkeys.js (findBoxAction); the run (gridpanelrun.js) joins them.
import { el, icon } from './core.js';

const NOUN = { srcs: 'sources', dsts: 'destinations' };
const KEY = { srcs: 's', dsts: 'd' };
const MODE = { find: 'Find', filter: 'Filter' };

// Each bar's step buttons point along it. Keep the key names in step with BOX in gridpanelkeys.js.
const STEPS = {
  srcs: [
    [-1, 'chevron-left', 'Previous match. Shift+Enter or Ctrl+P'],
    [1, 'chevron-right', 'Next match. Enter or Ctrl+N'],
  ],
  dsts: [
    [-1, 'chevron-up', 'Previous match. Shift+Enter or Ctrl+P'],
    [1, 'chevron-down', 'Next match. Enter or Ctrl+N'],
  ],
};

// host is the deck's search slot (gridpanelheadview.js), or the view's corner (g.head) in the editor's live test.
// onText(kind, text) on each edit; onMode() on a press of the other mode; onStep(kind, dir) on a step button press,
// dir 1 for the next match. One mode serves both boxes. The step buttons show only while the box has text, which is
// when they do something and the placeholder is gone.
export function findBoxes(host, { onText, onMode, onStep }) {
  const make = (kind) => {
    const input = el('input', 'pb-input sode-gridpanel__find-input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = `${MODE.find} ${NOUN[kind]}`;
    input.setAttribute('aria-label', input.placeholder);
    input.setAttribute('aria-keyshortcuts', KEY[kind]);
    const count = el('span', 'sode-gridpanel__find-count', document.createTextNode(''));
    count.setAttribute('aria-live', 'polite');
    const key = el('kbd', 'sode-gridpanel__find-key', KEY[kind]);
    key.setAttribute('aria-hidden', 'true');
    // Tab goes between the boxes, so the buttons are out of the Tab order, as the mode button is.
    const steps = STEPS[kind].map(([dir, name, tip]) => {
      const b = el('button', 'pb-btn pb-btn--ghost pb-btn--icon pb-btn--sm sode-gridpanel__find-step', icon(name));
      b.type = 'button';
      b.tabIndex = -1;
      b.hidden = true;
      b.dataset.dir = String(dir);
      b.dataset.pbTip = tip;
      b.setAttribute('aria-label', tip.split('.')[0]);
      b.addEventListener('click', () => {
        onStep(kind, dir);
        input.focus();
      });
      return b;
    });
    const wrap = el('div', 'sode-gridpanel__find', el('span', 'sode-gridpanel__find-field', input, count, key), ...steps);
    wrap.dataset.kind = kind;
    wrap.dataset.mode = 'find';
    input.addEventListener('input', () => onText(kind, input.value));
    return { wrap, input, count, steps };
  };
  const boxes = { srcs: make('srcs'), dsts: make('dsts') };
  let last = 'srcs';
  let now = 'find';
  // Find and Filter side by side (patchbay's pb-btn-group); the pressed one is the mode of both boxes.
  const modeBtn = (m) => {
    const b = el('button', 'pb-btn pb-btn--outline', document.createTextNode(MODE[m]));
    b.type = 'button';
    b.tabIndex = -1;
    b.dataset.mode = m;
    b.setAttribute('aria-pressed', String(m === now));
    b.addEventListener('click', () => {
      if (m !== now) onMode();
      boxes[last].input.focus();
    });
    return b;
  };
  const modes = { find: modeBtn('find'), filter: modeBtn('filter') };
  const mode = el('div', 'pb-btn-group sode-gridpanel__find-mode', modes.find, modes.filter);
  mode.setAttribute('role', 'group');
  mode.setAttribute('aria-label', 'Search mode');
  mode.dataset.pbTip = 'Find marks matches. Filter shows only matches. Ctrl+/';
  host.prepend(boxes.srcs.wrap, boxes.dsts.wrap, mode);
  return {
    input: (kind) => boxes[kind].input,
    // 'srcs' or 'dsts' when node is in that box, else null.
    kindOf(node) {
      for (const k of ['srcs', 'dsts']) if (node instanceof Node && boxes[k].wrap.contains(node)) return k;
      return null;
    },
    // find is gridpanelfind.js state; counts[kind] is { n: matches, at: the current match's place from 1 }.
    paint(find, counts) {
      last = find.last;
      now = find.mode;
      for (const m of ['find', 'filter'])
        if (modes[m].getAttribute('aria-pressed') !== String(m === now)) modes[m].setAttribute('aria-pressed', String(m === now));
      for (const k of ['srcs', 'dsts']) {
        const b = boxes[k];
        const box = find[k];
        if (b.input.value !== box.text) b.input.value = box.text;
        if (b.wrap.dataset.mode !== find.mode) b.wrap.dataset.mode = find.mode;
        const word = `${MODE[find.mode]} ${NOUN[k]}`;
        if (b.input.placeholder !== word) b.input.placeholder = word;
        if (b.input.getAttribute('aria-label') !== word) b.input.setAttribute('aria-label', word);
        const c = counts[k];
        const text = !box.text.trim() ? '' : c.n ? `${c.at} of ${c.n}` : 'No match';
        if (b.count.firstChild.data !== text) b.count.firstChild.data = text;
        b.wrap.toggleAttribute('data-counted', !!text);
        for (const s of b.steps) {
          if (s.hidden !== !text) s.hidden = !text;
          if (s.disabled !== !c.n) s.disabled = !c.n;
        }
      }
    },
  };
}
