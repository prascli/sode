package app

import (
	"encoding/json"
	"fmt"
	"regexp"
	"testing"
)

// The Grid editor at 2500 sources. Sources and Destinations are side by side on a wide window and stacked on a
// narrow one. Panel and Access do the same. In the panel's list, click, Shift-click and Ctrl-click select rows.
// Artwork sets both icons on every selected row. A drag moves the selection as a block, and so do Alt+arrows.
func TestChromeGridPanelEditorSelect(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t, "SIM_SOURCES=2500", "SIM_DESTS=750")
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1920, "height": 1080, "deviceScaleFactor": 1, "mobile": false})

	b.open(srv.URL + "/panels/editor?new")
	signInOnPad(b)
	b.waitFor("the lock goes", `!document.documentElement.dataset.sodeLock`)
	b.waitFor("the sidebar is built", `!!document.getElementById('ed-set-type')`)
	b.eval(`const s = document.getElementById('ed-set-type'); s.value = 'grid'; s.dispatchEvent(new Event('change', { bubbles: true })); true`)
	b.waitFor("the settings tab", `!!document.getElementById('tab-ed-settings')`)
	side := func(x, y string) string {
		return `(() => { const a = document.getElementById('` + x + `').closest('.sode-pair__col').getBoundingClientRect(); const b = document.getElementById('` + y + `').closest('.sode-pair__col').getBoundingClientRect(); return a.width > 0 && a.right <= b.left && Math.abs(a.top - b.top) < 4; })()`
	}
	above := func(x, y string) string {
		return `(() => { const a = document.getElementById('` + x + `').closest('.sode-pair__col').getBoundingClientRect(); const b = document.getElementById('` + y + `').closest('.sode-pair__col').getBoundingClientRect(); return a.width > 0 && a.bottom <= b.top; })()`
	}
	b.waitFor("Panel and Access side by side at 1920", side("ed-set-type", "ed-acts-api"))
	b.shot("settings-wide")
	b.eval(`document.getElementById('tab-ed-lists').click(); true`)
	b.waitFor("the lists fill", `!!document.querySelector('#ed-sources-list li[data-id="0"]') && !!document.querySelector('#ed-destinations-list li[data-id="0"]')`)
	b.waitFor("Sources and Destinations side by side at 1920", side("ed-sources-list", "ed-destinations-router"))
	b.shot("lists-wide")
	if n := int(b.eval(`document.getElementsByTagName('*').length`).(float64)); n > 8000 {
		t.Errorf("the editor holds %d elements with both lists, want at most 8000", n)
	}

	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 800, "height": 900, "deviceScaleFactor": 1, "mobile": false})
	b.waitFor("Sources above Destinations at 800", above("ed-sources-list", "ed-destinations-router"))
	b.shot("lists-narrow")
	b.eval(`document.getElementById('tab-ed-settings').click(); true`)
	b.waitFor("Panel above Access at 800", above("ed-set-type", "ed-acts-api"))
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1920, "height": 1080, "deviceScaleFactor": 1, "mobile": false})
	b.eval(`document.getElementById('tab-ed-lists').click(); true`)

	b.eval(`
		window.li = (n) => document.querySelector('#ed-sources-list li[data-id="' + n + '"]');
		window.pick = (n, mods) => li(n).querySelector('.sode-pages__name').dispatchEvent(new MouseEvent('click', { bubbles: true, ...mods }));
		window.picked = () => [...document.querySelectorAll('#ed-sources-list li[data-selected]')].map((x) => Number(x.dataset.id)).sort((a, b) => a - b).join();
		true`)
	b.waitFor("row 8 drawn", `!!li(8)`)
	b.eval(`pick(2); pick(5, { shiftKey: true }); pick(8, { ctrlKey: true }); true`)
	b.waitFor("click, Shift-click and Ctrl-click select five rows", `picked() === '2,3,4,5,8' && document.getElementById('ed-sources-sel').textContent === '5 selected.'`)

	// Artwork on all five at once: Icon A and Icon B.
	b.eval(`document.getElementById('ed-sources-sel-art').click(); true`)
	b.waitFor("the artwork control names the selection", `!document.getElementById('ed-sources-art').hidden && document.getElementById('ed-sources-art-head').textContent.startsWith('Artwork for 5 sources')`)
	b.shot("selected")
	b.eval(`document.querySelector('#ed-sources-art .pb-btn[aria-expanded]').click(); true`)
	b.waitFor("Icon A choices", `!!document.querySelector('#ed-sources-art button[aria-label="camera"]')`)
	b.eval(`document.querySelector('#ed-sources-art button[aria-label="camera"]').click(); true`)
	b.eval(`document.querySelector('#ed-sources-art [role="group"][aria-label="Icon B"] button[aria-label="7"]').click(); true`)
	b.waitFor("every selected row says it has artwork, and only those", `[2, 3, 4, 5, 8].every((n) => li(n).textContent.includes('artwork')) && !li(6).textContent.includes('artwork')`)

	// A drag of a selected row moves all five, in list order, before row 0 (the top half of row 0).
	b.eval(`(() => {
		const dt = new DataTransfer();
		const to = li(0);
		const r = to.getBoundingClientRect();
		const at = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 2 };
		li(8).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
		to.dispatchEvent(new DragEvent('dragover', at));
		to.dispatchEvent(new DragEvent('drop', at));
		return true;
	})()`)
	order := `[...document.querySelectorAll('#ed-sources-list li')].slice(0, 9).map((x) => x.dataset.id).join()`
	b.waitFor("the drag moves the block to the top", order+` === '2,3,4,5,8,0,1,6,7' && picked() === '2,3,4,5,8'`)

	// From the keyboard: Alt+Down twice moves the block down two rows; Alt+Home takes it back to the top.
	key := func(k string, mods string) {
		b.eval(fmt.Sprintf(`document.getElementById('ed-sources-list').focus(); document.getElementById('ed-sources-list').dispatchEvent(new KeyboardEvent('keydown', { key: %q, bubbles: true, cancelable: true, %s })); true`, k, mods))
	}
	key("ArrowDown", "altKey: true")
	key("ArrowDown", "altKey: true")
	b.waitFor("Alt+Down twice moves the block past two rows", order+` === '0,1,2,3,4,5,8,6,7'`)
	key("Home", "altKey: true")
	b.waitFor("Alt+Home moves it to the top", order+` === '2,3,4,5,8,0,1,6,7'`)
	key("ArrowDown", "")
	b.waitFor("an arrow moves the cursor and selects that row alone", `picked().split(',').length === 1`)
	key("ArrowDown", "shiftKey: true")
	key("ArrowDown", "shiftKey: true")
	b.waitFor("Shift+Down selects a range from the anchor", `picked().split(',').length === 3`)
	key("Escape", "")
	b.waitFor("Esc selects none", `picked() === '' && document.getElementById('ed-sources-sel-art').disabled`)

	// A selection of every row: Select all and an Icon A for 2500 rows stay quick.
	ms := b.eval(`(async () => {
		const t0 = performance.now();
		document.getElementById('ed-sources-sel-all').click();
		document.getElementById('ed-sources-sel-art').click();
		document.querySelector('#ed-sources-art button[aria-label="camera"]').click();
		await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
		return performance.now() - t0;
	})()`).(float64)
	t.Logf("Select all and Icon A on 2500 rows: %.0f ms to the next frame", ms)
	if ms > 300 {
		t.Errorf("Select all and Icon A on 2500 rows took %.0f ms, want under 300", ms)
	}
	b.waitFor("2500 selected", `document.getElementById('ed-sources-sel').textContent === '2500 selected.'`)
	b.eval(`document.getElementById('ed-sources-sel-none').click(); true`)

	b.eval(`document.getElementById('ed-name').value = 'Selected grid'; document.getElementById('ed-name').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ed-save').click(); true`)
	b.waitFor("saved", `document.getElementById('ed-state').textContent === 'Saved' && location.search.startsWith('?panel=')`)
	id := regexp.MustCompile(`panel=([\w-]+)`).FindStringSubmatch(b.eval(`location.search`).(string))[1]
	srcs, _ := readPanel(t, a, ana, id)["sources"].(map[string]any)
	members, _ := srcs["members"].([]any)
	head, _ := json.Marshal(members[:7])
	if len(members) != 2500 || string(head) != `[2,3,4,5,8,0,1]` {
		t.Errorf("members start %s (%d), want [2,3,4,5,8,0,1] of 2500", head, len(members))
	}
	items, _ := srcs["items"].(map[string]any)
	if it, _ := items["8"].(map[string]any); it["art"] != "icon:camera" || it["artB"] != "7" {
		t.Errorf("item 8 %v, want Icon A camera and Icon B 7", it)
	}
	if it, _ := items["100"].(map[string]any); it["art"] != "icon:camera" || it["artB"] != nil {
		t.Errorf("item 100 %v, want Icon A camera alone", it)
	}
	b.check()
}
