// Fits each Buttons panel cell's words inside its square (panels.css, data-fit). A cell is measured after fill
// changed its words (b._fitDirty). Every cell is measured after a resize or a font load. The idle paint measures
// nothing. All cells to fit move through each step together, so a pass costs a few layouts, not a few per cell.

// --fit is a multiplier on the cell's own font size; CSS holds the text at --pb-text-2xs, so lower tries change nothing.
const LOWEST = 0.2;
const STEPS = 6;
const MOST_LINES = 12;

const over = (b) => b.scrollWidth > b.clientWidth || b.scrollHeight > b.clientHeight;

function fitCells(cells) {
  for (const b of cells) {
    delete b.dataset.fit;
    b.style.removeProperty('--fit');
    b.style.removeProperty('--fit-lines');
  }
  const todo = cells.filter((b) => !b.dataset.hideText && over(b));
  if (!todo.length) return;
  const lo = new Map(todo.map((b) => [b, LOWEST]));
  const hi = new Map(todo.map((b) => [b, 1]));
  for (let i = 0; i < STEPS; i++) {
    for (const b of todo) b.style.setProperty('--fit', ((lo.get(b) + hi.get(b)) / 2).toFixed(3));
    for (const b of todo) {
      const mid = (lo.get(b) + hi.get(b)) / 2;
      (over(b) ? hi : lo).set(b, mid);
    }
  }
  for (const b of todo) b.style.setProperty('--fit', lo.get(b).toFixed(3));
  // At the smallest size the words still do not fit: they wrap anywhere and lose lines from the end.
  let cut = todo.filter(over);
  for (const b of cut) b.dataset.fit = 'cut';
  for (let n = MOST_LINES; cut.length && n >= 1; n--) {
    for (const b of cut) b.style.setProperty('--fit-lines', n);
    cut = cut.filter(over);
  }
}

// host is the grid; update(nodes) after each paint. stop() before the grid goes.
export function createFit(host) {
  let nodes = [];
  let every = true;
  let frame = 0;
  const run = () => {
    frame = 0;
    const todo = nodes.filter((b) => every || b._fitDirty);
    every = false;
    for (const b of todo) b._fitDirty = false;
    fitCells(todo);
  };
  const ask = () => {
    if (!frame) frame = requestAnimationFrame(run);
  };
  const all = () => {
    every = true;
    ask();
  };
  const seen = new ResizeObserver(all);
  seen.observe(host);
  document.fonts?.addEventListener('loadingdone', all);
  return {
    update(next) {
      if (next !== nodes) every = true;
      nodes = next;
      if (every || nodes.some((b) => b._fitDirty)) ask();
    },
    stop() {
      seen.disconnect();
      document.fonts?.removeEventListener('loadingdone', all);
      cancelAnimationFrame(frame);
    },
  };
}
