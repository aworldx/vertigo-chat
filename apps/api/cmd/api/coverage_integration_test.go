package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	chatpg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	chatdomain "chat/api/internal/chatsessions/domain"
	feedbackpg "chat/api/internal/feedback/adapters/postgres"
	feedback "chat/api/internal/feedback/application"
	feedbackdomain "chat/api/internal/feedback/domain"
	karmik "chat/api/internal/karmik/application"
	karmikdomain "chat/api/internal/karmik/domain"
	media "chat/api/internal/mediasearch/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

type botExchangeFunc func(context.Context, botdomain.Request, func(botdomain.Context) (botdomain.Result, error), func(botdomain.Result) error) (botdomain.Result, error)

func (f botExchangeFunc) Exchange(ctx context.Context, r botdomain.Request, g func(botdomain.Context) (botdomain.Result, error), p func(botdomain.Result) error) (botdomain.Result, error) {
	return f(ctx, r, g, p)
}
func (f *chatFixture) botPublication(t *testing.T) {
	ctx := context.Background()
	session := chatdomain.Session{ID: "session", IdentityKey: "guest:coverage", Nickname: "CoverageGuest", RoomID: "lobby"}
	for _, tc := range []struct {
		name     string
		err      error
		planning string
		delay    time.Duration
	}{
		{name: "reply"}, {name: "planning", planning: "2099-01-01"}, {name: "rate limited", err: botdomain.RateLimited{RetryAfter: time.Minute}, delay: time.Minute}, {name: "unavailable", err: botdomain.ErrUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := botExchangeFunc(func(_ context.Context, r botdomain.Request, _ func(botdomain.Context) (botdomain.Result, error), publish func(botdomain.Result) error) (botdomain.Result, error) {
				if r.Body != "Hello" || r.Nickname != session.Nickname || !strings.HasPrefix(r.Identity, "guest:") {
					t.Fatal(r)
				}
				if tc.err != nil {
					return botdomain.Result{}, tc.err
				}
				result := botdomain.Result{Text: "Reply", PlanningDate: tc.planning}
				return result, publish(result)
			})
			id := int64(20000 + len(tc.name))
			got := answerBot(f.pool, bot.NewService(store, nil), session, roomdomain.Message{ID: id, Body: "Хичкок, Hello"}, "192.0.2.1")
			if got != tc.delay {
				t.Fatal(got)
			}
			if tc.err == nil {
				var body string
				if err := f.pool.QueryRow(ctx, `SELECT body FROM room_messages WHERE client_id=$1`, fmt.Sprintf("public:%d", id)).Scan(&body); err != nil || body != "CoverageGuest, Reply" {
					t.Fatal(body, err)
				}
			}
		})
	}
	if botIdentity(chatdomain.Session{IdentityKey: "user:7"}, "") != "user:7" {
		t.Fatal("account identity lost")
	}
	if botIdentity(session, "") == botIdentity(session, "192.0.2.1") {
		t.Fatal("missing peer fallback ignored")
	}
}
func (f *chatFixture) feedbackLimits(t *testing.T) {
	ctx := context.Background()
	service := feedback.NewService(feedbackpg.NewStore(f.pool))
	for i := 0; i < 8; i++ {
		if i > 0 && i%2 == 0 {
			if _, err := f.pool.Exec(ctx, `UPDATE feedback_rate_events SET sent_at=now()-interval '2 minutes' WHERE identity_key='guest:coverage'`); err != nil {
				t.Fatal(err)
			}
		}
		err := service.Send(ctx, feedback.Entry{Name: "Guest", Body: "Useful feedback", Identity: "guest:coverage"})
		if err != nil {
			t.Fatal(i, err)
		}
		if i == 1 {
			if err := service.Send(ctx, feedback.Entry{Name: "Guest", Body: "Too soon", Identity: "guest:coverage"}); !errors.Is(err, feedbackdomain.ErrLimited) {
				t.Fatal(err)
			}
		}
	}
	if err := service.Send(ctx, feedback.Entry{Name: "Guest", Body: "Over hourly limit", Identity: "guest:coverage"}); !errors.Is(err, feedbackdomain.ErrLimited) {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE feedback_rate_events SET sent_at=now()-interval '2 hours' WHERE identity_key='guest:coverage'`); err != nil {
		t.Fatal(err)
	}
	if err := service.Send(ctx, feedback.Entry{Name: "Guest", Body: "After cooldown", Identity: "guest:coverage"}); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM feedback_rate_events WHERE identity_key='guest:coverage'`).Scan(&count); err != nil || count != 1 {
		t.Fatal(count, err)
	}
}
func (f *chatFixture) mediaPersistence(t *testing.T) {
	ctx := context.Background()
	lifecycle := chats.NewService(chatpg.NewStore(f.pool), chatsessionsPolicy())
	session, _, err := lifecycle.Start(ctx, chatdomain.Start{RoomID: "lobby", IdentityKey: "guest:media-coverage", Nickname: "MediaCoverage"})
	if err != nil {
		t.Fatal(err)
	}
	publish := sendRoomMedia(f.pool)
	invalid := media.Item{Kind: "music", Title: "Song", URL: "https://evil.example/file"}
	if _, err := publish(ctx, session, "invalid", invalid); err == nil {
		t.Fatal("foreign media accepted")
	}
	item := media.Item{Kind: "music", Title: "Song", URL: "https://sunproxy.net/file/test", Artist: "Artist", Duration: "1:00", Source: "https://mp3mn.net/t/test"}
	message, err := publish(ctx, session, "media-test", item)
	if err != nil || !message.Inserted || message.MediaURL != item.URL {
		t.Fatal(message, err)
	}
	duplicate, err := publish(ctx, session, "media-test", item)
	if err != nil || duplicate.Inserted || duplicate.ID != message.ID {
		t.Fatal(duplicate, err)
	}
	f.deleteMedia(t, message.ID)
	activated, err := lifecycle.Activate(ctx, session.ID, session.IdentityKey, session.Generation, time.Now())
	if err != nil || activated.Generation != session.Generation+1 {
		t.Fatal(activated, err)
	}
	if _, err := publish(ctx, session, "stale", item); err == nil {
		t.Fatal("stale session published media")
	}
}

