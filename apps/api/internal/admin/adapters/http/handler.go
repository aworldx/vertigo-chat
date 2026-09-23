package http

import (
	"chat/api/internal/admin/application"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)

func Register(m *http.ServeMux, d application.Database, identity Identity) {
	m.HandleFunc("GET /api/v1/admin/database", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Robots-Tag", "noindex, nofollow")
		user, status := identity(r, false)
		if status != 0 {
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		v, err := d.Read(ctx, user, r.URL.Query().Get("table"))
		if err != nil {
			status = 503
			if errors.Is(err, application.ErrForbidden) {
				status = 403
			}
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "unavailable"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"tables": v.Tables, "columns": v.Columns, "rows": v.Rows, "selected_table": v.Selected})
	})
}
