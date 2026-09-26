package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	chatpg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	mathrand "math/rand/v2"
	"os"
	"strings"
	"time"
)

func ambientAudience(pool *pgxpool.Pool) func(context.Context) (bot.Audience, error) {
	presence := chats.NewPresence(chatpg.NewStore(pool))
	history := rooms.NewService(roompg.NewStore(pool))
	return func(ctx context.Context) (bot.Audience, error) {
		var audience bot.Audience
		sessions, err := presence.List(ctx, "lobby")
		if err != nil {
			return audience, err
		}
		// Presence includes reconnecting humans: they still occupy the room and
		// must not temporarily make the bots believe somebody is alone.
		audience.Humans = len(sessions)
		messages, err := history.Recent(ctx, "lobby")
		for _, message := range messages {
			if strings.HasPrefix(message.ClientID, "ambient:") && message.Kind == "text" {
				speaker := "hitchcock"
				if message.Author == "Клэр" {
					speaker = "claire"
				}
				audience.History = append(audience.History, bot.AmbientMessage{Speaker: speaker, Body: message.Body, SentAt: message.SentAt})
			}
			if message.Author != "Хичкок" && message.Author != "Клэр" && message.Kind != "system" && message.SentAt.After(audience.LastHuman) {
				audience.LastHuman = message.SentAt
			}
		}
		return audience, err
	}
}
func runAmbient(ctx context.Context, pool *pgxpool.Pool, store botpg.Store, hitchcock, claire bot.Service, media *bot.Media) {
	if os.Getenv("OPENAI_API_KEY") == "" || env("CLAIRE_AMBIENT_ENABLED", "true") == "false" {
		return
	}
	for ctx.Err() == nil {
		err := store.AmbientLeader(ctx, func(leader context.Context) {
			runAmbientLeader(leader, pool, hitchcock, claire, media)
		})
		if err != nil && ctx.Err() == nil {
			slog.Warn("ambient leader unavailable")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(30 * time.Second):
		}
	}
}
func runAmbientLeader(ctx context.Context, pool *pgxpool.Pool, hitchcock, claire bot.Service, media *bot.Media) {
	ambient := bot.NewAmbient(bot.AmbientPorts{
		Audience: ambientAudience(pool), Now: time.Now,
		Delay:      func() time.Duration { return time.Duration(70+mathrand.IntN(71)) * time.Second },
		Talk:       ambientTalk(pool, hitchcock, claire, media),
		MediaReady: func(ctx context.Context) bool { return media.Ready(ctx, "lobby") },
	})
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			step, cancel := context.WithTimeout(ctx, 3*botTimeout())
			if err := ambient.Tick(step); err != nil && ctx.Err() == nil {
				slog.Info("ambient conversation paused", "error", err)
			}
			cancel()
		}
	}
}
func ambientTalk(pool *pgxpool.Pool, hitchcock, claire bot.Service, media *bot.Media) func(context.Context, bot.Turn, func() bool) (string, error) {
	return func(ctx context.Context, turn bot.Turn, allowed func() bool) (string, error) {
		if !allowed() {
			return "", nil
		}
		service, counterpart := hitchcock, "Клэр"
		if turn.Speaker.ID == "claire" {
			service = claire
			counterpart = "Хичкок"
		}
		var key [16]byte
		if _, err := rand.Read(key[:]); err != nil {
			return "", err
		}
		id := "ambient:" + hex.EncodeToString(key[:])
		spoken := ""
		_, err := service.Answer(ctx, bot.Request{ID: id, Identity: "ambient:" + turn.Speaker.ID, Nickname: counterpart, Body: turn.Body}, func(reply botdomain.Result) error {
			if !allowed() {
				return errors.New("audience changed")
			}
			text, kind, query := botdomain.MediaSuggestion(reply.Text)
			_, err := sendBotMessage(ctx, pool, roomdomain.Author{RoomID: "lobby", Identity: "bot:" + turn.Speaker.ID, Nickname: turn.Speaker.Name, Recipient: counterpart}, id, counterpart+", "+text)
			if err != nil {
				return err
			}
			spoken = text
			if turn.Speaker.ID == "claire" {
				media.Suggest(ctx, "lobby", id, kind, query, allowed)
			}
			return nil
		})
		if len([]rune(spoken)) > 400 {
			spoken = string([]rune(spoken)[:400])
		}
		return spoken, err
	}
}
