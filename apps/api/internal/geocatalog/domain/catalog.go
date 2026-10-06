// Package domain owns the offline location catalogue and its identity rules.
package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
)

const SchemaVersion = 1

// Source describes a pinned export, not a licence to redistribute its imagery.
type Source struct {
	ID          string `json:"id"`
	MapID       string `json:"map_id,omitempty"`
	Title       string `json:"title"`
	Author      string `json:"author"`
	URL         string `json:"url"`
	License     string `json:"license"`
	Revision    string `json:"revision"`
	DownloadURL string `json:"download_url"`
	SHA256      string `json:"sha256"`
	Provider    string `json:"provider"`
	Format      string `json:"format"`
	Selection   string `json:"selection"`
}

type Position struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type View struct {
	Heading *float64 `json:"heading,omitempty"`
	Pitch   *float64 `json:"pitch,omitempty"`
	Zoom    *float64 `json:"zoom,omitempty"`
}

type Record struct {
	ID           string   `json:"id"`
	IDKind       string   `json:"id_kind"`
	Position     Position `json:"position"`
	PanoramaID   string   `json:"panorama_id,omitempty"`
	View         View     `json:"view"`
	CountryCode  string   `json:"country_code,omitempty"`
	StateCode    string   `json:"state_code,omitempty"`
	PanoramaDate string   `json:"panorama_date,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// Location owns permanent identity. Aliases survive source/panorama updates.
type Location struct {
	Provider    string     `json:"provider"`
	Positions   []Position `json:"positions"`
	PanoramaIDs []string   `json:"panorama_ids,omitempty"`
}

// Entry keeps each map's framing and editorial tags separate from identity.
// Imported entries are never implicitly playable or verified.
type Entry struct {
	SourceID   string `json:"source_id"`
	Revision   string `json:"revision"`
	LocationID string `json:"location_id"`
	Record     Record `json:"record"`
}

type Catalog struct {
	SchemaVersion int                 `json:"schema_version"`
	Sources       map[string][]Source `json:"sources"`
	Locations     map[string]Location `json:"locations"`
	Entries       map[string]Entry    `json:"entries"`
}

func New() Catalog {
	return Catalog{SchemaVersion, map[string][]Source{}, map[string]Location{}, map[string]Entry{}}
}

func fingerprint(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

// CoordinateKey rounds only floating-point noise (~1 cm), never nearby roads.
func CoordinateKey(p Position) string {
	lat, lng := math.Round(p.Lat*1e7)/1e7, math.Round(p.Lng*1e7)/1e7
	if lat == 0 {
		lat = 0
	}
	if lng == 0 {
		lng = 0
	}
	return fmt.Sprintf("%.7f,%.7f", lat, lng)
}

func DerivedRecordID(p Position) string { return "coordinate:" + CoordinateKey(p) }

func (s Source) Validate() error {
	if strings.ContainsRune(s.ID, '\x00') || strings.ContainsRune(s.Provider, '\x00') {
		return fmt.Errorf("invalid source identity")
	}
	for _, value := range []string{s.ID, s.Title, s.Author, s.URL, s.License, s.Revision, s.Provider, s.DownloadURL, s.Format, s.Selection} {
		if value == "" {
			return fmt.Errorf("source metadata is incomplete")
		}
	}
	checksum, err := hex.DecodeString(s.SHA256)
	if err != nil || len(checksum) != sha256.Size {
		return fmt.Errorf("invalid source sha256")
	}
	return nil
}

func (p Position) Validate() error {
	if math.IsNaN(p.Lat) || math.IsNaN(p.Lng) || math.IsInf(p.Lat, 0) || math.IsInf(p.Lng, 0) || p.Lat < -90 || p.Lat > 90 || p.Lng < -180 || p.Lng > 180 {
		return fmt.Errorf("invalid coordinates: %v", p)
	}
	return nil
}

func (r Record) Validate() error {
	if r.ID == "" || strings.ContainsRune(r.ID, '\x00') || (r.IDKind != "native" && r.IDKind != "derived-coordinate") {
		return fmt.Errorf("invalid record identity")
	}
	if err := r.Position.Validate(); err != nil {
		return err
	}
	for _, value := range []*float64{r.View.Heading, r.View.Pitch, r.View.Zoom} {
		if value != nil && (math.IsNaN(*value) || math.IsInf(*value, 0)) {
			return fmt.Errorf("invalid view")
		}
	}
	return nil
}
