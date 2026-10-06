package domain

import (
	"fmt"
	"maps"
	"reflect"
	"slices"
)

type Report struct {
	AddedLocations int `json:"added_locations"`
	AddedEntries   int `json:"added_entries"`
	UpdatedEntries int `json:"updated_entries"`
	Unchanged      int `json:"unchanged"`
}

type identities map[string]string

func aliases(provider string, position Position, pano string) []string {
	keys := []string{provider + "\x00coord:" + CoordinateKey(position)}
	if pano != "" {
		keys = append(keys, provider+"\x00pano:"+pano)
	}
	return keys
}

func (idx identities) put(key, id string) error {
	if old := idx[key]; old != "" && old != id {
		return fmt.Errorf("identity conflict: %q links %s and %s", key, old, id)
	}
	idx[key] = id
	return nil
}

func index(c Catalog) (identities, error) {
	idx := identities{}
	for id, loc := range c.Locations {
		if id == "" || loc.Provider == "" || len(loc.Positions) == 0 {
			return nil, fmt.Errorf("invalid location %s", id)
		}
		for _, p := range loc.Positions {
			if err := p.Validate(); err != nil {
				return nil, err
			}
			if err := idx.put(aliases(loc.Provider, p, "")[0], id); err != nil {
				return nil, err
			}
		}
		for _, pano := range loc.PanoramaIDs {
			if pano == "" {
				return nil, fmt.Errorf("empty panorama alias")
			}
			if err := idx.put(loc.Provider+"\x00pano:"+pano, id); err != nil {
				return nil, err
			}
		}
	}
	return idx, nil
}

func entryKey(source, record string) string { return fingerprint(source + "\x00" + record) }

func (c Catalog) Validate() error {
	if c.SchemaVersion != SchemaVersion || c.Sources == nil || c.Locations == nil || c.Entries == nil {
		return fmt.Errorf("unsupported or incomplete catalogue")
	}
	idx, err := index(c)
	if err != nil {
		return err
	}
	for id, versions := range c.Sources {
		if len(versions) == 0 {
			return fmt.Errorf("source has no revisions")
		}
		for _, s := range versions {
			if err := s.Validate(); err != nil {
				return err
			}
			if s.ID != id || s.Provider != versions[0].Provider {
				return fmt.Errorf("inconsistent source")
			}
		}
	}
	return c.validateEntries(idx)
}

func (c Catalog) validateEntries(idx identities) error {
	for key, e := range c.Entries {
		versions := c.Sources[e.SourceID]
		if len(versions) == 0 || key != entryKey(e.SourceID, e.Record.ID) {
			return fmt.Errorf("invalid entry source/identity")
		}
		if !slices.ContainsFunc(versions, func(s Source) bool { return s.Revision == e.Revision }) {
			return fmt.Errorf("entry references missing revision")
		}
		if err := e.Record.Validate(); err != nil {
			return err
		}
		for _, alias := range aliases(versions[0].Provider, e.Record.Position, e.Record.PanoramaID) {
			if idx[alias] != e.LocationID || e.LocationID == "" {
				return fmt.Errorf("entry references missing location alias")
			}
		}
	}
	return nil
}

// Merge is all-or-nothing and leaves the caller's catalogue untouched on errors.
// Omitted records are retained: importing is an additive operation, not deletion.
func Merge(c Catalog, source Source, records []Record) (Catalog, Report, error) {
	var report Report
	if err := c.Validate(); err != nil {
		return Catalog{}, report, err
	}
	if err := source.Validate(); err != nil {
		return Catalog{}, report, err
	}
	if len(records) == 0 {
		return Catalog{}, report, fmt.Errorf("empty export")
	}
	next := Catalog{SchemaVersion, maps.Clone(c.Sources), maps.Clone(c.Locations), maps.Clone(c.Entries)}
	if err := next.addSource(source); err != nil {
		return Catalog{}, report, err
	}
	idx, err := index(next)
	if err != nil {
		return Catalog{}, report, err
	}
	seen := map[string]Record{}
	for _, record := range records {
		if len(record.Tags) == 0 {
			record.Tags = nil
		}
		if previous, ok := seen[record.ID]; ok && !reflect.DeepEqual(previous, record) {
			return Catalog{}, Report{}, fmt.Errorf("conflicting records with ID %q", record.ID)
		}
		seen[record.ID] = record
		if err := next.mergeRecord(source, record, idx, &report); err != nil {
			return Catalog{}, Report{}, err
		}
	}
	return next, report, nil
}

func (c *Catalog) addSource(source Source) error {
	versions := c.Sources[source.ID]
	for i, old := range versions {
		if old.Provider != source.Provider {
			return fmt.Errorf("source provider cannot change")
		}
		if old.Revision == source.Revision {
			if old != source {
				return fmt.Errorf("source revision changed; use a new revision")
			}
			if i != len(versions)-1 {
				return fmt.Errorf("cannot reimport an obsolete source revision")
			}
			return nil
		}
	}
	c.Sources[source.ID] = append(slices.Clone(versions), source)
	return nil
}

func (c *Catalog) mergeRecord(source Source, record Record, idx identities, report *Report) error {
	if err := record.Validate(); err != nil {
		return err
	}
	key := entryKey(source.ID, record.ID)
	old, exists := c.Entries[key]
	id := old.LocationID
	keys := aliases(source.Provider, record.Position, record.PanoramaID)
	for _, alias := range keys {
		candidate := idx[alias]
		if id != "" && candidate != "" && id != candidate {
			return fmt.Errorf("conflicting aliases for source record %q", record.ID)
		}
		if candidate != "" {
			id = candidate
		}
	}
	if id == "" {
		id = "loc_" + fingerprint(keys[0])
		if _, collision := c.Locations[id]; collision {
			return fmt.Errorf("location ID collision")
		}
		c.Locations[id] = Location{Provider: source.Provider}
		report.AddedLocations++
	}
	c.updateAliases(id, record)
	for _, alias := range keys {
		idx[alias] = id
	}
	entry := Entry{SourceID: source.ID, Revision: source.Revision, LocationID: id, Record: record}
	c.Entries[key] = entry
	switch {
	case !exists:
		report.AddedEntries++
	case reflect.DeepEqual(old, entry):
		report.Unchanged++
	default:
		report.UpdatedEntries++
	}
	return nil
}

func (c *Catalog) updateAliases(id string, r Record) {
	loc := c.Locations[id]
	if !slices.ContainsFunc(loc.Positions, func(p Position) bool { return CoordinateKey(p) == CoordinateKey(r.Position) }) {
		loc.Positions = append(slices.Clone(loc.Positions), r.Position)
	}
	if r.PanoramaID != "" && !slices.Contains(loc.PanoramaIDs, r.PanoramaID) {
		loc.PanoramaIDs = append(slices.Clone(loc.PanoramaIDs), r.PanoramaID)
	}
	c.Locations[id] = loc
}
