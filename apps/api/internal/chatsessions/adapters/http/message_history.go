package http

import (
	rooms "chat/api/internal/rooms/application"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

type MessageHistoryHandler struct{ history rooms.History }

func NewMessageHistoryHandler(history rooms.History) MessageHistoryHandler {
	return MessageHistoryHandler{history}
}
func (h MessageHistoryHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/chat/history", h.list)
}
func (h MessageHistoryHandler) list(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	w.Header().Set("Content-Type", "application/json")
	after := int64(0)
	var err error
	if raw := r.URL.Query().Get("after"); raw != "" {
		after, err = strconv.ParseInt(raw, 10, 64)
	}
	if err != nil {
		http.Error(w, `{"error":"invalid_period"}`, http.StatusBadRequest)
		return
	}
	messages, err := h.history.List(r.Context(), "lobby", r.URL.Query().Get("from"), r.URL.Query().Get("through"), after, time.Now())
	if errors.Is(err, rooms.ErrInvalidPeriod) {
		http.Error(w, `{"error":"invalid_period"}`, http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	var next *int64
	if len(messages) > rooms.HistoryPageSize {
		messages = messages[:rooms.HistoryPageSize]
		id := messages[len(messages)-1].ID
		next = &id
	}
	data := make([]messageDTO, 0, len(messages))
	for _, message := range messages {
		value := encodeMessage(message)
		value.ClientID = ""
		data = append(data, value)
	}
	_ = json.NewEncoder(w).Encode(struct {
		Data []messageDTO `json:"data"`
		Next *int64       `json:"next"`
	}{data, next})
}
