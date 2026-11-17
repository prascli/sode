package app

import (
	"fmt"
	"testing"

	"github.com/sethdotfm/sode/internal/config"
)

// fitProblems lists the cells whose words leave their square, whose square is not square, or whose text is smaller
// than --pb-text-2xs. It waits up to 4 s for the page to fit and returns "" when all is well.
const fitProblems = `new Promise((res) => {
	const floor = 0.625 * parseFloat(getComputedStyle(document.documentElement).fontSize) - 0.1;
	const check = () => [...document.querySelectorAll('.sode-panel__cell')].flatMap((c, i) => {
		const r = c.getBoundingClientRect(), out = [];
		const tag = i + ':' + c.className.match(/--(\w+)/)[1];
		if (c.scrollWidth > c.clientWidth) out.push(tag + ' wide ' + c.scrollWidth + '>' + c.clientWidth);
		// Lines past the square's room at one line each are cut from the end, but the first stays whole.
		const first = c.querySelector('.sode-panel__text').getBoundingClientRect();
		const oneLine = c.dataset.fit === 'cut' && c.style.getPropertyValue('--fit-lines') === '1';
		if (oneLine && (first.top < r.top || first.bottom > r.bottom)) out.push(tag + ' first line cut');
		if (!oneLine && c.scrollHeight > c.clientHeight) out.push(tag + ' tall ' + c.scrollHeight + '>' + c.clientHeight);
		if (c.dataset.span !== '1' && Math.abs(r.width - r.height) > 2) out.push(tag + ' not square ' + Math.round(r.width) + 'x' + Math.round(r.height));
		for (const t of c.querySelectorAll('.sode-panel__text')) {
			const fs = parseFloat(getComputedStyle(t).fontSize);
			if (fs < floor) out.push(tag + ' text ' + fs + 'px');
			// A cut box shows whole lines only; the cell's flex column must not squeeze it.
			const lines = t.clientHeight / parseFloat(getComputedStyle(t).lineHeight);
			if (c.dataset.fit === 'cut' && (lines < 0.9 || Math.abs(lines - Math.round(lines)) > 0.15)) out.push(tag + ' cut at ' + lines.toFixed(2) + ' lines');
		}
		return out;
	});
	let n = 0;
	const tick = () => { const p = check(); if (!p.length || ++n > 40) res(p.join('; ')); else setTimeout(tick, 100); };
	tick();
})`

// Long names on a Buttons panel stay inside their squares at desktop and phone widths. The text shrinks down to
// --pb-text-2xs, and past that an ellipsis cuts it. Long names never make a row taller. A Grid panel's name cells
// hold a 16-character name (the longest SODE_NAME_LEN asks for) inside them.
func TestChromePanelLongNamesFitTheirSquares(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim, func(c *config.Config) { c.Users[0].Trusted = true })
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	const words = "Studio A camera left wide shot program feed backup number two"
	const unbroken = "Averyveryverylongunbrokencaptionthatwouldrunoffthesquare"
	cells := fmt.Sprintf(`{"r":1,"c":1,"kind":"source","n":1,"caption":%[1]q},{"r":1,"c":2,"kind":"source","n":2,"caption":%[2]q},
		{"r":1,"c":3,"kind":"destination","n":3,"caption":%[1]q},{"r":1,"c":4,"kind":"destination","n":4,"caption":%[2]q},
		{"r":1,"c":5,"kind":"clear","caption":%[1]q,"fontSize":200},{"r":1,"c":6,"kind":"take","caption":%[2]q},
		{"r":1,"c":7,"kind":"panelName"},{"r":1,"c":8,"kind":"source","n":5},
		{"r":2,"c":1,"rs":1,"cs":2,"kind":"source","n":6,"caption":%[1]q,"fontSize":200},
		{"r":2,"c":3,"kind":"current","caption":%[2]q}`, words, unbroken)
	id := makePanel(t, a, ana, `{"name":"`+words+`","acts":"api","rows":4,"cols":8,"cells":[`+cells+`],"settings":{"mode":"take"}}`)
	secret, _ := mintKey(t, a, ana, id)
	grid := makePanel(t, a, ana, `{"name":"Grid fit","acts":"api","type":"grid","settings":{"mode":"take"}}`)
	gridKey, _ := mintKey(t, a, ana, grid)
	waitNamesAndTally(t, a, ana)

	for _, w := range []struct {
		name  string
		w, h  int
		phone bool
	}{{"desktop", 1280, 800, false}, {"phone", 390, 844, true}} {
		b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": w.w, "height": w.h, "deviceScaleFactor": 1, "mobile": w.phone})
		b.call("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": w.phone, "maxTouchPoints": 5})
		b.open(srv.URL + "/panels/" + id + "?instance=Fit#key=" + secret)
		b.waitFor(w.name+": the grid", `document.querySelectorAll('.sode-panel__cell').length === 10`)
		if w.phone {
			b.waitFor("the phone layout", `document.documentElement.dataset.layout === 'phone'`)
		}
		// The merged cell is not square; mark it so the check skips only that test for it.
		b.eval(`document.querySelectorAll('.sode-panel__cell--source')[3].dataset.span = '1'; true`)
		// View the long destination and stage a source on the other, so a destination shows all its lines.
		b.eval(`(() => { const d = document.querySelectorAll('.sode-panel__cell--destination'); d[1].click(); document.querySelector('.sode-panel__cell--source').click(); d[0].click(); })()`)
		b.waitFor(w.name+": a staged destination", `!!document.querySelector('.sode-panel__staged')`)
		if p := b.eval(fitProblems); p != "" {
			t.Errorf("%s: %v", w.name, p)
		}
		b.shot("buttons-" + w.name)
	}

	// A narrower window without a reload fits the text again.
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 700, "height": 800, "deviceScaleFactor": 1, "mobile": false})
	b.call("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": false})
	b.waitFor("the grid is narrower", `document.querySelector('.sode-panel__grid').getBoundingClientRect().width < 700`)
	if p := b.eval(fitProblems); p != "" {
		t.Errorf("after a resize: %v", p)
	}

	for _, w := range []struct {
		name  string
		w, h  int
		phone bool
	}{{"desktop", 1280, 800, false}, {"phone", 390, 844, true}} {
		b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": w.w, "height": w.h, "deviceScaleFactor": 1, "mobile": w.phone})
		b.call("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": w.phone, "maxTouchPoints": 5})
		b.open(srv.URL + "/panels/" + grid + "?instance=Fit#key=" + gridKey)
		b.waitFor(w.name+": the Grid panel", gridXp(2, 2)+` !== null`)
		// The widest 16 characters, put in the first shown source and destination names.
		v := b.eval(`(() => {
			const out = [];
			for (const sel of ['.sode-gridpanel__src', '.sode-gridpanel__dst']) {
				const n = document.querySelector(sel + ':not([hidden])');
				n.firstChild.data = 'WWWWWWWWWWWWWWWW';
				if (n.scrollWidth > n.clientWidth || n.scrollHeight > n.clientHeight) out.push(sel + ' ' + n.scrollWidth + 'x' + n.scrollHeight + ' in ' + n.clientWidth + 'x' + n.clientHeight);
			}
			return out.join('; ');
		})()`)
		if v != "" {
			t.Errorf("%s Grid names: %v", w.name, v)
		}
	}
	b.check()
	// The page holds its instance stream open, and the server's Close waits for it.
	b.open("about:blank")
}
