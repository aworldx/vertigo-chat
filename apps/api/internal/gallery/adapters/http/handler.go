package http

import (
	"chat/api/internal/gallery/application"
	"chat/api/internal/gallery/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type Handler struct {
	s        application.Service
	identity Identity
}

func NewHandler(s application.Service, i Identity) Handler { return Handler{s, i} }
func (h Handler) Register(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/gallery", h.list)
	m.HandleFunc("POST /api/v1/gallery", h.upload)
	m.HandleFunc("PUT /api/v1/gallery/{id}/caption", h.caption)
	m.HandleFunc("PUT /api/v1/gallery/{id}/like", h.like)
	m.HandleFunc("GET /gallery/photos/{id}", h.media)
	m.HandleFunc("GET /gallery/photos/{id}/thumbnail", h.media)
}

type photoDTO struct {
	ID        int64  `json:"id"`
	Author    string `json:"author"`
	Caption   string `json:"caption"`
	Date      string `json:"date"`
	Own       bool   `json:"own"`
	Likes     int    `json:"likes"`
	Liked     bool   `json:"liked"`
	Thumbnail string `json:"thumbnail"`
	Image     string `json:"image"`
}

func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, false)
	if status != 0 && status != 401 {
		failureStatus(w, status, "unavailable")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	photos, names, viewer, err := h.s.List(ctx, user)
	if err != nil {
		failure(w, err)
		return
	}
	data := make([]photoDTO, 0, len(photos))
	for _, p := range photos {
		url := "/gallery/photos/" + strconv.FormatInt(p.ID, 10)
		thumb := url
		if p.HasThumbnail {
			thumb += "/thumbnail"
		}
		data = append(data, photoDTO{p.ID, names[p.UserID], p.Caption, p.InsertedAt.Format("02.01.2006"), p.UserID == user, p.Likes, p.Liked, thumb, url})
	}
	respond(w, 200, map[string]any{"data": data, "can_upload": viewer.CanUpload})
}
func (h Handler) caption(w http.ResponseWriter, r *http.Request) {
	user, id, ok := h.mutation(w, r)
	if !ok {
		return
	}
	var input struct {
		Caption *string `json:"caption"`
	}
	if !decode(w, r, &input) || input.Caption == nil {
		failureStatus(w, 422, "invalid_caption")
		return
	}
	if err := h.s.Caption(r.Context(), user, id, *input.Caption); err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (h Handler) like(w http.ResponseWriter, r *http.Request) {
	user, id, ok := h.mutation(w, r)
	if !ok {
		return
	}
	var input struct {
		Active *bool `json:"active"`
	}
	if !decode(w, r, &input) || input.Active == nil {
		failureStatus(w, 422, "invalid_like")
		return
	}
	if err := h.s.Like(r.Context(), user, id, *input.Active); err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (h Handler) mutation(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	user, status := h.identity(r, true)
	if status != 0 {
		failureStatus(w, status, "forbidden")
		return 0, 0, false
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		failure(w, domain.ErrNotFound)
		return 0, 0, false
	}
	return user, id, true
}
func (h Handler) media(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		failure(w, domain.ErrNotFound)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	m, err := h.s.Media(ctx, id, r.URL.Path == "/gallery/photos/"+strconv.FormatInt(id, 10)+"/thumbnail")
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", m.ContentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(m.Bytes)
}
func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(dst) != nil {
		return false
	}
	var extra any
	return d.Decode(&extra) == io.EOF
}
func respond(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, follow")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func failureStatus(w http.ResponseWriter, status int, code string) {
	respond(w, status, map[string]string{"error": code})
}
func failure(w http.ResponseWriter, err error) {
	status, code := 503, "unavailable"
	for _, e := range []error{domain.ErrCaption, domain.ErrPhoto, domain.ErrThumbnail, domain.ErrRank, domain.ErrTotal, domain.ErrDaily} {
		if errors.Is(err, e) {
			status, code = 422, e.Error()
		}
	}
	if errors.Is(err, domain.ErrNotFound) {
		status, code = 404, "not_found"
	}
	if errors.Is(err, domain.ErrForbidden) {
		status, code = 403, "forbidden"
	}
	failureStatus(w, status, code)
}
