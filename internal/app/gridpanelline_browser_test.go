package app

import (
	"strings"
	"testing"
)

// A Drawn line on a Grid panel in Take mode, with real mouse events. A drag down one column numbers its targets and
// skips the protected row; release opens the confirm, and the take reaches the router. A press that barely moves
// stays a click. v draws a line from the keys, Esc drops it, and Space stages it.
func TestChromeGridPanelLine(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Line grid","type":"grid","settings":{"mode":"take","levels":[1]}}`)
	waitNamesAndTally(t, a, ana)
	a.mu.Lock()
	a.router.protect[3] = map[int]int{1: 9}
	a.mu.Unlock()

	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the grid", gridXp(7, 4)+` !== null`)
	b.waitFor("the lock screen goes", `document.querySelector('.sode-lock').hidden`)
	b.waitFor("destination 3 shows protected", `document.querySelector('.sode-gridpanel__dst[data-dst="3"]').classList.contains('pb-xpt--protected')`)

	at := func(src, dst int, dy float64) (float64, float64) {
		r := b.eval(`(() => { const r = ` + gridXp(src, dst) + `.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`).([]any)
		return r[0].(float64), r[1].(float64) + dy
	}
	mouse := func(typ string, x, y float64) {
		ev := map[string]any{"type": typ, "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1}
		if typ == "mouseReleased" {
			ev["buttons"] = 0
		}
		b.call("Input.dispatchMouseEvent", ev)
	}
	staged := func(src, dst int) string { return gridXp(src, dst) + `.dataset.s === 'staged'` }

	// A press that moves less than half a crosspoint is a click.
	x, y := at(9, 0, 0)
	mouse("mousePressed", x, y)
	mouse("mouseMoved", x+4, y+3)
	mouse("mouseReleased", x+4, y+3)
	b.waitFor("a small move stays a click and stages", staged(9, 0))
	gridKey(b, "Escape")
	b.waitFor("Esc drops it", `!document.querySelector('.sode-gridpanel__xp[data-s="staged"]')`)

	// A vertical line down source 7 from destination 1 to destination 4.
	x0, y0 := at(7, 1, 0)
	_, y1 := at(7, 4, 0)
	mouse("mousePressed", x0, y0)
	for k := 1; k <= 12; k++ {
		mouse("mouseMoved", x0, y0+(y1-y0)*float64(k)/12)
	}
	b.waitFor("the line shows with numbered targets and the protected row skipped", `(() => {
		const n = (d) => `+gridXp(7, 0)+`.parentNode.querySelector('.sode-gridpanel__xp[data-src="7"][data-dst="' + d + '"]').dataset.n;
		return !document.querySelector('.sode-gridpanel__lines').hidden && n(1) === '1' && n(2) === '2' && n(4) === '3' &&
			`+gridXp(7, 3)+`.hasAttribute('data-skip');
	})()`)
	b.shot("drawing")
	mouse("mouseReleased", x0, y1)
	b.waitFor("the confirm lists three destinations", `document.getElementById('confirm-body').textContent.includes('3 destinations')`)
	b.waitFor("the line is gone", `document.querySelector('.sode-gridpanel__lines').hidden && !document.querySelector('[data-n], [data-skip]')`)
	b.shot("confirm")
	gridConfirm(b)
	for _, d := range []int{1, 2, 4} {
		tallyHas(t, a, ana, d, 7)
	}
	if strings.Contains(apiDo(a, "GET", "/api/v1/tally", ana, nil).Body.String(), `"dst":3,"level":1,"src":7`) {
		t.Error("the protected row was taken")
	}

	// From the keys: the pointer places the cursor, v starts a line there, Esc drops it, and Space stages one.
	px, py := at(5, 0, 0)
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseMoved", "x": px, "y": py})
	gridCursorOn(b, "the pointer places the cursor", 0, 5)
	realKey(b, "v", "KeyV", 86)
	realKey(b, "j", "KeyJ", 74)
	b.waitFor("v and j draw a line of two", `!document.querySelector('.sode-gridpanel__lines').hidden && `+gridXp(5, 1)+`.dataset.n === '2'`)
	realKey(b, "Escape", "Escape", 27)
	b.waitFor("Esc drops the line and stages nothing", `document.querySelector('.sode-gridpanel__lines').hidden && !document.querySelector('[data-n], [data-s="staged"]')`)
	realKey(b, "v", "KeyV", 86)
	realKey(b, "j", "KeyJ", 74)
	realKey(b, "l", "KeyL", 76)
	realKey(b, "Enter", "Enter", 13)
	b.waitFor("Enter does nothing while a line is drawn", `document.getElementById('confirm').hidden`)
	realKey(b, " ", "Space", 32)
	b.waitFor("Space stages the line and confirms it", `document.getElementById('confirm-body').textContent.includes('2 destinations')`)
	gridConfirm(b)
	tallyHas(t, a, ana, 1, 5)
	tallyHas(t, a, ana, 2, 6)
	if n := b.eval(`document.querySelectorAll('.sode-gridpanel__xp[data-s="staged"]').length`); n != float64(0) {
		t.Errorf("%v routes still staged after the take", n)
	}
	b.check()
}
