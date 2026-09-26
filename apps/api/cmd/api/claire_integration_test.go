package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	chatdomain "chat/api/internal/chatsessions/domain"
	roompg "chat/api/internal/rooms/adapters/postgres"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type claireProviderFunc func(context.Context, botdomain.Context) (botdomain.Result, error)

func (f claireProviderFunc) Generate(ctx context.Context, c botdomain.Context) (botdomain.Result, error) {
	return f(ctx, c)
}

func (f *chatFixture) claireConversation(t *testing.T) {
	ctx := context.Background()
	if _, err := f.pool.Exec(ctx, `UPDATE room_messages SET sent_at=(NOW() AT TIME ZONE 'UTC')-interval '2 minutes' WHERE author_identity IN ('bot:claire','bot:hitchcock')`); err != nil {
		t.Fatal(err)
	}
	store := botpg.NewStore(f.pool, 0, 180)
	provider := claireProviderFunc(func(_ context.Context, input botdomain.Context) (botdomain.Result, error) {
		if !strings.HasPrefix(input.Identity, "claire:") && !strings.HasPrefix(input.Identity, "ambient:") {
			t.Fatal("mixed persona memory", input.Identity)
		}
		if input.Summarize {
			return botdomain.Result{Text: "Любит музыку", Total: 2}, nil
		}
		return botdomain.Result{Text: "На кастинге перепутала дверь, зато нашла буфет!\n/music ABBA - Dancing Queen", Total: 10}, nil
	})
	claire := bot.NewService(store, provider).WithFallback(botdomain.Claire().Fallback)
	mediaCalls := 0
	media := &bot.Media{Now: time.Now, Publish: func(context.Context, string, string, string, string, func() bool) error { mediaCalls++; return nil }}
	session := chatdomain.Session{ID: "claire-test", IdentityKey: "guest:claire-test", Nickname: "ClaireGuest", RoomID: "lobby"}
	answerPersona(f.pool, claire, botdomain.Claire(), session, roomdomain.Message{ID: 900001, Body: "Клэр, Как кастинги?"}, "192.0.2.11", media)
	var author, body string
	if err := f.pool.QueryRow(ctx, `SELECT author,body FROM room_messages WHERE client_id='claire:public:900001'`).Scan(&author, &body); err != nil {
		t.Fatal(err)
	}
	if author != "Клэр" || strings.Contains(body, "/music") || !strings.HasPrefix(body, "ClaireGuest, ") {
		t.Fatal(author, body)
	}
	if mediaCalls != 1 {
		t.Fatal(mediaCalls)
	}
	f.checkAmbientReplies(t, claire, media)
	if mediaCalls != 1 {
		t.Fatal("media cooldown bypassed", mediaCalls)
	}
}

func (f *chatFixture) checkAmbientReplies(t *testing.T, claire bot.Service, media *bot.Media) {
	t.Helper()
	ctx := context.Background()
	talk := ambientTalk(f.pool, claire, claire, media)
	if text, err := talk(ctx, bot.Turn{Speaker: botdomain.Claire(), Body: "Начни беседу"}, func() bool { return false }); err != nil || text != "" {
		t.Fatal(text, err)
	}
	for _, speaker := range []botdomain.Persona{botdomain.Claire(), botdomain.Hitchcock()} {
		text, err := talk(ctx, bot.Turn{Speaker: speaker, Body: "Продолжи беседу"}, func() bool { return true })
		if err != nil || text == "" || strings.Contains(text, "/music") {
			t.Fatal(text, err)
		}
	}
	checks := 0
	if _, err := talk(ctx, bot.Turn{Speaker: botdomain.Claire(), Body: "Не публикуй устаревшую реплику"}, func() bool { checks++; return checks == 1 }); err == nil {
		t.Fatal("published after audience change")
	}
	audience, err := ambientAudience(f.pool)(ctx)
	if err != nil || audience.Humans < 0 {
		t.Fatal(audience, err)
	}
	var humans int
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM chat_sessions WHERE room_id='lobby' AND status IN ('active','reconnecting')`).Scan(&humans); err != nil || humans != audience.Humans {
		t.Fatal(humans, audience, err)
	}
}
func (f *chatFixture) ambientLeadership(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	store := botpg.NewStore(f.pool, 0, 180)
	started := make(chan struct{})
	done := make(chan error, 1)
	go func() { done <- store.AmbientLeader(ctx, func(ctx context.Context) { close(started); <-ctx.Done() }) }()
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("leader did not start")
	}
	if err := store.AmbientLeader(ctx, func(context.Context) { t.Error("second leader ran") }); err != nil {
		t.Fatal(err)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("leader did not stop")
	}
	if err := store.AmbientLeader(context.Background(), func(context.Context) {}); err != nil {
		t.Fatal("leadership not released", err)
	}
}

func (f *chatFixture) claireVideo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/youtube/search" {
			t.Error(r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"videos":[{"id":"dQw4w9WgXcQ","title":"Тестовый клип","duration":120}]}`))
	}))
	defer server.Close()
	t.Setenv("YOUTUBE_WORKER_URL", server.URL)
	m := claireMedia(f.pool)
	last, err := roompg.NewStore(f.pool).LastMediaByAuthor(context.Background(), "unused-room", "bot:claire")
	if err != nil || !last.IsZero() {
		t.Fatal(last, err)
	}
	if m.Ready(context.Background(), "unused-room") {
		t.Fatal("media allowed outside the quiet lobby")
	}
	if err := m.Publish(context.Background(), "lobby", "claire-video-test", "youtube", "test", func() bool { return true }); err != nil {
		t.Fatal(err)
	}
	var kind, author string
	f.checkClaireMediaCooldown(t)
	if err := f.pool.QueryRow(context.Background(), `SELECT kind,author FROM room_messages WHERE client_id='media:claire-video-test'`).Scan(&kind, &author); err != nil || kind != "youtube" || author != "Клэр" {
		t.Fatal(kind, author, err)
	}
	if err := m.Publish(context.Background(), "lobby", "claire-video-cancelled", "youtube", "test", func() bool { return false }); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := f.pool.QueryRow(context.Background(), `SELECT count(*) FROM room_messages WHERE client_id='media:claire-video-cancelled'`).Scan(&count); err != nil || count != 0 {
		t.Fatal(count, err)
	}
	if err := m.Publish(context.Background(), "lobby", "claire-video-invalid", "invalid", "test", nil); err == nil {
		t.Fatal("invalid media command")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	runAmbientLeader(ctx, f.pool, bot.Service{}, bot.Service{}, m)
	t.Setenv("OPENAI_API_KEY", "")
	runAmbient(ctx, f.pool, botpg.NewStore(f.pool, 0, 180), bot.Service{}, bot.Service{}, m)
}

func (f *chatFixture) checkClaireMediaCooldown(t *testing.T) {
	t.Helper()
	last, err := roompg.NewStore(f.pool).LastMediaByAuthor(context.Background(), "lobby", "bot:claire")
	if err != nil || last.IsZero() {
		t.Fatal(last, err)
	}
	if claireMedia(f.pool).Ready(context.Background(), "lobby") {
		t.Fatal("restart bypassed media cooldown")
	}
}
