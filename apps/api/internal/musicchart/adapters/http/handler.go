package http

import (
	"bytes"
	"chat/api/internal/musicchart/application"
	"chat/api/internal/musicchart/domain"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type Handler struct {
	service    application.Service
	identity   Identity
	publicBase string
}

func NewHandler(s application.Service, i Identity, base string) Handler {
	return Handler{s, i, strings.TrimRight(base, "/")}
}
func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/music-chart", h.list)
	mux.HandleFunc("POST /api/v1/music-chart", h.upload)
	mux.HandleFunc("PATCH /api/v1/music-chart/{id}", h.mutate)
	mux.HandleFunc("PUT /api/v1/music-chart/{id}/like", h.mutate)
	mux.HandleFunc("POST /api/v1/music-chart/{id}/comments", h.mutate)
	mux.HandleFunc("GET /music-chart/tracks/{id}", h.audio)
}
func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, false)
	if status != 0 && status != 401 {
		http.Error(w, "unavailable", status)
		return
	}
	items, err := h.service.List(r.Context(), user)
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": items})
}
func (h Handler) actor(w http.ResponseWriter, r *http.Request) (int64, bool) {
	user, status := h.identity(r, true)
	if status != 0 {
		http.Error(w, "Войди с зарегистрированным ником.", status)
		return 0, false
	}
	return user, true
}
func (h Handler) upload(w http.ResponseWriter, r *http.Request) {
	user, ok := h.actor(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, domain.MaxAudioBytes+65536)
	if err := r.ParseMultipartForm(domain.MaxAudioBytes + 65536); err != nil {
		failure(w, domain.ErrInvalid)
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	f, header, err := r.FormFile("audio")
	if err != nil {
		failure(w, domain.ErrInvalid)
		return
	}
	defer func() { _ = f.Close() }()
	data, err := io.ReadAll(io.LimitReader(f, domain.MaxAudioBytes+1))
	if err != nil {
		failure(w, err)
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	}
	kind := header.Header.Get("Content-Type")
	if kind == "audio/x-wav" {
		kind = "audio/wav"
	}
	if err := h.service.Add(r.Context(), user, title, domain.Audio{Bytes: data, ContentType: kind}); err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
}
func (h Handler) mutate(w http.ResponseWriter, r *http.Request) {
	user, ok := h.actor(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		failure(w, domain.ErrNotFound)
		return
	}
	var input struct {
		Title  string `json:"title"`
		Body   string `json:"body"`
		Active bool   `json:"active"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil {
		failure(w, domain.ErrInvalid)
		return
	}
	switch r.Method {
	case "PATCH":
		err = h.service.Rename(r.Context(), user, id, input.Title)
	case "PUT":
		err = h.service.Like(r.Context(), user, id, input.Active)
	default:
		err = h.service.Comment(r.Context(), user, id, input.Body)
	}
	if err != nil {
		failure(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (h Handler) audio(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	a, err := h.service.Audio(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	if len(a.Bytes) == 0 && a.Key != "" && h.publicBase != "" {
		parts := strings.Split(a.Key, "/")
		for i, s := range parts {
			parts[i] = url.PathEscape(s)
		}
		http.Redirect(w, r, h.publicBase+"/"+strings.Join(parts, "/"), http.StatusFound)
		return
	}
	if len(a.Bytes) == 0 {
		http.Error(w, "audio unavailable", http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", a.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, "track", time.Time{}, bytes.NewReader(a.Bytes))
}
func failure(w http.ResponseWriter, err error) {
	status, message := 503, "Сервис временно недоступен. Попробуй позже."
	switch {
	case errors.Is(err, domain.ErrInvalid):
		status, message = 422, "Проверь название (до 120 символов), комментарий (до 280) и файл MP3, OGG или WAV до 20 МБ."
	case errors.Is(err, domain.ErrLimit):
		status, message = 422, "Можно загрузить не больше 5 треков."
	case errors.Is(err, domain.ErrForbidden):
		status, message = 403, "Можно изменять только свои треки и голосовать за чужие."
	case errors.Is(err, domain.ErrNotFound):
		status, message = 404, "Трек не найден."
	}
	http.Error(w, message, status)
}
