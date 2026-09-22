// Package http exposes internal chat-session lifecycle commands to the BFF.
package http

import (
	"encoding/json"
	"net/http"
	"time"

	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
)

type Handler struct {
	service application.Service
	token   string
}

func NewHandler(service application.Service, token string) Handler {
	return Handler{service: service, token: token}
}

func (h Handler) Register(mux *http.ServeMux) {
	if h.token != "" {
		mux.HandleFunc("POST /internal/v1/chat-sessions/start", h.start)
		mux.HandleFunc("POST /internal/v1/chat-sessions/restore", h.restore)
		mux.HandleFunc("POST /internal/v1/chat-sessions/connection-lost", h.connectionLost)
		mux.HandleFunc("POST /internal/v1/chat-sessions/activate", h.activate)
		mux.HandleFunc("POST /internal/v1/chat-sessions/touch", h.touch)
		mux.HandleFunc("POST /internal/v1/chat-sessions/register-identity", h.registerIdentity)
		mux.HandleFunc("POST /internal/v1/chat-sessions/leave", h.leave)
	}
}

func (h Handler) start(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-Chat-Sessions-Token") != h.token {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var body struct {
		RoomID      string `json:"room_id"`
		IdentityKey string `json:"identity_key"`
		Nickname    string `json:"nickname"`
		UserID      *int64 `json:"user_id"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	session, secret, err := h.service.Start(r.Context(), domain.Start{RoomID: body.RoomID, IdentityKey: body.IdentityKey, Nickname: body.Nickname, UserID: body.UserID})
	if err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"session_id": session.ID, "room_id": session.RoomID, "nickname": session.Nickname, "identity_key": session.IdentityKey, "generation": session.Generation, "resume_secret": secret}})
}

func (h Handler) restore(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-Chat-Sessions-Token") != h.token {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var body struct {
		SessionID    string `json:"session_id"`
		IdentityKey  string `json:"identity_key"`
		ResumeSecret string `json:"resume_secret"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil {
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	session, err := h.service.Restore(r.Context(), body.SessionID, body.IdentityKey, body.ResumeSecret, time.Now().UTC())
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	writeSession(w, session.ID, session.RoomID, session.Nickname, session.Generation, "active")
}

func (h Handler) connectionLost(w http.ResponseWriter, r *http.Request) {
	body, ok := lifecycleRequest(w, r, h.token)
	if !ok {
		return
	}
	session, err := h.service.Reconnect(r.Context(), body.SessionID, body.IdentityKey, body.Generation, time.Now().UTC())
	if err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	writeSession(w, session.ID, session.RoomID, session.Nickname, session.Generation, string(session.Status))
}

func (h Handler) activate(w http.ResponseWriter, r *http.Request) {
	body, ok := lifecycleRequest(w, r, h.token)
	if !ok {
		return
	}
	session, err := h.service.Activate(r.Context(), body.SessionID, body.IdentityKey, body.Generation, time.Now().UTC())
	if err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	writeSession(w, session.ID, session.RoomID, session.Nickname, session.Generation, string(session.Status))
}

func (h Handler) touch(w http.ResponseWriter, r *http.Request) {
	body, ok := lifecycleRequest(w, r, h.token)
	if !ok {
		return
	}
	if err := h.service.Touch(r.Context(), body.SessionID, body.IdentityKey, body.Generation, body.Visibility, time.Now().UTC()); err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

func (h Handler) registerIdentity(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-Chat-Sessions-Token") != h.token {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	var body struct {
		SessionID   string `json:"session_id"`
		IdentityKey string `json:"identity_key"`
		Generation  int    `json:"generation"`
		UserID      int64  `json:"user_id"`
		Nickname    string `json:"nickname"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || body.SessionID == "" || body.IdentityKey == "" || body.Generation < 0 || body.UserID <= 0 || body.Nickname == "" {
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	session, secret, err := h.service.RegisterIdentity(r.Context(), body.SessionID, body.IdentityKey, body.Generation, body.UserID, body.Nickname, time.Now().UTC())
	if err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"session_id": session.ID, "identity_key": session.IdentityKey, "generation": session.Generation, "resume_secret": secret}})
}

func (h Handler) leave(w http.ResponseWriter, r *http.Request) {
	body, ok := lifecycleRequest(w, r, h.token)
	if !ok {
		return
	}
	session, err := h.service.End(r.Context(), body.SessionID, body.IdentityKey, body.Generation, time.Now().UTC())
	if err != nil {
		w.WriteHeader(http.StatusConflict)
		return
	}
	writeSession(w, session.ID, session.RoomID, session.Nickname, session.Generation, string(session.Status))
}

type lifecycleBody struct {
	SessionID   string `json:"session_id"`
	IdentityKey string `json:"identity_key"`
	Generation  int    `json:"generation"`
	Visibility  string `json:"visibility"`
}

func lifecycleRequest(w http.ResponseWriter, r *http.Request, token string) (lifecycleBody, bool) {
	if r.Header.Get("X-Internal-Chat-Sessions-Token") != token {
		w.WriteHeader(http.StatusUnauthorized)
		return lifecycleBody{}, false
	}
	var body lifecycleBody
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || body.SessionID == "" || body.IdentityKey == "" || body.Generation < 0 {
		w.WriteHeader(http.StatusUnprocessableEntity)
		return lifecycleBody{}, false
	}
	return body, true
}

func writeSession(w http.ResponseWriter, id, roomID, nickname string, generation int, status string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"session_id": id, "room_id": roomID, "nickname": nickname, "generation": generation, "status": status}})
}
