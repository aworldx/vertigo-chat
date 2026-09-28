package main

import (
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	tetrishttp "chat/api/internal/tetris/adapters/http"
	tetrispg "chat/api/internal/tetris/adapters/postgres"
	tetris "chat/api/internal/tetris/application"
	"chat/api/internal/tetris/domain"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type gameInvitations struct{ rooms rooms.GameInvitations }

func (g gameInvitations) Publish(ctx context.Context, i tetris.Invitation) error {
	body, err := json.Marshal(struct {
		ID      string   `json:"id"`
		Code    string   `json:"code"`
		Status  string   `json:"status"`
		Players []string `json:"players"`
	}{i.ID, i.Code, i.Status, i.Players})
	if err != nil {
		return err
	}
	return g.rooms.Publish(ctx, i.Room, i.ID, i.Host, string(body))
}
func registerTetris(ctx context.Context, mux *http.ServeMux, pool *pgxpool.Pool, origin string) error {
	lease, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	var owner bool
	if err := lease.QueryRow(ctx, `SELECT pg_try_advisory_lock(674923008)`).Scan(&owner); err != nil || !owner {
		lease.Release()
		return errors.New("tetris requires one active API owner")
	}
	go func() {
		<-ctx.Done()
		release, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_, _ = lease.Exec(release, `SELECT pg_advisory_unlock(674923008)`)
		lease.Release()
	}()
	invitations := rooms.NewGameInvitations(roompg.NewStore(pool))
	if err := invitations.Cancel(ctx); err != nil {
		return err
	}
	service := tetris.NewService(tetrispg.NewStore(pool), gameInvitations{invitations})
	credentials := chats.NewCredentials(chatspg.NewStore(pool))
	auth := func(ctx context.Context, token string) (domain.Actor, error) {
		resume, err := chatshttp.DecodeResume(token)
		if err != nil {
			return domain.Actor{}, err
		}
		session, err := credentials.Verify(ctx, resume.SessionID, resume.IdentityKey, resume.Secret)
		if err != nil {
			return domain.Actor{}, err
		}
		userID := int64(0)
		if strings.HasPrefix(session.IdentityKey, "user:") {
			userID, _ = strconv.ParseInt(strings.TrimPrefix(session.IdentityKey, "user:"), 10, 64)
		}
		return domain.Actor{Key: session.IdentityKey, Room: session.RoomID, Nickname: session.Nickname, UserID: userID}, nil
	}
	tetrishttp.NewHandler(service, auth, origin).Register(mux)
	go service.Run(ctx)
	return nil
}
