package http

import (
	rooms "chat/api/internal/rooms/application"
	"chat/api/internal/rooms/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

type HistorySummarizer interface {
	Summarize(context.Context, int64, string, string, domain.HistoryFilters, time.Time) (rooms.HistorySummaryResult, error)
}

func RegisterHistorySummary(mux *http.ServeMux, service HistorySummarizer, identity func(*http.Request, bool) (int64, int)) {
	mux.HandleFunc("POST /api/v1/chat/history/summary", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		actor, status := identity(r, true)
		if status != 0 {
			summaryError(w, status, "forbidden")
			return
		}
		var input struct {
			From      string `json:"from"`
			Through   string `json:"through"`
			Author    string `json:"author"`
			Recipient string `json:"recipient"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			summaryError(w, 400, "invalid_period")
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF {
			summaryError(w, 400, "invalid_period")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
		defer cancel()
		result, err := service.Summarize(ctx, actor, input.From, input.Through, domain.HistoryFilters{Author: input.Author, Recipient: input.Recipient}, time.Now())
		if err != nil {
			status, code := summaryFailure(err)
			summaryError(w, status, code)
			return
		}
		_ = json.NewEncoder(w).Encode(result)
	})
}
func summaryFailure(err error) (int, string) {
	switch {
	case errors.Is(err, rooms.ErrInvalidPeriod):
		return 400, "invalid_period"
	case errors.Is(err, rooms.ErrSummaryLarge):
		return 422, "summary_period_too_large"
	case errors.Is(err, rooms.ErrSummaryEmpty):
		return 422, "summary_empty"
	case errors.Is(err, rooms.ErrSummaryBusy):
		return 429, "summary_busy"
	default:
		return 503, "summary_unavailable"
	}
}
func summaryError(w http.ResponseWriter, status int, code string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}
