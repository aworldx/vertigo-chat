package main

import (
	bot "chat/api/internal/bot/application"
	"chat/api/internal/mediasearch/adapters/provider"
	media "chat/api/internal/mediasearch/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"os"
	"time"
)

func claireMedia(pool *pgxpool.Pool) *bot.Media {
	catalogue := provider.NewCatalogue(os.Getenv("YOUTUBE_WORKER_URL"))
	catalogue.Proxies = provider.NewProxyPool(os.Getenv("MUSIC_PROXY_FILE"))
	search := media.NewService(catalogue)
	eligible := func(ctx context.Context, room string) bool {
		if room != "lobby" {
			return false
		}
		audience, err := ambientAudience(pool)(ctx)
		if err != nil || audience.Humans < 1 || audience.Humans > 2 {
			return false
		}
		last, err := roompg.NewStore(pool).LastMediaByAuthor(ctx, room, "bot:claire")
		return err == nil && time.Since(last) >= 30*time.Minute
	}
	return &bot.Media{Now: time.Now, Eligible: eligible, Publish: func(ctx context.Context, room, id, kind, query string, allowed func() bool) error {
		items, err := search.Search(ctx, kind, query)
		if err != nil {
			slog.Warn("claire media search failed", "kind", kind)
			return err
		}
		if len(items) == 0 {
			slog.Info("claire media search returned no results", "kind", kind)
		}
		if len(items) == 0 || (allowed != nil && !allowed()) {
			return nil
		}
		item := items[0]
		if !media.Allowed(item.Kind, item.URL) {
			return nil
		}
		author, err := botAuthor(ctx, pool, roomdomain.Author{RoomID: room, Identity: "bot:claire", Nickname: "Клэр"})
		if err != nil {
			return err
		}
		_, err = roompg.NewStore(pool).SendMedia(ctx, author, "media:"+id, item.Kind, item.Title, item.URL, item.Artist, item.Duration, item.Source)
		return err
	}}
}
