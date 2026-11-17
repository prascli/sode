package app

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/sethdotfm/sode/web"
)

// Show all destinations hangs below the destinations added with +, not over them, and a press
// at its centre reaches it.
func TestChromeMainShowAllBelowChips(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { a.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	srv := httptest.NewServer(a.Handler(web.FS))
	t.Cleanup(func() { srv.CloseClientConnections(); srv.Close() })
	waitNamesAndTally(t, a, userKey(t, a, "Ana"))

	b.open(srv.URL + "/")
	b.waitFor("Destination box", `!!document.getElementById('dst')`)
	for _, name := range []string{"DSM1", "DSM2", "DSM3"} {
		b.waitFor(name+" match list", `(() => { const t = document.getElementById('dst'); t.focus(); t.value = '`+name+`'; t.dispatchEvent(new Event('input', {bubbles: true})); return !!document.getElementById('dst-opt-0'); })()`)
		b.eval(`document.getElementById('dst-add').click(); true`)
	}
	b.waitFor("three destinations added", `document.querySelectorAll('#dst-chips > .pb-chip').length === 3`)
	b.eval(`(() => { const t = document.getElementById('dst'); t.blur(); t.focus(); return true; })()`)
	b.waitFor("Show all destinations shown", `!document.getElementById('dst-all').hidden && !!document.querySelector('#dst-all button').offsetParent`)

	if got := b.eval(`(() => {
		const all = document.querySelector('#dst-all button').getBoundingClientRect();
		const chips = document.getElementById('dst-chips').getBoundingClientRect();
		return all.top >= chips.bottom - 0.5;
	})()`); got != true {
		t.Fatal("Show all destinations overlaps the added destinations")
	}
	if got := b.eval(`(() => {
		const btn = document.querySelector('#dst-all button');
		const r = btn.getBoundingClientRect();
		return btn.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
	})()`); got != true {
		t.Fatal("something covers Show all destinations")
	}
	b.check()
}
