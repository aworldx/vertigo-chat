// Package http exposes the stable public profile contract.
package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"chat/api/internal/profiles/application"
	"chat/api/internal/profiles/domain"
)

type Handler struct{ catalog application.Catalog }

func NewHandler(catalog application.Catalog) Handler { return Handler{catalog: catalog} }

func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/profiles", h.list)
	mux.HandleFunc("GET /api/v1/profiles/{nickname}", h.show)
}

type MediaHandler struct{ media application.MediaService }

func NewMediaHandler(media application.MediaService) MediaHandler { return MediaHandler{media: media} }

func (h MediaHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/profiles/{nickname}/photo", h.photo)
	mux.HandleFunc("GET /profiles/{nickname}/photo", h.photo)
	mux.HandleFunc("GET /profiles/{nickname}/photo/thumbnail", h.thumbnail)
	mux.HandleFunc("GET /api/v1/profiles/{nickname}/photo/thumbnail", h.thumbnail)
}

func (h MediaHandler) photo(w http.ResponseWriter, r *http.Request)     { h.send(w, r, false) }
func (h MediaHandler) thumbnail(w http.ResponseWriter, r *http.Request) { h.send(w, r, true) }

func (h MediaHandler) send(w http.ResponseWriter, r *http.Request, thumbnail bool) {
	media, err := h.media.Read(r.Context(), r.PathValue("nickname"), thumbnail)
	if errors.Is(err, application.ErrNotFound) {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", media.ContentType)
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(media.Bytes)
}

func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	if hasNestedProfileParameter(params) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_params", "Укажи запрос до 80 символов и положительный номер страницы.")
		return
	}
	query := params.Get("q")
	page, err := page(params.Get("page"))
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_params", "Укажи запрос до 80 символов и положительный номер страницы.")
		return
	}
	result, normalized, err := h.catalog.List(r.Context(), query, page)
	if err != nil {
		writeCatalogError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": profiles(result.Profiles), "meta": map[string]any{"page": result.Number, "page_size": result.Size, "total": result.Total, "total_pages": result.TotalPages, "query": normalized}})
}

func hasNestedProfileParameter(params map[string][]string) bool {
	for key := range params {
		if strings.HasPrefix(key, "q[") || strings.HasPrefix(key, "page[") {
			return true
		}
	}
	return false
}

func (h Handler) show(w http.ResponseWriter, r *http.Request) {
	profile, err := h.catalog.Get(r.Context(), r.PathValue("nickname"))
	if err != nil {
		writeCatalogError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": profileDTO(profile)})
}

func page(raw string) (int, error) {
	if raw == "" {
		return 1, nil
	}
	return strconv.Atoi(raw)
}
func profiles(input []domain.Profile) []map[string]any {
	result := make([]map[string]any, 0, len(input))
	for _, p := range input {
		result = append(result, profileDTO(p))
	}
	return result
}
func profileDTO(p domain.Profile) map[string]any {
	photoURL := any(nil)
	if p.HasPhoto {
		photoURL = "/profiles/" + p.Nickname + "/photo"
	}
	thumbnailURL := photoURL
	if p.HasThumbnail {
		thumbnailURL = "/profiles/" + p.Nickname + "/photo/thumbnail"
	}
	title, icon := rank(p.PublicMessageCount, p.ChatSeconds)
	return map[string]any{"nickname": p.Nickname, "name": p.Name, "birth_date": p.BirthDate, "gender": p.Gender, "about": p.About, "photo_url": photoURL, "thumbnail_url": thumbnailURL, "rank": map[string]string{"title": title, "icon_url": "/images/ranks/" + icon + ".svg"}, "progress": map[string]int{"public_messages": max(p.PublicMessageCount, 0), "chat_hours": max(p.ChatSeconds, 0) / 3600}}
}
func rank(messages, seconds int) (string, string) {
	ranks := []struct {
		title, icon     string
		messages, hours int
	}{{"Зритель первого ряда", "ticket", 0, 0}, {"Киноман", "users-group", 50, 5}, {"Статист", "armchair", 200, 20}, {"Исполнитель эпизода", "movie", 600, 60}, {"Актёр второго плана", "star", 1500, 150}, {"Звезда экрана", "device-tv", 3500, 350}, {"Сценарист", "file-text", 7000, 700}, {"Продюсер", "cash", 12000, 1200}, {"Режиссёр-постановщик", "camera", 20000, 2000}, {"Режиссер", "theater", 35000, 3500}}
	current := ranks[0]
	for _, candidate := range ranks {
		if messages >= candidate.messages && seconds >= candidate.hours*3600 {
			current = candidate
		}
	}
	return current.title, current.icon
}
func writeCatalogError(w http.ResponseWriter, err error) {
	if errors.Is(err, application.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Анкета не найдена.")
		return
	}
	writeError(w, http.StatusUnprocessableEntity, "invalid_params", "Укажи запрос до 80 символов и положительный номер страницы.")
}
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
