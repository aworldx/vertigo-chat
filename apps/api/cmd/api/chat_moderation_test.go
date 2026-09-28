package main

import (
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testModerationStore(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	actions := rooms.NewActions(roompg.NewStore(tx))
	for _, kind := range []string{"text", "system"} {
		var id int64
		err = tx.QueryRow(ctx, `INSERT INTO room_messages(room_id,kind,author,body,theme_id,sent_at,inserted_at,updated_at) VALUES('moderation-test',$1,'author','message','vertigo',NOW(),NOW(),NOW()) RETURNING id`, kind).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		if !errors.Is(actions.Delete(ctx, "moderation-test", id, false), rooms.ErrActionDenied) {
			t.Fatal("non-admin deletion allowed")
		}
		if !errors.Is(actions.Delete(ctx, "other-room", id, true), rooms.ErrActionDenied) {
			t.Fatal("wrong room deletion allowed")
		}
		err = actions.Delete(ctx, "moderation-test", id, true)
		if kind == "system" && !errors.Is(err, rooms.ErrActionDenied) {
			t.Fatal("system deletion allowed")
		}
		if kind == "text" && err != nil {
			t.Fatal(err)
		}
	}
}
