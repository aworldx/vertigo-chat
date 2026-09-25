package main

import (
	"chat/api/internal/bot/adapters/openai"
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatdomain "chat/api/internal/chatsessions/domain"
	"chat/api/internal/observability"
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

func botReplies(pool *pgxpool.Pool, metrics *observability.Metrics, lifecycle ...context.Context) (chatshttp.BotReply, func(context.Context) bool) {
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
	provider.Observe = metrics.OpenAIObserver("hitchcock")
	provider.ObserveHeaders = metrics.OpenAIHeaders("hitchcock")
	service := bot.NewService(store, provider)
	claireProvider := openai.NewProvider(os.Getenv("OPENAI_API_KEY"), env("OPENAI_BOT_MODEL", "gpt-5.6-terra"))
	claireProvider.PersonaInstructions = botdomain.ClaireInstructions
	claireProvider.Client.Timeout = botTimeout()
	claireProvider.Observe = metrics.OpenAIObserver("claire")
	claireProvider.ObserveHeaders = metrics.OpenAIHeaders("claire")
	claire := bot.NewService(store, claireProvider).WithFallback(botdomain.Claire().Fallback)
	music := claireMedia(pool)
	if len(lifecycle) > 0 {
		go runAmbient(lifecycle[0], pool, store, service, claire, music)
	}
	type work struct {
		session chatdomain.Session
		message roomdomain.Message
		ip      string
		persona botdomain.Persona
	}
	queue := make(chan work, 32)
	go func() {
		for job := range queue {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			ready := available(ctx)
			cancel()
			if ready {
				chosen := service
				if job.persona.ID == "claire" {
					chosen = claire
				}
				if delay := answerPersona(pool, chosen, job.persona, job.session, job.message, job.ip, music); delay > 0 {
					busyUntil.Store(time.Now().Add(delay).UnixMilli())
				}
			}
		}
	}()
	return func(session chatdomain.Session, message roomdomain.Message, ip string) {
		persona, addressed := botdomain.Addressed(message.Body)
		if !message.Inserted || !addressed || message.Kind == "private" {
			return
		}
		select {
		case queue <- work{session, message, ip, persona}:
		default:
			slog.Info("bot queue full")
		}
	}, available
}
func answerBot(pool *pgxpool.Pool, service bot.Service, session chatdomain.Session, message roomdomain.Message, ip string) time.Duration {
	return answerPersona(pool, service, botdomain.Hitchcock(), session, message, ip, nil)
}

func answerPersona(pool *pgxpool.Pool, service bot.Service, persona botdomain.Persona, session chatdomain.Session, message roomdomain.Message, ip string, media *bot.Media) time.Duration {

	ctx, cancel := context.WithTimeout(context.Background(), 3*botTimeout())
	defer cancel()
	id := "public:" + strconv.FormatInt(message.ID, 10)
	identity := botIdentity(session, ip)
	if persona.ID == "claire" {
		identity = "claire:" + identity
		id = "claire:" + id
	}
	result, err := service.Answer(ctx, bot.Request{ID: id, Identity: identity, Nickname: session.Nickname, Body: strings.TrimSpace(strings.TrimPrefix(message.Body, persona.Name+","))}, func(reply botdomain.Result) error {
		text, kind, query := botdomain.MediaSuggestion(reply.Text)
		_, err := sendBotMessage(ctx, pool, roomdomain.Author{Recipient: session.Nickname, RoomID: session.RoomID, Identity: "bot:" + persona.ID, Nickname: persona.Name}, id, session.Nickname+", "+text)
		if err == nil && persona.ID == "claire" && media != nil {
			media.Suggest(ctx, session.RoomID, id, kind, query, nil)
		}
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
	if result.PlanningDate != "" && persona.ID == "hitchcock" {
		_, err = sendBotMessage(ctx, pool, roomdomain.Author{RoomID: session.RoomID, Identity: "bot:hitchcock", Nickname: "Хичкок"}, "planning:"+result.PlanningDate, "Господа, я ухожу на планёрку. Даже саспенсу нужен бюджет. Вернусь завтра.")
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
