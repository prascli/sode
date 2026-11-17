package app

import (
	"fmt"
	"testing"
)

// The grid's scroll bars are big enough for a trackball, and a wheel turned over the horizontal one scrolls the grid
// across, not down. Over the crosspoints the same wheel scrolls down as before.
func TestChromeGridPanelScrollBars(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wheel grid","type":"grid","settings":{"mode":"take","levels":[1]}}`)
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the lock screen goes", `document.querySelector('.sode-lock').hidden && !!`+gridXp(3, 3))
	sc := `document.querySelector('.sode-gridpanel__scroll')`
	b.waitFor("40 px across the bottom and 28 px down the side", sc+`.offsetHeight - `+sc+`.clientHeight === 40 && `+sc+`.offsetWidth - `+sc+`.clientWidth === 28`)

	pos := func() (float64, float64) {
		v := b.eval(`[` + sc + `.scrollLeft, ` + sc + `.scrollTop]`).([]any)
		return v[0].(float64), v[1].(float64)
	}
	// The middle of the horizontal bar, in client px.
	bar := b.eval(`(() => { const s = ` + sc + `; const r = s.getBoundingClientRect(); return [r.left + s.clientWidth / 2, r.top + s.clientTop + s.clientHeight + 20]; })()`).([]any)
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseMoved", "x": bar[0], "y": bar[1]})
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseWheel", "x": bar[0], "y": bar[1], "deltaX": 0, "deltaY": 240})
	b.waitFor("a wheel over the horizontal bar scrolls across", sc+`.scrollLeft > 0 && `+sc+`.scrollTop === 0`)
	left, _ := pos()

	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseMoved", "x": bar[0], "y": 400})
	b.call("Input.dispatchMouseEvent", map[string]any{"type": "mouseWheel", "x": bar[0], "y": 400, "deltaX": 0, "deltaY": 240})
	b.waitFor("over the crosspoints it scrolls down", fmt.Sprintf(`%s.scrollTop > 0 && %s.scrollLeft === %v`, sc, sc, left))
	b.check()
}
