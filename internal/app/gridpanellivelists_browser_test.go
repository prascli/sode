package app

import (
	"regexp"
	"testing"
	"time"
)

// Test it live on a Grid panel: Edit lists opens a drawer with the editor's own Sources and Destinations lists. A
// move, a pin or a remove there shows on the live grid at once and makes Save show in the bar. Keys in the drawer
// stay in the drawer. Save stores the lists and brings no "This panel was changed" banner. Back puts the lists back.
func TestChromeGridPanelLiveLists(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": false})

	b.open(srv.URL + "/panels/editor?new")
	signInOnPad(b)
	b.waitFor("the lock goes", `!document.documentElement.dataset.sodeLock`)
	asGrid(b, true)
	b.eval(`document.getElementById('ed-save').click(); true`)
	b.waitFor("saved", `document.getElementById('ed-state').textContent === 'Saved' && location.search.startsWith('?panel=')`)
	id := regexp.MustCompile(`panel=([\w-]+)`).FindStringSubmatch(b.eval(`location.search`).(string))[1]

	b.eval(`
		// Only drawn names count: a pooled name waits out of view with no size.
		window.first = (k, side) => [...document.querySelectorAll('#ed-live-view .sode-gridpanel__' + k + '[data-' + k + ']')].map((x) => [x.dataset[k], x.getBoundingClientRect()]).filter(([, r]) => r.width > 0 && r.height > 0).sort((x, y) => x[1][side] - y[1][side])[0]?.[0];
		window.firstSrc = () => first('src', 'left');
		window.firstDst = () => first('dst', 'top');
		window.row = (k, n) => document.querySelector('#ed-' + k + '-list li[data-id="' + n + '"]');
		window.key = (n, key) => n.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		document.getElementById('ed-live').click(); true`)
	b.waitFor("the live grid shows the saved order", `firstSrc() === '0' && firstDst() === '0'`)
	b.waitFor("the drawer starts closed, and its lists cannot take focus", `!document.getElementById('ed-live-drawer').classList.contains('pb-drawer--open') && document.getElementById('ed-live-drawer').inert && document.getElementById('ed-live-lists').getAttribute('aria-expanded') === 'false'`)

	b.eval(`window.liveBand = () => ['#panel-take', '#panel-clear', '.sode-gridpanel__deck'].map((s) => { const r = document.querySelector('#ed-live-view ' + s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }).join('|');
		window.bandWas = liveBand(); window.gridW = document.querySelector('#ed-live-view .sode-gridpanel__scroll').getBoundingClientRect().width;
		document.getElementById('ed-live-lists').click(); true`)
	b.waitFor("the open drawer sits beside the grid, under the band: the grid narrows, and the band and Take stay as they were", `(() => {
		const d = document.getElementById('ed-live-drawer').getBoundingClientRect(), sc = document.querySelector('#ed-live-view .sode-gridpanel__scroll').getBoundingClientRect();
		const take = document.getElementById('panel-take'), t = take.getBoundingClientRect(), deck = document.querySelector('#ed-live-view .sode-gridpanel__deck').getBoundingClientRect();
		return d.width > 300 && sc.right <= d.left + 1 && sc.width < gridW - 300 && d.top >= deck.bottom - 1 && liveBand() === bandWas &&
			document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2) === take;
	})()`)
	b.waitFor("Edit lists opens the drawer with the editor's own Sources list, and each part of it has height", `(() => {
		const d = document.getElementById('ed-live-drawer');
		return d.classList.contains('pb-drawer--open') && !d.inert && d.contains(document.getElementById('ed-sources-col'))
			&& document.getElementById('ed-sources-list').clientHeight > 0 && document.querySelector('#ed-sources-col .sode-rlist').clientHeight > 0
			&& !!document.getElementById('ed-sources-list').offsetParent && !document.getElementById('ed-destinations-list').offsetParent;
	})()`)
	b.waitFor("the drawer has its full width", `document.getElementById('ed-live-drawer').getBoundingClientRect().width > 300`)
	b.shot("drawer")

	b.eval(`row('sources', 3).querySelector('.sode-pages__name').click(); document.getElementById('ed-sources-sel-top').click(); true`)
	b.waitFor("Move to the top shows on the live grid at once, and Save shows", `firstSrc() === '3' && !document.getElementById('ed-live-save').hidden && document.getElementById('ed-live-state').textContent === 'Unsaved changes'`)

	b.eval(`window.cursorAt = () => { const c = document.querySelector('#ed-live-view .sode-gridpanel__cursor'); return c.dataset.i + ',' + c.dataset.j }; window.cursorWas = cursorAt();
		const l = document.getElementById('ed-sources-list'); l.focus(); key(l, 'ArrowDown'); key(l, 'Escape'); true`)
	b.waitFor("keys in the drawer move the list's highlight", `document.querySelector('#ed-sources-list li.is-cur')?.dataset.id === '0'`)
	b.waitFor("keys in the drawer never move the grid's cursor", `cursorAt() === cursorWas`)
	b.waitFor("Esc in a list drops its selection and keeps the drawer open", `document.getElementById('ed-sources-sel').textContent === '0 selected' && document.getElementById('ed-live-drawer').classList.contains('pb-drawer--open')`)

	// Add from the router: source 2 goes and comes back at the end. A spare pooled name can keep its number while hidden.
	b.eval(`row('sources', 2).querySelector('[data-act="delete"]').click(); true`)
	b.waitFor("source 2 leaves the live grid and shows under Add from the router", `!document.querySelector('#ed-live-view .sode-gridpanel__src[data-src="2"]:not([hidden])') && !!document.querySelector('#ed-sources-col .sode-rlist [data-n="2"]')?.offsetParent`)
	b.eval(`document.querySelector('#ed-sources-col .sode-rlist [data-n="2"]').click(); document.getElementById('ed-sources-add-sel').click(); true`)
	// It goes to the end, out of the grid's view, so the list's count and the save below show it.
	b.waitFor("the + adds it back to the list", `!document.querySelector('#ed-sources-col .sode-rlist [data-n="2"]') && document.getElementById('ed-sources-state').textContent === '200'`)

	b.eval(`document.getElementById('tab-ed-live-dsts').click(); true`)
	b.waitFor("the Destinations tab shows that list", `!!document.getElementById('ed-destinations-list').offsetParent && document.getElementById('ed-destinations-list').clientHeight > 0`)
	b.eval(`row('destinations', 4).querySelector('[data-act="pin"]').click(); row('sources', 1).querySelector('[data-act="delete"]').click(); true`)
	b.waitFor("a pin leads the live grid's destinations, and a removed source leaves it", `firstDst() === '4' && !document.querySelector('#ed-live-view .sode-gridpanel__src[data-src="1"]:not([hidden])')`)

	b.eval(`document.getElementById('ed-live-save').click(); true`)
	b.waitFor("Save stores the lists, and Save goes from the bar", `document.getElementById('ed-live-save').hidden && document.getElementById('ed-live-state').textContent === ''`)
	p := readPanel(t, a, ana, id)
	srcs, _ := p["sources"].(map[string]any)
	members, _ := srcs["members"].([]any)
	if len(members) < 2 || members[0] != float64(3) || members[1] != float64(0) {
		t.Errorf("saved sources %v", srcs["members"])
	}
	for _, m := range members {
		if m == float64(1) {
			t.Errorf("source 1 is still saved: %v", members)
		}
	}
	if members[len(members)-1] != float64(2) {
		t.Errorf("source 2 is not saved at the end: %v", members)
	}
	// One panel check every 5 s: past it, the saved copy must not show as a change from somewhere else.
	time.Sleep(6 * time.Second)
	// Asked at once, not waited for: a banner would go by itself when its countdown ends.
	if ok, _ := b.eval(`document.querySelector('#ed-live-view .sode-panel__update').hidden && firstSrc() === '3' && firstDst() === '4'`).(bool); !ok {
		t.Errorf("after the save, the live test shows an update banner or lost the edits")
	}

	b.eval(`key(document.getElementById('ed-live-close'), 'Escape'); true`)
	b.waitFor("Esc in the drawer, out of a list, closes it", `!document.getElementById('ed-live-drawer').classList.contains('pb-drawer--open') && document.activeElement === document.getElementById('ed-live-lists')`)
	b.waitFor("closed, the grid has its width back and draws crosspoints to its right edge", `(() => {
		const sc = document.querySelector('#ed-live-view .sode-gridpanel__scroll'), r = sc.getBoundingClientRect();
		const hit = document.elementsFromPoint(r.right - 40, r.top + r.height * 0.6);
		return Math.abs(r.width - gridW) < 1 && hit.some((n) => n.classList?.contains('sode-gridpanel__xp'));
	})()`)
	b.eval(`document.getElementById('ed-live-back').click(); true`)
	b.waitFor("Back to editing puts both lists back, with the edits", `[...document.getElementById('ed-lists').children].map((x) => x.id).join() === 'ed-sources-col,ed-destinations-col' && !!document.getElementById('ed-sources-list').offsetParent && document.querySelector('#ed-sources-list li').dataset.id === '3'`)
	b.check()
}
