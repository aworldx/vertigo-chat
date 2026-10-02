package http

import (
	"chat/api/internal/notes/application"
	"chat/api/internal/notes/domain"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type Handler struct {
	service  application.Service
	identity Identity
}

func NewHandler(service application.Service, identity Identity) Handler {
	return Handler{service, identity}
}
func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/notes/summary", h.summary)
	mux.HandleFunc("GET /api/v1/notes", h.list)
	mux.HandleFunc("POST /api/v1/notes", h.send)
}

type inputDTO struct {
	Recipient string `json:"recipient"`
	Body      string `json:"body"`
}
type noteDTO struct {
	ID         int64  `json:"id"`
	Sender     string `json:"sender"`
	Recipient  string `json:"recipient"`
	Body       string `json:"body"`
	Read       bool   `json:"read"`
	InsertedAt string `json:"inserted_at"`
}

func (h Handler) user(w http.ResponseWriter, r *http.Request, mutation bool) (int64, bool) {
	user, status := h.identity(r, mutation)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return 0, false
	}
	return user, true
}
func (h Handler) summary(w http.ResponseWriter, r *http.Request) {
	user, ok := h.user(w, r, false)
	if !ok {
		return
	}
	count, err := h.service.Summary(r.Context(), user)
	if err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]int{"unread": count})
}
func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	user, ok := h.user(w, r, false)
	if !ok {
		return
	}
	incoming, outgoing, err := h.service.List(r.Context(), user)
	if err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]any{"incoming": encode(incoming), "outgoing": encode(outgoing)})
}
func (h Handler) send(w http.ResponseWriter, r *http.Request) {
	user, ok := h.user(w, r, true)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1200)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	var v inputDTO
	var extra any
	if d.Decode(&v) != nil || d.Decode(&extra) != io.EOF {
		failure(w, domain.ErrInvalid)
		return
	}
	id, err := h.service.Send(r.Context(), user, domain.Input{Recipient: v.Recipient, Body: v.Body})
	if err != nil {
		failure(w, err)
		return
	}
	respond(w, http.StatusCreated, map[string]int64{"id": id})
}
func encode(values []domain.Note) []noteDTO {
	result := make([]noteDTO, 0, len(values))
	for _, v := range values {
		result = append(result, noteDTO{v.ID, v.Sender, v.Recipient, v.Body, v.ReadAt != nil, v.InsertedAt.UTC().Format(time.RFC3339)})
	}
	return result
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func failure(w http.ResponseWriter, err error) {
	status, code := http.StatusServiceUnavailable, "unavailable"
	if errors.Is(err, domain.ErrInvalid) {
		status, code = http.StatusUnprocessableEntity, "invalid_note"
	}
	if errors.Is(err, domain.ErrRecipient) {
		status, code = http.StatusNotFound, "recipient_not_found"
	}
	if errors.Is(err, domain.ErrDaily) {
		status, code = http.StatusTooManyRequests, "note_daily_limit"
	}
	respond(w, status, map[string]string{"error": code})
}
