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
	"chat/api/internal/clientip"
	emojihttp "chat/api/internal/emojis/adapters/http"
	emojiimages "chat/api/internal/emojis/adapters/images"
	emojipg "chat/api/internal/emojis/adapters/postgres"
	emojis "chat/api/internal/emojis/application"
	entrancehttp "chat/api/internal/entrance/adapters/http"
	entranceapp "chat/api/internal/entrance/application"
	"chat/api/internal/observability"
	profileshttp "chat/api/internal/profiles/adapters/http"
	"chat/api/internal/profiles/adapters/postgres"
	"chat/api/internal/profiles/application"
	roomspg "chat/api/internal/rooms/adapters/postgres"
	roomsapp "chat/api/internal/rooms/application"
	"chat/api/internal/webdelivery"

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
	metrics := observability.NewMetrics()
	configureBotMetrics(metrics, pool)
	metrics.Register(mux, os.Getenv("METRICS_TOKEN"))
	if directory := os.Getenv("WEB_ASSETS_DIR"); directory != "" {
		if err := webdelivery.Register(mux, os.DirFS(directory), env("API_PUBLIC_ORIGIN", "http://127.0.0.1:4020")); err != nil {
			slog.Error("load React build", "error", err)
			os.Exit(1)
		}
	}
	emojihttp.NewHandler(emojis.NewService(emojipg.NewStore(pool)), os.Getenv("S3_PUBLIC_BASE_URL")).Register(mux)
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
	accounts := accountspostgres.NewAccounts(pool)
	auth, err := accountshttp.NewHandler(
		accountsapplication.NewAuthenticator(accounts, accountspostgres.PBKDF2Verifier{}),
		accountsapplication.NewRegistrar(registrationCreator{pool}, accountspostgres.PBKDF2Verifier{}),
		accountsapplication.NewSessions(accounts),
		env("API_PUBLIC_ORIGIN", "http://127.0.0.1:4020"),
	)
	if err != nil {
		slog.Error("configure public accounts", "error", err)
		os.Exit(1)
	}
	auth.Register(mux)
	if err := registerAdmin(mux, pool, auth); err != nil {
		slog.Error("configure admin", "error", err)
		os.Exit(1)
	}
	registerLibrary(mux, pool, auth)
	if err := registerGallery(mux, pool, auth); err != nil {
		slog.Error("configure gallery", "error", err)
		os.Exit(1)
	}
	accountshttp.NewSettingsHandler(accountsapplication.NewSettings(accounts), auth.AccountIdentity).Register(mux)
	registerFeedback(mux, pool, auth)
	if err := registerMusicChart(mux, pool, auth); err != nil {
		slog.Error("configure chart media", "error", err)
		os.Exit(1)
	}
	registerMedia(ctx, mux, pool)
	emojihttp.NewUploadHandler(emojis.NewUploader(emojipg.NewStore(pool), emojiimages.Inspector{}), auth.AccountIdentity).Register(mux)
	profileshttp.NewMutationHandler(application.NewEditor(profiles), application.NewPhotoEditor(profiles), application.NewAccountCatalog(profiles), auth.AccountIdentity).Register(mux)
	go pruneAccountSessions(ctx, accounts)
	go runBotPresence(ctx, pool)
	go runKarmik(ctx, pool, metrics)
	go runOpenAICosts(ctx, metrics)
	chatsessionshttp.NewHistoryHandler(chatsessionsapplication.NewHistory(chatsessionspostgres.NewStore(pool))).Register(mux)
	chatSessions := chatsessionsapplication.NewService(chatsessionspostgres.NewStore(pool), chatsessionsPolicy())
	chatsessionshttp.NewHandler(
		chatSessions,
		os.Getenv("CHAT_SESSIONS_INTERNAL_TOKEN"),
	).Register(mux)
	entrancehttp.NewHandler(entranceapp.NewService(entranceWork(pool)), auth.AuthorizeMutation, auth.SetSessionCookie, func(result entranceapp.Result) string {
		return chatsessionshttp.EncodeResume(chatsessionshttp.Resume{SessionID: result.Session.ID, IdentityKey: result.Session.IdentityKey, Secret: result.ResumeSecret})
	}).WithUpgrade(upgradeChatAccount(pool)).Register(mux)
	chatsessionshttp.NewSocket(chatSessions, chatsessionspostgres.NewStore(pool), roomsapp.NewService(roomspg.NewStore(pool)), sendRoomMessage(pool), env("API_PUBLIC_ORIGIN", "http://127.0.0.1:4020")).WithExperience(roomExperience(pool, metrics, ctx)).Register(mux)
	go reapChatSessions(ctx, chatSessions)
	handler, err := clientip.Wrap(metrics.Wrap(mux), os.Getenv("API_TRUSTED_PROXY_CIDRS"))
	if err != nil {
		slog.Error("configure trusted proxies", "error", err)
		os.Exit(1)
	}
	server := &http.Server{Addr: env("API_ADDR", "127.0.0.1:4020"), Handler: handler, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
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

func pruneAccountSessions(ctx context.Context, accounts accountspostgres.Accounts) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := accounts.PruneSessions(ctx, now.UTC()); err != nil && ctx.Err() == nil {
				slog.Error("prune account sessions", "error", err)
			}
		}
	}
}