func (f *chatFixture) accountPreferences(t *testing.T) {
	ctx := context.Background()
	preferences := preferencesService(f.pool)
	for _, identity := range []string{"user:invalid", "user:999999999"} {
		if _, err := preferences.Get(ctx, identity); err == nil {
			t.Fatal("unknown account preferences", identity)
		}
	}
	current, err := preferences.Get(ctx, "user:1")
	if err != nil {
		t.Fatal(err)
	}
	current.Style = "italic"
	current.Appearance.HideKarmik = true
	if _, err := preferences.Save(ctx, "user:1", current); err != nil {
		t.Fatal(err)
	}
	restored, err := preferences.Get(ctx, "user:1")
	if err != nil || !restored.Appearance.HideKarmik {
		t.Fatal("Karmik visibility was not persisted", restored, err)
	}
}

type karmikAssessFunc func(context.Context, karmikdomain.Input) ([]karmik.Assessment, karmik.Usage, error)

func (f karmikAssessFunc) Assess(ctx context.Context, in karmikdomain.Input) ([]karmik.Assessment, karmik.Usage, error) {
	return f(ctx, in)
}
func (f *chatFixture) karmikReview(t *testing.T) {
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, `TRUNCATE bot_daily_usages,bot_request_receipts; INSERT INTO room_messages(room_id,kind,author,body,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES('lobby','text','fixture05','A thoughtful message','vertigo','{}','{}','theme','normal',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`); err != nil {
		t.Fatal(err)
	}
	calls := 0
	provider := karmikAssessFunc(func(_ context.Context, in karmikdomain.Input) ([]karmik.Assessment, karmik.Usage, error) {
		calls++
		if len(in.EligibleIDs) == 0 {
			t.Fatal(in)
		}
		return nil, karmik.Usage{Input: 2, Output: 1, Total: 3}, nil
	})
	service := karmik.NewService(karmikStore{f.pool}, provider, karmikBudget{botpg.NewStore(f.pool, 10000, 180)})
	cursor, err := reviewKarmik(ctx, f.pool, service, 0)
	if err != nil || cursor == 0 || calls != 1 {
		t.Fatal(cursor, calls, err)
	}
	next, err := reviewKarmik(ctx, f.pool, service, cursor)
	if err != nil || next != cursor || calls != 1 {
		t.Fatal(next, calls, err)
	}
	budget, err := bot.NewBudgetReader(botpg.NewStore(f.pool, 10000, 180)).Read(ctx, time.Now())
	if err != nil || budget.Used != 3 {
		t.Fatal(budget, err)
	}
}

func (f *chatFixture) deleteMedia(t *testing.T, id int64) {
	t.Helper()
	ctx := context.Background()
	actions := rooms.NewActions(roompg.NewStore(f.pool))
	if err := actions.Delete(ctx, "lobby", id, false); !errors.Is(err, rooms.ErrActionDenied) {
		t.Fatal(err)
	}
	if err := actions.Delete(ctx, "lobby", id, true); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM room_messages WHERE id=$1`, id).Scan(&count); err != nil || count != 0 {
		t.Fatal(count, err)
	}
}

func (f *chatFixture) sessionStartRollback(t *testing.T) {
	ctx := context.Background()
	store := chatpg.NewStore(f.pool)
	lifecycle := chats.NewService(store)
	session, _, err := lifecycle.Start(ctx, chatdomain.Start{RoomID: "lobby", IdentityKey: "guest:rollback-coverage", Nickname: "RollbackGuest"})
	if err != nil {
		t.Fatal(err)
	}
	var before, after int
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM visits`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Start(ctx, session, "different-secret", nil); err == nil {
		t.Fatal("duplicate session was accepted")
	}
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM visits`).Scan(&after); err != nil || before != after {
		t.Fatal("failed start left an orphan visit", before, after, err)
	}
}
