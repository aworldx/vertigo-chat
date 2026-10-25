package http

import (
	"chat/api/internal/profiles/application"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPublicRankContract(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.Catalog{}).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("GET", "/api/v1/ranks", nil))
	if response.Code != 200 {
		t.Fatal(response.Code)
	}
	var body struct {
		Data []struct {
			Title         string                                 `json:"title"`
			IconURL       string                                 `json:"icon_url"`
			Messages      int                                    `json:"messages"`
			Hours         int                                    `json:"hours"`
			FeatureUnlock string                                 `json:"feature_unlock"`
			Limits        struct{ Tracks, Articles, Photos int } `json:"limits"`
		}
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Data) != 10 || body.Data[1].Messages != 50 || body.Data[1].Hours != 5 || body.Data[1].FeatureUnlock != "" || body.Data[9].IconURL != "/images/ranks/theater.svg" {
		t.Fatalf("contract: %s", response.Body.String())
	}
	for i, limit := range []int{1, 2, 3, 5, 8, 12, 18, 25, 35, 50} {
		got := body.Data[i].Limits
		if got.Tracks != limit || got.Articles != limit || got.Photos != limit {
			t.Fatalf("rank %d: %+v", i, got)
		}
	}
}
