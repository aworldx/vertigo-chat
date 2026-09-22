package http

import (
	"chat/api/internal/entrance/application"
	"context"
	"encoding/json"
	"io"
	"mime"
	"net"
	"net/http"
)

type Upgrade func(context.Context, string, int, application.Input) (application.Result, error)

func (h Handler) WithUpgrade(upgrade Upgrade) Handler { h.upgrade = upgrade; return h }
func (h Handler) upgradeAccount(w http.ResponseWriter, r *http.Request) {
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
		Nickname   string `json:"nickname"`
		Password   string `json:"password"`
		Email      string `json:"email"`
		Token      string `json:"resume_token"`
		Generation int    `json:"generation"`
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
	result, err := h.upgrade(r.Context(), body.Token, body.Generation, application.Input{Nickname: body.Nickname, Password: body.Password, Email: body.Email, NetworkIdentity: host, PreviousAccountToken: previous, Register: true})
	if err != nil {
		writeFailure(w, err, true)
		return
	}
	h.setCookie(w, result.AccountToken, result.AccountExpires)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"resume_token": h.encode(result), "nickname": result.Session.Nickname}})
}
