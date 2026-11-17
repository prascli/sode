package app

import (
	"fmt"
	"testing"
)

// Find's list and the mouse. A pointer that the list arrived under, or that sends a move with no change of place,
// takes no highlight. A real move over a row takes it. Leaving the list puts back the keyboard's result, so a
// pointer that crossed the list on its way somewhere changes nothing. A click still chooses.
func TestChromeEditorFindHover(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)
	id := makePanel(t, a, ana, `{"name":"Hover panel","rows":4,"cols":8,"cells":[]}`)
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1280, "height": 800, "deviceScaleFactor": 1, "mobile": false})
	b.open(srv.URL + "/panels/editor?panel=" + id)
	signInOnPad(b)
	b.waitFor("lock gone", `!document.documentElement.dataset.sodeLock`)
	b.waitFor("panel loaded", `document.getElementById('ed-name').value === 'Hover panel'`)

	b.eval(`window.press = (el, init) => el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
		window.grid = document.getElementById('ed-grid');
		window.list = () => document.querySelector('.sode-find[data-open] .sode-find__list');
		window.hi = () => document.querySelector('.sode-find[data-open] .sode-find__row.is-hi')?.dataset.i;
		window.rowAt = (i) => { const r = list().querySelector('[data-i="' + i + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
		true`)
	b.waitFor("Find in the menu", `(document.querySelector('.is-sel') || press(grid, { key: 'ArrowDown' }), !!document.querySelector('.sode-find'))`)
	b.eval(`press(grid, { key: 'c' }); true`)
	b.waitFor("Find open with results", `list()?.getBoundingClientRect().height > 100 && list().querySelectorAll('.sode-find__row').length > 5 && hi() === '0'`)

	move := func(x, y float64) {
		b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseMoved", "x": x, "y": y})
	}
	at := func(i int) (float64, float64) {
		p := b.eval(fmt.Sprintf(`rowAt(%d)`, i)).([]any)
		return p[0].(float64), p[1].(float64)
	}
	stillHi := func(what, want string) {
		b.t.Helper()
		if got := b.eval(`hi()`); got != want {
			t.Errorf("%s: highlight on row %v, want %s", what, got, want)
		}
	}

	// The first event the list sees is where the pointer already was: no highlight. The same place again is no move.
	x, y := at(3)
	move(x, y)
	stillHi("a pointer the list arrived under", "0")
	move(x, y)
	stillHi("a move to the same place", "0")
	// A real move over a row takes the highlight and previews it.
	move(x+3, y)
	b.waitFor("a real move highlights the row", `hi() === '3'`)

	// A sweep across the list and out of the flyout puts the keyboard's result back.
	x5, y5 := at(5)
	move(x5, y5)
	b.waitFor("the sweep highlights as it goes", `hi() === '5'`)
	r := b.eval(`(() => { const p = document.querySelector('.sode-find[data-open]').getBoundingClientRect(); return [p.right + 40, p.top + p.height / 2]; })()`).([]any)
	move(r[0].(float64), r[1].(float64))
	b.waitFor("leaving the list puts the keyboard's result back", `hi() === '0'`)
	b.waitFor("Find is still open on the box", `document.activeElement === document.querySelector('.sode-find input')`)

	// A redraw under a still pointer takes no highlight either.
	move(x, y)
	move(x+3, y)
	b.waitFor("back over row 3", `hi() === '3'`)
	b.eval(`press(document.querySelector('.sode-find input'), { key: 'ArrowDown' }); true`)
	b.waitFor("the arrow key moves on from the hovered row", `hi() === '4'`)
	move(x+3, y)
	stillHi("a move to the same place after a redraw", "4")

	// A click chooses the row under the pointer.
	x2, y2 := at(2)
	want := b.eval(`list().querySelector('[data-i="2"] .sode-find__name').textContent`)
	move(x2, y2)
	move(x2+2, y2)
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mousePressed", "x": x2 + 2, "y": y2, "button": "left", "clickCount": 1})
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseReleased", "x": x2 + 2, "y": y2, "button": "left", "clickCount": 1})
	b.waitFor("the click placed that row", fmt.Sprintf(`[...document.querySelectorAll('.sode-ed__sq .sode-ed__text')].some((n) => n.textContent === %q)`, want))
	b.waitFor("the next result is highlighted and Find keeps the box", `hi() === '3' && document.activeElement === document.querySelector('.sode-find input')`)
	b.check()
}
