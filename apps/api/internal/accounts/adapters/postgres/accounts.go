// Package postgres adapts the existing registered_users table for Go Accounts.
package postgres

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/jackc/pgx/v5"
)

type Database interface {
	Begin(context.Context) (pgx.Tx, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}
type Accounts struct{ pool Database }

func NewAccounts(pool Database) Accounts { return Accounts{pool: pool} }

func (a Accounts) FindByNickname(ctx context.Context, nickname string) (domain.Principal, string, error) {
	const query = `SELECT id, nickname, is_admin, can_moderate_emojis, password_hash
		FROM registered_users WHERE nickname = $1 AND NOT is_game_guest`
	return a.scanCredential(ctx, query, nickname)
}

func (a Accounts) FindPrincipal(ctx context.Context, userID int64) (domain.Principal, error) {
	const query = `SELECT id, nickname, is_admin, can_moderate_emojis
		FROM registered_users WHERE id = $1 AND NOT is_game_guest`
	var principal domain.Principal
	if err := a.pool.QueryRow(ctx, query, userID).Scan(&principal.UserID, &principal.Nickname, &principal.Admin, &principal.CanModerateEmojis); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Principal{}, application.ErrAccountNotFound
		}
		return domain.Principal{}, fmt.Errorf("find principal: %w", err)
	}
	return principal, nil
}

func (a Accounts) scanCredential(ctx context.Context, query, value string) (domain.Principal, string, error) {
	var principal domain.Principal
	var hash string
	if err := a.pool.QueryRow(ctx, query, value).Scan(&principal.UserID, &principal.Nickname, &principal.Admin, &principal.CanModerateEmojis, &hash); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Principal{}, "", application.ErrAccountNotFound
		}
		return domain.Principal{}, "", fmt.Errorf("find credentials: %w", err)
	}
	return principal, hash, nil
}

// PBKDF2Verifier is deliberately compatible with the legacy Phoenix credential format.
type PBKDF2Verifier struct{}

// Hash produces the credential format already understood by Phoenix during the
// transition. Go becomes the sole writer once registration is routed here.
func (PBKDF2Verifier) Hash(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}
	const iterations = 210_000
	derived := pbkdf2SHA256([]byte(password), salt, iterations, sha256.Size)
	return strings.Join([]string{
		"pbkdf2_sha256", strconv.Itoa(iterations),
		base64.RawURLEncoding.EncodeToString(salt), base64.RawURLEncoding.EncodeToString(derived),
	}, "$"), nil
}

func (a Accounts) Create(ctx context.Context, nickname, email, passwordHash, networkIdentity string) (domain.Principal, error) {
	const query = `INSERT INTO registered_users (nickname, email, password_hash, is_admin, can_moderate_emojis, is_game_guest, theme_id, appearance, font_id, font_style, message_sound_enabled, public_message_count, chat_seconds, karma, inserted_at, updated_at)
	VALUES ($1, NULLIF($2, ''), $3, NOT EXISTS (SELECT 1 FROM registered_users WHERE NOT is_game_guest), false, false, 'vertigo', '{}'::jsonb, 'theme', 'normal', false, 0, 0, 0, NOW(), NOW())
	RETURNING id, nickname, is_admin, can_moderate_emojis`
	fingerprint, err := registrationFingerprint(networkIdentity)
	if err != nil {
		return domain.Principal{}, err
	}
	var principal domain.Principal
	err = pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		// Serialize first-account election, including the empty-table case.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(674923002)`); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO security_registration_guards(fingerprint, day, inserted_at, updated_at) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, now(), now())`, fingerprint); err != nil {
			var constraint *pgconn.PgError
			if errors.As(err, &constraint) && constraint.Code == "23505" {
				return application.ErrRegistrationLimited
			}
			return err
		}
		err := tx.QueryRow(ctx, query, nickname, email, passwordHash).Scan(&principal.UserID, &principal.Nickname, &principal.Admin, &principal.CanModerateEmojis)
		var constraint *pgconn.PgError
		if errors.As(err, &constraint) && constraint.Code == "23505" {
			return application.ErrInvalidRegistration
		}
		return err
	})
	if err != nil {
		return domain.Principal{}, fmt.Errorf("create account: %w", err)
	}
	return principal, nil
}

func (PBKDF2Verifier) Verify(password, encodedHash string) bool {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations < 1 || iterations > 1_000_000 {
		return false
	}
	salt, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expected, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil || len(expected) != sha256.Size {
		return false
	}
	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return hmac.Equal(actual, expected)
}

func pbkdf2SHA256(password, salt []byte, iterations, size int) []byte {
	result := make([]byte, 0, size)
	for block := uint32(1); len(result) < size; block++ {
		mac := hmac.New(sha256.New, password)
		_, _ = mac.Write(salt)
		_, _ = mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		t := append([]byte(nil), u...)
		for round := 1; round < iterations; round++ {
			mac = hmac.New(sha256.New, password)
			_, _ = mac.Write(u)
			u = mac.Sum(nil)
			for index := range t {
				t[index] ^= u[index]
			}
		}
		result = append(result, t...)
	}
	return result[:size]
}
