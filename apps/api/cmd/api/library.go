package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	libraryhttp "chat/api/internal/library/adapters/http"
	librarypg "chat/api/internal/library/adapters/postgres"
	library "chat/api/internal/library/application"
	profiles "chat/api/internal/profiles/application"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

type libraryPeople struct{ directory accounts.Directory }

func (p libraryPeople) Names(ctx context.Context, ids []int64) (map[int64]string, error) {
	return p.directory.PublicNames(ctx, ids)
}
func (p libraryPeople) CanPublish(ctx context.Context, id int64) (bool, error) {
	v, err := p.directory.PublicationProfile(ctx, id, false)
	return profiles.CanAddLibraryArticles(v.Messages, v.Seconds), err
}
func libraryGate(ctx context.Context, tx pgx.Tx, id int64) (bool, error) {
	v, err := accounts.NewDirectory(accountspg.NewAccounts(tx)).PublicationProfile(ctx, id, true)
	return profiles.CanAddLibraryArticles(v.Messages, v.Seconds), err
}
func registerLibrary(m *http.ServeMux, p *pgxpool.Pool, auth accountshttp.Handler) {
	libraryhttp.NewHandler(library.NewService(librarypg.NewStore(p, libraryGate), libraryPeople{accounts.NewDirectory(accountspg.NewAccounts(p))}), auth.AccountIdentity).Register(m)
}
