package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	profiles "chat/api/internal/profiles/application"
	"context"
	"github.com/jackc/pgx/v5"
)

func chartGate(ctx context.Context, tx pgx.Tx, id int64) (int, error) {
	v, err := accounts.NewDirectory(accountspg.NewAccounts(tx)).PublicationProfile(ctx, id, true)
	return profiles.Limits(v.Messages, v.Seconds).Tracks, err
}
