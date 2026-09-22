package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"
)

var ErrInvalidSession = errors.New("invalid account session")

// SessionRecord contains only the digest of the opaque browser credential.
// UserID zero represents an anonymous session used for login CSRF protection.
type SessionRecord struct {
	Digest    string
	UserID    int64
	ExpiresAt time.Time
}

type SessionStore interface {
	FindSession(context.Context, string, time.Time) (SessionRecord, error)
	ReplaceSession(context.Context, string, SessionRecord, time.Time) error
	RevokeSession(context.Context, string) error
}

type Sessions struct{ store SessionStore }

func NewSessions(store SessionStore) Sessions { return Sessions{store: store} }

func (s Sessions) Current(ctx context.Context, token string, now time.Time) (SessionRecord, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return SessionRecord{}, ErrInvalidSession
	}
	return s.store.FindSession(ctx, sessionDigest(token), now)
}

// Issue rotates and revokes the previous credential atomically. A concurrent
// login cannot revive a session already consumed by another login or logout.
func (s Sessions) Issue(ctx context.Context, previous string, userID int64, now time.Time) (string, SessionRecord, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", SessionRecord{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	lifetime := time.Hour
	if userID > 0 {
		lifetime = 30 * 24 * time.Hour
	}
	record := SessionRecord{Digest: sessionDigest(token), UserID: userID, ExpiresAt: now.Add(lifetime)}
	previousDigest := ""
	if previous != "" {
		previousDigest = sessionDigest(previous)
	}
	if err := s.store.ReplaceSession(ctx, previousDigest, record, now); err != nil {
		return "", SessionRecord{}, err
	}
	return token, record, nil
}

func (s Sessions) Revoke(ctx context.Context, token string) error {
	return s.store.RevokeSession(ctx, sessionDigest(token))
}

func sessionDigest(token string) string {
	digest := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}
