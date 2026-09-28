package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"time"
)

func pruneMessageHistory(ctx context.Context, history rooms.History) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if err := history.Prune(ctx, time.Now()); err != nil && ctx.Err() == nil {
			slog.Error("prune message history", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func registerHistoryModeration(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler, socket chatshttp.Socket) {
	authenticator := accounts.NewAuthenticator(accountspg.NewAccounts(pool), accountspg.PBKDF2Verifier{})
	moderation := rooms.NewModeration(rooms.NewActions(roompg.NewStore(pool)), func(ctx context.Context, id int64) (bool, error) {
		principal, err := authenticator.Principal(ctx, id)
		return principal.HasRole("admin"), err
	})
	chatshttp.RegisterHistoryModeration(mux, moderation, auth.AccountIdentity, socket.MessageDeleted)
}
