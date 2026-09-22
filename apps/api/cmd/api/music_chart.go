package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	charthttp "chat/api/internal/musicchart/adapters/http"
	"chat/api/internal/musicchart/adapters/postgres"
	charts3 "chat/api/internal/musicchart/adapters/s3"
	"chat/api/internal/musicchart/application"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
	"strings"
)

func registerMusicChart(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) error {
	service := application.NewService(postgres.NewStore(pool))
	base := os.Getenv("S3_PUBLIC_BASE_URL")
	if os.Getenv("S3_ENABLED") == "true" {
		storage, err := charts3.New(charts3.S3Config{Endpoint: os.Getenv("S3_ENDPOINT"), Region: os.Getenv("S3_REGION"), Bucket: os.Getenv("S3_BUCKET"), AccessKeyID: os.Getenv("S3_ACCESS_KEY_ID"), SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"), PublicBaseURL: base, VirtualHosted: os.Getenv("S3_VIRTUAL_HOSTED") == "true"})
		if err != nil {
			return err
		}
		service = service.WithAudioStorage(storage)
		if base == "" {
			base = strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/") + "/" + os.Getenv("S3_BUCKET")
		}
	}
	charthttp.NewHandler(service, auth.AccountIdentity, base).Register(mux)
	return nil
}
