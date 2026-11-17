package app

import (
	"fmt"
	"testing"
)

// bandRects keeps the band's control rects in window.__band; bandSame is true while none has moved.
const bandRects = `(() => {
	const ids = ['#panel-lvl', '#panel-lvl-all', '#panel-lvl-pick', '.sode-gridpanel__find[data-kind="srcs"] input', '.sode-gridpanel__find[data-kind="dsts"] input',
		'.sode-gridpanel__find-mode', '#panel-clear', '#panel-take', '.sode-gridpanel__scroll', '#panel-title'];
	window.__bandAt = () => ids.map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }).join('|');
	window.__band = window.__bandAt();
	return true;
})()`

const bandSame = `window.__bandAt() === window.__band`

// bandFits is true when the deck's controls are whole, inside the deck and apart from each other, and the page does
// not scroll sideways.
const bandFits = `(() => {
	const deck = document.querySelector('.sode-gridpanel__deck').getBoundingClientRect();
	const sel = ['#panel-title', '.sode-gridpanel__tools', '#panel-lvl-pick', '#panel-lvl', '#panel-lvl-all', '.sode-gridpanel__find[data-kind="srcs"]',
		'.sode-gridpanel__find[data-kind="dsts"]', '.sode-gridpanel__find-mode', '#panel-clear', '#panel-take'];
	const rs = sel.map((s) => document.querySelector(s).getBoundingClientRect());
	const inside = rs.every((r) => r.width > 0 && r.left >= deck.left && r.right <= deck.right + 0.5 && r.top >= deck.top && r.bottom <= deck.bottom);
	const apart = rs.every((a, i) => rs.every((b, j) => j <= i || a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5));
	const whole = ['#panel-title', '#panel-lvl-all', '#panel-clear', '#panel-take'].every((s) => { const n = document.querySelector(s); return n.scrollWidth <= n.clientWidth + 1; });
	return inside && apart && whole && document.documentElement.scrollWidth === innerWidth;
})()`

