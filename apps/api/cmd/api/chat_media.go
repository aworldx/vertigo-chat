package main

import (
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatpg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	chatdomain "chat/api/internal/chatsessions/domain"
	mediahttp "chat/api/internal/mediasearch/adapters/http"
	"chat/api/internal/mediasearch/adapters/provider"
	media "chat/api/internal/mediasearch/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
	"strconv"
	"time"
)

func registerMedia(ctx context.Context, mux *http.ServeMux, pool *pgxpool.Pool) {
	authorize := func(w http.ResponseWriter, r *http.Request) bool {
		token, err := chatshttp.DecodeResume(r.Header.Get("X-Chat-Session"))
		generation, _ := strconv.Atoi(r.Header.Get("X-Chat-Generation"))
		if err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return false
		}
		_, err = chats.NewCommandAuthenticator(chatpg.NewStore(pool)).Authenticate(r.Context(), token.SessionID, token.IdentityKey, token.Secret, generation)
		if err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return false
		}
		return true
	}
	catalogue := provider.NewCatalogue(os.Getenv("YOUTUBE_WORKER_URL"))
	catalogue.Proxies = provider.NewProxyPool(os.Getenv("MUSIC_PROXY_FILE"))
	mediahttp.NewHandler(media.NewService(media.NewQueue(ctx, catalogue)), authorize).Register(mux, os.Getenv("YOUTUBE_WORKER_URL"))
}
func sendRoomMedia(pool *pgxpool.Pool) chatshttp.SendMedia {
	return func(ctx context.Context, session chatdomain.Session, clientID string, item media.Item) (rooms.Message, error) {
		var message rooms.Message
		if !media.Allowed(item.Kind, item.URL) {
			return message, rooms.ErrRateLimited
		}
		err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			if err := chats.NewService(chatpg.NewStore(tx), chatsessionsPolicy()).Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
				return err
			}
			var err error
			message, err = roompg.NewStore(tx).SendMedia(ctx, rooms.Author{RoomID: session.RoomID, Identity: session.IdentityKey, Nickname: session.Nickname}, clientID, item.Kind, item.Title, item.URL, item.Artist, item.Duration, item.Source)
			return err
		})
		return message, err
	}
}
