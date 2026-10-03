package http

import (
	"chat/api/internal/polls/application"
	"chat/api/internal/polls/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type ChatIdentity func(context.Context, string) (string, error)
type Role func(context.Context, int64) (bool, error)
type Handler struct {
	service application.Service
	account Identity
	session Identity
	chat    ChatIdentity
	admin   Role
}

func NewHandler(s application.Service, a Identity, session Identity, c ChatIdentity, admin Role) Handler {
	return Handler{s, a, session, c, admin}
}
func (h Handler) Register(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/polls", h.list)
	m.HandleFunc("GET /api/v1/polls/notices", h.notices)
	m.HandleFunc("POST /api/v1/polls/{id}/votes", h.vote)
	m.HandleFunc("GET /api/v1/admin/polls", h.list)
	m.HandleFunc("POST /api/v1/admin/polls", h.create)
	m.HandleFunc("POST /api/v1/admin/polls/{id}/close", h.close)
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func (h Handler) notices(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("X-Chat-Session")
	if token == "" {
		respond(w, 403, map[string]string{"error": "forbidden"})
		return
	}
	nickname, err := h.chat(r.Context(), token)
	if err != nil {
		respond(w, 403, map[string]string{"error": "forbidden"})
		return
	}
	polls, err := h.service.List(r.Context(), nickname)
	if err != nil {
		respond(w, 503, map[string]string{"error": "unavailable"})
		return
	}
	notices := make([]domain.Poll, 0, len(polls))
	for _, poll := range polls {
		if poll.Status == "open" && poll.SelectedOptionID == 0 {
			notices = append(notices, poll)
		}
	}
	respond(w, 200, map[string]any{"polls": notices})
}
func (h Handler) list(w http.ResponseWriter, r *http.Request) {
	nickname := ""
	if token := r.Header.Get("X-Chat-Session"); token != "" {
		var err error
		nickname, err = h.chat(r.Context(), token)
		if err != nil {
			respond(w, 403, map[string]string{"error": "forbidden"})
			return
		}
	}
	if strings.HasPrefix(r.URL.Path, "/api/v1/admin/") && !h.authorized(w, r, false) {
		return
	}
	p, err := h.service.List(r.Context(), nickname)
	if err != nil {
		respond(w, 503, map[string]string{"error": "unavailable"})
		return
	}
	respond(w, 200, map[string]any{"polls": p})
}
func (h Handler) vote(w http.ResponseWriter, r *http.Request) {
	if !h.authorizedVote(w, r) {
		return
	}
	nickname, err := h.chat(r.Context(), r.Header.Get("X-Chat-Session"))
	if err != nil {
		respond(w, 403, map[string]string{"error": "forbidden"})
		return
	}
	id, err := pathID(r, "/votes")
	if err != nil {
		fail(w, domain.ErrInvalid)
		return
	}
	var v struct {
		OptionID int64 `json:"option_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if err = h.service.Vote(r.Context(), id, nickname, v.OptionID); err != nil {
		fail(w, err)
		return
	}
	respond(w, 201, map[string]string{"status": "voted"})
}
func (h Handler) create(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r, true) {
		return
	}
	var v domain.Input
	if !decode(w, r, &v) {
		return
	}
	user, _ := h.account(r, true)
	p, err := h.service.Create(r.Context(), user, v)
	if err != nil {
		fail(w, err)
		return
	}
	respond(w, 201, map[string]any{"poll": p})
}
func (h Handler) close(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r, true) {
		return
	}
	id, err := pathID(r, "/close")
	if err != nil {
		fail(w, domain.ErrInvalid)
		return
	}
	if err = h.service.Close(r.Context(), id); err != nil {
		fail(w, err)
		return
	}
	respond(w, 200, map[string]string{"status": "closed"})
}
func (h Handler) authorizedVote(w http.ResponseWriter, r *http.Request) bool {
	_, status := h.session(r, true)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return false
	}
	return true
}
func (h Handler) authorized(w http.ResponseWriter, r *http.Request, mutation bool) bool {
	user, status := h.account(r, mutation)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return false
	}
	ok, err := h.admin(r.Context(), user)
	if err != nil {
		respond(w, 503, map[string]string{"error": "unavailable"})
		return false
	}
	if !ok {
		respond(w, 403, map[string]string{"error": "forbidden"})
		return false
	}
	return true
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8*1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	var extra any
	if d.Decode(v) != nil || d.Decode(&extra) != io.EOF {
		fail(w, domain.ErrInvalid)
		return false
	}
	return true
}
func pathID(r *http.Request, suffix string) (int64, error) {
	s := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/v1/"), suffix)
	p := strings.Split(s, "/")
	return strconv.ParseInt(p[len(p)-1], 10, 64)
}
func fail(w http.ResponseWriter, err error) {
	status, code := 503, "unavailable"
	switch {
	case errors.Is(err, domain.ErrInvalid):
		status, code = 422, "invalid_poll"
	case errors.Is(err, domain.ErrNotFound):
		status, code = 404, "poll_not_found"
	case errors.Is(err, domain.ErrClosed):
		status, code = 409, "poll_closed"
	case errors.Is(err, domain.ErrVoted):
		status, code = 409, "already_voted"
	}
	respond(w, status, map[string]string{"error": code})
}

var _ = time.RFC3339
