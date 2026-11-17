package app

import "testing"

// The Grid panel page looks as in the prototype at 1440 by 900. It checks the header boxes and line, the Sources row
// and the Destinations word, and the picked row and column washes. It checks the staged ring's colours and the Take
// button's size and place. The grid goes down to the window's bottom, the Panels link is in the header and Full width
// is gone. Then it checks the panels list's picture and words for a Grid panel.
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
	b.waitFor("the header is one row, about the prototype's 86.7 px", `(() => {
		const h = document.querySelector('.sode-panels__head').getBoundingClientRect().height;
		return h > 84 && h < 90;
	})()`)
	b.waitFor("Full screen has its words, Full width is gone and the Panels link is in the header", `(() => {
		const s = document.getElementById('panel-screen');
		return getComputedStyle(s, '::before').content === '"Full screen"' && s.getBoundingClientRect().width > 100 &&
			document.getElementById('panel-full').getClientRects().length === 0 &&
			document.getElementById('panel-home').parentNode === document.querySelector('.sode-panels__head') &&
			!!document.querySelector('#panel-home a[href="panels"]');
	})()`)
	b.waitFor("the grid reaches the window's bottom", `Math.abs(document.querySelector('.sode-gridpanel__scroll').getBoundingClientRect().bottom - innerHeight) < 2 && document.documentElement.scrollHeight === innerHeight`)
	b.waitFor("the Sources row starts at the Source bar and the corner names the Destinations", `(() => {
		const src = document.querySelector('.sode-gridpanel__label--src').getBoundingClientRect();
		const dst = document.querySelector('.sode-gridpanel__head > .sode-gridpanel__label--dst');
		const scroll = document.querySelector('.sode-gridpanel__scroll').getBoundingClientRect();
		return Math.abs(src.left - 208) < 1 && src.bottom <= scroll.top && dst?.textContent === 'Destinations' && document.querySelector('.sode-gridpanel__head').lastChild === dst;
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
	b.waitFor("Take is 192 by 64 px at the right of the Levels band", `(() => {
		const t = document.getElementById('panel-take').getBoundingClientRect();
		const band = document.getElementById('panel-levels').getBoundingClientRect();
		return Math.round(t.width) === 192 && Math.round(t.height) === 64 && innerWidth - t.right < 12 && t.top >= band.top && t.bottom <= band.bottom && document.getElementById('panel-take').textContent === 'Take 1';
	})()`)
	b.waitFor("the V pick is two by two picks, filled when on", `(() => {
		const [v, two] = document.querySelectorAll('#panel-lvl-pick > .sode__pick');
		const r = v.getBoundingClientRect(), p = two.getBoundingClientRect();
		return Math.abs(r.width - r.height) < 2 && r.width > 2 * p.width && v.getAttribute('aria-pressed') === 'true' && getComputedStyle(v).backgroundColor !== 'rgba(0, 0, 0, 0)';
	})()`)
	b.waitFor("an armed Take is amber with dark words", `(() => {
		const t = document.getElementById('panel-take');
		// Canvas turns any colour form (oklab from color-mix) into RGB.
		const rgb = (c) => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; };
		const [r, g, bl] = rgb(getComputedStyle(t).backgroundColor);
		const [ir] = rgb(getComputedStyle(t).color);
		return t.classList.contains('sode-panel__take--armed') && r > 200 && g > 150 && bl < 140 && ir < 100;
	})()`)
	held := `[...document.querySelectorAll('.sode-gridpanel__held:not([hidden])')].map((n) => n.parentNode.dataset.dst + ':' + n.textContent).join(',')`
	note := `[...document.querySelectorAll('.sode-gridpanel__note > :not([hidden])')].map((n) => n.textContent).join('|')`
	b.waitFor("the staged destination says so, and the note counts it", held+` === '3:staged' && `+note+` === '1 staged|Press Take or Enter to send the staged routes. Esc drops them.'`)
	b.waitFor("the search boxes name the mode and show their keys", `[...document.querySelectorAll('.sode-gridpanel__find-input')].map((n) => n.placeholder).join('|') === 'Find sources|Find destinations' && `+
		`[...document.querySelectorAll('.sode-gridpanel__find-key')].map((n) => n.textContent).join('') === 'sd'`)
	b.shot("look")
	b.eval(`document.querySelector('.sode-gridpanel__dst[data-dst="2"]').click(); true`)
	b.waitFor("a pick shows first in the note", note+` === '1 destination picked|Click a crosspoint in a picked row or column for a Diagonal. Esc drops the picks.'`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("Clear drops the picks first", note+` === '1 staged|Press Take or Enter to send the staged routes. Esc drops them.' && !document.querySelector('.sode-gridpanel__dst[data-picked]')`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("then the staged routes, and has nothing left to drop", held+` === '' && document.getElementById('panel-take').disabled && document.getElementById('panel-clear').disabled && `+
		note+` === 'Click names to pick rows and columns. Shift-click picks a range.'`)

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
