package app

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/sethdotfm/sode/internal/config"
)

// Per-instance uptime and hidden instances for the panels page. panelmonfile.go keeps both over a restart
// (docs/agents/panels.md).

const (
	monHistory  = monForget // an instance is dropped after this, so more history would describe nothing
	monTransMax = 400       // a flapping device keeps only its newest changes
)

var errHideCap = errors.New("too many hidden instances on this panel")

func init() {
	const read = config.ScopePanels
	registerAPI(
		apiRoute{"POST", apiBase + "/panels/{id}/instances/hide", read, (*App).apiPanelHide},
		apiRoute{"DELETE", apiBase + "/panels/{id}/instances/hide", read, (*App).apiPanelUnhide},
	)
}

// mark records a state change, dropping what is older than monHistory but the last change before it,
// which is the state the window starts in. It says whether it recorded one.
func (in *monInst) mark(s string, at time.Time) bool {
	if n := len(in.trans); n > 0 && in.trans[n-1].S == s {
		return false
	}
	in.trans = append(in.trans, UptimeTrans{T: at.UnixMilli(), S: s})
	cut := at.Add(-monHistory).UnixMilli()
	i := 0
	for i+1 < len(in.trans) && in.trans[i+1].T <= cut {
		i++
	}
	if len(in.trans)-i > monTransMax {
		i = len(in.trans) - monTransMax
	}
	in.trans = in.trans[i:]
	return true
}

// instUptime is the /log uptime request's answer shape for one instance over the last monHistory,
// without message counts. Start is "" before the instance was first heard.
type instUptime struct {
	From  int64         `json:"from"`
	To    int64         `json:"to"`
	Start string        `json:"start"`
	Trans []UptimeTrans `json:"trans"`
}

func (in *monInst) uptime(now time.Time) instUptime {
	out := instUptime{From: now.Add(-monHistory).UnixMilli(), To: now.UnixMilli(), Trans: []UptimeTrans{}}
	for _, t := range in.trans {
		if t.T <= out.From {
			out.Start = t.S
		} else {
			out.Trans = append(out.Trans, t)
		}
	}
	return out
}

// setHidden hides one instance from the panels page for every viewer, or shows it again. It ends nothing:
// watches and keys stay, and a return does not show it.
func (m *panelMon) setHidden(id, inst string, on bool) error {
	m.mu.Lock()
	k := watchKey(id, inst)
	if on && !m.hide[k] && len(m.hiddenLocked(id)) >= monDevices {
		m.mu.Unlock()
		return errHideCap
	}
	if on {
		m.hide[k] = true
	} else {
		delete(m.hide, k)
	}
	m.dirty = true
	m.mu.Unlock()
	return m.saveFile()
}

// hiddenInstances lists the lowercased device names hidden on the panel.
func (m *panelMon) hiddenInstances(id string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.hiddenLocked(id)
}

func (m *panelMon) hiddenLocked(id string) []string {
	out := []string{}
	for k := range m.hide {
		if hid, inst := splitWatchKey(k); hid == id && inst != "" {
			out = append(out, inst)
		}
	}
	slices.Sort(out)
	return out
}

// unhideLocked shows the instance again; device "" does the whole panel.
func (m *panelMon) unhideLocked(id, device string) {
	for k := range m.hide {
		if hid, inst := splitWatchKey(k); hid == id && (device == "" || inst == strings.ToLower(device)) {
			delete(m.hide, k)
			m.dirty = true
		}
	}
}

// counts is how many of the panel's instances are online and how many the user is shown. The user is
// shown the known ones and the watched ones not heard since Sode started, less the hidden ones.
func (m *panelMon) counts(user, id string) (online, known int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, now := strings.ToLower(user), m.now()
	for k, in := range m.inst[id] {
		if m.hide[watchKey(id, k)] {
			continue
		}
		known++
		if in.live(now) {
			online++
		}
	}
	for k := range m.watch[u] {
		if wid, inst := splitWatchKey(k); wid == id && inst != "" && m.inst[id][inst] == nil && !m.hide[k] {
			known++
		}
	}
	return online, known
}

func (a *App) apiPanelHide(w http.ResponseWriter, r *http.Request, cl *apiCtx) {
	a.hideInstance(w, r, cl, true)
}

func (a *App) apiPanelUnhide(w http.ResponseWriter, r *http.Request, cl *apiCtx) {
	a.hideInstance(w, r, cl, false)
}

func (a *App) hideInstance(w http.ResponseWriter, r *http.Request, cl *apiCtx, on bool) {
	p, ok := a.watchFor(w, r, cl)
	if !ok {
		return
	}
	inst := cleanDevice(r.URL.Query().Get("instance"))
	if inst == "" {
		apiFail(w, http.StatusBadRequest, "bad_request", "instance is a device name: ?instance=<instance name>")
		return
	}
	switch err := a.mon.setHidden(p.ID, inst, on); {
	case errors.Is(err, errHideCap):
		apiFail(w, http.StatusConflict, "conflict", err.Error())
	case err != nil:
		apiFail(w, http.StatusInternalServerError, "internal", "the hidden instances could not be saved: "+err.Error())
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}
