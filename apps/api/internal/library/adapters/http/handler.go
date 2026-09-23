package http

import (
	"chat/api/internal/library/application"
	"chat/api/internal/library/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type Handler struct {
	s        application.Service
	identity Identity
}

func NewHandler(s application.Service, i Identity) Handler { return Handler{s, i} }
func (h Handler) Register(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/library", h.list)
	m.HandleFunc("POST /api/v1/library", h.save)
	m.HandleFunc("PUT /api/v1/library/{id}", h.save)
}

type inputDTO struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	Series string `json:"series"`
	Part   *int   `json:"part_number"`
}
type articleDTO struct {
	ID       int64  `json:"id"`
	AuthorID int64  `json:"author_id"`
	Author   string `json:"author"`
	Date     string `json:"date"`
	Own      bool   `json:"own"`
	inputDTO
}
type seriesDTO struct {
	AuthorID int64  `json:"author_id"`
	Author   string `json:"author"`
	Name     string `json:"name"`
	Count    int    `json:"count"`
}

func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, false)
	if status != 0 && status != 401 {
		respond(w, status, map[string]string{"error": "unavailable"})
		return
	}
	author, _ := strconv.ParseInt(r.URL.Query().Get("author"), 10, 64)
	series := strings.TrimSpace(r.URL.Query().Get("series"))
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	articles, groups, names, can, err := h.s.List(ctx, user, author, series)
	if err != nil {
		failure(w, err)
		return
	}
	data := []articleDTO{}
	for _, a := range articles {
		data = append(data, articleDTO{a.ID, a.UserID, names[a.UserID], a.InsertedAt.Format("02.01.2006"), a.UserID == user, inputDTO{a.Title, a.Body, a.Series, a.Part}})
	}
	tags := []seriesDTO{}
	for _, g := range groups {
		tags = append(tags, seriesDTO{g.UserID, names[g.UserID], g.Name, g.Count})
	}
	sort.SliceStable(tags, func(i, j int) bool {
		if tags[i].Author != tags[j].Author {
			return tags[i].Author < tags[j].Author
		}
		return tags[i].Name < tags[j].Name
	})
	respond(w, 200, map[string]any{"data": data, "series": tags, "can_publish": can})
}
func (h Handler) save(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, true)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return
	}
	id := int64(0)
	if r.Method == "PUT" {
		var err error
		id, err = strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || id <= 0 {
			failure(w, domain.ErrNotFound)
			return
		}
	}
	r.Body = http.MaxBytesReader(w, r.Body, 60000)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	var v inputDTO
	var extra any
	if d.Decode(&v) != nil || d.Decode(&extra) != io.EOF {
		failure(w, domain.ErrInvalid)
		return
	}
	saved, err := h.s.Save(r.Context(), user, id, domain.Input{Title: v.Title, Body: v.Body, Series: v.Series, Part: v.Part})
	if err != nil {
		failure(w, err)
		return
	}
	status = 200
	if id == 0 {
		status = 201
	}
	respond(w, status, map[string]int64{"id": saved})
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func failure(w http.ResponseWriter, err error) {
	status, code := 503, "unavailable"
	for _, e := range []error{domain.ErrInvalid, domain.ErrRank, domain.ErrDaily, domain.ErrTotal} {
		if errors.Is(err, e) {
			status, code = 422, e.Error()
		}
	}
	if errors.Is(err, domain.ErrForbidden) {
		status, code = 403, "forbidden"
	}
	if errors.Is(err, domain.ErrNotFound) {
		status, code = 404, "not_found"
	}
	respond(w, status, map[string]string{"error": code})
}
