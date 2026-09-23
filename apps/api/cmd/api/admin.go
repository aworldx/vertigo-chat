package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	adminhttp "chat/api/internal/admin/adapters/http"
	adminpg "chat/api/internal/admin/adapters/postgres"
	admin "chat/api/internal/admin/application"
	emojihttp "chat/api/internal/emojis/adapters/http"
	emojiimages "chat/api/internal/emojis/adapters/images"
	emojipg "chat/api/internal/emojis/adapters/postgres"
	emojis3 "chat/api/internal/emojis/adapters/s3"
	emojis "chat/api/internal/emojis/application"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
)

func registerAdmin(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) error {
	authenticator := accounts.NewAuthenticator(accountspg.NewAccounts(pool), accountspg.PBKDF2Verifier{})
	role := func(name string) func(context.Context, int64) (bool, error) {
		return func(ctx context.Context, id int64) (bool, error) {
			p, err := authenticator.Principal(ctx, id)
			return p.HasRole(name), err
		}
	}
	adminhttp.Register(mux, admin.NewDatabase(adminpg.NewReader(pool), role("admin")), auth.AccountIdentity)
	store := emojipg.NewStore(pool)
	management := emojis.NewManagement(store, role("emoji_moderator"), emojis.NewUploader(store, emojiimages.Inspector{}))
	if os.Getenv("S3_ENABLED") == "true" {
		storage, err := emojis3.New(emojis3.S3Config{Endpoint: os.Getenv("S3_ENDPOINT"), Region: os.Getenv("S3_REGION"), Bucket: os.Getenv("S3_BUCKET"), AccessKeyID: os.Getenv("S3_ACCESS_KEY_ID"), SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"), PublicBaseURL: os.Getenv("S3_PUBLIC_BASE_URL"), VirtualHosted: os.Getenv("S3_VIRTUAL_HOSTED") == "true"})
		if err != nil {
			return err
		}
		management = management.WithObjectRemoval(storage.Remove)
	}
	emojihttp.NewManager(management, auth.AccountIdentity, os.Getenv("S3_PUBLIC_BASE_URL"), accounts.NewDirectory(accountspg.NewAccounts(pool)).PublicNames).Register(mux)
	return nil
}
