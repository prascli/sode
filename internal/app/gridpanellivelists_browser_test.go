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

	b.eval(`document.getElementById('ed-live-lists').click(); true`)
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

	b.eval(`document.getElementById('tab-ed-live-dsts').click(); true`)
	b.waitFor("the Destinations tab shows that list", `!!document.getElementById('ed-destinations-list').offsetParent && document.getElementById('ed-destinations-list').clientHeight > 0`)
	b.eval(`row('destinations', 4).querySelector('[data-act="pin"]').click(); row('sources', 1).querySelector('[data-act="delete"]').click(); true`)
	b.waitFor("a pin leads the live grid's destinations, and a removed source leaves it", `firstDst() === '4' && !document.querySelector('#ed-live-view .sode-gridpanel__src[data-src="1"]')`)

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
	// One panel check every 5 s: past it, the saved copy must not show as a change from somewhere else.
	time.Sleep(6 * time.Second)
	// Asked at once, not waited for: a banner would go by itself when its countdown ends.
	if ok, _ := b.eval(`document.querySelector('#ed-live-view .sode-panel__update').hidden && firstSrc() === '3' && firstDst() === '4'`).(bool); !ok {
		t.Errorf("after the save, the live test shows an update banner or lost the edits")
	}

	b.eval(`key(document.getElementById('ed-live-close'), 'Escape'); true`)
	b.waitFor("Esc in the drawer, out of a list, closes it", `!document.getElementById('ed-live-drawer').classList.contains('pb-drawer--open') && document.activeElement === document.getElementById('ed-live-lists')`)
	b.eval(`document.getElementById('ed-live-back').click(); true`)
	b.waitFor("Back to editing puts both lists back, with the edits", `[...document.getElementById('ed-lists').children].map((x) => x.id).join() === 'ed-sources-col,ed-destinations-col' && !!document.getElementById('ed-sources-list').offsetParent && document.querySelector('#ed-sources-list li').dataset.id === '3'`)
	b.check()
}
