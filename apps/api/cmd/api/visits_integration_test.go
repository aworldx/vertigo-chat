package main

import (
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	"context"
	"reflect"
	"testing"
	"time"
)

func (f *chatFixture) visitHistory(t *testing.T) {
	ctx := context.Background()
	tx, err := f.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
	const query = `INSERT INTO visits(nickname,identity_key,entered_at,left_at,inserted_at,updated_at)
 VALUES($1,$2,$3::timestamptz AT TIME ZONE 'UTC',$4::timestamptz AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`
	for index, record := range []struct {
		nick     string
		age      time.Duration
		finished bool
	}{
		{"boundary", 48 * time.Hour, true}, {"excluded", 48*time.Hour + time.Second, true},
		{"repeat", time.Hour, false}, {"repeat", 2 * time.Hour, false}, {"repeat", 2 * time.Hour, true},
	} {
		var left *time.Time
		if record.finished {
			left = &now
		}
		if _, err = tx.Exec(ctx, query, record.nick, "history-test-"+string(rune('a'+index)), now.Add(-record.age), left); err != nil {
			t.Fatal(err)
		}
	}
	history, err := chats.NewHistory(chatspg.NewStore(tx)).List(ctx, now.Add(500*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	names := []string{}
	for _, v := range history {
		names = append(names, v.Nickname)
	}
	if !reflect.DeepEqual(names, []string{"repeat", "repeat", "boundary"}) {
		t.Fatal(names)
	}
	if !history[0].EnteredAt.Equal(now.Add(-time.Hour)) || history[0].LeftAt != nil || history[1].LeftAt == nil {
		t.Fatal("history timestamps/status")
	}
}
