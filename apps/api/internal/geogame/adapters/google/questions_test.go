package google

import (
	"chat/api/internal/geogame/domain"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPinnedImageryAndBilingualAnswers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "metadata"):
			if r.URL.Query().Get("pano") != "original-ID" {
				t.Error("pano ID lost")
			}
			_, _ = w.Write([]byte(`{"status":"OK","pano_id":"original-ID","location":{"lat":10,"lng":20}}`))
		default:
			_, _ = w.Write([]byte(`{"status":"OK","results":[{"address_components":[{"long_name":"remote plus code","types":["plus_code"]}]},{"address_components":[{"long_name":"Italy","short_name":"IT","types":["country"]},{"long_name":"Manarola","types":["locality"]}]}]}`))
		}
	}))
	defer server.Close()
	p := Provider{Key: "never-log-me", BaseURL: server.URL, Client: server.Client()}
	q, err := p.resolve(context.Background(), Candidate{ID: "stable", PanoID: "original-ID"})
	if err != nil || q.ID != "stable" || q.PanoID != "original-ID" || q.Place.Score("Italy, Manarola") != 3 {
		t.Fatalf("resolve failed: %+v %v", q, err)
	}
	for _, tag := range []string{"unused", "future", "provisional", "v8_removal", "v10_removed", "inaccurate", "reconsider", "unknown"} {
		if Eligible(Candidate{ID: "id", Tags: []string{tag}}) {
			t.Errorf("accepted %s", tag)
		}
	}
	if !Eligible(Candidate{ID: "id", Tags: []string{"_europe", "v10"}}) {
		t.Fatal("rejected regular version tags")
	}
}

func TestPreferredQuestionsKeepUrbanPlaces(t *testing.T) {
	candidates := []domain.Question{}
	for i := range 12 {
		candidates = append(candidates, domain.Question{ID: fmt.Sprint(i), Place: domain.Place{BuiltUp: i >= 8}})
	}
	selected := preferredQuestions(candidates)
	urban := 0
	seen := map[string]bool{}
	for _, q := range selected {
		if seen[q.ID] {
			t.Fatal("duplicate")
		}
		seen[q.ID] = true
		if q.Place.BuiltUp {
			urban++
		}
	}
	if len(selected) != 5 || urban != 4 {
		t.Fatalf("wanted four urban scenes, got %d", urban)
	}
}
