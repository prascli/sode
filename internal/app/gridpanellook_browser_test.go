package app

import "testing"

// The Grid panel page at 1440 by 900. The header, the Levels box and the search boxes are one band, the deck. It
// holds the title and its line, the status boxes and buttons, and the Levels box like the main page's. Then come the
// search boxes with Find and Filter, Select none, Clear and the red Take. It checks the Sources row, the Destinations
// word, the picked row and column washes and the staged ring. The cursor ring, the staged ring and Take pulse in one
// phase.
// The grid goes down to the window's bottom and Full width is gone. Then it checks the panels list's picture and
// words for a Grid panel.
func TestChromeGridPanelLook(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Studio grid","type":"grid","settings":{"mode":"take","levels":[1,2]}}`)
	waitNamesAndTally(t, a, ana)

	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": false})
	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on') && !!`+gridXp(3, 3))

	b.waitFor("the header boxes and the line under the title", `(() => {
		const t = (s) => [...document.querySelectorAll(s)].map((n) => n.textContent.trim()).join('|');
		return t('.sode-gridpanel__stat-val') === 'Connected|Take|Ana' && t('.sode-gridpanel__stat > .pb-label') === 'Router|Mode|Signed in' &&
			t('.sode-gridpanel__meta').includes('Your panel') && t('.sode-gridpanel__meta').includes('Grid panel, 200 sources by 120 destinations') &&
			t('.sode-gridpanel__meta').includes('Can view and take') && !!document.querySelector('.sode-gridpanel__stat-val .pb-dot--ok');
	})()`)
	b.waitFor("one deck at the top holds the header, the Levels box and the search boxes, under 180 px high", `(() => {
		const deck = document.querySelector('.sode-gridpanel__deck');
		const r = deck.getBoundingClientRect();
		const inside = ['#panel-title', '.sode-gridpanel__tools', '#panel-lvl', '.sode-gridpanel__find[data-kind="srcs"] input', '#panel-take']
			.every((s) => { const n = deck.querySelector(s); const b = n?.getBoundingClientRect(); return b && b.top >= r.top && b.bottom <= r.bottom; });
		return r.top === 0 && r.height < 180 && inside && !document.querySelector('.sode-gridpanel__head .sode-gridpanel__find');
	})()`)
	b.waitFor("the Lock chip does not cover the title or the Levels box", `(() => {
		const c = document.querySelector('.sode-lock__who').getBoundingClientRect();
		const off = (s) => { const n = document.querySelector(s).getBoundingClientRect(); return n.top >= c.bottom || n.left >= c.right; };
		return off('#panel-title') && off('#panel-lvl-pick') && off('#panel-levels .sode__box-head');
	})()`)
	b.waitFor("the Levels box is the main page's: at least half its 336 px, large words that fit, as tall as the picks", `(() => {
		const i = document.getElementById('panel-lvl'), p = document.getElementById('panel-lvl-pick').getBoundingClientRect();
		const r = i.getBoundingClientRect(), cs = getComputedStyle(i);
		const c = document.createElement('canvas').getContext('2d');
		c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
		const fits = c.measureText(i.placeholder).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) <= i.clientWidth;
		return i.classList.contains('sode__input') && r.width >= 168 && cs.fontSize === '27.5px' && fits &&
			Math.abs(r.top - p.top) < 1 && Math.abs(r.height - p.height) < 1;
	})()`)
	b.waitFor("nothing in the deck is cut: the title, its line, Select none on one line", `(() => {
		const cut = (n) => n.scrollWidth > n.clientWidth + 1;
		const all = document.getElementById('panel-lvl-all');
		const line = [...all.children].map((n) => n.getBoundingClientRect().top);
		return !cut(document.getElementById('panel-title')) && ![...document.querySelectorAll('.sode-gridpanel__cut')].some(cut) &&
			/^Select(All|None)$/.test(all.textContent) && Math.abs(line[0] - line[1]) < 1 && document.documentElement.scrollWidth === innerWidth;
	})()`)
	b.waitFor("the user is named once, in the Signed in box: the Lock chip shows only its button", `(() => {
		const name = document.querySelector('.sode-lock__who-name');
		return !!document.querySelector('.sode-lock__who .pb-btn') && name.getClientRects().length === 0;
	})()`)
	b.waitFor("Find and Filter are one segmented pair, each as tall as a search box", `(() => {
		const [f, x] = document.querySelectorAll('.sode-gridpanel__find-mode > .pb-btn');
		const [fr, xr] = document.querySelectorAll('.sode-gridpanel__find-mode > input[type="radio"]');
		const box = document.querySelector('.sode-gridpanel__find[data-kind="srcs"] input').getBoundingClientRect();
		return f.textContent === 'Find' && fr.checked && x.textContent === 'Filter' && !xr.checked &&
			Math.abs(f.getBoundingClientRect().height - box.height) < 2 && Math.abs(x.getBoundingClientRect().height - box.height) < 2;
	})()`)
	b.waitFor("Full screen is an icon, Full width is gone and the Panels link is in the header", `(() => {
		const s = document.getElementById('panel-screen');
		return getComputedStyle(s, '::before').content === 'none' && s.getBoundingClientRect().width < 48 &&
			document.getElementById('panel-full').getClientRects().length === 0 &&
			document.querySelector('.sode-panels__head').contains(document.getElementById('panel-home')) &&
			!!document.querySelector('#panel-home a[href="panels"]');
	})()`)
	b.waitFor("big scroll bars: 40 px across the bottom, 28 px down the side", `(() => {
		const sc = document.querySelector('.sode-gridpanel__scroll');
		return sc.offsetHeight - sc.clientHeight === 40 && sc.offsetWidth - sc.clientWidth === 28;
	})()`)
	b.waitFor("the grid reaches the window's bottom", `Math.abs(document.querySelector('.sode-gridpanel__scroll').getBoundingClientRect().bottom - innerHeight) < 2 && document.documentElement.scrollHeight === innerHeight`)
	b.waitFor("the Sources row starts at the Source bar with no words after it, and the corner names the Destinations", `(() => {
		const label = document.querySelector('.sode-gridpanel__label--src');
		const src = label.getBoundingClientRect();
		const dst = document.querySelector('.sode-gridpanel__head > .sode-gridpanel__label--dst');
		const scroll = document.querySelector('.sode-gridpanel__scroll').getBoundingClientRect();
		return Math.abs(src.left - 224) < 1 && src.bottom <= scroll.top && dst?.textContent === 'Destinations' && document.querySelector('.sode-gridpanel__head').lastChild === dst &&
			label.parentNode.textContent === 'Sources';
	})()`)

	b.waitFor("80 px crosspoints with 16 px names, under one raised deck", `(() => {
		const bg = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
		return Math.round(document.querySelector('.sode-gridpanel__probe-xp').getBoundingClientRect().width) === 80 &&
			getComputedStyle(document.querySelector('.sode-gridpanel__src')).fontSize === '16.25px' &&
			bg('.sode-gridpanel__bar') === bg('.sode-gridpanel__deck');
	})()`)

	b.eval(`document.querySelector('.sode-gridpanel__dst[data-dst="2"]').click(); document.querySelector('.sode-gridpanel__src[data-src="4"]').click(); true`)
	b.waitFor("the picked row and column are washed", gridXp(6, 2)+`.hasAttribute('data-row') && !`+gridXp(6, 2)+`.hasAttribute('data-col') && `+
		gridXp(4, 5)+`.hasAttribute('data-col') && `+gridXp(4, 2)+`.hasAttribute('data-row') && `+gridXp(4, 2)+`.hasAttribute('data-col') && !`+gridXp(6, 5)+`.hasAttribute('data-row') && `+
		`getComputedStyle(`+gridXp(6, 2)+`).backgroundColor !== getComputedStyle(`+gridXp(6, 5)+`).backgroundColor`)
	b.eval(`document.querySelector('.sode-gridpanel__dst[data-dst="2"]').click(); document.querySelector('.sode-gridpanel__src[data-src="4"]').click(); true`)
	b.waitFor("an unpicked row is plain again", `!`+gridXp(6, 2)+`.hasAttribute('data-row')`)

	b.eval(gridXp(5, 3) + `.click()`)
	b.waitFor("the staged ring is a pie of the staged levels", `(() => {
		const r = `+gridXp(5, 3)+`.querySelector('.sode-gridpanel__stage');
		const bg = r.style.background;
		return `+gridXp(5, 3)+`.dataset.s === 'staged' && getComputedStyle(r).display === 'block' && bg.includes('conic-gradient') && (bg.match(/transparent/g) || []).length > 3;
	})()`)
	b.waitFor("Take is at the right of the deck; Select none, Clear and Take are as tall as the picks, past the search boxes", `(() => {
		const t = document.getElementById('panel-take').getBoundingClientRect();
		const c = document.getElementById('panel-clear').getBoundingClientRect();
		const a = document.getElementById('panel-lvl-all').getBoundingClientRect();
		const f = document.querySelector('.sode-gridpanel__find-mode').getBoundingClientRect();
		const p = document.getElementById('panel-lvl-pick').getBoundingClientRect();
		const same = (r) => Math.abs(r.top - p.top) < 1 && Math.abs(r.height - p.height) < 1;
		return same(t) && same(c) && same(a) && innerWidth - t.right < 12 && a.left >= f.right && a.right <= c.left && c.right <= t.left &&
			document.getElementById('panel-take').textContent === 'Take 1';
	})()`)
	b.waitFor("the V pick is two by two picks, filled when on", `(() => {
		const [v, two] = document.querySelectorAll('#panel-lvl-pick > .sode__pick');
		const r = v.getBoundingClientRect(), p = two.getBoundingClientRect();
		return Math.abs(r.width - r.height) < 2 && r.width > 2 * p.width && v.getAttribute('aria-pressed') === 'true' && getComputedStyle(v).backgroundColor !== 'rgba(0, 0, 0, 0)';
	})()`)
	b.waitFor("an armed Take is the main page's red Take, between --pb-status-error and --pb-danger-hover, with its words", `(() => {
		const t = document.getElementById('panel-take');
		if (!t.classList.contains('pb-btn--danger')) return false;
		// Canvas turns any colour form (oklab from color-mix) into RGB; a probe reads the tokens in this theme.
		const rgb = (c) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
		const token = (v) => { const p = document.createElement('i'); p.style.color = 'var(' + v + ')'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return rgb(c); };
		const bg = rgb(getComputedStyle(t).backgroundColor), lo = token('--pb-status-error'), hi = token('--pb-danger-hover');
		const ink = rgb(getComputedStyle(t).color), want = token('--pb-text-on-accent');
		const near = (a, b) => a.slice(0, 3).every((v, k) => Math.abs(v - b[k]) <= 3);
		return t.classList.contains('sode-panel__take--armed') && bg.slice(0, 3).every((v, k) => v >= Math.min(lo[k], hi[k]) - 3 && v <= Math.max(lo[k], hi[k]) + 3) && near(ink, want);
	})()`)
	held := `[...document.querySelectorAll('.sode-gridpanel__held:not([hidden])')].map((n) => n.parentNode.dataset.dst + ':' + n.textContent).join(',')`
	note := `[...document.querySelectorAll('.sode-gridpanel__note > :not([hidden])')].map((n) => n.textContent).join('|')`
	b.waitFor("the staged destination says so, and the note counts it with no help words", held+` === '3:staged' && `+note+` === '1 staged'`)
	// Over a crosspoint the cursor is a ring. All three count from time zero (gridpanelview.js joinPulse).
	b.eval(`(() => {
		const r = ` + gridXp(6, 5) + `.getBoundingClientRect();
		document.querySelector('.sode-gridpanel__scroll').dispatchEvent(new PointerEvent('pointermove', { clientX: r.x + 20, clientY: r.y + 20, bubbles: true, pointerType: 'mouse' }));
		return true;
	})()`)
	b.waitFor("the cursor ring, the staged ring and the armed Take pulse in one phase", `(() => {
		const phase = (n) => n.getAnimations().filter((a) => a.animationName === 'sode-panel-pulse').map((a) => a.currentTime % 2000);
		const t = [...phase(document.querySelector('.sode-gridpanel__ring')), ...phase(`+gridXp(5, 3)+`), ...phase(document.getElementById('panel-take'))];
		return t.length === 3 && Math.max(...t) - Math.min(...t) < 20;
	})()`)
	b.waitFor("the search boxes name the mode and show their keys", `[...document.querySelectorAll('.sode-gridpanel__find-input')].map((n) => n.placeholder).join('|') === 'Find sources|Find destinations' && `+
		`[...document.querySelectorAll('.sode-gridpanel__find-key')].map((n) => n.textContent).join('') === 'sd'`)
	b.shot("look")
	b.eval(`document.querySelector('.sode-gridpanel__dst[data-dst="2"]').click(); true`)
	b.waitFor("a pick shows first in the note", note+` === '1 destination picked'`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("Clear drops the picks first", note+` === '1 staged' && !document.querySelector('.sode-gridpanel__dst[data-picked]')`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("then the staged routes, and has nothing left to drop", held+` === '' && document.getElementById('panel-take').disabled && document.getElementById('panel-clear').disabled && `+
		note+` === ''`)

	b.open(srv.URL + "/panels")
	b.waitFor("the Grid panel in the list", `!!document.querySelector('.sode-ov__item[data-id="`+id+`"]')`)
	b.eval(`document.querySelector('.sode-ov__item[data-id="` + id + `"]').click(); true`)
	b.waitFor("its picture and words", `(() => {
		const big = document.querySelector('.sode-ov__big');
		return big?.querySelector('.pb-hint')?.textContent === 'Grid, all sources by all destinations' && !!big.querySelector('.sode-ov__thumb--grid .sode-ov__k-on') &&
			!!document.querySelector('.sode-ov__item[data-id="`+id+`"] .sode-ov__thumb--grid');
	})()`)
	b.check()
}
