package domain

import (
	"encoding/json"
	"math"
	"reflect"
	"strings"
	"testing"
)

func source(id string) Source {
	return Source{ID: id, Title: "Map", Author: "Author", URL: "https://example.com", License: "MIT", Revision: "v1", DownloadURL: "https://example.com/v1.json", SHA256: strings.Repeat("a", 64), Provider: "google-streetview", Format: "geojson", Selection: "curated"}
}
func record(id, pano string, lat float64) Record {
	return Record{ID: id, IDKind: "native", Position: Position{Lat: lat, Lng: 20}, PanoramaID: pano}
}
func merge(t *testing.T, c Catalog, s Source, records ...Record) Catalog {
	t.Helper()
	next, _, err := Merge(c, s, records)
	if err != nil {
		t.Fatal(err)
	}
	if err := next.Validate(); err != nil {
		t.Fatal(err)
	}
	return next
}

func TestReimportOrderAndOverlap(t *testing.T) {
	a, b := record("a", "p1", 10), record("b", "p2", 11)
	c := merge(t, New(), source("one"), a, b)
	next, report, err := Merge(c, source("one"), []Record{b, a})
	if err != nil || report != (Report{Unchanged: 2}) || !reflect.DeepEqual(c, next) {
		t.Fatalf("not idempotent: %+v %v", report, err)
	}
	heading := 45.0
	a.ID = "other-id"
	a.View.Heading = &heading
	c = merge(t, c, source("two"), a)
	if len(c.Locations) != 2 || len(c.Entries) != 3 {
		t.Fatal("overlap duplicated locations or lost provenance")
	}
	if c.Entries[entryKey("one", "a")].Record.View.Heading != nil {
		t.Fatal("overwrote original framing")
	}
	if *c.Entries[entryKey("two", "other-id")].Record.View.Heading != 45 {
		t.Fatal("lost map-specific view")
	}
}

func TestChangedPanoramaAndCoordinatesRetainIdentity(t *testing.T) {
	s := source("one")
	r := record("external", "old-pano", 10)
	c := merge(t, New(), s, r)
	id := c.Entries[entryKey(s.ID, r.ID)].LocationID
	s.Revision = "v2"
	r.PanoramaID = "new-pano"
	c = merge(t, c, s, r)
	s.Revision = "v3"
	r.Position.Lat = 10.001
	c = merge(t, c, s, r)
	if len(c.Locations) != 1 || c.Entries[entryKey(s.ID, r.ID)].LocationID != id {
		t.Fatal("ID changed")
	}
	if len(c.Locations[id].PanoramaIDs) != 2 || len(c.Locations[id].Positions) != 2 {
		t.Fatal("lost aliases")
	}
	_, _, err := Merge(c, source("one"), []Record{record("external", "old-pano", 10)})
	if err == nil {
		t.Fatal("stale version accepted")
	}
}

func TestCoordinateFallbackAndProviderIsolation(t *testing.T) {
	s := source("one")
	r := record("", "", 0)
	r.ID = DerivedRecordID(r.Position)
	r.IDKind = "derived-coordinate"
	c := merge(t, New(), s, r)
	s.Revision = "v2"
	r.PanoramaID = "resolved"
	c = merge(t, c, s, r)
	if len(c.Locations) != 1 {
		t.Fatal("new panorama duplicated coordinates")
	}
	other := source("two")
	other.Provider = "mapillary"
	c = merge(t, c, other, r)
	if len(c.Locations) != 2 {
		t.Fatal("cross-provider IDs merged")
	}
	r.ID = "nearby"
	r.Position.Lat = 0.00001
	r.PanoramaID = "nearby-pano"
	c = merge(t, c, s, r)
	if len(c.Locations) != 3 {
		t.Fatal("nearby distinct places merged")
	}
}

func TestConflictIsAtomic(t *testing.T) {
	s := source("one")
	c := merge(t, New(), s, record("a", "p1", 10), record("b", "p2", 11))
	before, _ := json.Marshal(c)
	s.Revision = "v2"
	_, _, err := Merge(c, s, []Record{record("new", "new", 12), record("a", "p2", 10)})
	if err == nil {
		t.Fatal("conflicting aliases accepted")
	}
	after, _ := json.Marshal(c)
	if string(before) != string(after) {
		t.Fatal("failed import mutated catalogue")
	}
}

func TestMalformedAndAmbiguousRecordsFail(t *testing.T) {
	r := record("a", "p1", 10)
	for name, records := range map[string][]Record{
		"empty":                   {},
		"invalid latitude":        {record("a", "", 91)},
		"nan":                     {record("a", "", math.NaN())},
		"same ID different place": {r, record("a", "p2", 11)},
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := Merge(New(), source("s"), records); err == nil {
				t.Fatal("accepted invalid import")
			}
		})
	}
}

func TestAbsentRecordsAreRetained(t *testing.T) {
	s := source("s")
	c := merge(t, New(), s, record("a", "p1", 10), record("b", "p2", 11))
	s.Revision = "v2"
	c = merge(t, c, s, record("a", "p1", 10))
	if len(c.Entries) != 2 {
		t.Fatal("additive import removed old record")
	}
	if c.Entries[entryKey("s", "b")].Revision != "v1" {
		t.Fatal("lost provenance of retained record")
	}
}

func TestIncrementalAdditionAndMetadataUpdate(t *testing.T) {
	s := source("one")
	r := record("a", "p1", 10)
	c := merge(t, New(), s, r)
	id := c.Entries[entryKey(s.ID, r.ID)].LocationID
	s.Revision = "v2"
	r.Tags = []string{"reconsider"}
	next, report, err := Merge(c, s, []Record{r, record("b", "p2", 11)})
	if err != nil || report != (Report{AddedLocations: 1, AddedEntries: 1, UpdatedEntries: 1}) {
		t.Fatalf("incremental result: %+v %v", report, err)
	}
	if next.Entries[entryKey(s.ID, r.ID)].LocationID != id || len(next.Sources[s.ID]) != 2 {
		t.Fatal("lost stable ID or source version history")
	}
	if err := next.Validate(); err != nil {
		t.Fatal(err)
	}
}
