package app

import (
	"strings"
	"testing"
)

// A Grid panel page that never asks for a name makes a take. The Communication Log row and the main page's History
// name the panel and the instance, which is the page's address. A long panel name wraps in the row and is never cut off.
func TestChromeHistoryNamesPanelAndInstance(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	const name = "Studio grid for the second floor control room"
	id := makePanel(t, a, ana, `{"name":"`+name+`","type":"grid","settings":{"mode":"take","levels":[1,2],"askInstanceName":false}}`)
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/" + id)
	signInOnPad(b)
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on')`)
	b.waitFor("names are the current Router names", `document.querySelector('.sode-gridpanel__dst[data-dst="2"]')?.textContent === 'DSM1'`)
	b.eval(gridXp(11, 2) + `.click()`)
	b.waitFor("staged", gridXp(11, 2)+`.dataset.s === 'staged'`)
	gridKey(b, "Enter")
	gridConfirm(b)
	tallyHas(t, a, ana, 2, 11)

	const where = "on panel " + name + ", instance 127.0.0.1"
	if e := lastRow(t, a, "take"); !strings.Contains(e.Note, "instance 127.0.0.1") {
		t.Errorf("take row %+v, want the instance in Note", e)
	}

	b.call("Emulation.setDeviceMetricsOverride", map[string]any{"width": 1100, "height": 800, "deviceScaleFactor": 1, "mobile": false})
	b.open(srv.URL + "/")
	b.waitFor("History names the panel and the instance", `[...document.querySelectorAll('.sode__hist-row .sode__hist-by')].some((n) => n.textContent.includes('`+where+`'))`)
	b.waitFor("the label is shown in full inside its row", `(() => {
		const n = [...document.querySelectorAll('.sode__hist-row .sode__hist-by')].find((n) => n.textContent.includes('`+where+`'));
		const r = n.getBoundingClientRect(), p = n.parentElement.getBoundingClientRect();
		return r.width > 0 && r.right <= p.right + 0.5 && r.bottom <= p.bottom + 0.5 && n.scrollWidth <= n.clientWidth;
	})()`)
	b.shot("history")
	b.check()
}
