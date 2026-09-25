package main

import (
	"context"
	"log/slog"
	"time"

	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	roomdomain "chat/api/internal/rooms/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func sendBotMessage(ctx context.Context, pool *pgxpool.Pool, author roomdomain.Author, clientID, body string) (roomdomain.Message, error) {
	var message roomdomain.Message
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		account := accountspg.NewAccounts(tx)
		id, err := accounts.NewBotProgress(account).UserID(ctx, author.Nickname)
		if err != nil {
			return err
		}
		message, err = rooms.NewService(roompg.NewStore(tx)).Send(ctx, author, clientID, body)
		if err != nil || !message.Inserted {
			return err
		}
		return accounts.NewProgress(account).RecordMessage(ctx, id)
	})
	return message, err
}

func runBotPresence(ctx context.Context, pool *pgxpool.Pool) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	progress := accounts.NewBotProgress(accountspg.NewAccounts(pool))
	for {
		if err := progress.Tick(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("record bot presence failed")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
