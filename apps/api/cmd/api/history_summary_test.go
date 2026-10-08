package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

func testHistorySummaryPostgres(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Now().UTC().Truncate(time.Second)
	_, err = tx.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,recipient,body,theme_id,sent_at,inserted_at,updated_at)
 SELECT 'lobby','text','SummaryAuthor','SummaryTarget','Публичная фраза '||n::text,'vertigo',$1,$1,$1 FROM generate_series(1,105) AS n`, now.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,recipient,body,theme_id,sent_at,inserted_at,updated_at)
 VALUES ('lobby','private','SummaryAuthor','SummaryTarget','SECRET','vertigo',$1,$1,$1),
 ('lobby','text','SummaryAuthor','OtherTarget','WRONG_TARGET','vertigo',$1,$1,$1)`, now.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	budget := botpg.NewStore(pool, 120000, 180)
	before, err := budget.ReadBudget(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	provider := claireProviderFunc(func(_ context.Context, input botdomain.Context) (botdomain.Result, error) {
		assertSummaryTranscript(t, input)
		return botdomain.Result{Text: "Сводка", Input: 10, Output: 2, Total: 12}, nil
	})
	service := rooms.NewHistorySummary(rooms.NewHistory(roompg.NewStore(tx)), historyAI{bot.NewSummary(budget, provider)})
	from := now.Add(-time.Hour).In(rooms.HistoryZone).Format("2006-01-02T15:04")
	through := now.In(rooms.HistoryZone).Format("2006-01-02T15:04")
	result, err := service.Summarize(ctx, 1, from, through, domain.HistoryFilters{Author: "summaryauthor", Recipient: "summarytarget"}, now)
	if err != nil || result.Messages != 105 || result.Summary != "Сводка" {
		t.Fatal(result, err)
	}
	after, err := budget.ReadBudget(ctx, now)
	if err != nil || after.Used-before.Used != 12 {
		t.Fatal(before, after, err)
	}
	var conversations int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM bot_conversations WHERE subject_key='history:user:1'`).Scan(&conversations); err != nil || conversations != 0 {
		t.Fatal(conversations, err)
	}
}

func assertSummaryTranscript(t *testing.T, input botdomain.Context) {
	t.Helper()
	if len(input.Messages) != 1 || input.Memory != "" {
		t.Fatal("wrong summary context")
	}
	text := input.Messages[0].Content
	if strings.Contains(text, "SECRET") || strings.Contains(text, "WRONG_TARGET") || strings.Count(text, "Публичная фраза") != 105 {
		t.Fatal("wrong summary input")
	}
}

type historyAI struct{ service bot.Summary }

func (a historyAI) Summarize(ctx context.Context, actor int64, transcript string) (string, error) {
	return a.service.Summarize(ctx, "history:user:"+strconv.FormatInt(actor, 10), transcript)
}

func TestHistorySummaryDisabled(t *testing.T) {
	mux := http.NewServeMux()
	registerHistorySummary(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("POST", "/api/v1/chat/history/summary", strings.NewReader("{}")))
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "summary_unavailable") {
		t.Fatalf("summary still available: %d %s", response.Code, response.Body.String())
	}
}
