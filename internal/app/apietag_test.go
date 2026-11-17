package app

import (
	"testing"
	"time"

	"github.com/sethdotfm/sode/internal/config"
)

// ifNone reads path with If-None-Match set when tag is not empty. A 304 that carries a body gives -1.
func ifNone(a *App, path, key, tag string) (code int, etag string) {
	var hdr map[string]string
	if tag != "" {
		hdr = map[string]string{"If-None-Match": tag}
	}
	rec := apiDo(a, "GET", path, key, hdr)
	if rec.Code == 304 && rec.Body.Len() != 0 {
		return -1, ""
	}
	return rec.Code, rec.Header().Get("ETag")
}

func etagApp(t *testing.T) *App {
	t.Helper()
	a := panelsApp(t)
	cfg := a.r().cfg
	cfg.APIClients[0].Scopes = append(cfg.APIClients[0].Scopes, config.ScopePanels)
	if err := a.ApplyConfig(cfg); err != nil {
		t.Fatal(err)
	}
	return a
}

const etagPanel = `{"name":"Wall","share":{"mode":"everyone"},"cells":[{"kind":"source","n":1}]}`

func TestPanelReadsAnswer304WhenNothingChanged(t *testing.T) {
	a := etagApp(t)
	id := makePanel(t, a, userKey(t, a, "Ana"), etagPanel)
	bot := botKey(t, a)
	for _, path := range []string{"/api/v1/tally", "/api/v1/protected", "/api/v1/names", "/api/v1/panels/" + id} {
		code, tag := ifNone(a, path, bot, "")
		if code != 200 || tag == "" || tag[0] != '"' {
			t.Fatalf("%s: first read %d, ETag %q", path, code, tag)
		}
		if code, again := ifNone(a, path, bot, tag); code != 304 || again != tag {
			t.Errorf("%s: unchanged read %d, ETag %q", path, code, again)
		}
		if code, _ := ifNone(a, path, bot, `"other", `+tag); code != 304 {
			t.Errorf("%s: list of tags %d", path, code)
		}
		if code, _ := ifNone(a, path, bot, `"other"`); code != 200 {
			t.Errorf("%s: other tag %d", path, code)
		}
	}
}

func TestPanelReadETagMovesWithRightsAndDefaultArtwork(t *testing.T) {
	a := etagApp(t)
	id := makePanel(t, a, userKey(t, a, "Ana"), etagPanel)
	cy, bot := userKey(t, a, "Cy"), botKey(t, a)
	path := "/api/v1/panels/" + id
	_, tag := ifNone(a, path, bot, "")

	apiSend(a, "PUT", "/api/v1/default-artwork", cy, `{"kind":"source","n":1,"art":"icon:camera"}`)
	code, art := ifNone(a, path, bot, tag)
	if code != 200 || art == tag {
		t.Fatalf("after Default artwork change: %d, ETag %q was %q", code, art, tag)
	}

	cfg := a.r().cfg
	cfg.APIClients[0].Rights = config.Rights{Sources: &[]int{1}}
	if err := a.ApplyConfig(cfg); err != nil {
		t.Fatal(err)
	}
	code, rights := ifNone(a, path, bot, art)
	if code != 200 || rights == art {
		t.Fatalf("after Rights change: %d, ETag %q was %q", code, rights, art)
	}
}

// An editor's read lists the instances with their uptime, which is measured to now. Only a change in what the
// page shows moves the tag: time alone does not, a lost instance does.
func TestPanelReadAnswers304ToAnEditorWhileTimePasses(t *testing.T) {
	a, clk := monApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, etagPanel)
	if code := keepalive(a, id, ana, "Desk"); code != 200 {
		t.Fatalf("keepalive: %d", code)
	}
	path := "/api/v1/panels/" + id
	_, tag := ifNone(a, path, ana, "")
	clk.advance(5 * time.Second)
	if code, again := ifNone(a, path, ana, tag); code != 304 || again != tag {
		t.Fatalf("5 s later: %d, ETag %q was %q", code, again, tag)
	}
	clk.advance(10 * time.Second)
	keepalive(a, id, ana, "Desk")
	if code, _ := ifNone(a, path, ana, tag); code != 304 {
		t.Fatalf("after a keepalive: %d, want 304", code)
	}
	clk.advance(2 * time.Minute)
	if code, _ := ifNone(a, path, ana, tag); code != 200 {
		t.Fatalf("after the instance went offline: %d, want 200", code)
	}
}

// A panel page opened by a key or as Public has no socket hello, so the read carries the take confirm's settings.
func TestPanelReadCarriesTheConfirmSettings(t *testing.T) {
	a := etagApp(t)
	id := makePanel(t, a, userKey(t, a, "Ana"), etagPanel)
	cfg := a.r().cfg
	cfg.ConfirmLockoutMs, cfg.ConfirmEnter = 1500, true
	if err := a.ApplyConfig(cfg); err != nil {
		t.Fatal(err)
	}
	got, _ := readPanel(t, a, botKey(t, a), id)["confirm"].(map[string]any)
	if got["lockoutMs"] != 1500.0 || got["enter"] != true {
		t.Fatalf("confirm %v, want lockoutMs 1500 and enter true", got)
	}
}
