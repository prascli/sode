package app

import (
	"fmt"
	"strings"
	"testing"
)

// A narrow window with a mouse keeps the desktop layout, so patchbay's page floor applies unless a page drops it.
func TestChromePanelPagesFitNarrowMouseWindow(t *testing.T) {
	b, _, _, id := editorTabPrep(t, `{"name":"Narrow","rows":4,"cols":8,"cells":[]}`, func(b *tab, _ *App, _, _ string) {
		b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": false})
	})
	fits := `document.documentElement.dataset.layout === 'desktop' && document.documentElement.scrollWidth <= document.documentElement.clientWidth`
	b.waitFor("the editor fits a 390 px mouse window", fits)
	b.shot("narrow-editor")
	origin := fmt.Sprint(b.eval(`location.origin`))
	for _, path := range []string{"/panels", "/panels/" + id} {
		b.open(origin + path)
		b.waitFor(path+" loaded", `document.readyState === 'complete' && !!document.querySelector('main')`)
		b.waitFor(path+" fits a 390 px mouse window", fits)
		b.shot("narrow" + strings.ReplaceAll(path, "/", "-"))
	}
	b.open(origin + "/")
	b.waitFor("the main page keeps patchbay's page floor", `getComputedStyle(document.body).minWidth !== '0px' && document.documentElement.scrollWidth > document.documentElement.clientWidth`)
	b.check()
}
