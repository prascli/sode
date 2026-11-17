package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/sethdotfm/sode/internal/config"
)

// A long key list scrolls inside its dialog, and the dialog stays on the screen: the Share modal's instance list in
// the panel editor, and My API keys in Settings.
func TestChromeKeyListsScroll(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim, func(c *config.Config) { c.Users[0].Trusted = true })
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	waitNamesAndTally(t, a, ana)
	id := makePanel(t, a, ana, `{"name":"Many","acts":"api","rows":2,"cols":2,"cells":[]}`)
	for i := 0; i < 19; i++ {
		if rec := apiSend(a, "POST", "/api/v1/panels/"+id+"/key", ana, fmt.Sprintf(`{"instance":"Wall %d"}`, i)); rec.Code != 201 {
			t.Fatalf("key %d: %d %s", i, rec.Code, rec.Body.String())
		}
	}
	for i := 0; i < 24; i++ {
		apiTestKey(t, a, keyOwner{Kind: actorUser, Name: "Ana"}, fmt.Sprintf("Desk %d", i), time.Time{})
	}
	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1280, "height": 800, "deviceScaleFactor": 1, "mobile": false})
	// fits(dialog, list): the dialog is inside the viewport and the list is shorter than its rows, so it scrolls.
	fits := func(what, dialog, list string) {
		t.Helper()
		b.waitFor(what, fmt.Sprintf(`(() => { const d = document.querySelector(%q)?.getBoundingClientRect(); const l = document.querySelector(%q); if (!d || !l) return false; return d.top >= 0 && d.bottom <= innerHeight && l.clientHeight > 0 && l.scrollHeight > l.clientHeight + 20 && getComputedStyle(l).overflowY === 'auto'; })()`, dialog, list))
	}

	b.open(srv.URL + "/panels/editor?panel=" + id)
	signInOnPad(b)
	b.waitFor("panel loaded", `!document.documentElement.dataset.sodeLock && document.getElementById('ed-name').value === 'Many'`)
	b.eval(`document.getElementById('ed-share').click(); true`)
	b.waitFor("every instance listed", `document.querySelectorAll('.sode-ov__keyitem').length === 19`)
	fits("the Share modal stays on the screen and its list scrolls", ".sode-ov__share", ".sode-ov__keys")

	b.open(srv.URL + "/#settings")
	b.waitFor("Settings open", `document.documentElement.dataset.view === 'settings'`)
	// The editor's sign-in may carry over to this page.
	b.waitFor("Sign in or My API keys shown", `!document.getElementById('account-login').hidden || !document.getElementById('account-keys').hidden`)
	if b.eval(`document.getElementById('account-keys').hidden`) == true {
		b.eval(`document.getElementById('account-login').click()`)
		signInOnPad(b)
	}
	b.waitFor("signed in", `!document.getElementById('account-keys').hidden`)
	b.eval(`document.getElementById('account-keys').click()`)
	b.waitFor("every key listed", `document.querySelectorAll('.sode__keys-dlg .sode__key-list .sode__key-row').length >= 25`)
	fits("My API keys stays on the screen and its list scrolls", ".sode__keys-dlg", ".sode__keys-dlg .sode__key-list")
	b.check()
}
