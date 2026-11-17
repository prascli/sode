package app

import (
	"testing"

	"github.com/sethdotfm/sode/internal/config"
)

// A Grid panel page whose socket never opens has no hello, so its take confirm uses the lockout and Enter from the
// panel read. A Public panel needs no socket to run.
func TestChromeGridPanelConfirmSettings(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim, func(c *config.Config) {
		c.Users[0].Trusted = true
		c.ConfirmLockoutMs, c.ConfirmEnter = 1500, true
	})
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Hall grid","type":"grid","acts":"public","settings":{"mode":"take","levels":[1]}}`)
	waitNamesAndTally(t, a, ana)

	b.call("Page.addScriptToEvaluateOnNewDocument", map[string]any{"source": `window.WebSocket = class { static OPEN = 1; readyState = 0; send() {} close() {} };`})
	b.open(srv.URL + "/panels/" + id + "?instance=Hall")
	b.waitFor("the grid", gridXp(11, simDst)+` !== null && `+gridXp(5, 5)+`.dataset.on?.startsWith('1')`)
	b.eval(gridXp(11, simDst) + `.click()`)
	b.waitFor("staged", gridXp(11, simDst)+`.dataset.s === 'staged'`)
	held := b.eval(`new Promise((done) => {
		const at = performance.now();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		const wait = () => (document.getElementById('confirm-ok').disabled ? requestAnimationFrame(wait) : done(performance.now() - at));
		wait();
	})`)
	if ms, _ := held.(float64); ms < 1400 {
		t.Errorf("the confirm unlocked after %v ms, want the configured 1500", held)
	}
	if b.eval(`document.getElementById('confirm-body').textContent.includes('or Enter')`) != true {
		t.Error("the prompt does not say Enter also confirms")
	}
	gridKey(b, "Enter")
	tallyHas(t, a, ana, simDst, 11)
	b.check()
}
