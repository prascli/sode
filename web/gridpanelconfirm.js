// A Grid panel's take confirm. It is the main page's churning-letter confirm (keyconfirm.js) over the #confirm markup
// in panel.html, with a summary in the main page's plan look. Levels and labels come from the adapter's GET /tally,
// since the panel page has no S.levels. Its lockout is lockout.js's: the configured value once the socket's hello
// has filled S.cfg, else 500 ms.
import { el } from './core.js';
import { keyConfirm } from './keyconfirm.js';
import { levelColor } from './levelbox.js';
import { levelTextOf } from './levels.js';

// The main page's level bar (levelview.js levelBar) with the levels passed in: a fixed slot per level.
function levelBar(tally, on) {
  const levels = tally.levels;
  const set = new Set(on);
  const row = el(
    'span',
    'sode__bar',
    ...levels.map((l) => {
      const slot = el('span', 'sode__slot' + (set.has(l.level) ? ' sode__slot--on' : ''), l.label);
      slot.dataset.hint = `Level ${l.label}`;
      return levelColor(slot, l);
    }),
  );
  const odd = levels.length % 2;
  if (odd) row.classList.add('sode__bar--odd');
  row.style.setProperty('--sode-bar-cols', Math.floor(levels.length / 2) + odd);
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `Levels ${levelTextOf(on, levels, tally.levelNumbering)}`);
  return row;
}

const strong = (t) => el('strong', null, t);

function routeRow(tally, g, dstName) {
  return el(
    'div',
    'sode__route',
    levelBar(tally, g.levels),
    el('span', 'sode__end sode__end--src', g.srcName),
    el('span', 'sode__arrow', '→'),
    el('span', 'sode__end sode__end--dst', dstName),
  );
}

// plan is planOf (gridpanelplan.js); tally() is the last GET /tally answer.
export function gridSummary(plan, tally) {
  const n = plan.items.length;
  const srcs = new Set(plan.items.flatMap((i) => i.groups.map((g) => g.src)));
  const firstSrc = plan.items[0].groups[0].srcName;
  const question = el(
    'div',
    null,
    'Are you sure you want to take ',
    ...(srcs.size === 1 ? ['Source ', strong(firstSrc)] : [strong(`${srcs.size} sources`)]),
    ' to ',
    ...(n === 1 ? ['Destination ', strong(plan.items[0].dstName)] : [strong(`${n} destinations`)]),
    '?',
  );
  if (n === 1) return [question, ...plan.items[0].groups.map((g) => routeRow(tally, g, plan.items[0].dstName))];
  return [
    question,
    ...plan.items.map((item, i) =>
      el(
        'section',
        'sode__plan-item',
        el('div', 'sode__plan-head', el('span', 'sode__plan-n', `${i + 1}/${n}`), strong(item.dstName)),
        ...item.groups.map((g) => routeRow(tally, g, item.dstName)),
      ),
    ),
  ];
}

// onTake(plan) sends; onClose(plan) is a cancel.
export function gridConfirm({ tally, onTake, onClose }) {
  return keyConfirm({
    verb: () => 'take',
    summary: (plan) => gridSummary(plan, tally()),
    prompt: (key) => ['Press ', key, ' to confirm, or escape to cancel.'],
    onTake: (plan) => onTake(plan),
    onClose: (plan) => onClose(plan),
  });
}
