package community

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"chat/api/internal/geocatalog/domain"
)

func TestPreservePanoramaAndView(t *testing.T) {
	records, err := Parse("geoguessr-json", []byte(`{"customCoordinates":[{"lat":0,"lng":20,"heading":12,"pitch":-3,"zoom":0.4,"panoId":null,"extra":{"panoId":"ABC_xyz","panoDate":"2024-01","tags":["unused"]}}]}`))
	if err != nil {
		t.Fatal(err)
	}
	r := records[0]
	if r.PanoramaID != "ABC_xyz" || r.IDKind != "derived-coordinate" || *r.View.Heading != 12 || r.Tags[0] != "unused" || r.PanoramaDate != "2024-01" {
		t.Fatalf("lost metadata: %+v", r)
	}
}

func TestLargeNativeFeatureIDIsExact(t *testing.T) {
	r, err := Parse("geojson", []byte(`{"type":"FeatureCollection","features":[{"type":"Feature","id":9007199254740993123,"geometry":{"type":"Point","coordinates":[20,10]},"properties":{"panoId":"p1"}}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if r[0].ID != "9007199254740993123" || r[0].Position.Lat != 10 || r[0].Position.Lng != 20 {
		t.Fatal("ID precision or coordinate order lost")
	}
}

func TestRejectMalformedExports(t *testing.T) {
	for _, raw := range []string{
		`{"customCoordinates":[{"lng":0}]}`,
		`{"customCoordinates":[{"lat":null,"lng":0}]}`,
		`{"customCoordinates":[{"lat":91,"lng":0}]}`,
		`{"customCoordinates":[{"lat":0,"lng":0,"id":{}}]}`,
		`{"customCoordinates":[{"lat":0,"lng":0,"panoId":"a","extra":{"panoId":"b"}}]}`,
		`{"customCoordinates":[]}`,
		`{"customCoordinates":[{"lat":0,"lng":0}]} {}`,
	} {
		if _, err := Parse("geoguessr-json", []byte(raw)); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	if _, err := Parse("geojson", []byte(`{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[null,10]}}]}`)); err == nil {
		t.Fatal("accepted null coordinate")
	}
}

func TestManifestChecksum(t *testing.T) {
	dir := t.TempDir()
	data := []byte(`{"customCoordinates":[{"lat":0,"lng":0}]}`)
	sum := sha256.Sum256(data)
	s := domain.Source{ID: "map", Title: "Map", Author: "A", URL: "https://example.com", License: "MIT", Revision: "v1", DownloadURL: "https://example.com/v1", SHA256: hex.EncodeToString(sum[:]), Provider: "google-streetview", Format: "geoguessr-json", Selection: "curated"}
	manifest, _ := json.Marshal(Manifest{Source: s, File: "export.json"})
	write := func(path string, data []byte) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, path), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	write("manifest.json", manifest)
	write("export.json", data)
	if _, _, err := Read(filepath.Join(dir, "manifest.json")); err != nil {
		t.Fatal(err)
	}
	write("export.json", append(data, ' '))
	if _, _, err := Read(filepath.Join(dir, "manifest.json")); err == nil {
		t.Fatal("checksum mismatch accepted")
	}
}

func TestPinnedCommunityImports(t *testing.T) {
	// This path is rooted at this package, so Docker executes against the same committed snapshots.
	root := "../../../../../../data/geo/sources"
	c := domain.New()
	for _, item := range []struct {
		folder       string
		count, panos int
	}{{"touge", 5835, 5835}, {"aaw", 4955, 0}} {
		s, records, err := Read(filepath.Join(root, item.folder, "manifest.json"))
		if err != nil {
			t.Fatal(err)
		}
		panos := 0
		for _, r := range records {
			if r.PanoramaID != "" {
				panos++
			}
		}
		if len(records) != item.count || panos != item.panos {
			t.Fatalf("snapshot changed: %s %d records, %d panos", item.folder, len(records), panos)
		}
		c, _, err = domain.Merge(c, s, records)
		if err != nil {
			t.Fatal(err)
		}
		// Match a real second CLI invocation, including omitempty round trips.
		c = roundTripCatalog(t, c)
		next, report, err := domain.Merge(c, s, records)
		if err != nil || report.AddedLocations != 0 || report.AddedEntries != 0 || report.UpdatedEntries != 0 || report.Unchanged != len(records) {
			t.Fatalf("reimport: %+v %v", report, err)
		}
		c = next
	}
	if len(c.Entries) != 10790 {
		t.Fatalf("unexpected entry count: %d", len(c.Entries))
	}
}

func roundTripCatalog(t *testing.T, c domain.Catalog) domain.Catalog {
	t.Helper()
	encoded, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var decoded domain.Catalog
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded
}
