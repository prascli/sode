package app

import (
	"encoding/json"
	"fmt"
	"testing"
)

// Artwork on a Grid panel's names: an item's own artwork (an icon with Icon B, an uploaded image), else its Default
// artwork. A Default artwork that hides text never hides a name. A node moved by a scroll keeps no artwork of its old item.
func TestChromeGridPanelArt(t *testing.T) {
	b := startBrowser(t)
	sim := startSim(t)
	a := simApp(t, sim)
	srv := seamServer(t, a)
	ana := userKey(t, a, "Ana")
	id := makeGridPanel(t, a, ana, "Art grid")
	rec := apiSendRaw(a, "POST", "/api/v1/panels/"+id+"/artwork", ana, b64(t, tinyPNG))
	if rec.Code != 201 {
		t.Fatalf("artwork: %d %s", rec.Code, rec.Body.String())
	}
	img := apiBody(t, rec)["id"].(string)
	body := `{"name":"Art grid","type":"grid","settings":{"mode":"take"},
		"sources":{"members":"all","items":{"1":{"art":"icon:camera","artB":"2"}}},
		"destinations":{"members":"all","items":{"1":{"art":"` + img + `"}}}}`
	if rec := apiSend(a, "PUT", "/api/v1/panels/"+id, ana, body); rec.Code != 200 {
		t.Fatalf("PUT: %d %s", rec.Code, rec.Body.String())
	}
	num := func(n int) *int { return &n }
	for _, d := range []ArtDefault{
		{Kind: artKindSource, N: num(2), Art: "icon:mic", ArtB: "B", HideText: true},
		{Kind: artKindSource, N: num(1), Art: "icon:mic", ArtB: "9"},
		{Kind: artKindDst, N: num(2), ArtB: "A", HideText: true},
	} {
		if _, err := a.artDefaults.set(d, nil); err != nil {
			t.Fatal(err)
		}
	}
	waitNamesAndTally(t, a, ana)

	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	signInOnPad(b)
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on')`)
	name := func(kind string, n int) string {
		return fmt.Sprintf(`document.querySelector('.sode-gridpanel__%s[data-%s="%d"]:not([hidden])')`, kind, map[string]string{"src": "src", "dst": "dst"}[kind], n)
	}
	art := func(kind string, n int) string {
		return name(kind, n) + `?.querySelector('.sode-gridpanel__art:not([hidden])')`
	}

	b.waitFor("source 1 shows its own icon and Icon B", `(() => {
		const r = `+art("src", 1)+`;
		return !!r && r.querySelector('use')?.getAttribute('href') === '#pb-i-camera' && !r.firstChild.hidden && r.lastChild.textContent === '2';
	})()`)
	b.waitFor("source 2 shows its Default artwork", `(() => {
		const r = `+art("src", 2)+`;
		return !!r && r.querySelector('use')?.getAttribute('href') === '#pb-i-mic' && r.lastChild.textContent === 'B';
	})()`)
	b.waitFor("destination 1 shows its uploaded image", `(() => {
		const i = `+art("dst", 1)+`?.querySelector('img:not([hidden])');
		return !!i && i.src.startsWith('blob:');
	})()`)
	b.waitFor("destination 2 shows Icon B alone", `(() => {
		const r = `+art("dst", 2)+`;
		return !!r && r.lastChild.textContent === 'A' && r.firstChild.hidden;
	})()`)
	// Hide text in a default never hides the name.
	for _, q := range []string{name("src", 2), name("dst", 2)} {
		if b.eval(`(() => { const n = `+q+`; return n.firstChild.data.length > 0 && n.firstChild.data === n.firstChild.data.trim() && n.getBoundingClientRect().width > 0; })()`) != true {
			t.Errorf("a name lost its text under a default that hides text: %s", q)
		}
	}
	// The editor's list rows set artwork: Icon A and Icon B on source 3, saved on the item.
	b.open(srv.URL + "/panels/editor?panel=" + id)
	b.waitFor("the lock goes", `!document.documentElement.dataset.sodeLock`)
	b.waitFor("the Sources tab", `!!document.getElementById('tab-ed-sources')`)
	b.eval(`document.getElementById('tab-ed-sources').click(); true`)
	row := `document.querySelector('#ed-sources-list li[data-id="3"]')`
	b.waitFor("the source rows", row+` !== null`)
	b.eval(row + `.querySelector('[data-act="art"]').click(); true`)
	b.waitFor("the artwork control opens for that row", `!document.getElementById('ed-sources-art').hidden && document.getElementById('ed-sources-art-head').textContent.startsWith('Artwork for ')`)
	b.eval(`document.querySelector('#ed-sources-art .pb-btn[aria-expanded]').click(); true`)
	b.waitFor("Icon A choices", `!!document.querySelector('#ed-sources-art button[aria-label="camera"]')`)
	b.eval(`document.querySelector('#ed-sources-art button[aria-label="camera"]').click(); true`)
	b.waitFor("Icon B choices", `!!document.querySelector('#ed-sources-art [role="group"][aria-label="Icon B"] button[aria-label="7"]')`)
	b.eval(`document.querySelector('#ed-sources-art [role="group"][aria-label="Icon B"] button[aria-label="7"]').click(); true`)
	b.waitFor("the row says it has artwork", row+`.textContent.includes('artwork')`)
	b.eval(`document.getElementById('ed-save').click(); true`)
	b.waitFor("saved", `document.getElementById('ed-state').textContent === 'Saved'`)
	srcs, _ := readPanel(t, a, ana, id)["sources"].(map[string]any)
	items, _ := json.Marshal(srcs["items"])
	if want := `{"1":{"art":"icon:camera","artB":"2"},"3":{"art":"icon:camera","artB":"7"}}`; string(items) != want {
		t.Errorf("items %s, want %s", items, want)
	}
	b.open(srv.URL + "/panels/" + id + "?instance=Desk")
	b.waitFor("the lock screen goes", `!document.querySelector('.sode-lock.is-on')`)
	b.waitFor("source 3 shows what the editor set", `(() => {
		const r = `+art("src", 3)+`;
		return !!r && r.querySelector('use')?.getAttribute('href') === '#pb-i-camera' && r.lastChild.textContent === '7';
	})()`)
	// A scroll moves nodes to other items; none keeps artwork it was not given.
	gridShow(b, 15, 15)
	b.waitFor("only items with artwork show it", `(() => {
		const rows = [...document.querySelectorAll('.sode-gridpanel__src:not([hidden]), .sode-gridpanel__dst:not([hidden])')];
		return rows.length > 0 && rows.every((n) => n.querySelector('.sode-gridpanel__art').hidden);
	})()`)
}
