package main

import (
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	catalog "chat/api/internal/geocatalog/domain"
	geogoogle "chat/api/internal/geogame/adapters/google"
	geohttp "chat/api/internal/geogame/adapters/http"
	geopg "chat/api/internal/geogame/adapters/postgres"
	geo "chat/api/internal/geogame/application"
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

func registerGeo(ctx context.Context, mux *http.ServeMux, pool *pgxpool.Pool, origin string) {
	provider := geoProvider()
	registerGeoProvider(ctx, mux, pool, origin, provider, os.Getenv("GEO_GOOGLE_BROWSER_KEY"))
}
func registerGeoProvider(ctx context.Context, mux *http.ServeMux, pool *pgxpool.Pool, origin string, provider geo.Questions, browserKey string) {
	store := geopg.Store{Pool: pool}
	credentials := chats.NewCredentials(chatspg.NewStore(pool))
	auth := func(ctx context.Context, token string) (domain.Actor, error) {
		resume, err := chatshttp.DecodeResume(token)
		if err != nil {
			return domain.Actor{}, err
		}
		s, err := credentials.Verify(ctx, resume.SessionID, resume.IdentityKey, resume.Secret)
		if err != nil {
			return domain.Actor{}, err
		}
		return domain.Actor{Key: s.IdentityKey, Room: s.RoomID, Nickname: s.Nickname, Registered: strings.HasPrefix(s.IdentityKey, "user:")}, nil
	}
	geohttp.Handler{Service: geo.Service{Store: store, Questions: provider, Now: time.Now}, Rankings: store, Authenticate: auth, Origin: origin, BrowserKey: browserKey}.Register(mux)
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := store.Prune(ctx); err != nil && ctx.Err() == nil {
					slog.Error("prune geo games", "error", err)
				}
			}
		}
	}()
}
func geoProvider() geogoogle.Provider {
	p := geogoogle.Provider{Key: os.Getenv("GEO_GOOGLE_SERVER_KEY"), BrowserKey: os.Getenv("GEO_GOOGLE_BROWSER_KEY")}
	if p.Key == "" || p.BrowserKey == "" {
		return p
	}
	data, err := os.ReadFile(env("GEO_CATALOG_PATH", "/app/data/geo/catalog.json"))
	var c catalog.Catalog
	if err != nil || json.Unmarshal(data, &c) != nil || c.Validate() != nil {
		slog.Error("geo catalogue unavailable or invalid")
		return p
	}
	keys := make([]string, 0, len(c.Entries))
	for key := range c.Entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	seen := map[string]bool{}
	for _, key := range keys {
		e := c.Entries[key]
		r := e.Record
		versions := c.Sources[e.SourceID]
		s := versions[len(versions)-1]
		if s.Provider != "google-streetview" || seen[e.LocationID] || e.Revision != s.Revision {
			continue
		}
		candidate := geogoogle.Candidate{ID: e.LocationID, PanoID: r.PanoramaID, Source: s.Title, Author: s.Author, Position: domain.Point{Lat: r.Position.Lat, Lng: r.Position.Lng}, Tags: r.Tags, ScenicRoads: s.Title == "Gorgeous Touge Roads"}
		if r.View.Heading != nil {
			candidate.Heading = *r.View.Heading
		}
		if r.View.Pitch != nil {
			candidate.Pitch = *r.View.Pitch
		}
		if !geogoogle.Eligible(candidate) {
			continue
		}
		p.Candidates = append(p.Candidates, candidate)
		seen[e.LocationID] = true
	}
	return p
}
