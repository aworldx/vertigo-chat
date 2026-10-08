package main

import (
	"encoding/json"
	"net/http"
)

// Keep the endpoint explicit so stale clients cannot generate summaries.
func registerHistorySummary(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/chat/history/summary", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "summary_unavailable"})
	})
}
