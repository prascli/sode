package app

import (
	"encoding/json"
	"fmt"
	"regexp"
	"testing"
)

// A Grid panel's Sources tab at 2500 sources: the router list draws only the rows in view. A typed range uses the
// numbers as shown (offset 1), and Enter selects it. Add appends it and skips what is there. Shift-click covers only
// the rows Find shows, and the selection stays when Find changes. Save keeps the list.
func TestChromeGridPanelEditorChunk(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t, "SIM_SOURCES=2500", "SIM_DESTS=750")
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/editor?new")
	signInOnPad(b)
	b.waitFor("the lock goes", `!document.documentElement.dataset.sodeLock`)
	b.waitFor("the sidebar is built", `!!document.getElementById('ed-set-type')`)
	b.eval(`const s = document.getElementById('ed-set-type'); s.value = 'grid'; s.dispatchEvent(new Event('change', { bubbles: true })); true`)
	b.waitFor("the Sources tab", `!!document.getElementById('tab-ed-sources')`)
	b.eval(`document.getElementById('tab-ed-sources').click(); true`)

	rows := `document.querySelectorAll('#ed-sources-router [data-n]:not([hidden])')`
	b.waitFor("the router list shows its first rows", `!!document.querySelector('#ed-sources-router [data-n="0"]:not([hidden])')`)
	if n := int(b.eval(`document.querySelectorAll('#ed-sources-router [data-n]').length`).(float64)); n > 200 {
		t.Fatalf("the router list draws %d rows for 2500 sources", n)
	}
	b.eval(`const r = document.getElementById('ed-sources-router'); r.scrollTop = r.scrollHeight; true`)
	b.waitFor("the last source shows at the end", `!!document.querySelector('#ed-sources-router [data-n="2499"]:not([hidden])')`)

	b.eval(`document.getElementById('ed-sources-clear').click(); true`)
	b.waitFor("Clear empties the panel's list", `document.querySelectorAll('#ed-sources-list li').length === 0`)

	find := func(text string) {
		b.eval(fmt.Sprintf(`(() => { const f = document.getElementById('ed-sources-find'); f.value = %q; f.dispatchEvent(new Event('input', { bubbles: true })); return true })()`, text))
	}
	enter := `document.getElementById('ed-sources-find').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); true`
	members := `[...document.querySelectorAll('#ed-sources-list li')].map((li) => li.dataset.id).join()`
	span := func(lo, hi int) (s string) {
		for n := lo; n <= hi; n++ {
			if s != "" {
				s += ","
			}
			s += fmt.Sprint(n)
		}
		return s
	}

	find("101-140")
	b.waitFor("the range shows forty rows, from shown number 101", `document.getElementById('ed-sources-shown').textContent.startsWith('40 ') && !!document.querySelector('#ed-sources-router [data-n="100"]:not([hidden])') && !document.querySelector('#ed-sources-router [data-n="99"]:not([hidden])')`)
	b.eval(enter)
	b.waitFor("Enter selects the range", `document.getElementById('ed-sources-add').textContent === 'Add 40'`)
	b.eval(`document.getElementById('ed-sources-add').click(); true`)
	b.waitFor("Add appends the range in router order", members+` === '`+span(100, 139)+`'`)

	find("131-150")
	b.eval(enter)
	b.eval(`document.getElementById('ed-sources-add').click(); true`)
	b.waitFor("a second Add skips what the panel has", members+` === '`+span(100, 149)+`'`)

	// Router 12..23 are CAM 1..12; "cam 1" shows CAM 1, 10, 11 and 12.
	click := func(n int, mods string) {
		b.eval(fmt.Sprintf(`document.querySelector('#ed-sources-router [data-n="%d"]:not([hidden])').dispatchEvent(new MouseEvent('click', { bubbles: true, %s })); true`, n, mods))
	}
	find("bars")
	b.waitFor("Find shows Bars", rows+`.length === 1`)
	click(1, "")
	find("cam 1")
	b.waitFor("Find shows four cameras", rows+`.length === 4`)
	click(12, "metaKey: true")
	click(22, "shiftKey: true")
	b.waitFor("Shift-click covers only the rows Find shows, and Bars stays selected", `document.getElementById('ed-sources-add').textContent === 'Add 4' && document.getElementById('ed-sources-selected').textContent.includes('1 not shown')`)
	b.waitFor("the selection is marked", `document.querySelector('#ed-sources-router [data-n="21"]').getAttribute('aria-selected') === 'true'`)
	b.shot("selected")
	b.eval(`document.getElementById('ed-sources-add').click(); true`)
	b.waitFor("Add appends the selection in router order", members+` === '`+span(100, 149)+`,1,12,21,22'`)
	b.waitFor("the router list marks what the panel has", `document.querySelector('#ed-sources-router [data-n="12"]').textContent.includes('in panel')`)
	b.shot("chunk")

	b.eval(`document.getElementById('ed-name').value = 'Chunk grid'; document.getElementById('ed-name').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ed-save').click(); true`)
	b.waitFor("saved", `document.getElementById('ed-state').textContent === 'Saved' && location.search.startsWith('?panel=')`)
	id := regexp.MustCompile(`panel=([\w-]+)`).FindStringSubmatch(b.eval(`location.search`).(string))[1]
	srcs, _ := readPanel(t, a, ana, id)["sources"].(map[string]any)
	got, _ := json.Marshal(srcs["members"])
	if want := "[" + span(100, 149) + ",1,12,21,22]"; string(got) != want {
		t.Errorf("members %s, want %s", got, want)
	}
	b.check()
}
