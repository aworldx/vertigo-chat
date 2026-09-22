// Package postgres persists fenced chat-session transitions in the shared database.
package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"chat/api/internal/chatsessions/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrInvalidSession = domain.ErrInvalidSession

type Database interface {
	Begin(context.Context) (pgx.Tx, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}
type Store struct{ pool Database }

func NewStore(pool Database) Store { return Store{pool: pool} }

func (s Store) Start(ctx context.Context, session domain.Session, resumeSecret string, userID *int64) (domain.Session, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Session{}, fmt.Errorf("begin chat session start: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	const visitQuery = `INSERT INTO visits (nickname, identity_key, session_id, user_id, entered_at, inserted_at, updated_at)
	VALUES ($1, $2, $3, $4, (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')) RETURNING id`
	if err := tx.QueryRow(ctx, visitQuery, session.Nickname, session.IdentityKey, session.ID, userID).Scan(&session.VisitID); err != nil {
		return domain.Session{}, startError("create visit", err)
	}
	const sessionQuery = `INSERT INTO chat_sessions (id, room_id, identity_key, nickname, resume_secret_hash, status, last_seen_at, generation, visit_id, inserted_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, 'active', (NOW() AT TIME ZONE 'UTC'), 0, $6, (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC')) RETURNING generation`
	if err := tx.QueryRow(ctx, sessionQuery, session.ID, session.RoomID, session.IdentityKey, session.Nickname, hashSecret(resumeSecret), session.VisitID).Scan(&session.Generation); err != nil {
		return domain.Session{}, startError("create chat session", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO room_messages (room_id,kind,author,body,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES ($1,'system','system',$2,'vertigo','{}','{}','theme','normal',(NOW() AT TIME ZONE 'UTC'),(NOW() AT TIME ZONE 'UTC'),(NOW() AT TIME ZONE 'UTC'))`, session.RoomID, "в чат заходит "+session.Nickname); err != nil {
		return domain.Session{}, fmt.Errorf("persist entrance: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Session{}, fmt.Errorf("commit chat session start: %w", err)
	}
	session.Status = domain.StatusActive
	return session, nil
}

func (s Store) Restore(ctx context.Context, sessionID, identityKey, resumeSecret string, now time.Time, activeCutoff time.Time, hiddenCutoff time.Time) (domain.Session, error) {
	const query = `UPDATE chat_sessions SET status = 'active', last_seen_at = $4, reconnect_deadline_at = NULL, generation = generation + 1, updated_at = $4
	WHERE id = $1 AND identity_key = $2 AND resume_secret_hash = $3 AND status IN ('active', 'reconnecting')
	AND ((status = 'reconnecting' AND reconnect_deadline_at > $4) OR
	     (status = 'active' AND ((last_visibility = 'hidden' AND last_seen_at > $6) OR
	                              (COALESCE(last_visibility, 'unknown') != 'hidden' AND last_seen_at > $5))))
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	var session domain.Session
	if err := s.pool.QueryRow(ctx, query, sessionID, identityKey, hashSecret(resumeSecret), now.UTC(), activeCutoff.UTC(), hiddenCutoff.UTC()).Scan(
		&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Session{}, ErrInvalidSession
		}
		return domain.Session{}, fmt.Errorf("restore chat session: %w", err)
	}
	return session, nil
}

func (s Store) Reconnect(ctx context.Context, sessionID, identityKey string, generation int, now time.Time, grace time.Duration, hiddenGrace time.Duration) (domain.Session, error) {
	const query = `UPDATE chat_sessions SET status = 'reconnecting', reconnect_deadline_at = $4::timestamp +
	CASE WHEN last_visibility = 'hidden' THEN ($6 * interval '1 second') ELSE ($5 * interval '1 second') END, updated_at = $4
	WHERE id = $1 AND identity_key = $2 AND generation = $3 AND status = 'active'
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	return s.transition(ctx, "start reconnect", query, sessionID, identityKey, generation, now.UTC(), int64(grace/time.Second), int64(hiddenGrace/time.Second))
}

func (s Store) Activate(ctx context.Context, sessionID, identityKey string, generation int, now time.Time, activeCutoff time.Time, hiddenCutoff time.Time) (domain.Session, error) {
	const query = `UPDATE chat_sessions SET status = 'active', last_seen_at = $4, reconnect_deadline_at = NULL, generation = generation + 1, updated_at = $4
	WHERE id = $1 AND identity_key = $2 AND generation = $3 AND status IN ('active', 'reconnecting')
	AND ((status = 'reconnecting' AND reconnect_deadline_at > $4) OR
	     (status = 'active' AND ((last_visibility = 'hidden' AND last_seen_at > $6) OR
	                              (COALESCE(last_visibility, 'unknown') != 'hidden' AND last_seen_at > $5))))
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	return s.transition(ctx, "activate chat session", query, sessionID, identityKey, generation, now.UTC(), activeCutoff.UTC(), hiddenCutoff.UTC())
}

func (s Store) Touch(ctx context.Context, sessionID, identityKey string, generation int, visibility string, now time.Time, activeCutoff time.Time, hiddenCutoff time.Time) error {
	if visibility != "visible" && visibility != "hidden" {
		visibility = "unknown"
	}
	const query = `UPDATE chat_sessions SET last_seen_at = $5, last_visibility = $4, updated_at = $5
	WHERE id = $1 AND identity_key = $2 AND generation = $3 AND status = 'active'
	AND ((last_visibility = 'hidden' AND last_seen_at > $7) OR
	     (COALESCE(last_visibility, 'unknown') != 'hidden' AND last_seen_at > $6))
	RETURNING visit_id`
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin chat session touch: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var visitID int64
	if err := tx.QueryRow(ctx, query, sessionID, identityKey, generation, visibility, now.UTC(), activeCutoff.UTC(), hiddenCutoff.UTC()).Scan(&visitID); err != nil {
		return transitionError("touch chat session", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE visits SET updated_at = $2 WHERE id = $1 AND left_at IS NULL`, visitID, now.UTC()); err != nil {
		return fmt.Errorf("touch visit: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit chat session touch: %w", err)
	}
	return nil
}

func (s Store) RegisterIdentity(ctx context.Context, sessionID, identityKey string, generation int, userID int64, resumeSecret string, now time.Time) (domain.Session, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Session{}, fmt.Errorf("begin chat identity registration: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	registeredIdentity := "user:" + strconv.FormatInt(userID, 10)
	const sessionQuery = `UPDATE chat_sessions SET identity_key = $4, resume_secret_hash = $5, last_seen_at = $6, updated_at = $6, generation = generation + 1
	WHERE id = $1 AND identity_key = $2 AND generation = $3 AND status = 'active'
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	var session domain.Session
	if err := tx.QueryRow(ctx, sessionQuery, sessionID, identityKey, generation, registeredIdentity, hashSecret(resumeSecret), now.UTC()).Scan(
		&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline,
	); err != nil {
		return domain.Session{}, transitionError("register chat identity", err)
	}
	const visitQuery = `UPDATE visits SET user_id = $2, identity_key = $3, updated_at = $4 WHERE id = $1 AND left_at IS NULL`
	if tag, err := tx.Exec(ctx, visitQuery, session.VisitID, userID, registeredIdentity, now.UTC()); err != nil {
		return domain.Session{}, fmt.Errorf("register visit identity: %w", err)
	} else if tag.RowsAffected() != 1 {
		return domain.Session{}, ErrInvalidSession
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Session{}, fmt.Errorf("commit chat identity registration: %w", err)
	}
	return session, nil
}

func (s Store) MarkStale(ctx context.Context, now time.Time, heartbeat time.Duration, grace time.Duration, hiddenGrace time.Duration) ([]domain.Session, error) {
	const query = `UPDATE chat_sessions SET status = 'reconnecting', reconnect_deadline_at = last_seen_at +
	CASE WHEN last_visibility = 'hidden' THEN (($4 + $2) * interval '1 second') ELSE (($3 + $2) * interval '1 second') END, updated_at = $1
	WHERE status = 'active' AND last_seen_at <= $1::timestamp - ($2 * interval '1 second')
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	return s.sessions(ctx, "mark stale chat sessions", query, now.UTC(), int64(heartbeat/time.Second), int64(grace/time.Second), int64(hiddenGrace/time.Second))
}

func (s Store) Expired(ctx context.Context, now time.Time) ([]domain.Session, error) {
	const query = `SELECT id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at
	FROM chat_sessions WHERE status = 'reconnecting' AND reconnect_deadline_at <= $1`
	return s.sessions(ctx, "list expired chat sessions", query, now.UTC())
}

func (s Store) sessions(ctx context.Context, action string, query string, args ...any) ([]domain.Session, error) {
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", action, err)
	}
	defer rows.Close()
	var sessions []domain.Session
	for rows.Next() {
		var session domain.Session
		if err := rows.Scan(&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline); err != nil {
			return nil, fmt.Errorf("scan %s: %w", action, err)
		}
		sessions = append(sessions, session)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s: %w", action, err)
	}
	return sessions, nil
}

func (s Store) End(ctx context.Context, sessionID, identityKey string, generation int, now time.Time) (domain.Session, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Session{}, fmt.Errorf("begin chat session end: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	const sessionQuery = `UPDATE chat_sessions SET status = 'ended', ended_at = $4, reconnect_deadline_at = NULL, generation = generation + 1, updated_at = $4
	WHERE id = $1 AND identity_key = $2 AND generation = $3 AND status IN ('active', 'reconnecting')
	RETURNING id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at`
	var session domain.Session
	if err := tx.QueryRow(ctx, sessionQuery, sessionID, identityKey, generation, now.UTC()).Scan(
		&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			const endedQuery = `SELECT id, room_id, identity_key, nickname, status, generation, visit_id, reconnect_deadline_at
			FROM chat_sessions WHERE id = $1 AND identity_key = $2 AND status = 'ended'`
			if endedErr := tx.QueryRow(ctx, endedQuery, sessionID, identityKey).Scan(
				&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline,
			); endedErr == nil {
				if commitErr := tx.Commit(ctx); commitErr != nil {
					return domain.Session{}, fmt.Errorf("commit idempotent chat session end: %w", commitErr)
				}
				return session, nil
			}
		}
		return domain.Session{}, transitionError("end chat session", err)
	}
	var userID *int64
	var enteredAt time.Time
	const visitQuery = `UPDATE visits SET left_at = $2, updated_at = $2 WHERE id = $1 AND left_at IS NULL
	RETURNING user_id, entered_at`
	if err := tx.QueryRow(ctx, visitQuery, session.VisitID, now.UTC()).Scan(&userID, &enteredAt); err != nil {
		return domain.Session{}, transitionError("finish visit", err)
	}
	if userID != nil {
		const rankQuery = `UPDATE registered_users SET chat_seconds = chat_seconds + GREATEST(EXTRACT(EPOCH FROM ($2::timestamp - $1::timestamp))::integer, 0) WHERE id = $3`
		if _, err := tx.Exec(ctx, rankQuery, enteredAt, now.UTC(), *userID); err != nil {
			return domain.Session{}, fmt.Errorf("increment chat time: %w", err)
		}
	}
	const messageQuery = `INSERT INTO room_messages (room_id, kind, author, body, theme_id, appearance, reactions, font_id, font_style, sent_at, inserted_at, updated_at)
	VALUES ($1, 'system', 'system', $2, 'vertigo', '{}'::jsonb, '{}'::jsonb, 'theme', 'normal', $3, $3, $3)`
	if _, err := tx.Exec(ctx, messageQuery, session.RoomID, "из чата выходит "+session.Nickname, now.UTC()); err != nil {
		return domain.Session{}, fmt.Errorf("persist departure: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Session{}, fmt.Errorf("commit chat session end: %w", err)
	}
	return session, nil
}

func (s Store) transition(ctx context.Context, action string, query string, args ...any) (domain.Session, error) {
	var session domain.Session
	if err := s.pool.QueryRow(ctx, query, args...).Scan(
		&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Session{}, ErrInvalidSession
		}
		return domain.Session{}, transitionError(action, err)
	}
	return session, nil
}

func hashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func startError(action string, err error) error {
	return transitionError(action, err)
}

func transitionError(action string, err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidSession
	}
	return fmt.Errorf("%s: %w", action, err)
}
