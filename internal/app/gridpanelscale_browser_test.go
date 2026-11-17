package app

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

// gridNodesMax is the most nodes a Grid panel page holds at 1280 by 800, whatever the router's size. That is the
// crosspoints that show plus overscan, the names and the pinned bands. All 2500 by 750 would be 1.9 million.
const gridNodesMax = 4000

// A Grid panel on a 2500 by 750 router. The page holds a bounded number of nodes and adds or removes none while
// it scrolls corner to corner: nodes are moved, never made again. Pinned names stay at the edge. The open time
// and the time for each scroll step are reported, not asserted.
func TestChromeGridPanelScale(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t, "SIM_SOURCES=2500", "SIM_DESTS=750")
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	const pinSrc, pinDst = 1200, 400
	id := makePanel(t, a, ana, fmt.Sprintf(`{"name":"Big grid","type":"grid","settings":{"mode":"take","levels":[1]},
		"sources":{"members":"all","items":{"%d":{"pinned":true}}},"destinations":{"members":"all","items":{"%d":{"pinned":true}}}}`, pinSrc, pinDst))
	waitNamesAndTally(t, a, ana)
	for deadline := time.Now().Add(30 * time.Second); ; time.Sleep(100 * time.Millisecond) {
		body := apiDo(a, "GET", "/api/v1/names", ana, nil).Body.String()
		if strings.Contains(body, `"SRC 2500"`) && strings.Contains(body, `"MV 737"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the app never read all 2500 by 750 names")
		}
	}

	start := time.Now()
	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the grid", `document.querySelector('.sode-gridpanel__src[data-src="0"]')?.textContent === 'Black'`)
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on')`)
	t.Logf("open to first grid: %v (includes the sign-in)", time.Since(start).Round(time.Millisecond))
	b.shot("scale")

	// Pinned items come first; the scroller is as large as the whole grid.
	b.waitFor("the pinned source and destination lead", `(() => {
		const s = document.querySelector('.sode-gridpanel__src[data-src="`+fmt.Sprint(pinSrc)+`"]');
		const d = document.querySelector('.sode-gridpanel__dst[data-dst="`+fmt.Sprint(pinDst)+`"]');
		const c = document.querySelector('.sode-gridpanel__src[data-src="0"]');
		return s && d && s.getBoundingClientRect().left < c.getBoundingClientRect().left;
	})()`)
	b.waitFor("a line marks the end of each pinned band", `(() => {
		const after = (n) => getComputedStyle(document.querySelector(n), '::after');
		return parseFloat(after('.sode-gridpanel__top').height) > 2 && parseFloat(after('.sode-gridpanel__side').width) > 2;
	})()`)
	b.waitFor("the scroller spans the whole grid", `(() => {
		const sc = document.querySelector('.sode-gridpanel__scroll');
		const xp = document.querySelector('.sode-gridpanel__src[data-src="0"]').getBoundingClientRect().width;
		return sc.scrollWidth >= 2500 * xp && sc.scrollHeight >= 750 * xp;
	})()`)

	sweep, ok := b.eval(`(async () => {
		const grid = document.getElementById('panel-grid');
		const sc = grid.querySelector('.sode-gridpanel__scroll');
		const count = () => grid.querySelectorAll('*').length;
		let added = 0, removed = 0, most = count();
		const els = (list) => [...list].filter((n) => n.nodeType === 1).length;
		const mo = new MutationObserver((recs) => {
			for (const r of recs) { added += els(r.addedNodes); removed += els(r.removedNodes); }
		});
		mo.observe(grid, { childList: true, subtree: true });
		const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		const steps = 60, times = [];
		let missing = 0;
		for (let i = 1; i <= steps; i++) {
			const t0 = performance.now();
			sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * i / steps;
			sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * i / steps;
			await frame();
			times.push(performance.now() - t0);
			most = Math.max(most, count());
			// The crosspoint in the middle of the view is drawn at every step.
			const r = sc.getBoundingClientRect();
			const hit = document.elementsFromPoint(r.left + r.width * 0.6, r.top + r.height * 0.6);
			if (!hit.some((n) => n.classList?.contains('sode-gridpanel__xp'))) missing++;
		}
		mo.takeRecords().forEach((r) => { added += els(r.addedNodes); removed += els(r.removedNodes); });
		mo.disconnect();
		times.sort((x, y) => x - y);
		return { added, removed, most, missing, median: times[times.length >> 1], worst: times[times.length - 1] };
	})()`).(map[string]any)
	if !ok {
		t.Fatal("the sweep returned nothing")
	}
	t.Logf("scroll sweep: median step %.1f ms, worst %.1f ms (two frames each), most nodes %v", sweep["median"], sweep["worst"], sweep["most"])
	if sweep["added"].(float64) != 0 || sweep["removed"].(float64) != 0 {
		t.Errorf("scrolling added %v and removed %v elements, want nodes moved and none made again", sweep["added"], sweep["removed"])
	}
	if sweep["most"].(float64) > gridNodesMax {
		t.Errorf("the grid held %v nodes, want at most %d", sweep["most"], gridNodesMax)
	}
	if sweep["missing"].(float64) != 0 {
		t.Errorf("%v scroll steps showed no crosspoint mid-view", sweep["missing"])
	}

	// At the far corner: the last crosspoint is drawn with its names, and the pinned names stay at the edges.
	b.waitFor("the last crosspoint", gridXp(2499, 749)+` !== null && document.querySelector('.sode-gridpanel__src[data-src="2499"]').textContent === 'SRC 2500' && document.querySelector('.sode-gridpanel__dst[data-dst="749"]').textContent === 'MV 737'`)
	b.waitFor("pinned names stay at the edges", `(() => {
		const sc = document.querySelector('.sode-gridpanel__scroll').getBoundingClientRect();
		const s = document.querySelector('.sode-gridpanel__src[data-src="`+fmt.Sprint(pinSrc)+`"]').getBoundingClientRect();
		const d = document.querySelector('.sode-gridpanel__dst[data-dst="`+fmt.Sprint(pinDst)+`"]').getBoundingClientRect();
		return s.top >= sc.top - 1 && s.left < sc.left + sc.width / 3 && d.left >= sc.left - 1 && d.top < sc.top + sc.height / 3;
	})()`)
	b.shot("scale-corner")

	// Idle: the polls get 304 and the tick runs each second, but nothing changed, so nothing in the grid is written.
	b.call("Performance.enable", nil)
	i0 := b.metrics()
	idle := b.eval(`new Promise((done) => {
		const grid = document.getElementById('panel-grid');
		let n = 0;
		const mo = new MutationObserver((recs) => { n += recs.length; });
		mo.observe(grid, { subtree: true, childList: true, attributes: true, characterData: true });
		setTimeout(() => { n += mo.takeRecords().length; mo.disconnect(); done(n); }, 5000);
	})`)
	i1 := b.metrics()
	t.Logf("5 s idle: tasks %.0f ms", (i1["TaskDuration"]-i0["TaskDuration"])*1000)
	if idle != 0.0 {
		t.Errorf("5 s idle wrote the grid %v times, want none", idle)
	}

	// Find glides across the whole Source bar to SRC 2400: nodes are moved, never made, and it ends with the match in
	// view. The glide time and its slowest frame are reported, not asserted.
	b.eval(`document.querySelector('.sode-gridpanel__scroll').scrollLeft = 0; true`)
	glide, ok := b.eval(`(async () => {
		const grid = document.getElementById('panel-grid');
		const sc = grid.querySelector('.sode-gridpanel__scroll');
		let added = 0, removed = 0;
		const els = (list) => [...list].filter((n) => n.nodeType === 1).length;
		const mo = new MutationObserver((recs) => {
			for (const r of recs) { added += els(r.addedNodes); removed += els(r.removedNodes); }
		});
		mo.observe(grid, { childList: true, subtree: true });
		await new Promise((r) => requestAnimationFrame(r));
		const input = document.querySelector('.sode-gridpanel__find[data-kind="srcs"] input');
		input.focus();
		const t0 = performance.now();
		const ended = new Promise((r) => sc.addEventListener('scrollend', r, { once: true }));
		document.execCommand('insertText', false, 'src 2400');
		let last = t0, worst = 0, going = true;
		const tick = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; if (going) requestAnimationFrame(tick); };
		requestAnimationFrame(tick);
		await Promise.race([ended, new Promise((r) => setTimeout(r, 5000))]);
		going = false;
		const ms = performance.now() - t0;
		mo.takeRecords().forEach((r) => { added += els(r.addedNodes); removed += els(r.removedNodes); });
		mo.disconnect();
		const n = grid.querySelector('.sode-gridpanel__src[data-src="2399"]:not([hidden])');
		const r = sc.getBoundingClientRect();
		const shown = !!n && n.getBoundingClientRect().left >= r.left && n.getBoundingClientRect().right <= r.right;
		return { added, removed, ms, worst, shown };
	})()`).(map[string]any)
	if !ok {
		t.Fatal("the glide returned nothing")
	}
	t.Logf("Find glide to SRC 2400: %.0f ms, slowest frame %.1f ms", glide["ms"], glide["worst"])
	if glide["added"].(float64) != 0 || glide["removed"].(float64) != 0 {
		t.Errorf("the glide added %v and removed %v elements, want nodes moved and none made again", glide["added"], glide["removed"])
	}
	if glide["shown"] != true {
		t.Error("after the glide SRC 2400 is not in view")
	}
	realKey(b, "Escape", "Escape", 27)
	b.eval(`(() => { const sc = document.querySelector('.sode-gridpanel__scroll'); sc.scrollLeft = sc.scrollWidth; sc.scrollTop = sc.scrollHeight; return true; })()`)
	b.waitFor("back at the far corner", gridXp(2499, 749)+` !== null`)

	// A press far from the start still stages.
	b.eval(gridXp(2499, 749) + `.click()`)
	b.waitFor("the press stages", gridXp(2499, 749)+`.dataset.s === 'staged'`)

	// A staged route pulses, and only the staged crosspoints run the animation. An inherited property animated above
	// the grid restyles every node under it each frame. At this size that took 4.7 s of every 10 s.
	b.eval(gridXp(2498, 748) + `.click(); ` + gridXp(2497, 747) + `.click(); true`)
	b.waitFor("three staged", `document.querySelectorAll('.sode-gridpanel__xp[data-s="staged"]').length === 3`)
	b.waitFor("the staged crosspoints pulse", `document.getAnimations().filter((a) => a.effect?.target?.dataset?.s === 'staged').length === 3`)
	if big := b.eval(`document.getAnimations().map((a) => a.effect.target).filter((n) => n.getElementsByTagName('*').length > 20).map((n) => n.className).join(' ')`); big != "" {
		t.Errorf("an animation runs on an element with many nodes under it: %v", big)
	}
	b.waitFor("the staged crosspoints pulse in step", `(() => {
		const t = document.getAnimations().filter((a) => a.effect?.target?.dataset?.s === 'staged').map((a) => (a.currentTime - a.effect.getTiming().delay) % 2000);
		return Math.max(...t) - Math.min(...t) < 100;
	})()`)
	m0 := b.metrics()
	time.Sleep(3 * time.Second)
	m1 := b.metrics()
	style := (m1["RecalcStyleDuration"] - m0["RecalcStyleDuration"]) * 1000
	t.Logf("3 s with three staged: style recalc %.0f ms, tasks %.0f ms", style, (m1["TaskDuration"]-m0["TaskDuration"])*1000)
	// About 60 ms here, and about 1400 ms when the whole grid restyled each frame.
	if style > 600 {
		t.Errorf("3 s with three staged spent %.0f ms on style recalc, want under 600", style)
	}
	b.check()
}
