package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/sethdotfm/sode/internal/config"
)

// gridXp is the crosspoint of router source src and destination dst on a Grid panel page.
func gridXp(src, dst int) string {
	return fmt.Sprintf(`document.querySelector('.sode-gridpanel__xp[data-src="%d"][data-dst="%d"]')`, src, dst)
}

// gridConfirm answers the open take confirm with its churning letter once the lockout is over.
func gridConfirm(b *tab) {
	b.waitFor("the take confirm", `!document.getElementById('confirm').hidden`)
	b.waitFor("the confirm lockout ends", `!document.getElementById('confirm-ok').disabled`)
	b.eval(`(() => {
		const k = /\((\w)\)/.exec(document.getElementById('confirm-ok').textContent)[1].toLowerCase();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
	})()`)
	b.waitFor("the confirm closes", `document.getElementById('confirm').hidden`)
}

func gridKey(b *tab, key string) {
	b.eval(fmt.Sprintf(`document.dispatchEvent(new KeyboardEvent('keydown', { key: %q, bubbles: true, cancelable: true }))`, key))
}

// tallyHas waits for the router, read over REST, to have src on dst at level 1.
func tallyHas(t *testing.T, a *App, key string, dst, src int) {
	t.Helper()
	want := fmt.Sprintf(`"dst":%d,"level":1,"src":%d`, dst, src)
	for deadline := time.Now().Add(10 * time.Second); ; time.Sleep(50 * time.Millisecond) {
		body := apiDo(a, "GET", "/api/v1/tally", key, nil).Body.String()
		if strings.Contains(body, want) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("tally never had %s: %.400s", want, body)
		}
	}
}

func signInOnPad(b *tab) {
	b.waitFor("PIN pad", `!!document.querySelector('.sode-lock__key[data-key="1"]')?.offsetParent`)
	for _, d := range "1234" {
		b.eval(fmt.Sprintf(`document.querySelector('.sode-lock__key[data-key="%c"]').click()`, d))
	}
	b.eval(`document.querySelector('.sode-lock__key[data-key="enter"]').click()`)
}

