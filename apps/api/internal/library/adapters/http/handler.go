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
	m.HandleFunc("PUT /api/v1/library/series", h.updateSeries)
	m.HandleFunc("PUT /api/v1/library/{id}/like", h.reaction)
	m.HandleFunc("PUT /api/v1/library/{id}/bookmark", h.reaction)
	m.HandleFunc("POST /api/v1/library/images", h.upload)
	m.HandleFunc("GET /library/images/{id}", h.image)
}

type inputDTO struct {
	Title      string  `json:"title"`
	Body       string  `json:"body"`
	Series     string  `json:"series"`
	Part       *int    `json:"part_number"`
	WorkAuthor string  `json:"work_author"`
	CoverImage *string `json:"cover_image,omitempty"`
}
type articleDTO struct {
	ID         int64  `json:"id"`
	AuthorID   int64  `json:"author_id"`
	Author     string `json:"author"`
	Date       string `json:"date"`
	Own        bool   `json:"own"`
	SourceURL  string `json:"source_url"`
	CoverImage string `json:"cover_image"`
	Likes      int    `json:"likes"`
	Liked      bool   `json:"liked"`
	Bookmarked bool   `json:"bookmarked"`
	inputDTO
}
type seriesDTO struct {
	AuthorID    int64  `json:"author_id"`
	Author      string `json:"author"`
	Name        string `json:"name"`
	Count       int    `json:"count"`
	Description string `json:"description"`
	Own         bool   `json:"own"`
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
	articles, groups, names, can, err := h.s.List(ctx, user, author, series, r.URL.Query().Get("bookmarks") == "1")
	if err != nil {
		failure(w, err)
		return
	}
	data := []articleDTO{}
	for _, a := range articles {
		data = append(data, articleDTO{ID: a.ID, AuthorID: a.UserID, Author: names[a.UserID], Date: a.InsertedAt.Format("02.01.2006"), Own: a.UserID == user, SourceURL: a.SourceURL, CoverImage: a.CoverImage, Likes: a.Likes, Liked: a.Liked, Bookmarked: a.Bookmarked, inputDTO: inputDTO{Title: a.Title, Body: a.Body, Series: a.Series, Part: a.Part, WorkAuthor: a.WorkAuthor}})
	}
	tags := []seriesDTO{}
	for _, g := range groups {
		tags = append(tags, seriesDTO{g.UserID, names[g.UserID], g.Name, g.Count, g.Description, g.UserID == user})
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
	saved, err := h.s.Save(r.Context(), user, id, domain.Input{Title: v.Title, Body: v.Body, Series: v.Series, Part: v.Part, WorkAuthor: v.WorkAuthor, CoverImage: v.CoverImage})
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
	for _, e := range []error{domain.ErrInvalid, domain.ErrRank, domain.ErrDaily, domain.ErrTotal, domain.ErrImage, domain.ErrImageQuota} {
		if errors.Is(err, e) {
			status, code = 422, e.Error()
		}
	}
	if errors.Is(err, domain.ErrSeriesConflict) {
		status, code = 409, err.Error()
	}
	if errors.Is(err, domain.ErrForbidden) {
		status, code = 403, "forbidden"
	}
	if errors.Is(err, domain.ErrNotFound) {
		status, code = 404, "not_found"
	}
	respond(w, status, map[string]string{"error": code})
}
