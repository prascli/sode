package app

import (
	"fmt"
	"testing"
	"time"
)

// touchAt is the client centre of the element that expr gives, as "x,y".
func touchAt(b *tab, expr string) (float64, float64) {
	b.t.Helper()
	var x, y float64
	got := b.eval(`(() => { const r = (` + expr + `).getBoundingClientRect(); return (r.left + r.width / 2) + ',' + (r.top + r.height / 2); })()`)
	if _, err := fmt.Sscanf(got.(string), "%g,%g", &x, &y); err != nil {
		b.t.Fatalf("no place for %s: %v", expr, err)
	}
	return x, y
}

// touch puts one finger down on the element that expr gives and lifts it after hold. It uses the browser's own
// touch input, so the page gets Touch Events and the click that follows a tap.
func touch(b *tab, expr string, hold time.Duration) {
	b.t.Helper()
	x, y := touchAt(b, expr)
	b.call("Input.dispatchTouchEvent", map[string]any{"type": "touchStart", "touchPoints": []map[string]any{{"x": x, "y": y}}})
	time.Sleep(hold)
	b.call("Input.dispatchTouchEvent", map[string]any{"type": "touchEnd", "touchPoints": []map[string]any{}})
}

func tap(b *tab, expr string) { touch(b, expr, 30*time.Millisecond) }

// A Grid panel on the phone layout, by touch only. Taps add names to the picks, a long-press adds a range, and the
// numbered targets show with no hover. A tap on a crosspoint stages the Diagonal and the Take button opens the
// confirm. A double-tap on a name jumps and leaves the picks as they were. There is no key list.
func TestChromeGridPanelPhone(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Phone grid","type":"grid","settings":{"mode":"take","levels":[1,2]}}`)
	waitNamesAndTally(t, a, ana)

	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": true})
	b.call("Emulation.setTouchEmulationEnabled", map[string]any{"enabled": true, "maxTouchPoints": 5})
	b.open(srv.URL + "/panels/" + id + "?instance=Phone")
	b.waitFor("the phone layout", `document.documentElement.dataset.layout === 'phone'`)
	signInOnPad(b)
	b.waitFor("the grid", gridXp(2, 2)+` !== null`)
	b.waitFor("the lock screen goes", `document.querySelector('.sode-lock').hidden`)

	if px := b.eval(`document.querySelector('.sode-gridpanel__probe-xp').getBoundingClientRect().width`).(float64); px < 64 {
		t.Errorf("a crosspoint is %vpx on the phone, want a finger's size", px)
	}
	b.waitFor("the Take button shows, off with nothing staged", `(() => { const t = document.getElementById('panel-take'); return !!t?.offsetParent && t.disabled; })()`)

	// Router numbers start at 0, so source 11 is the twelfth column: it goes first.
	b.eval(`(() => {
		const sc = document.querySelector('.sode-gridpanel__scroll');
		sc.scrollLeft = 11 * document.querySelector('.sode-gridpanel__probe-xp').getBoundingClientRect().width;
		return true;
	})()`)
	src := func(n int) string {
		return fmt.Sprintf(`document.querySelector('.sode-gridpanel__src[data-src="%d"]')`, n)
	}
	dst := func(n int) string {
		return fmt.Sprintf(`document.querySelector('.sode-gridpanel__dst[data-dst="%d"]')`, n)
	}
	picked := func(name string) string { return `('picked' in ` + name + `.dataset)` }
	b.waitFor("source 13 drawn", src(13)+` !== null && !`+src(13)+`.hidden && `+src(13)+`.getBoundingClientRect().right <= document.querySelector(".sode-gridpanel__scroll").getBoundingClientRect().right`)

	tap(b, src(11))
	b.waitFor("a tap picks", picked(src(11)))
	tap(b, src(12))
	b.waitFor("a second tap adds to the picks", picked(src(11))+` && `+picked(src(12)))
	time.Sleep(500 * time.Millisecond) // not a double-tap
	tap(b, src(12))
	b.waitFor("a tap on a picked name removes it", picked(src(11))+` && !`+picked(src(12)))
	cursor := b.eval(gridCursor)
	touch(b, src(13), 700*time.Millisecond)
	b.waitFor("a long-press adds the range from the last tap", picked(src(11))+` && `+picked(src(12))+` && `+picked(src(13)))
	if got := b.eval(gridCursor); got != cursor {
		t.Errorf("a long-press moved the cursor from %v to %v", cursor, got)
	}

	b.waitFor("the numbered targets show with no hover",
		gridXp(11, 0)+`?.dataset.n === '1' && `+gridXp(12, 1)+`?.dataset.n === '2' && `+gridXp(13, 2)+`?.dataset.n === '3'`)
	b.shot("phone-preview")

	tap(b, gridXp(11, 0))
	staged := func(s, d int) string { return gridXp(s, d) + `.dataset.s === 'staged'` }
	b.waitFor("a tap on a crosspoint stages the Diagonal", staged(11, 0)+` && `+staged(12, 1)+` && `+staged(13, 2))
	b.waitFor("the Take button works and counts the staged routes", `(() => { const t = document.getElementById('panel-take'); return !t.disabled && t.textContent === 'Take 3'; })()`)
	tap(b, `document.getElementById('panel-take')`)
	b.waitFor("the confirm lists all three", `document.getElementById('confirm-body').textContent.includes('3 destinations')`)
	b.shot("phone-confirm")
	gridConfirm(b)
	tallyHas(t, a, ana, 0, 11)
	tallyHas(t, a, ana, 1, 12)
	tallyHas(t, a, ana, 2, 13)
	b.waitFor("the Take button is off again", `document.getElementById('panel-take').disabled`)

	// Destination 5 has source 5: a double-tap on its name goes along the row to it.
	b.eval(`document.querySelector('.sode-gridpanel__scroll').scrollTo(0, 0), true`)
	b.waitFor("destination 5 drawn", dst(5)+` !== null && !`+dst(5)+`.hidden`)
	tap(b, dst(5))
	time.Sleep(80 * time.Millisecond)
	tap(b, dst(5))
	gridCursorOn(b, "a double-tap on a name jumps", 5, 5)
	b.waitFor("the double-tap leaves the picks", `!`+picked(dst(5)))

	realKey(b, "?", "Slash", 191)
	time.Sleep(200 * time.Millisecond)
	if open := b.eval(`!document.getElementById('keys').hidden`); open == true {
		t.Error("the phone layout opened the key list")
	}
	b.check()
}
