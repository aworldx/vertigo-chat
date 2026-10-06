// Package community reads explicitly selected, checksummed local exports.
// It never downloads URLs or treats an imported location as a playable question.
package community

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"chat/api/internal/geocatalog/domain"
)

type Manifest struct {
	Source domain.Source `json:"source"`
	File   string        `json:"file"`
}

func boundedRead(path string, limit int64) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("file exceeds size limit")
	}
	return data, err
}

func Read(manifestPath string) (domain.Source, []domain.Record, error) {
	var manifest Manifest
	data, err := boundedRead(manifestPath, 64*1024)
	if err != nil {
		return manifest.Source, nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil {
		return manifest.Source, nil, err
	}
	if err := decoder.Decode(new(json.RawMessage)); err != io.EOF {
		return manifest.Source, nil, fmt.Errorf("trailing manifest content")
	}
	if err := manifest.Source.Validate(); err != nil {
		return manifest.Source, nil, err
	}
	if manifest.Source.Provider != "google-streetview" {
		return manifest.Source, nil, fmt.Errorf("these export formats require google-streetview provider")
	}
	if !filepath.IsLocal(manifest.File) {
		return manifest.Source, nil, fmt.Errorf("export path must be relative to manifest")
	}
	data, err = boundedRead(filepath.Join(filepath.Dir(manifestPath), manifest.File), 32*1024*1024)
	if err != nil {
		return manifest.Source, nil, err
	}
	sum := sha256.Sum256(data)
	if hex.EncodeToString(sum[:]) != manifest.Source.SHA256 {
		return manifest.Source, nil, fmt.Errorf("export checksum mismatch")
	}
	records, err := Parse(manifest.Source.Format, data)
	return manifest.Source, records, err
}

type point struct {
	ID          json.RawMessage `json:"id"`
	Lat         *float64        `json:"lat"`
	Lng         *float64        `json:"lng"`
	Heading     *float64        `json:"heading"`
	Pitch       *float64        `json:"pitch"`
	Zoom        *float64        `json:"zoom"`
	PanoID      string          `json:"panoId"`
	CountryCode string          `json:"countryCode"`
	StateCode   string          `json:"stateCode"`
	Extra       struct {
		PanoID   string   `json:"panoId"`
		PanoDate string   `json:"panoDate"`
		Tags     []string `json:"tags"`
	} `json:"extra"`
}

// Native IDs remain exact strings, including large numeric GeoJSON feature IDs.
func recordID(raw json.RawMessage, p domain.Position) (string, string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.DerivedRecordID(p), "derived-coordinate", nil
	}
	if raw[0] == '"' {
		var id string
		if err := json.Unmarshal(raw, &id); err != nil {
			return "", "", err
		}
		if id == "" {
			return "", "", fmt.Errorf("empty native ID")
		}
		return id, "native", nil
	}
	var number json.Number
	if err := json.Unmarshal(raw, &number); err != nil {
		return "", "", fmt.Errorf("ID must be a string or number")
	}
	return number.String(), "native", nil
}

func (p point) record() (domain.Record, error) {
	var r domain.Record
	if p.Lat == nil || p.Lng == nil {
		return r, fmt.Errorf("missing latitude/longitude")
	}
	r.Position = domain.Position{Lat: *p.Lat, Lng: *p.Lng}
	var err error
	r.ID, r.IDKind, err = recordID(p.ID, r.Position)
	if err != nil {
		return r, err
	}
	r.PanoramaID = p.PanoID
	if r.PanoramaID == "" {
		r.PanoramaID = p.Extra.PanoID
	}
	if p.PanoID != "" && p.Extra.PanoID != "" && p.PanoID != p.Extra.PanoID {
		return r, fmt.Errorf("conflicting top-level/extra panorama IDs")
	}
	r.View = domain.View{Heading: p.Heading, Pitch: p.Pitch, Zoom: p.Zoom}
	r.CountryCode, r.StateCode = p.CountryCode, p.StateCode
	r.PanoramaDate, r.Tags = p.Extra.PanoDate, p.Extra.Tags
	return r, r.Validate()
}

func Parse(format string, data []byte) ([]domain.Record, error) {
	switch format {
	case "geoguessr-json":
		return parseMap(data)
	case "geojson":
		return parseGeoJSON(data)
	default:
		return nil, fmt.Errorf("unsupported format %q", format)
	}
}

func parseMap(data []byte) ([]domain.Record, error) {
	var doc struct {
		Points []point `json:"customCoordinates"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if len(doc.Points) == 0 {
		return nil, fmt.Errorf("empty customCoordinates")
	}
	result := make([]domain.Record, 0, len(doc.Points))
	for i, p := range doc.Points {
		r, err := p.record()
		if err != nil {
			return nil, fmt.Errorf("record %d: %w", i, err)
		}
		result = append(result, r)
	}
	return result, nil
}

func parseGeoJSON(data []byte) ([]domain.Record, error) {
	var doc struct {
		Type     string `json:"type"`
		Features []struct {
			Type     string          `json:"type"`
			ID       json.RawMessage `json:"id"`
			Geometry struct {
				Type        string     `json:"type"`
				Coordinates []*float64 `json:"coordinates"`
			} `json:"geometry"`
			Properties point `json:"properties"`
		} `json:"features"`
	}
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if doc.Type != "FeatureCollection" || len(doc.Features) == 0 {
		return nil, fmt.Errorf("expected nonempty FeatureCollection")
	}
	result := make([]domain.Record, 0, len(doc.Features))
	for i, f := range doc.Features {
		if f.Type != "Feature" || f.Geometry.Type != "Point" || len(f.Geometry.Coordinates) != 2 {
			return nil, fmt.Errorf("feature %d: expected 2D Point", i)
		}
		p := f.Properties
		p.ID = f.ID
		p.Lng, p.Lat = f.Geometry.Coordinates[0], f.Geometry.Coordinates[1]
		r, err := p.record()
		if err != nil {
			return nil, fmt.Errorf("feature %d: %w", i, err)
		}
		result = append(result, r)
	}
	return result, nil
}
