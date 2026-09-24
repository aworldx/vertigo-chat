package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	botdomain "chat/api/internal/bot/domain"
	karmik "chat/api/internal/karmik/application"
	chartpg "chat/api/internal/musicchart/adapters/postgres"
	chart "chat/api/internal/musicchart/application"
	chartdomain "chat/api/internal/musicchart/domain"
	"context"
	"fmt"
	"testing"
	"time"
)

func (f *chatFixture) botBudget(t *testing.T) {
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, `TRUNCATE bot_daily_usages,bot_messages,bot_conversations,bot_request_receipts RESTART IDENTITY CASCADE`); err != nil {
		t.Fatal(err)
	}
	store := botpg.NewStore(f.pool, 50, 180).WithWarningPercent(90)
	summaries := 0
	for i := range 6 {
		published := false
		_, err := store.Exchange(ctx, botdomain.Request{ID: fmt.Sprintf("budget-%d", i), Identity: "guest:test-bot", Nickname: "Тест", Body: "Привет"}, func(input botdomain.Context) (botdomain.Result, error) {
			if input.Summarize {
				if !published {
					t.Fatal("summary delayed reply publication")
				}
				summaries++
				return botdomain.Result{Text: "Любит кино", Input: 1, Output: 1, Total: 2}, nil
			}
			return botdomain.Result{Text: "Ответ", Input: 5, Output: 2, Total: 7}, nil
		}, func(botdomain.Result) error { published = true; return nil })
		if err != nil {
			t.Fatal(err)
		}
	}
	if summaries != 1 {
		t.Fatal("summary interval changed", summaries)
	}
	if err := store.Spend(ctx, func() (botdomain.Result, error) { return botdomain.Result{Total: 1, Input: 1}, nil }); err != nil {
		t.Fatal("shared Karmik budget rejected", err)
	}
	called := false
	err := store.Spend(ctx, func() (botdomain.Result, error) { called = true; return botdomain.Result{}, nil })
	if err == nil || called {
		t.Fatal("shared daily budget bypassed")
	}
	var total int
	if err := f.pool.QueryRow(ctx, `SELECT sum(total_tokens) FROM bot_daily_usages`).Scan(&total); err != nil || total != 45 {
		t.Fatal("usage lost", total, err)
	}
	f.checkBudgetSnapshot(t, store)
}

func (f *chatFixture) checkBudgetSnapshot(t *testing.T, store botpg.Store) {
	t.Helper()
	ctx := context.Background()
	snapshot, err := store.ReadBudget(ctx, time.Now())
	if err != nil || snapshot.Used != 45 || snapshot.Limit != 50 || snapshot.Remaining != 5 || snapshot.Available != 0 {
		t.Fatal("budget snapshot", snapshot, err)
	}
	// Test the configured UTC+3 day boundary, independent of the host timezone.
	boundary := time.Date(2099, 1, 1, 21, 0, 0, 0, time.UTC)
	if _, err := f.pool.Exec(ctx, `INSERT INTO bot_daily_usages(usage_date,input_tokens,output_tokens,total_tokens,request_count,inserted_at,updated_at) VALUES('2099-01-01',10,0,10,1,NOW(),NOW())`); err != nil {
		t.Fatal(err)
	}
	before, err := store.ReadBudget(ctx, boundary.Add(-time.Second))
	if err != nil || before.Used != 10 {
		t.Fatal(before, err)
	}
	after, err := store.ReadBudget(ctx, boundary)
	if err != nil || after.Used != 0 || after.Available != 45 {
		t.Fatal(after, err)
	}
}
func (f *chatFixture) chart(t *testing.T) {
	ctx := context.Background()
	service := chart.NewService(chartpg.NewStore(f.pool))
	var owner, other int64
	if err := f.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname='fixture01'`).Scan(&owner); err != nil {
		t.Fatal(err)
	}
	if err := f.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname='fixture02'`).Scan(&other); err != nil {
		t.Fatal(err)
	}
	for i := range 5 {
		if err := service.Add(ctx, owner, fmt.Sprintf("Песня %d", i), chartdomain.Audio{Bytes: []byte("ID3-test"), ContentType: "audio/mpeg"}); err != nil {
			t.Fatal(err)
		}
	}
	if service.Add(ctx, owner, "Шестая", chartdomain.Audio{Bytes: []byte("ID3-test"), ContentType: "audio/mpeg"}) == nil {
		t.Fatal("track quota bypass")
	}
	tracks, err := service.List(ctx, owner)
	if err != nil || len(tracks) != 5 {
		t.Fatal(tracks, err)
	}
	id := tracks[0].ID
	if service.Like(ctx, owner, id, true) == nil || service.Rename(ctx, other, id, "Чужое") == nil {
		t.Fatal("ownership bypass")
	}
	checkChartInteractions(t, service, owner, other, id)
}
func checkChartInteractions(t *testing.T, service chart.Service, owner, other, id int64) {
	t.Helper()
	ctx := context.Background()
	for range 2 {
		if err := service.Like(ctx, other, id, true); err != nil {
			t.Fatal(err)
		}
	}
	if err := service.Comment(ctx, other, id, "Отличный трек"); err != nil {
		t.Fatal(err)
	}
	tracks, err := service.List(ctx, other)
	if err != nil || tracks[0].Likes != 1 || len(tracks[0].Comments) != 1 {
		t.Fatal("vote/comment persistence", tracks, err)
	}
}

func (f *chatFixture) karmikQuota(t *testing.T) {
	ctx := context.Background()
	var user int64
	var before int
	if err := f.pool.QueryRow(ctx, `SELECT id,karma FROM registered_users WHERE nickname='fixture03'`).Scan(&user, &before); err != nil {
		t.Fatal(err)
	}
	store := karmikStore{f.pool}
	var first int64
	for i := range 3 {
		var id int64
		if err := f.pool.QueryRow(ctx, `INSERT INTO room_messages(room_id,kind,author,body,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES('lobby','text','fixture03','Спасибо за помощь','vertigo','{}','{}','theme','normal',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') RETURNING id`).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			first = id
		}
		m := karmik.Message{ID: id, UserID: user, Author: "fixture03", Body: "Спасибо за помощь"}
		a := karmik.Assessment{MessageID: id, Verdict: "good", Reason: "Искренняя благодарность"}
		for range 2 {
			if err := store.Apply(ctx, m, a, 1); err != nil {
				t.Fatal(err)
			}
		}
	}
	var after, count int
	if err := f.pool.QueryRow(ctx, `SELECT karma,(SELECT count(*) FROM karmik_assessments WHERE user_id=$1) FROM registered_users WHERE id=$1`, user).Scan(&after, &count); err != nil {
		t.Fatal(err)
	}
	if after != before+2 || count != 2 {
		t.Fatal("Karmik quota/idempotency changed", after, before, count)
	}
	if ok, err := store.Eligible(ctx, user, first); err != nil || ok {
		t.Fatal("repeated assessment remained eligible", err)
	}
}
