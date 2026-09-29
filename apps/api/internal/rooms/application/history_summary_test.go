package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type summaryArchive struct {
	data    []domain.Message
	err     error
	calls   int
	filters domain.HistoryFilters
}

func (s *summaryArchive) Prune(context.Context, time.Time) error { return nil }
func (s *summaryArchive) History(_ context.Context, _ string, _, _ time.Time, after int64, limit int, filters domain.HistoryFilters) ([]domain.Message, error) {
	s.calls++
	s.filters = filters
	if s.err != nil {
		return nil, s.err
	}
	var found []domain.Message
	for _, m := range s.data {
		if m.ID > after {
			found = append(found, m)
			if len(found) == limit {
				break
			}
		}
	}
	return found, nil
}

type summaryGeneratorFunc func(context.Context, int64, string) (string, error)

func (f summaryGeneratorFunc) Summarize(ctx context.Context, actor int64, text string) (string, error) {
	return f(ctx, actor, text)
}
func summaryMessages(count int) []domain.Message {
	var result []domain.Message
	for i := 0; i < count; i++ {
		result = append(result, domain.Message{ID: int64(i + 1), Kind: "text", Author: "Лиса", Recipient: "Марк", Body: "Обсуждаем кино", SentAt: time.Date(2026, 9, 29, 9, 0, 0, 0, time.UTC)})
	}
	return result
}

var summaryNow = time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)

func TestHistorySummaryReadsEveryPageAndExcludesPrivateData(t *testing.T) {
	store := &summaryArchive{data: summaryMessages(205)}
	store.data[0].Kind = "private"
	store.data[0].Body = "PRIVATE_SECRET"
	store.data[1].Kind = "system"
	store.data[1].Body = "SYSTEM"
	store.data[2].Kind = "tetris"
	store.data[2].Body = "GAME"
	var transcript string
	gen := summaryGeneratorFunc(func(_ context.Context, actor int64, text string) (string, error) {
		if actor != 7 {
			t.Fatal(actor)
		}
		transcript = text
		return "  Сводка  ", nil
	})
	service := NewHistorySummary(NewHistory(store), gen)
	result, err := service.Summarize(context.Background(), 7, "2026-09-29T10:00", "2026-09-29T15:00", domain.HistoryFilters{Author: " Лиса ", Recipient: " Марк "}, summaryNow)
	if err != nil || result.Messages != 202 || result.Summary != "Сводка" || store.calls != 3 || store.filters.Author != "Лиса" || store.filters.Recipient != "Марк" {
		t.Fatalf("%+v %v %+v", result, err, store)
	}
	if strings.Contains(transcript, "PRIVATE_SECRET") || strings.Contains(transcript, "SYSTEM") || strings.Contains(transcript, "GAME") || strings.Count(transcript, "Обсуждаем кино") != 202 || !strings.Contains(transcript, "2026-09-29 12:00:00") {
		t.Fatal("incorrect transcript")
	}
}
func TestHistorySummaryRejectsOversizedEmptyAndInvalidWindowsBeforeAI(t *testing.T) {
	for _, tc := range []struct {
		name                string
		data                []domain.Message
		from                string
		storeErr, errorWant error
	}{
		{"too many", summaryMessages(501), "2026-09-29", nil, ErrSummaryLarge},
		{"too much text", []domain.Message{{ID: 1, Kind: "text", Body: strings.Repeat("я", SummaryByteLimit)}}, "2026-09-29", nil, ErrSummaryLarge},
		{"empty", nil, "2026-09-29", nil, ErrSummaryEmpty},
		{"invalid", nil, "invalid", nil, ErrInvalidPeriod},
		{"database", nil, "2026-09-29", ErrSummaryUnavailable, ErrSummaryUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewHistorySummary(NewHistory(&summaryArchive{data: tc.data, err: tc.storeErr}), summaryGeneratorFunc(func(context.Context, int64, string) (string, error) { t.Fatal("AI must not run"); return "", nil }))
			_, err := service.Summarize(context.Background(), 1, tc.from, "2026-09-29", domain.HistoryFilters{}, summaryNow)
			if !errors.Is(err, tc.errorWant) {
				t.Fatal(err)
			}
		})
	}
}
func TestHistorySummaryBusyCooldownAndProviderFailures(t *testing.T) {
	start, finish := make(chan struct{}), make(chan struct{})
	service := NewHistorySummary(NewHistory(&summaryArchive{data: summaryMessages(1)}), summaryGeneratorFunc(func(context.Context, int64, string) (string, error) {
		close(start)
		<-finish
		return "Сводка", nil
	}))
	result := make(chan error, 1)
	go func() {
		_, err := service.Summarize(context.Background(), 1, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow)
		result <- err
	}()
	<-start
	_, err := service.Summarize(context.Background(), 2, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow)
	if !errors.Is(err, ErrSummaryBusy) {
		t.Fatal(err)
	}
	close(finish)
	if err := <-result; err != nil {
		t.Fatal(err)
	}
	_, err = service.Summarize(context.Background(), 1, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow.Add(30*time.Second))
	if !errors.Is(err, ErrSummaryBusy) {
		t.Fatal(err)
	}
	service.generator = summaryGeneratorFunc(func(context.Context, int64, string) (string, error) { return "", nil })
	_, err = service.Summarize(context.Background(), 1, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow.Add(time.Minute))
	if !errors.Is(err, ErrSummaryUnavailable) {
		t.Fatal(err)
	}
	service.generator = summaryGeneratorFunc(func(context.Context, int64, string) (string, error) { return "", errors.New("provider") })
	_, err = service.Summarize(context.Background(), 3, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow.Add(time.Minute))
	if !errors.Is(err, ErrSummaryUnavailable) {
		t.Fatal(err)
	}
	_, err = service.Summarize(context.Background(), 0, "2026-09-29", "2026-09-29", domain.HistoryFilters{}, summaryNow)
	if !errors.Is(err, ErrActionDenied) {
		t.Fatal(err)
	}
}
