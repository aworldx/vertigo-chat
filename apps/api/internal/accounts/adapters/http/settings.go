package http

import (
	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
	"encoding/json"
	"errors"
	"net/http"
)

type SettingsHandler struct {
	settings application.Settings
	identity func(*http.Request, bool) (int64, int)
}

func NewSettingsHandler(settings application.Settings, identity func(*http.Request, bool) (int64, int)) SettingsHandler {
	return SettingsHandler{settings, identity}
}
func (h SettingsHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/account/settings", h.read)
	mux.HandleFunc("PUT /api/v1/account/settings/email", h.save)
}
func (h SettingsHandler) actor(w http.ResponseWriter, r *http.Request, mutation bool) (int64, bool) {
	id, status := h.identity(r, mutation)
	if status != 0 {
		code := "unavailable"
		if status == http.StatusUnauthorized {
			code = "unauthorized"
		}
		if status == http.StatusForbidden {
			code = "forbidden"
		}
		writeError(w, status, code)
		return 0, false
	}
	return id, true
}
func (h SettingsHandler) read(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, false)
	if !ok {
		return
	}
	email, err := h.settings.Read(r.Context(), id)
	if err != nil {
		writeSettingsFailure(w, err)
		return
	}
	writeSettings(w, email)
}
func (h SettingsHandler) save(w http.ResponseWriter, r *http.Request) {
	id, ok := h.actor(w, r, true)
	if !ok {
		return
	}
	var body struct {
		Email *string `json:"email"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Email == nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_input")
		return
	}
	email, err := h.settings.Save(r.Context(), id, *body.Email)
	if err != nil {
		writeSettingsFailure(w, err)
		return
	}
	writeSettings(w, &email)
}
func writeSettings(w http.ResponseWriter, email *string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"email": email}})
}
func writeSettingsFailure(w http.ResponseWriter, err error) {
	codes := []struct {
		err  error
		code string
	}{
		{domain.ErrEmailRequired, "email_required"},
		{domain.ErrEmailInvalid, "email_invalid"},
		{domain.ErrEmailTooLong, "email_too_long"},
		{application.ErrEmailTaken, "email_taken"},
	}
	for _, candidate := range codes {
		if errors.Is(err, candidate.err) {
			writeError(w, http.StatusUnprocessableEntity, candidate.code)
			return
		}
	}
	if errors.Is(err, application.ErrAccountNotFound) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeFailure(w, err)
}
