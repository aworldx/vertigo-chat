package application

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"time"
)

const HistoryHours = 48

type HistoryReader interface {
	// RecentVisits returns entries since the inclusive cutoff, newest first.
	RecentVisits(context.Context, time.Time) ([]domain.Visit, error)
}
type History struct{ reader HistoryReader }

func NewHistory(reader HistoryReader) History { return History{reader} }
func (h History) List(ctx context.Context, now time.Time) ([]domain.Visit, error) {
	since := now.UTC().Add(-HistoryHours * time.Hour).Truncate(time.Second)
	visits, err := h.reader.RecentVisits(ctx, since)
	if err != nil {
		return nil, err
	}
	return domain.CollapseActiveVisits(visits), nil
}
