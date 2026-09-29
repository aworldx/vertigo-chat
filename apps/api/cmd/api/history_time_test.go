package main

import (
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"testing"
	"time"
)

func testHistoryMinuteWindow(t *testing.T, tx pgx.Tx) {
	t.Helper()
	ctx := context.Background()
	now := time.Now().UTC()
	minute := now.Add(-2 * time.Hour).Truncate(time.Minute)
	_, err := tx.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,recipient,body,theme_id,sent_at,inserted_at,updated_at)
 SELECT 'minute-test','text','Автор','Кому',n::text,'vertigo',$1::timestamp + n * interval '1 second',$1,$1
 FROM (VALUES (-1),(0),(59),(60)) AS f(n)`, minute)
	if err != nil {
		t.Fatal(err)
	}
	boundary := minute.In(rooms.HistoryZone).Format("2006-01-02T15:04")
	items, err := rooms.NewHistory(roompg.NewStore(tx)).List(ctx, "minute-test", boundary, boundary, 0, now, domain.HistoryFilters{Author: "автор", Recipient: "кому"})
	if err != nil || len(items) != 2 {
		t.Fatal(items, err)
	}
	if items[0].Body != "0" || items[1].Body != "59" {
		t.Fatal("selected minute must include seconds 00–59 only", items)
	}
}
