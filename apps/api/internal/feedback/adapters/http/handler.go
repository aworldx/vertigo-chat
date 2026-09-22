package http

import (
	"chat/api/internal/feedback/application"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"
)

type Actor func(http.ResponseWriter, *http.Request) (int64, string, bool)
type Handler struct {
	service application.Service
	actor   Actor
}

func NewHandler(s application.Service, actor Actor) Handler { return Handler{s, actor} }
func (h Handler) Register(mux *http.ServeMux)               { mux.HandleFunc("POST /api/v1/chat/feedback", h.send) }
func (h Handler) send(w http.ResponseWriter, r *http.Request) {
	id, name, ok := h.actor(w, r)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
		Body string `json:"body"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10000))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF {
		http.Error(w, "invalid_input", http.StatusUnprocessableEntity)
		return
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		http.Error(w, "invalid_peer", http.StatusBadRequest)
		return
	}
	identity := "guest:" + host
	if id > 0 {
		identity = "user:" + strconv.FormatInt(id, 10)
		body.Name = name
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	err = h.service.Send(ctx, application.Entry{UserID: id, Name: body.Name, Body: body.Body, Identity: identity})
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		w.WriteHeader(422)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Проверь длину имени и сообщения. Лимит: 2 сообщения в минуту и 8 в час."})
		return
	}
	w.WriteHeader(201)
	_, _ = w.Write([]byte(`{"data":{"sent":true}}`))
}
