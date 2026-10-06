// Package google resolves community candidates on demand. Imagery and geocoding
// responses are never appended to the permanent imported community catalogue.
package google

import (
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Candidate struct {
	ID, PanoID, Source, Author string
	Position                   domain.Point
	Heading, Pitch             float64
	Tags                       []string
	ScenicRoads                bool
}
type Provider struct {
	Key, BrowserKey string
	Candidates      []Candidate
	Client          *http.Client
	BaseURL         string
}

func (p Provider) Configured() bool {
	return p.Key != "" && p.BrowserKey != "" && len(p.Candidates) >= 5
}

var acceptedTag = regexp.MustCompile(`^(_(africa|asia|europe|north_america|south_america|oceania)|v[0-9]+|v4 add|banger)$`)

func Eligible(c Candidate) bool {
	for _, tag := range c.Tags {
		if !acceptedTag.MatchString(tag) {
			return false
		}
	}
	return c.ID != ""
}

func (p Provider) Prepare(ctx context.Context) ([]domain.Question, error) {
	if !p.Configured() {
		return nil, domain.ErrUnavailable
	}
	indexes := rand.Perm(len(p.Candidates))
	sort.SliceStable(indexes, func(i, j int) bool {
		return !p.Candidates[indexes[i]].ScenicRoads && p.Candidates[indexes[j]].ScenicRoads
	})
	result := []domain.Question{}
	urban := 0
	seen := map[string]bool{}
	for attempts, index := range indexes {
		if attempts >= 20 || ctx.Err() != nil {
			break
		}
		c := p.Candidates[index]
		if !Eligible(c) || seen[c.ID] {
			continue
		}
		q, err := p.resolve(ctx, c)
		if err != nil {
			continue
		}
		if seen[q.PanoID] {
			continue
		}
		seen[c.ID] = true
		seen[q.PanoID] = true
		result = append(result, q)
		if q.Place.BuiltUp {
			urban++
		}
		if len(result) >= 5 && urban >= 4 {
			return preferredQuestions(result), nil
		}
	}
	if len(result) >= 5 {
		return preferredQuestions(result), nil
	}
	return nil, domain.ErrUnavailable
}

// Prefer four built-up locations while retaining one varied scene. This is a
// metadata heuristic, not a guarantee that every panorama shows buildings.
func preferredQuestions(candidates []domain.Question) []domain.Question {
	sort.SliceStable(candidates, func(i, j int) bool { return candidates[i].Place.BuiltUp && !candidates[j].Place.BuiltUp })
	result := append([]domain.Question(nil), candidates[:5]...)
	rand.Shuffle(len(result), func(i, j int) { result[i], result[j] = result[j], result[i] })
	return result
}

type metadata struct {
	Status   string       `json:"status"`
	PanoID   string       `json:"pano_id"`
	Location domain.Point `json:"location"`
}

func (p Provider) resolve(ctx context.Context, c Candidate) (domain.Question, error) {
	params := url.Values{"source": {"outdoor"}}
	if c.PanoID != "" {
		params.Set("pano", c.PanoID)
	} else {
		params.Set("location", coordinates(c.Position))
		params.Set("radius", "50")
	}
	var meta metadata
	if err := p.get(ctx, "streetview/metadata", params, &meta); err != nil {
		return domain.Question{}, err
	}
	// Missing pinned imagery is skipped, never silently replaced with a different view.
	if meta.Status != "OK" || meta.PanoID == "" {
		return domain.Question{}, domain.ErrUnavailable
	}
	place, err := p.place(ctx, meta.Location)
	return domain.Question{ID: c.ID, PanoID: meta.PanoID, Position: meta.Location, Heading: c.Heading, Pitch: c.Pitch, Place: place, Source: c.Source, Author: c.Author}, err
}

type component struct {
	Long  string   `json:"long_name"`
	Short string   `json:"short_name"`
	Types []string `json:"types"`
}
type geocoding struct {
	Status  string `json:"status"`
	Results []struct {
		Components []component `json:"address_components"`
	} `json:"results"`
}

func (p Provider) place(ctx context.Context, point domain.Point) (domain.Place, error) {
	var place domain.Place
	for _, lang := range []string{"ru", "en"} {
		var response geocoding
		if err := p.get(ctx, "geocode/json", url.Values{"latlng": {coordinates(point)}, "language": {lang}}, &response); err != nil {
			return place, err
		}
		if response.Status != "OK" || len(response.Results) == 0 {
			return place, domain.ErrUnavailable
		}
		var country, code, city string
		for _, result := range response.Results {
			country, code, city = address(result.Components)
			if city != "" && hasComponent(result.Components, "street_number") && hasComponent(result.Components, "route") {
				place.BuiltUp = true
			}
			if country != "" {
				break
			}
		}
		if country == "" {
			return place, domain.ErrUnavailable
		}
		place.Countries = append(place.Countries, country, code)
		if city != "" {
			place.Cities = append(place.Cities, city)
		}
		if lang == "ru" {
			place.Country, place.City = country, city
		}
	}
	return place, nil
}
func address(components []component) (country, code, city string) {
	for _, c := range components {
		for _, kind := range c.Types {
			switch kind {
			case "country":
				country, code = c.Long, c.Short
			case "locality", "postal_town":
				if city == "" {
					city = c.Long
				}
			}
		}
	}
	return
}
func coordinates(p domain.Point) string {
	return strconv.FormatFloat(p.Lat, 'f', 7, 64) + "," + strconv.FormatFloat(p.Lng, 'f', 7, 64)
}
func (p Provider) get(ctx context.Context, path string, params url.Values, target interface{}) error {
	params.Set("key", p.Key)
	base := p.BaseURL
	if base == "" {
		base = "https://maps.googleapis.com/maps/api/"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/"+path+"?"+params.Encode(), nil)
	if err != nil {
		return domain.ErrUnavailable
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 4 * time.Second}
	}
	resp, err := client.Do(req)
	// Do not expose transport errors: their URLs can contain a server API key.
	if err != nil {
		return domain.ErrUnavailable
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != 200 {
		return fmt.Errorf("google response status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(target)
}

func hasComponent(components []component, kind string) bool {
	for _, c := range components {
		for _, t := range c.Types {
			if t == kind {
				return true
			}
		}
	}
	return false
}
