package http

import (
	accounts "chat/api/internal/accounts/application"
	"chat/api/internal/entrance/application"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"time"
)

type Handler struct {
	service   application.Service
	authorize func(http.ResponseWriter, *http.Request) (string, bool)
	setCookie func(http.ResponseWriter, string, time.Time)
	encode    func(application.Result) string
}

func NewHandler(service application.Service, authorize func(http.ResponseWriter, *http.Request) (string, bool), setCookie func(http.ResponseWriter, string, time.Time), encode func(application.Result) string) Handler {
	return Handler{service, authorize, setCookie, encode}
}
func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/chat/enter", h.enter)
	mux.HandleFunc("POST /api/v1/chat/register", h.enter)
}
func (h Handler) enter(w http.ResponseWriter, r *http.Request) {
	previous, ok := h.authorize(w, r)
	if !ok {
		return
	}
	kind, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || kind != "application/json" {
		failure(w, 415, "json_required")
		return
	}
	var body struct {
		Nickname string `json:"nickname"`
		Password string `json:"password"`
		Email    string `json:"email"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		failure(w, 422, "invalid_input")
		return
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		failure(w, 400, "invalid_peer")
		return
	}
	result, err := h.service.Enter(r.Context(), application.Input{Nickname: body.Nickname, Password: body.Password, Email: body.Email, NetworkIdentity: host, PreviousAccountToken: previous, Register: r.URL.Path == "/api/v1/chat/register"})
	if err != nil {
		writeFailure(w, err, r.URL.Path == "/api/v1/chat/register")
		return
	}
	if result.AccountToken != "" {
		h.setCookie(w, result.AccountToken, result.AccountExpires)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"resume_token": h.encode(result), "nickname": result.Session.Nickname}})
}
func writeFailure(w http.ResponseWriter, err error, registering bool) {
	switch {
	case errors.Is(err, application.ErrInvalidNickname):
		if registering {
			failure(w, 422, "registration_nickname")
			return
		}
		failure(w, 422, "invalid_nickname")
	case errors.Is(err, application.ErrNicknameOnline):
		failure(w, 409, "nickname_online")
	case errors.Is(err, accounts.ErrPasswordRequired):
		failure(w, 401, "password_required")
	case errors.Is(err, accounts.ErrAccountNotFound):
		failure(w, 401, "not_found")
	case errors.Is(err, accounts.ErrInvalidCredentials):
		failure(w, 401, "invalid_password")
	case errors.Is(err, accounts.ErrRegistrationNickname):
		failure(w, 422, "registration_nickname")
	case errors.Is(err, accounts.ErrRegistrationPassword):
		failure(w, 422, "registration_password")
	case errors.Is(err, accounts.ErrRegistrationEmail):
		failure(w, 422, "registration_email")
	case errors.Is(err, accounts.ErrInvalidRegistration):
		failure(w, 422, "invalid_registration")
	case errors.Is(err, accounts.ErrRegistrationLimited):
		failure(w, 429, "registration_limited")
	case errors.Is(err, accounts.ErrInvalidSession):
		failure(w, 401, "session_changed")
	default:
		slog.Error("chat entrance failed", "error", err)
		failure(w, 503, "unavailable")
	}
}
func failure(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}
