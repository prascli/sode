package app

import (
	"net/url"
	"path/filepath"
	"testing"
	"time"
)

// Per-instance uptime, hidden instances and the counts behind the panels page's All, Some or All
// Offline badge. The clock is the fake one from panelmon_test.go.

func hide(t *testing.T, a *App, method, id, key, device string, want int) {
	t.Helper()
	if rec := apiSend(a, method, "/api/v1/panels/"+id+"/instances/hide?instance="+url.QueryEscape(device), key, ""); rec.Code != want {
		t.Fatalf("%s hide %s: %d %s", method, device, rec.Code, rec.Body.String())
	}
}

func instByName(t *testing.T, p map[string]any, device string) map[string]any {
	t.Helper()
	for _, x := range p["instances"].([]any) {
		if i := x.(map[string]any); i["device"] == device {
			return i
		}
	}
	t.Fatalf("no instance %s in %v", device, p["instances"])
	return nil
}

func countsOf(p map[string]any) (float64, float64) {
	return p["instancesOnline"].(float64), p["instancesKnown"].(float64)
}

func TestInstanceUptimeRecordsLostAndBack(t *testing.T) {
	a, clk := monApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wall"}`)
	start := clk.t
	keepalive(a, id, ana, "Lobby")
	clk.advance(50 * time.Second)
	a.monSweep()
	clk.advance(10 * time.Minute)
	keepalive(a, id, ana, "Lobby")

	up := instByName(t, panelOf(t, a, id, ana), "Lobby")["uptime"].(map[string]any)
	if up["start"] != "" || up["to"].(float64) != float64(clk.t.UnixMilli()) || up["from"].(float64) != float64(clk.t.Add(-monHistory).UnixMilli()) {
		t.Fatalf("window %v", up)
	}
	trans := up["trans"].([]any)
	want := []struct {
		at time.Time
		s  string
	}{{start, "up"}, {start.Add(monMiss), "down"}, {clk.t, "up"}}
	if len(trans) != len(want) {
		t.Fatalf("trans %v", trans)
	}
	for i, w := range want {
		got := trans[i].(map[string]any)
		if got["s"] != w.s || got["t"].(float64) != float64(w.at.UnixMilli()) {
			t.Errorf("trans[%d] = %v, want %s at %v", i, got, w.s, w.at)
		}
	}
}

func TestInstanceUptimeKeepsTheStateTheWindowStartsIn(t *testing.T) {
	in := &monInst{}
	t0 := time.Date(2026, 11, 8, 0, 0, 0, 0, time.UTC)
	in.mark(upUp, t0)
	in.mark(upUp, t0.Add(time.Minute)) // no change, not recorded
	in.mark(upDown, t0.Add(time.Hour))
	in.mark(upUp, t0.Add(2*time.Hour))
	now := t0.Add(monHistory + 90*time.Minute)
	in.mark(upDown, now)
	if len(in.trans) != 3 || in.trans[0].S != upDown {
		t.Fatalf("pruned %v", in.trans)
	}
	got := in.uptime(now)
	if got.Start != upDown || len(got.Trans) != 2 || got.Trans[0].S != upUp {
		t.Fatalf("uptime %+v", got)
	}
	for i := range monTransMax + 10 {
		in.mark([]string{upUp, upDown}[i%2], now.Add(time.Duration(i+1)*time.Second))
	}
	if len(in.trans) != monTransMax {
		t.Fatalf("kept %d changes", len(in.trans))
	}
}

