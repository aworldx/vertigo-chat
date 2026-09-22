package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	entrancehttp "chat/api/internal/entrance/adapters/http"
	entrance "chat/api/internal/entrance/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"chat/api/migrations"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/jackc/pgx/v5/pgxpool"
)

type chatFixture struct {
	pool   *pgxpool.Pool
	server *httptest.Server
	client *http.Client
	csrf   string
}

func TestPublicChatPostgres(t *testing.T) {
	url := os.Getenv("GO_CHAT_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set GO_CHAT_TEST_DATABASE_URL to a disposable legacy-schema database")
	}
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	// Legacy utc_datetime columns have no zone. Never depend on the DB's zone.
	config.ConnConfig.RuntimeParams["timezone"] = "Asia/Kathmandu"
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()
	store := accountspg.NewAccounts(pool)
	auth, err := accountshttp.NewHandler(accounts.NewAuthenticator(store, accountspg.PBKDF2Verifier{}), accounts.NewRegistrar(registrationCreator{pool}, accountspg.PBKDF2Verifier{}), accounts.NewSessions(store), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	auth.Register(mux)
	entrancehttp.NewHandler(entrance.NewService(entranceWork(pool)), auth.AuthorizeMutation, auth.SetSessionCookie, func(result entrance.Result) string {
		return chatshttp.EncodeResume(chatshttp.Resume{SessionID: result.Session.ID, IdentityKey: result.Session.IdentityKey, Secret: result.ResumeSecret})
	}).Register(mux)
	lifecycle := chats.NewService(chatspg.NewStore(pool), chatsessionsPolicy())
	chatshttp.NewSocket(lifecycle, chatspg.NewStore(pool), rooms.NewService(roompg.NewStore(pool)), sendRoomMessage(pool), server.URL).Register(mux)
	jar, _ := cookiejar.New(nil)
	fixture := chatFixture{pool: pool, server: server, client: &http.Client{Jar: jar, Timeout: 5 * time.Second}}
	t.Run("guest protection and atomic registration", fixture.registration)
	t.Run("socket resume fencing outbox and terminal leave", fixture.socket)
}
func (f *chatFixture) refresh(t *testing.T) {
	t.Helper()
	response, err := f.client.Get(f.server.URL + "/api/v1/auth/session")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	var body struct {
		Data struct {
			CSRF string `json:"csrf_token"`
		}
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	f.csrf = body.Data.CSRF
}
func (f *chatFixture) post(t *testing.T, path, body string, status int) string {
	t.Helper()
	f.refresh(t)
	request, err := http.NewRequest("POST", f.server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", f.server.URL)
	request.Header.Set("X-CSRF-Token", f.csrf)
	response, err := f.client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	var result struct {
		Data struct {
			Resume string `json:"resume_token"`
		}
		Error string
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("%s status=%d want=%d error=%s", path, response.StatusCode, status, result.Error)
	}
	return result.Data.Resume
}
func (f *chatFixture) registration(t *testing.T) {
	f.post(t, "/api/v1/chat/enter", `{"nickname":"fixture01","password":""}`, 401)
	f.post(t, "/api/v1/chat/enter", `{"nickname":"Хичкок","password":""}`, 409)
	token := f.post(t, "/api/v1/chat/enter", `{"nickname":"guest-atomic","password":""}`, 200)
	f.post(t, "/api/v1/chat/register", `{"nickname":"guest-atomic","password":"secret123"}`, 409)
	f.post(t, "/api/v1/auth/register", `{"nickname":"guest-atomic","password":"secret123"}`, 422)
	var count int
	if err := f.pool.QueryRow(context.Background(), `SELECT count(*) FROM registered_users WHERE nickname='guest-atomic'`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("occupied guest name registered: %d %v", count, err)
	}
	conn, _ := f.connect(t, token)
	f.send(t, conn, map[string]string{"type": "leave"})
	f.frame(t, conn, "left")
	_ = conn.CloseNow()
	f.post(t, "/api/v1/chat/register", `{"nickname":"chat-registered","password":"secret123"}`, 200)
	if err := f.pool.QueryRow(context.Background(), `SELECT count(*) FROM visits WHERE nickname='chat-registered' AND user_id IS NOT NULL`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("registered entrance visit count=%d err=%v", count, err)
	}
}

type serverFrame struct {
	Type       string
	Generation int
	Message    struct {
		ID         int64
		Body       string
		SentAt     time.Time `json:"sent_at"`
		Appearance struct {
			Dark struct {
				Nickname string `json:"nickname_color"`
				Text     string `json:"text_color"`
			}
		}
		FontID    string `json:"font_id"`
		FontStyle string `json:"font_style"`
	}
}

func (f *chatFixture) connect(t *testing.T, token string) (*websocket.Conn, serverFrame) {
	t.Helper()
	ctx, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	conn, response, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(f.server.URL, "http")+"/api/v1/chat/socket", &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{f.server.URL}}})
	if err != nil {
		if response != nil {
			_ = response.Body.Close()
		}
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	f.send(t, conn, map[string]string{"type": "resume", "resume_token": token})
	return conn, f.frame(t, conn, "ready")
}
func (f *chatFixture) send(t *testing.T, conn *websocket.Conn, value any) {
	t.Helper()
	ctx, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	if err := wsjson.Write(ctx, conn, value); err != nil {
		t.Fatal(err)
	}
}
func (f *chatFixture) frame(t *testing.T, conn *websocket.Conn, kind string) serverFrame {
	t.Helper()
	ctx, done := context.WithTimeout(context.Background(), 5*time.Second)
	defer done()
	for {
		var frame serverFrame
		if err := wsjson.Read(ctx, conn, &frame); err != nil {
			t.Fatal(err)
		}
		if frame.Type == kind {
			return frame
		}
	}
}
func (f *chatFixture) socket(t *testing.T) {
	token := f.post(t, "/api/v1/chat/enter", `{"nickname":"fixture01","password":"secret123"}`, 200)
	conn, first := f.connect(t, token)
	f.messagePresentation(t, conn)
	newer, second := f.connect(t, token)
	if second.Generation <= first.Generation {
		t.Fatal("restore did not fence old connection")
	}
	resume, err := chatshttp.DecodeResume(token)
	if err != nil {
		t.Fatal(err)
	}
	lifecycle := chats.NewService(chatspg.NewStore(f.pool), chatsessionsPolicy())
	if _, err := lifecycle.End(context.Background(), resume.SessionID, resume.IdentityKey, first.Generation, time.Now()); err == nil {
		t.Fatal("old generation ended new connection")
	}
	f.send(t, newer, map[string]string{"type": "leave"})
	f.frame(t, newer, "left")
	var count int
	if err := f.pool.QueryRow(context.Background(), `SELECT count(*) FROM room_messages WHERE body='из чата выходит fixture01'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("departure count=%d err=%v", count, err)
	}
	if _, err := lifecycle.Restore(context.Background(), resume.SessionID, resume.IdentityKey, resume.Secret, time.Now()); err == nil {
		t.Fatal("ended session restored")
	}
}

func (f *chatFixture) messagePresentation(t *testing.T, conn *websocket.Conn) {
	t.Helper()
	f.send(t, conn, map[string]string{"type": "send", "client_id": "test-outbox", "body": "привет"})
	ack := f.frame(t, conn, "ack")
	f.checkMessageClock(t, ack.Message.SentAt)

	if ack.Message.Appearance.Dark.Nickname != "#fcd34d" || ack.Message.Appearance.Dark.Text != "#e4e4e7" || ack.Message.FontID != "theme" || ack.Message.FontStyle != "normal" {
		t.Fatalf("default message presentation: %+v", ack.Message)
	}
	// A replay must return the persisted presentation, not reset it to send defaults.
	if _, err := f.pool.Exec(context.Background(), `UPDATE room_messages SET appearance='{"dark":{"nickname_color":"#ABCDEF","text_color":"#123456"}}',font_id='serif',font_style='italic' WHERE id=$1`, ack.Message.ID); err != nil {
		t.Fatal(err)
	}

	f.send(t, conn, map[string]string{"type": "send", "client_id": "test-outbox", "body": "different retry"})
	again := f.frame(t, conn, "ack")
	if ack.Message.ID != again.Message.ID || again.Message.Body != "привет" {
		t.Fatalf("duplicate outbox changed history: %+v %+v", ack, again)
	}
	if again.Message.Appearance.Dark.Nickname != "#abcdef" || again.Message.Appearance.Dark.Text != "#123456" || again.Message.FontID != "serif" || again.Message.FontStyle != "italic" {
		t.Fatalf("stored presentation on replay: %+v", again.Message)
	}
}

func (f *chatFixture) checkMessageClock(t *testing.T, sentAt time.Time) {
	t.Helper()
	if elapsed := time.Since(sentAt); elapsed < -time.Second || elapsed > 10*time.Second {
		t.Fatalf("message timestamp is not UTC: %v", sentAt)
	}
	var enteredAt time.Time
	if err := f.pool.QueryRow(context.Background(), `SELECT entered_at FROM visits WHERE nickname='fixture01' ORDER BY id DESC LIMIT 1`).Scan(&enteredAt); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(enteredAt); elapsed < -time.Second || elapsed > 10*time.Second {
		t.Fatalf("entrance timestamp is not UTC: %v", enteredAt)
	}

}
