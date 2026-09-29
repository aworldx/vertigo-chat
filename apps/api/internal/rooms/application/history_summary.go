package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"
)

const SummaryMessageLimit = 500
const SummaryByteLimit = 60000

var ErrSummaryLarge = errors.New("summary_period_too_large")
var ErrSummaryEmpty = errors.New("summary_empty")
var ErrSummaryBusy = errors.New("summary_busy")
var ErrSummaryUnavailable = errors.New("summary_unavailable")

type SummaryGenerator interface {
	Summarize(context.Context, int64, string) (string, error)
}
type HistorySummaryResult struct {
	Summary  string `json:"summary"`
	Messages int    `json:"messages"`
}
type HistorySummary struct {
	history   History
	generator SummaryGenerator
	mu        sync.Mutex
	busy      bool
	recent    map[int64]time.Time
}

func NewHistorySummary(history History, generator SummaryGenerator) *HistorySummary {
	return &HistorySummary{history: history, generator: generator, recent: make(map[int64]time.Time)}
}
func (s *HistorySummary) Summarize(ctx context.Context, actor int64, from, through string, filters domain.HistoryFilters, now time.Time) (HistorySummaryResult, error) {
	if actor <= 0 {
		return HistorySummaryResult{}, ErrActionDenied
	}
	if !s.acquire(actor, now) {
		return HistorySummaryResult{}, ErrSummaryBusy
	}
	defer func() { s.mu.Lock(); s.busy = false; s.mu.Unlock() }()
	transcript, count, err := s.transcript(ctx, from, through, filters, now)
	if err != nil {
		return HistorySummaryResult{}, err
	}
	s.mu.Lock()
	s.recent[actor] = now.Add(time.Minute)
	s.mu.Unlock()
	text, err := s.generator.Summarize(ctx, actor, transcript)
	if err != nil || strings.TrimSpace(text) == "" {
		return HistorySummaryResult{}, ErrSummaryUnavailable
	}
	return HistorySummaryResult{Summary: strings.TrimSpace(text), Messages: count}, nil
}
func (s *HistorySummary) acquire(actor int64, now time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, until := range s.recent {
		if !now.Before(until) {
			delete(s.recent, id)
		}
	}
	if s.busy || now.Before(s.recent[actor]) {
		return false
	}
	s.busy = true
	return true
}

type summaryLine struct {
	Time      string `json:"time_msk"`
	Author    string `json:"author"`
	Recipient string `json:"recipient,omitempty"`
	Kind      string `json:"kind"`
	Text      string `json:"text"`
}

func (s *HistorySummary) transcript(ctx context.Context, from, through string, filters domain.HistoryFilters, now time.Time) (string, int, error) {
	var out strings.Builder
	after, scanned, count := int64(0), 0, 0
	for {
		page, err := s.history.List(ctx, "lobby", from, through, after, now, filters)
		if err != nil {
			return "", 0, err
		}
		more := len(page) > HistoryPageSize
		if more {
			page = page[:HistoryPageSize]
		}
		scanned += len(page)
		if scanned > SummaryMessageLimit {
			return "", 0, ErrSummaryLarge
		}
		for _, message := range page {
			switch message.Kind {
			case "text", "music", "youtube", "gif":
			default:
				continue
			}
			line, err := json.Marshal(summaryLine{Time: message.SentAt.In(HistoryZone).Format("2006-01-02 15:04:05"), Author: message.Author, Recipient: message.Recipient, Kind: message.Kind, Text: message.Body})
			if err != nil {
				return "", 0, err
			}
			if out.Len()+len(line)+1 > SummaryByteLimit {
				return "", 0, ErrSummaryLarge
			}
			out.Write(line)
			out.WriteByte('\n')
			count++
		}
		if !more {
			break
		}
		after = page[len(page)-1].ID
	}
	if count == 0 {
		return "", 0, ErrSummaryEmpty
	}
	return out.String(), count, nil
}
