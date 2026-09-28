package main

import (
	roompg "chat/api/internal/rooms/adapters/postgres"
	"chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
	"time"
)

func testHistoryFilters(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Now().UTC().Truncate(time.Second)
	_, err = tx.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,recipient,body,theme_id,sent_at,inserted_at,updated_at)
 SELECT 'filter-test','text','Автор','Кому',n::text,'vertigo',$1,$1,$1 FROM generate_series(1,101) AS n;
 `, now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,recipient,body,theme_id,sent_at,inserted_at,updated_at)
 SELECT room,kind,author,recipient,'Кому, упоминание','vertigo',$1,$1,$1 FROM (VALUES
 ('filter-test','text','Автор2','Кому'),('filter-test','text','Автор','Другой'),
 ('filter-test','text','Автор',NULL),('filter-test','system','Автор','Кому'),
 ('filter-test','private','Автор','Кому'),('other-filter-room','text','Автор','Кому')
 ) AS f(room,kind,author,recipient)`, now.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	store := roompg.NewStore(tx)
	for _, tc := range []struct {
		filters domain.HistoryFilters
		want    int
	}{
		{domain.HistoryFilters{}, 105}, {domain.HistoryFilters{Author: "автор"}, 103},
		{domain.HistoryFilters{Recipient: "КОМУ"}, 102}, {domain.HistoryFilters{Author: "аВтОр", Recipient: "кОмУ"}, 101},
		{domain.HistoryFilters{Author: "Автор%"}, 0}, {domain.HistoryFilters{Recipient: "Ком"}, 0},
	} {
		messages, err := store.History(ctx, "filter-test", now.Add(-2*time.Hour), now, 0, 200, tc.filters)
		if err != nil || len(messages) != tc.want {
			t.Fatalf("%+v: got %d want %d: %v", tc.filters, len(messages), tc.want, err)
		}
	}
	filters := domain.HistoryFilters{Author: "Автор", Recipient: "Кому"}
	first, err := store.History(ctx, "filter-test", now.Add(-2*time.Hour), now, 0, 100, filters)
	if err != nil || len(first) != 100 {
		t.Fatal(len(first), err)
	}
	second, err := store.History(ctx, "filter-test", now.Add(-2*time.Hour), now, first[99].ID, 100, filters)
	if err != nil || len(second) != 1 || second[0].ID <= first[99].ID {
		t.Fatal(second, err)
	}
}
