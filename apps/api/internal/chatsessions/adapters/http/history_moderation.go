package http

import (
	rooms "chat/api/internal/rooms/application"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

func RegisterHistoryModeration(mux *http.ServeMux, moderation rooms.Moderation, identity func(*http.Request, bool) (int64, int), deleted func(string, int64)) {
	mux.HandleFunc("DELETE /api/v1/chat/history/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		actor, status := identity(r, true)
		if status != 0 {
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || id <= 0 {
			w.WriteHeader(400)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_message"})
			return
		}
		err = moderation.Delete(r.Context(), actor, "lobby", id)
		if err != nil {
			status = 503
			if errors.Is(err, rooms.ErrActionDenied) {
				status = 403
			}
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "action_rejected"})
			return
		}
		deleted("lobby", id)
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
	})
}

// MessageDeleted shares archive moderation with active and reconnecting sockets.
func (h Socket) MessageDeleted(room string, id int64) {
	h.hub.rememberDeletion(room, id)
	h.cache.invalidate()
}
