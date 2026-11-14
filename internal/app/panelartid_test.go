package app

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

// A hand-edited art id names a path under <id>.art, so load drops any that artIDRe refuses.
func TestPanelLoadDropsBadArtIDs(t *testing.T) {
	a := panelsApp(t)
	ana := userKey(t, a, "Ana")
	id := makePanel(t, a, ana, `{"name":"Wall"}`)
	p, _ := a.panels.get(id)
	p.Art = []PanelArt{{ID: "a-0123abcd", Type: "image/png", Size: 1}, {ID: "../../config", Type: "image/png", Size: 1}}
	b, err := yaml.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(filepath.Dir(a.cfgPath), panelsDir, id+".yaml"), b, 0o600); err != nil {
		t.Fatal(err)
	}
	got, _ := loadPanels(a.cfgPath).get(id)
	if len(got.Art) != 1 || got.Art[0].ID != "a-0123abcd" {
		t.Fatalf("art after reload: %+v", got.Art)
	}
}
