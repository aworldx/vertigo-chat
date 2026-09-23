package http

import (
	"chat/api/internal/chatsessions/application"
	"encoding/json"
	"net/http"
	"time"
)

type HistoryHandler struct{ history application.History }

func NewHistoryHandler(history application.History) HistoryHandler { return HistoryHandler{history} }
func (h HistoryHandler) Register(mux *http.ServeMux)               { mux.HandleFunc("GET /api/v1/visits", h.list) }
func (h HistoryHandler) list(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	visits, err := h.history.List(r.Context(), time.Now())
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "unavailable"})
		return
	}
	type visitDTO struct {
		ID        int64   `json:"id"`
		Nickname  string  `json:"nickname"`
		EnteredAt string  `json:"entered_at"`
		LeftAt    *string `json:"left_at"`
	}
	data := make([]visitDTO, 0, len(visits))
	for _, visit := range visits {
		var leftAt *string
		if visit.LeftAt != nil {
			value := visit.LeftAt.UTC().Format(time.RFC3339)
			leftAt = &value
		}
		data = append(data, visitDTO{visit.ID, visit.Nickname, visit.EnteredAt.UTC().Format(time.RFC3339), leftAt})
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"data": data, "meta": map[string]int{"history_hours": application.HistoryHours}})
}