func TestHiddenInstanceIsHiddenForEveryoneUntilShown(t *testing.T) {
	a, clk := monApp(t)
	ana, cy := userKey(t, a, "Ana"), userKey(t, a, "Cy")
	id := makePanel(t, a, ana, `{"name":"Wall","share":{"mode":"everyone"}}`)
	keepalive(a, id, ana, "Lobby")
	keepalive(a, id, ana, "Desk")
	clk.advance(40 * time.Second)
	keepalive(a, id, ana, "Lobby")
	clk.advance(10 * time.Second)
	a.monSweep() // Desk is lost
	if on, known := countsOf(panelOf(t, a, id, ana)); on != 1 || known != 2 {
		t.Fatalf("counts %v of %v", on, known)
	}
	watchInst(t, a, id, ana, "Desk", 204)

	hide(t, a, "POST", id, ana, "desk", 204)
	p := panelOf(t, a, id, ana)
	if on, known := countsOf(p); on != 1 || known != 1 {
		t.Fatalf("counts after hide %v of %v", on, known)
	}
	if h := p["hiddenInstances"].([]any); len(h) != 1 || h[0] != "desk" {
		t.Fatalf("hiddenInstances %v", h)
	}
	if w := p["watchingInstances"].([]any); len(w) != 1 {
		t.Fatalf("a hide ended the watch: %v", w)
	}
	// A hide is the panel's, so every viewer agrees.
	pc := panelOf(t, a, id, cy)
	if on, known := countsOf(pc); on != 1 || known != 1 {
		t.Fatalf("Cy's counts %v of %v", on, known)
	}
	if h := pc["hiddenInstances"].([]any); len(h) != 1 {
		t.Fatalf("Cy's hiddenInstances %v", h)
	}

	keepalive(a, id, ana, "Desk") // back, and still hidden
	p = panelOf(t, a, id, ana)
	if h := p["hiddenInstances"].([]any); len(h) != 1 {
		t.Fatalf("a return showed the instance again: %v", h)
	}
	if on, known := countsOf(p); on != 1 || known != 1 {
		t.Fatalf("counts after back %v of %v", on, known)
	}

	hide(t, a, "DELETE", id, cy, "Desk", 204)
	p = panelOf(t, a, id, ana)
	if h := p["hiddenInstances"].([]any); len(h) != 0 {
		t.Fatalf("show left %v", h)
	}
	if on, known := countsOf(p); on != 2 || known != 2 {
		t.Fatalf("counts after show %v of %v", on, known)
	}
}

// The 24 hour drop ends a hide too, unless someone watches the instance.
func TestHideEndsWithTheDropUnlessWatched(t *testing.T) {
	a, clk := monApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wall"}`)
	keepalive(a, id, ana, "Lobby")
	keepalive(a, id, ana, "Desk")
	watchInst(t, a, id, ana, "Desk", 204)
	hide(t, a, "POST", id, ana, "Lobby", 204)
	hide(t, a, "POST", id, ana, "Desk", 204)
	clk.advance(time.Minute)
	a.monSweep()
	clk.advance(monForget + time.Minute)
	a.monSweep()
	if h := a.mon.hiddenInstances(id); len(h) != 1 || h[0] != "desk" {
		t.Fatalf("after the drop %v", h)
	}
}

func TestHideFollowsARenameAndEndsWithTheInstance(t *testing.T) {
	a, _ := monApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wall"}`)
	keepalive(a, id, ana, "Lobby")
	hide(t, a, "POST", id, ana, "Lobby", 204)
	a.mon.followRename(id, "Lobby", "Foyer")
	if h := a.mon.hiddenInstances(id); len(h) != 1 || h[0] != "foyer" {
		t.Fatalf("after rename %v", h)
	}
	a.mon.forgetDevice(id, "Foyer")
	if h := a.mon.hiddenInstances(id); len(h) != 0 {
		t.Fatalf("after forget %v", h)
	}
}