// The Grid panel page at 1440 by 900. The header, the Levels box and the search boxes are one band, the deck. Its
// header row holds the title, the main page's Server and Router status, Full screen and the Panels link, and the Lock
// chip names the user as on the main page. Under it are the Levels box with Select all under it, the search boxes
// with the Filter switch, then Clear and the red Take with the note over them. Nothing in the band moves as words
// change. It checks the Sources row, the Destinations word, the picked row and column washes and the staged ring. The
// cursor ring, the staged ring and Take pulse in one phase. The grid goes down to the window's bottom and Full width
// and Kiosk mode are gone. The band fits at 1280 by 800 and 1920 by 1080, and 8 pins on each edge leave a short
// window room to scroll. Then it checks the panels list's picture and words for a Grid panel.
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

	b.waitFor("the header has the main page's status and no other details", `(() => {
		const t = (s) => [...document.querySelectorAll(s)].map((n) => n.textContent.trim()).join('|');
		const dots = [...document.querySelectorAll('.sode-gridpanel__tools > .sode__conn .pb-dot')];
		return t('.sode-gridpanel__tools > .sode__conn .pb-status') === 'Server|Router' && dots.length === 2 && dots.every((d) => d.classList.contains('pb-dot--ok')) &&
			!document.querySelector('.sode-gridpanel__meta, .sode-gridpanel__stat') && t('#panel-instance') === 'Desk' &&
			getComputedStyle(document.querySelector('.sode-gridpanel__tools > .sode__conn')).position === 'static';
	})()`)
	b.waitFor("one deck at the top holds the header, the Levels box and the search boxes, under 190 px high", `(() => {
		const deck = document.querySelector('.sode-gridpanel__deck');
		const r = deck.getBoundingClientRect();
		const inside = ['#panel-title', '.sode-gridpanel__tools', '#panel-lvl', '#panel-lvl-all', '.sode-gridpanel__find[data-kind="srcs"] input', '.sode-gridpanel__find-mode', '#panel-take']
			.every((s) => { const n = deck.querySelector(s); const b = n?.getBoundingClientRect(); return b && b.top >= r.top && b.bottom <= r.bottom; });
		return r.top === 0 && r.height < 190 && inside && !document.querySelector('.sode-gridpanel__head .sode-gridpanel__find');
	})()`)
	b.waitFor("the Lock chip does not cover the title or the Levels box", `(() => {
		const c = document.querySelector('.sode-lock__who').getBoundingClientRect();
		const off = (s) => { const n = document.querySelector(s).getBoundingClientRect(); return n.top >= c.bottom || n.left >= c.right; };
		return off('#panel-title') && off('#panel-lvl-pick') && off('#panel-levels .sode__box-head');
	})()`)
	b.waitFor("the Levels box is the main page's, large words that fit, with a short Select all as wide as it under it, both in the picks' height", `(() => {
		const i = document.getElementById('panel-lvl'), p = document.getElementById('panel-lvl-pick').getBoundingClientRect();
		const r = i.getBoundingClientRect(), cs = getComputedStyle(i), a = document.getElementById('panel-lvl-all').getBoundingClientRect();
		const c = document.createElement('canvas').getContext('2d');
		c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
		const fits = c.measureText(i.placeholder).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) <= i.clientWidth;
		return i.classList.contains('sode__input') && r.width >= 168 && cs.fontSize === '27.5px' && fits &&
			Math.abs(r.top - p.top) < 1 && Math.abs(a.bottom - p.bottom) < 1 && a.top > r.bottom && a.height < r.height &&
			Math.abs(a.left - r.left) < 1 && Math.abs(a.width - r.width) < 1;
	})()`)
	b.waitFor("nothing in the deck is cut: the title, its line, Select none on one line", `(() => {
		const cut = (n) => n.scrollWidth > n.clientWidth + 1;
		const all = document.getElementById('panel-lvl-all');
		const line = [...all.children].map((n) => n.getBoundingClientRect().top);
		return !cut(document.getElementById('panel-title')) && !cut(all) &&
			/^Select(All|None)$/.test(all.textContent) && Math.abs(line[0] - line[1]) < 1 && document.documentElement.scrollWidth === innerWidth;
	})()`)
	b.waitFor("the Lock chip names the user, as on the main page", `(() => {
		const name = document.querySelector('.sode-lock__who-name');
		return !!document.querySelector('.sode-lock__who .pb-btn') && name.getClientRects().length > 0 && name.textContent === 'Signed in as Ana';
	})()`)
	b.waitFor("Filter is one switch, off, as tall as both search boxes", `(() => {
		const m = document.querySelector('.sode-gridpanel__find-mode');
		const sw = m.querySelector('input[role="switch"]');
		const top = document.querySelector('.sode-gridpanel__find[data-kind="srcs"] input').getBoundingClientRect();
		const bot = document.querySelector('.sode-gridpanel__find[data-kind="dsts"] input').getBoundingClientRect();
		const r = m.getBoundingClientRect();
		return m.tagName === 'LABEL' && m.textContent.startsWith('Filter') && sw.type === 'checkbox' && !sw.checked &&
			Math.abs(r.top - top.top) < 2 && Math.abs(r.bottom - bot.bottom) < 2;
	})()`)
	b.waitFor("Full screen is a ghost icon, Full width and Kiosk mode are gone and the Panels link is in the header", `(() => {
		const s = document.getElementById('panel-screen');
		return getComputedStyle(s, '::before').content === 'none' && s.getBoundingClientRect().width < 48 &&
			s.classList.contains('pb-btn--ghost') && !s.classList.contains('pb-btn--outline') &&
			document.getElementById('panel-kiosk').getClientRects().length === 0 &&
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

	// The band's controls, to check that nothing moves as their words change.
	b.eval(bandRects)
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
	b.waitFor("Take says only Take at the right of the deck; Clear and Take are as tall as the picks, past the Filter switch; the note is over them", `(() => {
		const t = document.getElementById('panel-take').getBoundingClientRect();
		const c = document.getElementById('panel-clear').getBoundingClientRect();
		const f = document.querySelector('.sode-gridpanel__find-mode').getBoundingClientRect();
		const p = document.getElementById('panel-lvl-pick').getBoundingClientRect();
		const n = document.querySelector('.sode-gridpanel__chip').getBoundingClientRect();
		const same = (r) => Math.abs(r.top - p.top) < 1 && Math.abs(r.height - p.height) < 1;
		return same(t) && same(c) && innerWidth - t.right < 24 && f.right <= c.left && c.right <= t.left &&
			n.bottom <= t.top && Math.abs(n.right - t.right) < 2 && document.getElementById('panel-take').textContent === 'Take';
	})()`)
	b.waitFor("the V pick is one pick wide and two picks high, as on the main page, filled when on", `(() => {
		const [v, two] = document.querySelectorAll('#panel-lvl-pick > .sode__pick');
		const r = v.getBoundingClientRect(), p = two.getBoundingClientRect();
		return Math.abs(r.width - p.width) < 2 && r.height > 2 * p.height && v.getAttribute('aria-pressed') === 'true' && getComputedStyle(v).backgroundColor !== 'rgba(0, 0, 0, 0)';
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
	b.waitFor("the lock screen has faded", `!document.documentElement.hasAttribute("data-sode-lock")`)
	b.shot("look")
	b.eval(`document.querySelector('.sode-gridpanel__dst[data-dst="2"]').click(); document.querySelector('.sode-gridpanel__dst[data-dst="3"]').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); ` +
		`document.querySelector('.sode-gridpanel__src[data-src="5"]').click(); true`)
	b.waitFor("a pick shows first in the note", note+` === '2 destinations, 1 source picked'`)
	b.eval(`document.getElementById('panel-lvl-all').click(); document.querySelector('.sode-gridpanel__find-mode input').click(); true`)
	b.waitFor("Select all changes its words and Filter is on", `document.getElementById('panel-lvl-all').textContent === 'SelectNone' && document.querySelector('.sode-gridpanel__find-mode input').checked`)
	b.waitFor("nothing in the band moved", bandSame)
	b.waitFor("the switch has moved", `!document.getAnimations().some((a) => a instanceof CSSTransition)`)
	b.shot("filter-on")
	b.eval(`document.getElementById('panel-lvl-all').click(); document.querySelector('.sode-gridpanel__find-mode input').click(); ` +
		`document.querySelector('.sode-gridpanel__dst[data-dst="3"]').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); document.querySelector('.sode-gridpanel__src[data-src="5"]').click(); true`)
	b.waitFor("one pick left", note+` === '1 destination picked'`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("Clear drops the picks first", note+` === '1 staged' && !document.querySelector('.sode-gridpanel__dst[data-picked]')`)
	b.eval(`document.getElementById('panel-clear').click(); true`)
	b.waitFor("then the staged routes, and has nothing left to drop", held+` === '' && document.getElementById('panel-take').disabled && document.getElementById('panel-clear').disabled && `+
		note+` === ''`)

	for _, size := range [][2]int{{1280, 800}, {1920, 1080}} {
		b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": size[0], "height": size[1], "deviceScaleFactor": 1, "mobile": false})
		b.waitFor(fmt.Sprintf("at %d by %d the band fits: nothing cut, nothing over another, no sideways scroll", size[0], size[1]), `innerWidth === `+fmt.Sprint(size[0])+` && `+bandFits)
		b.shot(fmt.Sprintf("band-%d", size[0]))
	}

	// 8 pins on each edge, the most an edge holds, on a short window: the pinned bands leave room to scroll.
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1280, "height": 800, "deviceScaleFactor": 1, "mobile": false})
	pins := `{"1":{"pinned":true},"2":{"pinned":true},"3":{"pinned":true},"4":{"pinned":true},"5":{"pinned":true},"6":{"pinned":true},"7":{"pinned":true},"8":{"pinned":true}}`
	pinned := makePanel(t, a, ana, `{"name":"Pinned grid","type":"grid","settings":{"mode":"take","levels":[1]},`+
		`"sources":{"members":"all","items":`+pins+`},"destinations":{"members":"all","items":`+pins+`}}`)
	b.open(srv.URL + "/panels/" + pinned + "?instance=Desk")
	b.waitFor("the pinned grid", `!!document.querySelector('.sode-gridpanel__xp')`)
	b.waitFor("the pinned bands take at most half the room past the names, so the rest scrolls", `(() => {
		const f = document.querySelector('.sode-gridpanel__field'), sc = document.querySelector('.sode-gridpanel__scroll');
		const v = (k) => Number(getComputedStyle(f).getPropertyValue(k).trim());
		const xp = document.querySelector('.sode-gridpanel__probe-xp').getBoundingClientRect().width;
		const name = document.querySelector('.sode-gridpanel__probe').getBoundingClientRect();
		const rows = v('--sode-row-pins'), cols = v('--sode-col-pins');
		return rows >= 1 && rows < 8 && cols >= 1 && rows * xp <= (sc.clientHeight - name.height) / 2 && cols * xp <= (sc.clientWidth - name.width) / 2;
	})()`)
	b.shot("pins-1280")

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
