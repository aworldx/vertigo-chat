// Package http exposes the internal Accounts boundary to the Phoenix BFF.
package http

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
)

type Handler struct {
	authenticator application.Authenticator
	registrar     application.Registrar
	token         string
}

func NewHandler(authenticator application.Authenticator, registrar application.Registrar, token string) Handler {
	return Handler{authenticator: authenticator, registrar: registrar, token: token}
}

func (h Handler) Register(mux *http.ServeMux) {
	if h.token == "" {
		return
	}
	mux.HandleFunc("POST /internal/v1/accounts/authenticate", h.authenticate)
	mux.HandleFunc("POST /internal/v1/accounts/register", h.register)
	mux.HandleFunc("GET /internal/v1/accounts/{userID}/principal", h.principal)
}

func (h Handler) register(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r) {
		return
	}
	var body struct {
		Nickname string `json:"nickname"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		writeError(w, http.StatusUnprocessableEntity)
		return
	}
	principal, err := h.registrar.Register(r.Context(), body.Nickname, body.Email, body.Password)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity)
		return
	}
	writePrincipal(w, principal)
}

func (h Handler) authenticate(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r) {
		return
	}
	var body struct {
		Nickname string `json:"nickname"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		writeError(w, http.StatusUnprocessableEntity)
		return
	}
	principal, err := h.authenticator.Authenticate(r.Context(), body.Nickname, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized)
		return
	}
	writePrincipal(w, principal)
}

func (h Handler) principal(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r) {
		return
	}
	userID, err := strconv.ParseInt(r.PathValue("userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity)
		return
	}
	principal, err := h.authenticator.Principal(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized)
		return
	}
	writePrincipal(w, principal)
}

func (h Handler) authorized(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("X-Internal-Accounts-Token") == h.token {
		return true
	}
	writeError(w, http.StatusUnauthorized)
	return false
}

func writePrincipal(w http.ResponseWriter, principal domain.Principal) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{
		"user_id": principal.UserID, "nickname": principal.Nickname,
		"roles": roles(principal),
	}})
}

func roles(principal domain.Principal) []string {
	roles := make([]string, 0, 2)
	if principal.HasRole("admin") {
		roles = append(roles, "admin")
	}
	if principal.HasRole("emoji_moderator") {
		roles = append(roles, "emoji_moderator")
	}
	return roles
}

func writeError(w http.ResponseWriter, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
}
