package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspostgres "chat/api/internal/accounts/adapters/postgres"
	accountsapplication "chat/api/internal/accounts/application"
	chatsessionshttp "chat/api/internal/chatsessions/adapters/http"
	chatsessionspostgres "chat/api/internal/chatsessions/adapters/postgres"
	chatsessionsapplication "chat/api/internal/chatsessions/application"
	profileshttp "chat/api/internal/profiles/adapters/http"
	"chat/api/internal/profiles/adapters/postgres"
	"chat/api/internal/profiles/application"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		slog.Error("ping database", "error", err)
		os.Exit(1)
	}
	mux := http.NewServeMux()
	profiles := postgres.NewCatalogue(pool)
	if os.Getenv("S3_ENABLED") == "true" {
		media, err := postgres.NewS3Media(postgres.S3Config{
			Endpoint: os.Getenv("S3_ENDPOINT"), Region: os.Getenv("S3_REGION"), Bucket: os.Getenv("S3_BUCKET"),
			AccessKeyID: os.Getenv("S3_ACCESS_KEY_ID"), SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
			PublicBaseURL: os.Getenv("S3_PUBLIC_BASE_URL"), VirtualHosted: os.Getenv("S3_VIRTUAL_HOSTED") == "true",
		})
		if err != nil {
			slog.Error("configure S3 media", "error", err)
			os.Exit(1)
		}
		profiles = postgres.NewCatalogueWithMedia(pool, media)
	}
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	profileshttp.NewHandler(application.NewCatalog(profiles)).Register(mux)
	profileshttp.NewMediaHandler(application.NewMediaService(profiles)).Register(mux)
	profileshttp.NewMutationHandler(application.NewEditor(profiles), application.NewPhotoEditor(profiles), os.Getenv("PROFILE_INTERNAL_TOKEN")).Register(mux)
	accounts := accountspostgres.NewAccounts(pool)
	accountshttp.NewHandler(
		accountsapplication.NewAuthenticator(accounts, accountspostgres.PBKDF2Verifier{}),
		accountsapplication.NewRegistrar(accounts, accountspostgres.PBKDF2Verifier{}),
		os.Getenv("ACCOUNTS_INTERNAL_TOKEN"),
	).Register(mux)
	chatSessions := chatsessionsapplication.NewService(chatsessionspostgres.NewStore(pool), chatsessionsPolicy())
	chatsessionshttp.NewHandler(
		chatSessions,
		os.Getenv("CHAT_SESSIONS_INTERNAL_TOKEN"),
	).Register(mux)
	go reapChatSessions(ctx, chatSessions)
	server := &http.Server{Addr: env("API_ADDR", "127.0.0.1:4020"), Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	slog.Info("api listening", "address", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("api stopped", "error", err)
		os.Exit(1)
	}
}
func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func chatsessionsPolicy() chatsessionsapplication.Policy {
	return chatsessionsapplication.Policy{
		Grace:       positiveSecondsEnv("CHAT_SESSION_GRACE_SECONDS", 60),
		HiddenGrace: positiveSecondsEnv("CHAT_HIDDEN_SESSION_GRACE_SECONDS", 5*60),
	}
}

func positiveSecondsEnv(name string, fallback int) time.Duration {
	seconds, err := strconv.Atoi(os.Getenv(name))
	if err != nil || seconds <= 0 {
		seconds = fallback
	}
	return time.Duration(seconds) * time.Second
}

func reapChatSessions(ctx context.Context, service chatsessionsapplication.Service) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := service.Reap(ctx, now.UTC()); err != nil && ctx.Err() == nil {
				slog.Error("reap chat sessions", "error", err)
			}
		}
	}
}
