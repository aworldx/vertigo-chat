package filecatalog_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"chat/api/internal/geocatalog/adapters/filecatalog"
	"chat/api/internal/geocatalog/application"
	"chat/api/internal/geocatalog/domain"
)

func TestImportPersistenceDryRunAndRollback(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	store := filecatalog.Store{Path: path}
	s := domain.Source{ID: "s", Title: "Map", Author: "A", URL: "https://example.com", License: "MIT", Revision: "v1", DownloadURL: "https://example.com/v1", SHA256: strings.Repeat("a", 64), Provider: "google-streetview", Format: "geojson", Selection: "curated"}
	r := domain.Record{ID: "a", IDKind: "native", Position: domain.Position{Lat: 10, Lng: 20}, PanoramaID: "p1"}
	if _, err := application.Import(store, s, []domain.Record{r}, false); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("dry-run wrote catalogue")
	}
	if _, err := application.Import(store, s, []domain.Record{r}, true); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	report, err := application.Import(store, s, []domain.Record{r}, true)
	if err != nil || report.Unchanged != 1 {
		t.Fatalf("reimport failed: %+v %v", report, err)
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("reimport changed bytes")
	}
	r.Position.Lat = 100
	if _, err := application.Import(store, s, []domain.Record{r}, true); err == nil {
		t.Fatal("accepted invalid import")
	}
	after, _ = os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("failed import damaged catalogue")
	}
	if err := os.WriteFile(path+".lock", nil, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := application.Import(store, s, []domain.Record{r}, true); err == nil {
		t.Fatal("ignored another writer's lock")
	}
	if _, err := os.Stat(path + ".lock"); err != nil {
		t.Fatal("removed another writer's lock")
	}
}

func TestCorruptCatalogIsNotOverwritten(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	for _, data := range []string{`{}`, `{"schema_version":99}`, `{"schema_version":1,"surprise":true}`} {
		if err := os.WriteFile(path, []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
		err := (filecatalog.Store{Path: path}).Update(func(domain.Catalog) (domain.Catalog, error) { return domain.New(), nil }, true)
		if err == nil {
			t.Fatal("overwrote corrupt catalogue")
		}
		actual, _ := os.ReadFile(path)
		if string(actual) != data {
			t.Fatal("changed corrupt file")
		}
	}
}
