package postgres_test

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"chat/api/internal/accounts/adapters/postgres"
	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
	"chat/api/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The verification script supplies a disposable DB with the actual legacy
// schema, including constraints and the profile provisioning trigger.
func TestAccountsPostgres(t *testing.T) {
	url := os.Getenv("GO_ACCOUNTS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("run script/verify-go-accounts for PostgreSQL integration")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var database string
	if err := pool.QueryRow(ctx, `SELECT current_database()`).Scan(&database); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(database, "chat_accounts_test_") {
		t.Fatal("integration tests require disposable chat_accounts_test_* database")
	}
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatalf("migration not repeatable: %v", err)
	}
	accounts := postgres.NewAccounts(pool)
	t.Run("atomic registration and first admin", func(t *testing.T) { testRegistration(t, pool, accounts) })
	t.Run("registration conflicts roll back quota", func(t *testing.T) { testRegistrationConflicts(t, pool, accounts) })
	t.Run("session persistence expiry revocation and race", func(t *testing.T) { testSessions(t, pool, accounts) })
	t.Run("private settings ownership and uniqueness", func(t *testing.T) { testPrivateSettings(t, pool, accounts) })
	// All data in this database is created by this test; leave the schema for the
	// subsequent real-browser flow, and never touch a developer's normal DB.
	if _, err := pool.Exec(ctx, `TRUNCATE registered_users, security_registration_guards RESTART IDENTITY CASCADE`); err != nil {
		t.Fatal(err)
	}
}

func testRegistration(t *testing.T, pool *pgxpool.Pool, accounts postgres.Accounts) {
	ctx := context.Background()
	var wg sync.WaitGroup
	results := make(chan domain.Principal, 2)
	errs := make(chan error, 2)
	for index, nickname := range []string{"первый", "второй"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p, err := accounts.Create(ctx, nickname, "", "legacy-hash", []string{"192.0.2.1", "192.0.2.2"}[index])
			results <- p
			errs <- err
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	admins := 0
	for p := range results {
		if p.Admin {
			admins++
		}
	}
	if admins != 1 {
		t.Fatalf("first admins=%d", admins)
	}
	var profiles int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM profiles p JOIN registered_users u ON u.id=p.user_id WHERE NOT u.is_bot`).Scan(&profiles); err != nil || profiles != 2 {
		t.Fatalf("profile trigger: count=%d error=%v", profiles, err)
	}
}

func testRegistrationConflicts(t *testing.T, pool *pgxpool.Pool, accounts postgres.Accounts) {
	ctx := context.Background()
	if _, err := accounts.Create(ctx, "третий", "", "hash", "192.0.2.1"); !errors.Is(err, application.ErrRegistrationLimited) {
		t.Fatalf("rate limit: %v", err)
	}
	if _, err := accounts.Create(ctx, "первый", "", "hash", "192.0.2.3"); !errors.Is(err, application.ErrRegistrationNickname) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := accounts.Create(ctx, "третий", "taken@example.com", "hash", "192.0.2.3"); err != nil {
		t.Fatalf("failed registration consumed claim: %v", err)
	}
	if _, err := accounts.Create(ctx, "четвёртый", "TAKEN@example.com", "hash", "192.0.2.4"); !errors.Is(err, application.ErrRegistrationEmail) {
		t.Fatalf("case-insensitive email conflict: %v", err)
	}
	if _, err := accounts.Create(ctx, "четвёртый", "free@example.com", "hash", "192.0.2.4"); err != nil {
		t.Fatalf("email conflict consumed claim: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM registered_users WHERE NOT is_bot`).Scan(&count); err != nil || count != 4 {
		t.Fatalf("partial writes: count=%d err=%v", count, err)
	}
}

func testSessions(t *testing.T, pool *pgxpool.Pool, accounts postgres.Accounts) {
	ctx := context.Background()
	now := time.Now().UTC()
	var userID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE NOT is_bot ORDER BY id LIMIT 1`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	sessions := application.NewSessions(accounts)
	anonymous, _, err := sessions.Issue(ctx, "", 0, now)
	if err != nil {
		t.Fatal(err)
	}
	token, record, err := sessions.Issue(ctx, anonymous, userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if record.Digest == token {
		t.Fatal("plaintext token stored")
	}
	// Recreate the service to prove sessions survive process restarts.
	restarted := application.NewSessions(postgres.NewAccounts(pool))
	if found, err := restarted.Current(ctx, token, now); err != nil || found.UserID != userID {
		t.Fatalf("restart: %v", err)
	}
	if _, err := restarted.Current(ctx, anonymous, now); !errors.Is(err, application.ErrInvalidSession) {
		t.Fatalf("old session: %v", err)
	}
	if _, err := restarted.Current(ctx, token, record.ExpiresAt); !errors.Is(err, application.ErrInvalidSession) {
		t.Fatalf("expiry: %v", err)
	}
	testConcurrentRotation(t, restarted, token, userID, now)
	if err := accounts.PruneSessions(ctx, now.Add(31*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
}

func testConcurrentRotation(t *testing.T, restarted application.Sessions, token string, userID int64, now time.Time) {
	t.Helper()
	ctx := context.Background()

	var wg sync.WaitGroup
	results := make(chan error, 2)
	tokens := make(chan string, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			next, _, err := restarted.Issue(ctx, token, userID, now)
			results <- err
			tokens <- next
		}()
	}
	wg.Wait()
	close(results)
	close(tokens)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		} else if !errors.Is(err, application.ErrInvalidSession) {
			t.Fatal(err)
		}
	}
	if successes != 1 {
		t.Fatalf("concurrent rotations succeeded: %d", successes)
	}
	for next := range tokens {
		if next == "" {
			continue
		}
		if err := restarted.Revoke(ctx, next); err != nil {
			t.Fatal(err)
		}
		if _, err := restarted.Current(ctx, next, now); !errors.Is(err, application.ErrInvalidSession) {
			t.Fatalf("revocation: %v", err)
		}
	}
}
