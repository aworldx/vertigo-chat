package main

import (
	"chat/api/internal/bot/adapters/openai"
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatdomain "chat/api/internal/chatsessions/domain"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

func botReplies(pool *pgxpool.Pool) (chatshttp.BotReply, func(context.Context) bool) {
	limit, _ := strconv.Atoi(env("OPENAI_BOT_DAILY_TOKEN_LIMIT", "120000"))
	offset := botUTCOffset()
	percent, _ := strconv.Atoi(env("OPENAI_BOT_TOKEN_WARNING_PERCENT", "90"))
	store := botpg.NewStore(pool, limit, offset).WithWarningPercent(percent)
	var busyUntil atomic.Int64
	available := func(ctx context.Context) bool {
		return time.Now().UnixMilli() >= busyUntil.Load() && store.Available(ctx)
	}
	provider := openai.NewProvider(os.Getenv("OPENAI_API_KEY"), env("OPENAI_BOT_MODEL", "gpt-5.6-terra"))
	provider.Client.Timeout = botTimeout()
	service := bot.NewService(store, provider)
	type work struct {
		session chatdomain.Session
		message roomdomain.Message
		ip      string
	}
	queue := make(chan work, 32)
	go func() {
		for job := range queue {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			ready := available(ctx)
			cancel()
			if ready {
				if delay := answerBot(pool, service, job.session, job.message, job.ip); delay > 0 {
					busyUntil.Store(time.Now().Add(delay).UnixMilli())
				}
			}
		}
	}()
	return func(session chatdomain.Session, message roomdomain.Message, ip string) {
		if !message.Inserted || !strings.HasPrefix(message.Body, "Хичкок,") {
			return
		}
		select {
		case queue <- work{session, message, ip}:
		default:
			slog.Info("bot queue full")
		}
	}, available
}
func answerBot(pool *pgxpool.Pool, service bot.Service, session chatdomain.Session, message roomdomain.Message, ip string) time.Duration {

	ctx, cancel := context.WithTimeout(context.Background(), 3*botTimeout())
	defer cancel()
	id := "public:" + strconv.FormatInt(message.ID, 10)
	result, err := service.Answer(ctx, bot.Request{ID: id, Identity: botIdentity(session, ip), Nickname: session.Nickname, Body: strings.TrimSpace(strings.TrimPrefix(message.Body, "Хичкок,"))}, func(reply botdomain.Result) error {
		_, err := rooms.NewService(roompg.NewStore(pool)).Send(ctx, roomdomain.Author{Recipient: session.Nickname, RoomID: session.RoomID, Identity: "bot:hitchcock", Nickname: "Хичкок"}, id, session.Nickname+", "+reply.Text)
		return err
	})
	if err != nil {
		slog.Info("bot unavailable")
		var limited botdomain.RateLimited
		if errors.As(err, &limited) {
			return limited.RetryAfter
		}
		return 0
	}
	if result.PlanningDate != "" {
		_, err = rooms.NewService(roompg.NewStore(pool)).Send(ctx, roomdomain.Author{RoomID: session.RoomID, Identity: "bot:hitchcock", Nickname: "Хичкок"}, "planning:"+result.PlanningDate, "Господа, я ухожу на планёрку. Даже саспенсу нужен бюджет. Вернусь завтра.")
		if err != nil {
			slog.Warn("publish bot planning failed", "error", err)
		}
	}
	return 0
}

func botIdentity(session chatdomain.Session, ip string) string {
	if strings.HasPrefix(session.IdentityKey, "user:") {
		return session.IdentityKey
	}
	if ip == "" {
		ip = session.ID
	}
	digest := sha256.Sum256([]byte(ip + ":" + strings.ToLower(session.Nickname)))
	return "guest:" + base64.RawURLEncoding.EncodeToString(digest[:])
}

func botTimeout() time.Duration {
	millis, err := strconv.Atoi(env("OPENAI_BOT_RECEIVE_TIMEOUT_MS", "120000"))
	if err != nil || millis < 30000 {
		millis = 120000
	}
	return time.Duration(millis) * time.Millisecond
}
func botUTCOffset() int {
	offset, err := strconv.Atoi(env("OPENAI_BOT_UTC_OFFSET_MINUTES", "180"))
	if err != nil || offset < -720 || offset > 840 {
		return 180
	}
	return offset
}
