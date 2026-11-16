package app

import (
	"encoding/json"
	"regexp"
	"testing"
)

// A new panel made as a Grid panel in the editor: the type select, the Grid tabs and the hidden Buttons settings.
// A pin on the Sources tab is saved, the type locks, and the panel page shows the pinned source first.
func TestChromeGridPanelEditor(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/editor?new")
	signInOnPad(b)
	b.waitFor("the lock goes", `!document.documentElement.dataset.sodeLock`)
	b.waitFor("the sidebar is built", `!!document.getElementById('ed-set-type') && !!document.getElementById('ed-templates')`)
	tabs := `[...document.querySelectorAll('#ed-side .pb-tab')].map((x) => x.textContent).join()`
	b.waitFor("a new panel is a Buttons panel", tabs+` === 'Cell,Panel,Access' && !document.getElementById('ed-set-type').disabled`)

	b.eval(`const s = document.getElementById('ed-set-type'); s.value = 'grid'; s.dispatchEvent(new Event('change', { bubbles: true })); true`)
	b.waitFor("a Grid panel has Sources, Destinations, Panel and Access tabs", tabs+` === 'Sources,Destinations,Panel,Access'`)
	shown := func(id string) string { return `!!document.getElementById('` + id + `')?.offsetParent` }
	b.waitFor("the Buttons settings, the cells and Templates are hidden", `!`+shown("ed-rows")+` && !`+shown("ed-set-guard")+` && !`+shown("ed-set-multi")+` && !`+shown("ed-set-wrapPages")+` && !`+shown("ed-grid")+` && !`+shown("ed-pages")+` && !`+shown("ed-templates"))
	b.waitFor("the Grid keeps Mode, levels and Kiosk mode", shown("ed-set-mode")+` && `+shown("ed-set-kiosk")+` && `+shown("ed-set-wake"))

	b.eval(`document.getElementById('tab-ed-sources').click(); true`)
	src := `document.querySelector('#ed-sources-list li[data-id="5"]')`
	b.waitFor("the Sources list follows the router", src+` !== null && document.querySelectorAll('#ed-sources-list li').length === 200 && document.getElementById('ed-sources-all').disabled`)
	b.eval(src + `.querySelector('[data-act="pin"]').click(); true`)
	b.waitFor("the source is pinned", src+`.querySelector('[data-act="pin"]').getAttribute('aria-pressed') === 'true' && document.getElementById('ed-sources-state').textContent.includes('1 of 8 pinned')`)
	b.eval(`document.querySelector('#ed-sources-list li[data-id="0"] [data-act="delete"]').click(); true`)
	b.waitFor("Remove takes the source out", `!document.querySelector('#ed-sources-list li[data-id="0"]') && document.getElementById('ed-sources-all').disabled`)
	b.shot("sources")

	b.eval(`document.getElementById('ed-name').value = 'Edited grid'; document.getElementById('ed-name').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ed-save').click(); true`)
	b.waitFor("saved, and the type is locked", `document.getElementById('ed-state').textContent === 'Saved' && document.getElementById('ed-set-type').disabled && location.search.startsWith('?panel=')`)
	id := regexp.MustCompile(`panel=([\w-]+)`).FindStringSubmatch(b.eval(`location.search`).(string))[1]
	p := readPanel(t, a, ana, id)
	if p["type"] != "grid" {
		t.Fatalf("type %v", p["type"])
	}
	srcs, _ := p["sources"].(map[string]any)
	hide, _ := json.Marshal(srcs["hide"])
	items, _ := json.Marshal(srcs["items"])
	if srcs["members"] != "all" || string(hide) != `[0]` || string(items) != `{"5":{"pinned":true}}` {
		t.Errorf("sources %v", srcs)
	}

	// Opened again from a fresh page: no unsaved changes, the type locked, and a second save is a PUT that keeps both.
	b.open(srv.URL + "/panels/editor?panel=" + id)
	b.waitFor("the saved Grid panel opens in the editor", tabs+` === 'Sources,Destinations,Panel,Access' && document.getElementById('ed-state').textContent === 'Saved' && document.getElementById('ed-set-type').disabled`)
	b.waitFor("the pin and the removed source load", src+`?.querySelector('[data-act="pin"]').getAttribute('aria-pressed') === 'true' && !document.querySelector('#ed-sources-list li[data-id="0"]')`)
	b.eval(`document.querySelector('#ed-sources-list li[data-id="7"] [data-act="pin"]').click(); true`)
	b.waitFor("a second pin is an unsaved change", `document.getElementById('ed-state').textContent === 'Unsaved changes'`)
	b.eval(`document.getElementById('ed-save').click(); true`)
	b.waitFor("saved again", `document.getElementById('ed-state').textContent === 'Saved'`)
	srcs, _ = readPanel(t, a, ana, id)["sources"].(map[string]any)
	hide, _ = json.Marshal(srcs["hide"])
	items, _ = json.Marshal(srcs["items"])
	if string(hide) != `[0]` || string(items) != `{"5":{"pinned":true},"7":{"pinned":true}}` {
		t.Errorf("after the PUT, sources %v", srcs)
	}

	b.eval(`document.getElementById('ed-live').click(); true`)
	b.waitFor("Test it live runs the Grid panel", `!!document.querySelector('#ed-live-view .sode-gridpanel__xp')`)

	b.open(srv.URL + "/panels/" + id)
	b.waitFor("the panel opens as a Grid panel", `document.querySelectorAll('.sode-gridpanel__src').length === 199`)
	b.waitFor("the pinned source is first", `document.querySelector('.sode-gridpanel__src').dataset.src === '5'`)
	b.check()
}
