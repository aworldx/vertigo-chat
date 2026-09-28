package main

import (
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
	"time"
)

func testMessageHistory(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// The inherited schema stores sent_at at whole-second precision.
	now := time.Now().UTC().Truncate(time.Second)
	cutoff := rooms.HistoryCutoff(now)
	insert := func(room, kind, body string, at time.Time) int64 {
		t.Helper()
		var id int64
		err := tx.QueryRow(ctx, `INSERT INTO room_messages(room_id,kind,author,body,theme_id,appearance,font_id,font_style,sent_at,inserted_at,updated_at) VALUES($1,$2,'Styled',$3,'vertigo','{"dark":{"nickname_color":"#aabbcc","text_color":"#ddeeff"}}','serif','italic',$4,$4,$4) RETURNING id`, room, kind, body, at).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	room := "archive-test"
	insert(room, "text", "expired", cutoff.Add(-time.Second))
	first := insert(room, "text", "boundary", cutoff)
	insert(room, "private", "secret", now.Add(-time.Hour))
	insert("other-archive", "text", "other room", now.Add(-time.Hour))
	insert(room, "system", "joined", now.Add(-time.Hour))
	for range 102 {
		insert(room, "text", "public", now.Add(-time.Hour))
	}
	store := roompg.NewStore(tx)
	assertArchivePages(t, store, room, cutoff, now, first)
	if err := store.Prune(ctx, cutoff); err != nil {
		t.Fatal(err)
	}
	var old, kept int
	if err := tx.QueryRow(ctx, `SELECT count(*) FILTER(WHERE body='expired'),count(*) FILTER(WHERE id=$2) FROM room_messages WHERE room_id=$1`, room, first).Scan(&old, &kept); err != nil || old != 0 || kept != 1 {
		t.Fatal(old, kept, err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := store.History(cancelled, room, cutoff, now, 0, 101); err == nil {
		t.Fatal("cancel ignored")
	}
	if err := store.Prune(cancelled, cutoff); err == nil {
		t.Fatal("cancel ignored")
	}
}

func assertArchivePages(t *testing.T, store roompg.Store, room string, cutoff, now time.Time, first int64) {
	t.Helper()
	ctx := context.Background()
	messages, err := store.History(ctx, room, cutoff, now, 0, 101)
	if err != nil || len(messages) != 101 {
		t.Fatal(len(messages), err)
	}
	if messages[0].ID != first || messages[0].Appearance.Dark.Nickname != "#aabbcc" || messages[0].FontID != "serif" || messages[0].FontStyle != "italic" {
		t.Fatal(messages[0])
	}
	next, err := store.History(ctx, room, cutoff, now, messages[99].ID, 101)
	if err != nil || len(next) != 4 {
		t.Fatal(len(next), err)
	}
	recent, err := store.Recent(ctx, room)
	if err != nil || len(recent) != 100 {
		t.Fatal(len(recent), err)
	}
}
