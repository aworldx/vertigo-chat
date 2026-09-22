// Package application coordinates chat-session transitions through small ports.
package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"chat/api/internal/chatsessions/domain"
)

type Store interface {
	Start(context.Context, domain.Session, string, *int64) (domain.Session, error)
	Restore(context.Context, string, string, string, time.Time, time.Time, time.Time) (domain.Session, error)
	Reconnect(context.Context, string, string, int, time.Time, time.Duration, time.Duration) (domain.Session, error)
	Activate(context.Context, string, string, int, time.Time, time.Time, time.Time) (domain.Session, error)
	Touch(context.Context, string, string, int, string, time.Time, time.Time, time.Time) error
	MarkStale(context.Context, time.Time, time.Duration, time.Duration, time.Duration) ([]domain.Session, error)
	Expired(context.Context, time.Time) ([]domain.Session, error)
	RegisterIdentity(context.Context, string, string, int, int64, string, time.Time) (domain.Session, error)
	End(context.Context, string, string, int, time.Time) (domain.Session, error)
}

const defaultHeartbeatTimeout = 180 * time.Second
const defaultGrace = 60 * time.Second
const defaultHiddenGrace = 5 * time.Minute

// Policy is deliberately transport-independent so every Go adapter evaluates
// a lifecycle transition using the same time windows.
type Policy struct {
	HeartbeatTimeout time.Duration
	Grace            time.Duration
	HiddenGrace      time.Duration
}

type Service struct {
	store            Store
	heartbeatTimeout time.Duration
	grace            time.Duration
	hiddenGrace      time.Duration
}

func NewService(store Store, policies ...Policy) Service {
	policy := Policy{HeartbeatTimeout: defaultHeartbeatTimeout, Grace: defaultGrace, HiddenGrace: defaultHiddenGrace}
	if len(policies) == 1 {
		policy = normalizePolicy(policies[0])
	}
	return Service{store: store, heartbeatTimeout: policy.HeartbeatTimeout, grace: policy.Grace, hiddenGrace: policy.HiddenGrace}
}

func (s Service) Start(ctx context.Context, start domain.Start) (domain.Session, string, error) {
	if start.RoomID == "" || start.IdentityKey == "" || start.Nickname == "" {
		return domain.Session{}, "", fmt.Errorf("invalid chat session start")
	}
	resumeSecret, err := randomToken(32)
	if err != nil {
		return domain.Session{}, "", fmt.Errorf("generate resume secret: %w", err)
	}
	sessionID, err := randomUUID()
	if err != nil {
		return domain.Session{}, "", fmt.Errorf("generate session id: %w", err)
	}
	session := domain.Session{ID: sessionID, RoomID: start.RoomID, IdentityKey: start.IdentityKey, Nickname: start.Nickname}
	session, err = s.store.Start(ctx, session, resumeSecret, start.UserID)
	if err != nil {
		return domain.Session{}, "", err
	}
	return session, resumeSecret, nil
}

func (s Service) Restore(ctx context.Context, sessionID, identityKey, resumeSecret string, now time.Time) (domain.Session, error) {
	return s.store.Restore(
		ctx,
		sessionID,
		identityKey,
		resumeSecret,
		now,
		now.Add(-(s.heartbeatTimeout + s.grace)),
		now.Add(-(s.heartbeatTimeout + s.hiddenGrace)),
	)
}

// Reconnect starts a bounded grace period after an unintentional transport loss.
// The expected generation fences a stale socket from replacing a newer connection.
func (s Service) Reconnect(ctx context.Context, sessionID, identityKey string, generation int, now time.Time) (domain.Session, error) {
	return s.store.Reconnect(ctx, sessionID, identityKey, generation, now, s.grace, s.hiddenGrace)
}

// Activate attaches a newly verified connection and cancels reconnect grace.
func (s Service) Activate(ctx context.Context, sessionID, identityKey string, generation int, now time.Time) (domain.Session, error) {
	return s.store.Activate(
		ctx,
		sessionID,
		identityKey,
		generation,
		now,
		now.Add(-(s.heartbeatTimeout + s.grace)),
		now.Add(-(s.heartbeatTimeout + s.hiddenGrace)),
	)
}

func (s Service) Touch(ctx context.Context, sessionID, identityKey string, generation int, visibility string, now time.Time) error {
	return s.store.Touch(ctx, sessionID, identityKey, generation, visibility, now, now.Add(-(s.heartbeatTimeout + s.grace)), now.Add(-(s.heartbeatTimeout + s.hiddenGrace)))
}

// Reap advances abandoned sessions without relying on a browser disconnect event.
func (s Service) Reap(ctx context.Context, now time.Time) error {
	if _, err := s.store.MarkStale(ctx, now, s.heartbeatTimeout, s.grace, s.hiddenGrace); err != nil {
		return err
	}
	expired, err := s.store.Expired(ctx, now)
	if err != nil {
		return err
	}
	for _, session := range expired {
		if _, err := s.End(ctx, session.ID, session.IdentityKey, session.Generation, now); err != nil {
			return err
		}
	}
	return nil
}

// RegisterIdentity binds an active guest session to a newly registered account.
// It rotates the resume secret so the former guest credential cannot restore it.
func (s Service) RegisterIdentity(ctx context.Context, sessionID, identityKey string, generation int, userID int64, nickname string, now time.Time) (domain.Session, string, error) {
	if sessionID == "" || identityKey == "" || generation < 0 || userID <= 0 || nickname == "" {
		return domain.Session{}, "", fmt.Errorf("invalid chat identity registration")
	}
	secret, err := randomToken(32)
	if err != nil {
		return domain.Session{}, "", fmt.Errorf("generate registered resume secret: %w", err)
	}
	session, err := s.store.RegisterIdentity(ctx, sessionID, identityKey, generation, userID, secret, now)
	if err != nil {
		return domain.Session{}, "", err
	}
	return session, secret, nil
}

// End makes an explicit leave terminal. It deliberately uses the same generation
// fence as Reconnect so an old tab cannot end a newer connection.
func (s Service) End(ctx context.Context, sessionID, identityKey string, generation int, now time.Time) (domain.Session, error) {
	return s.store.End(ctx, sessionID, identityKey, generation, now)
}

func normalizePolicy(policy Policy) Policy {
	if policy.HeartbeatTimeout <= 0 {
		policy.HeartbeatTimeout = defaultHeartbeatTimeout
	}
	if policy.Grace <= 0 {
		policy.Grace = defaultGrace
	}
	if policy.HiddenGrace <= 0 {
		policy.HiddenGrace = defaultHiddenGrace
	}
	return policy
}

func randomToken(bytes int) (string, error) {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func randomUUID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", value[0:4], value[4:6], value[6:8], value[8:10], value[10:16]), nil
}
