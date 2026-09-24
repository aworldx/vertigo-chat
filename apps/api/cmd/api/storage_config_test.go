package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"testing"
)

func TestStorageConfigurationFailsClosedAndBuildsAllMediaRoutes(t *testing.T) {
	t.Setenv("S3_ENABLED", "true")
	for _, key := range []string{"S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"} {
		t.Setenv(key, "")
	}
	constructors := []struct {
		name     string
		register func(*http.ServeMux, *pgxpool.Pool, accountshttp.Handler) error
	}{{"gallery", registerGallery}, {"chart", registerMusicChart}, {"admin", registerAdmin}}
	for _, builder := range constructors {
		if err := builder.register(http.NewServeMux(), nil, accountshttp.Handler{}); err == nil {
			t.Fatal(builder.name, "accepted missing S3 configuration")
		}
	}
	for key, value := range map[string]string{"S3_ENDPOINT": "https://storage.example", "S3_REGION": "test", "S3_BUCKET": "bucket", "S3_ACCESS_KEY_ID": "test", "S3_SECRET_ACCESS_KEY": "test"} {
		t.Setenv(key, value)
	}
	for _, builder := range constructors {
		if err := builder.register(http.NewServeMux(), nil, accountshttp.Handler{}); err != nil {
			t.Fatal(builder.name, err)
		}
	}
}
