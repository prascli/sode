package app

import (
	"bytes"
	"encoding/json"
	"errors"

	"gopkg.in/yaml.v3"
)

// Panel types (ADR 0011). A file with no type is a Buttons panel. Keep in step with web/gridpaneledges.js.
const (
	panelTypeButtons = "buttons"
	panelTypeGrid    = "grid"
)

const gridMembersAll = "all"

// GridEdge is a Grid panel's sources or destinations. Membership stays apart from per-item settings, so a later
// pin or artwork never stops an "all" edge from following the router.
type GridEdge struct {
	Members GridMembers `yaml:"members" json:"members"`
}

// GridMembers is "all" (router order, following the router) or an explicit list of router numbers in panel order.
type GridMembers struct {
	All  bool
	List []int
}

var errGridMembers = errors.New(`members is "all"`)

func (m GridMembers) MarshalJSON() ([]byte, error) {
	if m.All {
		return json.Marshal(gridMembersAll)
	}
	return json.Marshal(m.List)
}

func (m *GridMembers) UnmarshalJSON(b []byte) error {
	var s string
	if json.Unmarshal(b, &s) == nil {
		*m = GridMembers{All: s == gridMembersAll}
		if !m.All {
			return errGridMembers
		}
		return nil
	}
	if bytes.HasPrefix(bytes.TrimSpace(b), []byte("[")) {
		*m = GridMembers{}
		return json.Unmarshal(b, &m.List)
	}
	return errGridMembers
}

func (m GridMembers) MarshalYAML() (any, error) {
	if m.All {
		return gridMembersAll, nil
	}
	return m.List, nil
}

func (m *GridMembers) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind == yaml.ScalarNode && n.Value == gridMembersAll {
		*m = GridMembers{All: true}
		return nil
	}
	if n.Kind == yaml.SequenceNode {
		*m = GridMembers{}
		return n.Decode(&m.List)
	}
	return errGridMembers
}

func allEdge() *GridEdge { return &GridEdge{Members: GridMembers{All: true}} }

// normalGrid fills a Grid panel's defaults. A Grid panel has no rows, columns or Pages, so a read
// carries an empty Pages list that a client can send back.
func (p *Panel) normalGrid() {
	if p.Sources == nil {
		p.Sources = allEdge()
	}
	if p.Destinations == nil {
		p.Destinations = allEdge()
	}
	p.Rows, p.Cols = 0, 0
	if p.Pages == nil {
		p.Pages = []PanelPage{}
	}
}

// checkGrid judges the type and the parts that belong to the other type. Explicit member lists come later,
// so only "all" is taken for now.
func checkGrid(p *Panel) error {
	switch p.Type {
	case panelTypeButtons:
		if p.Sources != nil || p.Destinations != nil {
			return errors.New("sources and destinations are for a Grid panel")
		}
		return nil
	case panelTypeGrid:
	default:
		return errors.New(`type is "buttons" or "grid"`)
	}
	if len(p.Pages) > 0 || len(p.LegacyCells) > 0 {
		return errors.New("a Grid panel has no cells and no Pages")
	}
	for _, e := range []*GridEdge{p.Sources, p.Destinations} {
		if e != nil && !e.Members.All {
			return errGridMembers
		}
	}
	return nil
}
