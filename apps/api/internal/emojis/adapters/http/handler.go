package http

import (
	"chat/api/internal/emojis/application"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type Handler struct {
	service    application.Service
	publicBase string
}

func NewHandler(s application.Service, publicBase string) Handler {
	return Handler{s, strings.TrimRight(publicBase, "/")}
}
func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/chat/emojis", h.list)
	mux.HandleFunc("GET /emojis/{id}", h.image)
}

type emojiDTO struct {
	ID     int64    `json:"id"`
	Code   string   `json:"code"`
	Width  int      `json:"width"`
	Height int      `json:"height"`
	Terms  []string `json:"terms"`
}

func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		http.Error(w, "unavailable", http.StatusServiceUnavailable)
		return
	}
	result := make([]emojiDTO, 0, len(items))
	for _, e := range items {
		terms := e.Terms
		if terms == nil {
			terms = []string{}
		}
		result = append(result, emojiDTO{e.ID, e.Code, e.Width, e.Height, terms})
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": result})
}
func (h Handler) image(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		http.NotFound(w, r)
		return
	}
	image, err := h.service.Image(r.Context(), id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if len(image.Bytes) == 0 && image.Key != "" && h.publicBase != "" {
		http.Redirect(w, r, h.publicBase+"/"+escapeKey(image.Key), http.StatusFound)
		return
	}
	if len(image.Bytes) == 0 {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", image.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(image.Bytes)
}

func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
