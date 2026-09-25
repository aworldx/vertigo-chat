// Package http exposes the same-origin public Accounts API.
package http

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"time"

	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
)

type Handler struct {
	authenticator application.Authenticator
	registrar     application.Registrar
	sessions      application.Sessions
	origin        string
	cookieName    string
	secure        bool
}

func NewHandler(authenticator application.Authenticator, registrar application.Registrar, sessions application.Sessions, origin string) (Handler, error) {
	secure, err := validateOrigin(origin)
	if err != nil {
		return Handler{}, err
	}
	name := "__Host-chat_account"
	if !secure {
		name = "chat_account"
	}
	return Handler{authenticator: authenticator, registrar: registrar, sessions: sessions, origin: origin, cookieName: name, secure: secure}, nil
}

func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/auth/session", h.current)
	mux.HandleFunc("POST /api/v1/auth/login", h.login)
	mux.HandleFunc("POST /api/v1/auth/register", h.register)
	mux.HandleFunc("POST /api/v1/auth/logout", h.logout)
}

func (h Handler) current(w http.ResponseWriter, r *http.Request) {
	if !h.sameOrigin(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	token := h.token(r)
	record, err := h.sessions.Current(r.Context(), token, time.Now())
	if errors.Is(err, application.ErrInvalidSession) {
		token, record, err = h.sessions.Issue(r.Context(), "", 0, time.Now())
		if err == nil {
			h.setCookie(w, token, record.ExpiresAt)
		}
	}
	if err != nil {
		writeFailure(w, err)
		return
	}
	var principal *domain.Principal
	if record.UserID != 0 {
		found, err := h.authenticator.Principal(r.Context(), record.UserID)
		if err != nil {
			writeFailure(w, err)
			return
		}
		principal = &found
	}
	writeSession(w, principal, token)
}

type credentials struct {
	Nickname string `json:"nickname"`
	Password string `json:"password"`
}

func (h Handler) login(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r) {
		return
	}
	var body credentials
	if !decodeBody(w, r, &body) {
		return
	}
	principal, err := h.authenticator.Authenticate(r.Context(), body.Nickname, body.Password)
	if err != nil {
		writeFailure(w, err)
		return
	}
	h.signIn(w, r, principal)
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
	if !decodeBody(w, r, &body) {
		return
	}
	// The configured trusted-proxy middleware normalizes RemoteAddr. Never
	// consume caller-supplied forwarding headers inside business handlers.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_peer")
		return
	}
	principal, err := h.registrar.Register(r.Context(), body.Nickname, body.Email, body.Password, host)
	if err != nil {
		writeFailure(w, err)
		return
	}
	h.signIn(w, r, principal)
}

func (h Handler) signIn(w http.ResponseWriter, r *http.Request, principal domain.Principal) {
	token, record, err := h.sessions.Issue(r.Context(), h.token(r), principal.UserID, time.Now())
	if err != nil {
		writeFailure(w, err)
		return
	}
	h.setCookie(w, token, record.ExpiresAt)
	writeSession(w, &principal, token)
}

func (h Handler) logout(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(w, r) {
		return
	}
	if err := h.sessions.Revoke(r.Context(), h.token(r)); err != nil {
		writeFailure(w, err)
		return
	}
	h.setCookie(w, "", time.Unix(1, 0))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

func decodeBody(w http.ResponseWriter, r *http.Request, body any) bool {
	contentType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		writeError(w, http.StatusUnsupportedMediaType, "json_required")
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(body) != nil || decoder.Decode(new(any)) != io.EOF {
		writeError(w, http.StatusUnprocessableEntity, "invalid_input")
		return false
	}
	return true
}

type principalDTO struct {
	UserID   int64    `json:"user_id"`
	Nickname string   `json:"nickname"`
	Roles    []string `json:"roles"`
}

func writeSession(w http.ResponseWriter, principal *domain.Principal, token string) {
	var dto *principalDTO
	if principal != nil {
		dto = &principalDTO{UserID: principal.UserID, Nickname: principal.Nickname, Roles: roles(*principal)}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"principal": dto, "csrf_token": csrfToken(token)}})
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

func writeFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrInvalidCredentials), errors.Is(err, application.ErrInvalidSession):
		writeError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, application.ErrInvalidRegistration):
		writeError(w, http.StatusUnprocessableEntity, "invalid_registration")
	case errors.Is(err, application.ErrRegistrationLimited):
		writeError(w, http.StatusTooManyRequests, "registration_limited")
	default:
		writeError(w, http.StatusServiceUnavailable, "unavailable")
	}
}

func writeError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}