// A Grid panel in Take mode, signed in as a user. A press stages and a second press unstages. Another source in a
// staged row replaces the route. Enter opens the churning-letter confirm, and the take is one History Group.
func TestChromeGridPanelTake(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Studio grid","type":"grid","settings":{"mode":"take","levels":[1,2]}}`)
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the panel title", `document.getElementById('panel-title').textContent === 'Studio grid'`)
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on')`)
	b.waitFor("a field for every router source and destination", `(() => {
		const f = document.querySelector('.sode-gridpanel__field');
		return f?.style.getPropertyValue('--sode-cols') === '200' && f.style.getPropertyValue('--sode-rows') === '120';
	})()`)
	b.waitFor("names are the current Router names", `document.querySelector('.sode-gridpanel__dst[data-dst="2"]').textContent === 'DSM1' && document.querySelector('.sode-gridpanel__src[data-src="10"]').textContent === '`+simSrcName+`'`)
	b.waitFor("the pie shows what the router has", gridXp(2, 2)+`.dataset.on?.startsWith('1,2')`)
	b.shot("grid")

	staged := func(src, dst int) string { return gridXp(src, dst) + `.dataset.s === 'staged'` }
	b.eval(gridXp(12, 4) + `.click()`)
	b.waitFor("a press stages", staged(12, 4))
	b.eval(gridXp(12, 4) + `.click()`)
	b.waitFor("a second press unstages", `!(`+staged(12, 4)+`)`)
	b.eval(gridXp(11, 2) + `.click()`)
	b.eval(gridXp(simSrc, 2) + `.click()`)
	b.waitFor("another source in the row replaces the route", staged(simSrc, 2)+` && !(`+staged(11, 2)+`)`)
	b.eval(gridXp(11, 3) + `.click()`)
	b.waitFor("two routes staged", staged(11, 3))

	// A real Enter with focus on the last crosspoint pressed, as a mouse leaves it.
	b.eval(gridXp(11, 3) + `.focus(); true`)
	for _, typ := range []string{"keyDown", "keyUp"} {
		b.call("Input.dispatchKeyEvent", map[string]any{"type": typ, "key": "Enter", "code": "Enter", "windowsVirtualKeyCode": 13})
	}
	b.waitFor("the confirm lists both destinations", `document.getElementById('confirm-body').textContent.includes('2 destinations')`)
	b.shot("confirm")
	gridConfirm(b)
	tallyHas(t, a, ana, 2, simSrc)
	tallyHas(t, a, ana, 3, 11)
	b.waitFor("the tally reaches the pies", gridXp(simSrc, 2)+`.dataset.on?.startsWith('1,2') && !(`+staged(simSrc, 2)+`)`)
	if !strings.Contains(apiDo(a, "GET", "/api/v1/tally", ana, nil).Body.String(), `"dst":4,"level":1,"src":4`) {
		t.Error("the unstaged route was sent")
	}

	// One confirm is one POST: History holds both routes in one Group.
	var hist struct {
		Entries []struct {
			Dst   int    `json:"dst"`
			Group string `json:"group"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(apiDo(a, "GET", "/api/v1/history", ana, nil).Body.Bytes(), &hist); err != nil {
		t.Fatal(err)
	}
	groups := map[int]string{}
	for _, e := range hist.Entries {
		groups[e.Dst] = e.Group
	}
	if len(hist.Entries) != 2 || groups[2] == "" || groups[2] != groups[3] {
		t.Errorf("history %+v, want one Group of two routes", hist.Entries)
	}

	// Esc drops staged routes.
	b.eval(gridXp(12, 4) + `.click()`)
	b.waitFor("staged again", staged(12, 4))
	gridKey(b, "Escape")
	b.waitFor("Esc drops it", `!document.querySelector('.sode-gridpanel__xp[data-s="staged"]')`)

	// The panels list draws with a Grid panel in it.
	b.open(srv.URL + "/panels")
	b.waitFor("the panels list names the Grid panel", `document.body.textContent.includes('Studio grid')`)
	b.check()
}

// One Grid panel in Instant mode. It opens as a keyless page that an Assign gives a key, then as Both behind a
// sign-in, then as Public. Each press sends its one route at once.
func TestChromeGridPanelSharingModes(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim, func(c *config.Config) { c.Users[0].Trusted = true })
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	body := func(acts string) string {
		return `{"name":"Wall grid","type":"grid","acts":"` + acts + `","settings":{"mode":"instant","levels":[1]}}`
	}
	id := makePanel(t, a, ana, body("api"))
	waitNamesAndTally(t, a, ana)
	ready := func(how string) {
		b.waitFor(how+": the grid", `document.getElementById('panel-title')?.textContent === 'Wall grid' && `+gridXp(simSrc, simDst)+` !== null`)
		b.waitFor(how+": the tally", gridXp(5, 5)+`.dataset.on?.startsWith('1')`)
	}

	// Keyless: a revoked key makes the page announce itself, and an Assign gives it a working key.
	secret := instanceKey(t, a, id, ana, "Lobby")
	if rec := apiSend(a, "DELETE", "/api/v1/panels/"+id+"/key?instance=Lobby", ana, ""); rec.Code/100 != 2 {
		t.Fatalf("revoke: %d %s", rec.Code, rec.Body.String())
	}
	b.open(srv.URL + "/panels/" + id + "?instance=Lobby#key=" + strings.TrimPrefix(secret, keyPrefix))
	b.waitFor("the ended-key note", `document.getElementById('panels-note')?.textContent.includes("This link's key no longer works")`)
	p, _ := a.panels.get(id)
	var kid string
	for deadline := time.Now().Add(15 * time.Second); kid == ""; time.Sleep(50 * time.Millisecond) {
		if rows := a.mon.keylessOf(p); len(rows) == 1 {
			kid = rows[0].Keyless
		}
		if time.Now().After(deadline) {
			t.Fatal("the page never announced itself keyless")
		}
	}
	if code, m := keylessAssign(a, id, ana, kid, ""); code != 200 {
		t.Fatalf("assign: %d %v", code, m)
	}
	ready("API key from an Assign")
	b.eval(gridXp(11, simDst) + `.click()`)
	tallyHas(t, a, ana, simDst, 11)

	// Both, by the plain link: the page lock signs in and the panel runs as the user.
	if rec := apiSend(a, "PUT", "/api/v1/panels/"+id, ana, body("both")); rec.Code != 200 {
		t.Fatalf("to both: %d %s", rec.Code, rec.Body.String())
	}
	b.eval(`localStorage.clear()`)
	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	ready("Both as a user")
	b.eval(gridXp(12, simDst) + `.click()`)
	tallyHas(t, a, ana, simDst, 12)

	// Public: no key and no sign-in needed.
	if rec := apiSend(a, "PUT", "/api/v1/panels/"+id, ana, body("public")); rec.Code != 200 {
		t.Fatalf("to public: %d %s", rec.Code, rec.Body.String())
	}
	b.eval(`localStorage.clear()`)
	b.open(srv.URL + "/panels/" + id + "?instance=Hall")
	ready("Public")
	b.eval(gridXp(13, simDst) + `.click()`)
	tallyHas(t, a, ana, simDst, 13)
	// The revoked key's open and the plain links before their sign-in are refused on purpose.
	for _, e := range b.problems() {
		if !strings.Contains(e, "status of 401") {
			t.Errorf("page error: %s", e)
		}
	}
}