// A restart keeps each instance's last 24 hours and the hides. The time Sode was stopped has no record,
// and a device that opens again after the restart is no return notice.
func TestInstanceHistoryAndHidesOutliveARestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	clk := &monClock{t: time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)}
	m := loadPanelMon(path)
	m.now = clk.now
	const id = "p-0000abcd"
	if _, err := m.beat(id, "Lobby"); err != nil {
		t.Fatal(err)
	}
	if _, err := m.beat(id, "Desk"); err != nil {
		t.Fatal(err)
	}
	if err := m.setHidden(id, "Desk", true); err != nil {
		t.Fatal(err)
	}
	clk.advance(10 * time.Second)
	m.stopFile()
	stopped := clk.t

	clk.advance(10 * time.Minute)
	m2 := loadPanelMon(path)
	m2.now = clk.now
	if h := m2.hiddenInstances(id); len(h) != 1 || h[0] != "desk" {
		t.Fatalf("hides %v", h)
	}
	rows := m2.instances(id)
	if len(rows) != 2 || rows[0].Device != "Desk" || rows[1].Device != "Lobby" || rows[1].Online || rows[1].Stream {
		t.Fatalf("instances %+v", rows)
	}
	tr := rows[1].Uptime.Trans
	if len(tr) != 2 || tr[0].S != upUp || tr[1].S != upOff || tr[1].T != stopped.UnixMilli() {
		t.Fatalf("trans %v", tr)
	}
	if on, known := m2.counts("", id); on != 0 || known != 1 {
		t.Fatalf("counts %v of %v", on, known)
	}
	if ev := m2.sweep(clk.t); len(ev) != 0 {
		t.Fatalf("a restored instance raised %v", ev)
	}
	for _, inst := range []string{"", "Lobby"} {
		if err := m2.setWatchInst("ana", id, inst, true); err != nil {
			t.Fatal(err)
		}
	}
	if rows := m2.offlineKeys("ana"); len(rows) != 0 {
		t.Fatalf("a restart raised alarms %v", rows)
	}
	// Still unheard monMiss after the start: down from then, with no notice.
	start := clk.t
	clk.advance(monMiss + time.Second)
	if ev := m2.sweep(clk.t); len(ev) != 0 {
		t.Fatalf("a restored instance raised %v", ev)
	}
	tr = m2.instances(id)[1].Uptime.Trans
	if n := len(tr); tr[n-1].S != upDown || tr[n-1].T != start.Add(monMiss).UnixMilli() {
		t.Fatalf("trans after miss %v", tr)
	}
	if ev, err := m2.beat(id, "Lobby"); err != nil || ev != nil {
		t.Fatalf("return after a restart: %v %v", ev, err)
	}
	if on, known := m2.counts("", id); on != 1 || known != 1 {
		t.Fatalf("counts after return %v of %v", on, known)
	}
}

// Sode stopped without its stop write: the off goes at the last alive stamp.
func TestInstanceHistoryEndsAtTheAliveStampAfterACrash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	clk := &monClock{t: time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)}
	m := loadPanelMon(path)
	m.now = clk.now
	if _, err := m.beat("p-0000abcd", "Lobby"); err != nil {
		t.Fatal(err)
	}
	clk.advance(time.Minute)
	if err := m.saveFile(); err != nil {
		t.Fatal(err)
	}
	alive := clk.t
	clk.advance(time.Hour)
	m2 := loadPanelMon(path)
	m2.now = clk.now
	tr := m2.instances("p-0000abcd")[0].Uptime.Trans
	if len(tr) != 2 || tr[1].S != upOff || tr[1].T != alive.UnixMilli() {
		t.Fatalf("trans %v", tr)
	}
}

func TestHideNeedsAnInstanceAndAnEditor(t *testing.T) {
	a, _ := monApp(t)
	ana, bo := userKey(t, a, "Ana"), userKey(t, a, "Bo")
	id := makePanel(t, a, ana, `{"name":"Wall","share":{"mode":"everyone"}}`)
	hide(t, a, "POST", id, ana, "", 400)
	hide(t, a, "POST", id, bo, "Lobby", 403)
}

func TestWatchedInstanceNotSeenCountsAsKnownAndOffline(t *testing.T) {
	a, _ := monApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wall"}`)
	watchInst(t, a, id, ana, "Lobby", 204)
	if on, known := countsOf(panelOf(t, a, id, ana)); on != 0 || known != 1 {
		t.Fatalf("counts %v of %v", on, known)
	}
	hide(t, a, "POST", id, ana, "Lobby", 204)
	if on, known := countsOf(panelOf(t, a, id, ana)); on != 0 || known != 0 {
		t.Fatalf("hidden watched instance still counted: %v of %v", on, known)
	}
}
