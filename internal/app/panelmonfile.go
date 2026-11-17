package app

import (
	"context"
	"encoding/json"
	"log"
	"maps"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/sethdotfm/sode/internal/config"
)

// instFile keeps the panels page's instances over a restart: each one's name, last heard time and uptime
// changes, and the hidden instances. Written as /log's uptime is (uptime.go): a few seconds after a change,
// and each minute as an alive stamp. Off goes in at stop, or at the alive stamp after a crash.

const (
	instFile      = "panelinstances.json"
	instSaveEvery = 5 * time.Second
	instAliveEach = time.Minute
)

type monFileState struct {
	instPath string // "" = memory only
	dirty    bool   // under mu
	started  time.Time
	savedAt  time.Time // under mu: the last snapshot taken
	gen      int       // under mu: counts snapshots
	fileMu   sync.Mutex
	written  int // under fileMu: the newest snapshot on disk, so an older one never overwrites it
}

type monFile struct {
	Alive     int64                    `json:"alive"` // ms
	Hidden    []string                 `json:"hidden"`
	Instances map[string][]monFileInst `json:"instances"` // by panel id
}

type monFileInst struct {
	Device string        `json:"device"`
	Seen   int64         `json:"seen"` // ms
	Trans  []UptimeTrans `json:"trans"`
}

// loadFile restores instances as lost and restored, so they count as offline and raise no notice.
func (m *panelMon) loadFile(path string) {
	m.instPath = path
	b, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("panels: %s: %v", path, err)
		}
		return
	}
	var f monFile
	if err := json.Unmarshal(b, &f); err != nil {
		log.Printf("panels: %s is not valid JSON, instances skipped: %v", path, err)
		return
	}
	for _, k := range f.Hidden {
		if id, inst := splitWatchKey(k); validPanelID(id) && inst != "" {
			m.hide[watchKey(id, inst)] = true
		}
	}
	for id, rows := range f.Instances {
		if !validPanelID(id) {
			continue
		}
		set := map[string]*monInst{}
		for _, r := range rows {
			dev := cleanDevice(r.Device)
			if dev == "" || len(set) >= monDevices {
				continue
			}
			in := &monInst{device: dev, seen: time.UnixMilli(r.Seen), lost: true, restored: true}
			slices.SortStableFunc(r.Trans, func(a, b UptimeTrans) int { return int(a.T - b.T) })
			in.trans = r.Trans
			if n := len(in.trans); n > monTransMax {
				in.trans = in.trans[n-monTransMax:]
			}
			if n := len(in.trans); n > 0 && in.trans[n-1].S != upOff {
				in.trans = append(in.trans, UptimeTrans{T: max(f.Alive, in.trans[n-1].T), S: upOff})
			}
			set[strings.ToLower(dev)] = in
		}
		if len(set) > 0 {
			m.inst[id] = set
		}
	}
}

// startedLocked is when Sode began to listen: the first sweep's time.
func (m *panelMon) startedLocked(now time.Time) time.Time {
	if m.started.IsZero() {
		m.started = now
	}
	return m.started
}

func (m *panelMon) snapshotLocked(now time.Time) monFile {
	f := monFile{Alive: now.UnixMilli(), Hidden: slices.Sorted(maps.Keys(m.hide)), Instances: map[string][]monFileInst{}}
	for id, set := range m.inst {
		for _, in := range set {
			f.Instances[id] = append(f.Instances[id], monFileInst{Device: in.device, Seen: in.seen.UnixMilli(), Trans: slices.Clone(in.trans)})
		}
	}
	return f
}

// saveFile writes a snapshot. No file I/O under mu.
func (m *panelMon) saveFile() error {
	if m.instPath == "" {
		return nil
	}
	m.mu.Lock()
	now := m.now()
	f := m.snapshotLocked(now)
	m.gen++
	g := m.gen
	m.dirty, m.savedAt = false, now
	m.mu.Unlock()

	m.fileMu.Lock()
	defer m.fileMu.Unlock()
	if g < m.written {
		return nil
	}
	m.written = g
	b, err := json.Marshal(f)
	if err == nil {
		err = config.AtomicWrite(m.instPath, b)
	}
	if err != nil {
		m.mu.Lock()
		m.dirty = true
		m.mu.Unlock()
	}
	return err
}

// saveDue writes when something changed, or when the alive stamp is a minute old.
func (m *panelMon) saveDue() {
	m.mu.Lock()
	due := m.dirty || m.now().Sub(m.savedAt) >= instAliveEach
	m.mu.Unlock()
	if !due {
		return
	}
	if err := m.saveFile(); err != nil {
		log.Printf("panels: instances not saved: %v", err)
	}
}

// stopFile marks every instance off at stop, so the time Sode is stopped has no record.
func (m *panelMon) stopFile() {
	m.mu.Lock()
	now := m.now()
	for _, set := range m.inst {
		for _, in := range set {
			in.mark(upOff, now)
		}
	}
	m.mu.Unlock()
	if err := m.saveFile(); err != nil {
		log.Printf("panels: instances not saved at stop: %v", err)
	}
}

// runFile saves until ctx ends, then writes the stop.
func (m *panelMon) runFile(ctx context.Context) {
	t := time.NewTicker(instSaveEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			m.stopFile()
			return
		case <-t.C:
			m.saveDue()
		}
	}
}
