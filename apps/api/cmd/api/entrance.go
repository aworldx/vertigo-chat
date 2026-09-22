package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	accountdomain "chat/api/internal/accounts/domain"
	chathttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	chatdomain "chat/api/internal/chatsessions/domain"
	entrance "chat/api/internal/entrance/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	roomapp "chat/api/internal/rooms/application"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
	"strings"
	"time"
)

// Cross-context transactions and concrete dependencies belong to the composition
// root. Each context continues to access only its own repository and rules.
func entranceWork(pool *pgxpool.Pool) entrance.UnitOfWork {
	return func(ctx context.Context, nickname string, action func(entrance.Accounts, entrance.Sessions) error) error {
		return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			store := chatspg.NewStore(tx)
			available, err := store.ReserveNickname(ctx, nickname)
			if err != nil {
				return err
			}
			if !available {
				return entrance.ErrNicknameOnline
			}
			accountStore := accountspg.NewAccounts(tx)
			return action(entranceAccounts{accounts.NewAuthenticator(accountStore, accountspg.PBKDF2Verifier{}), accounts.NewRegistrar(accountStore, accountspg.PBKDF2Verifier{}), accounts.NewSessions(accountStore)}, chats.NewService(store, chatsessionsPolicy()))
		})
	}
}

type entranceAccounts struct {
	accounts.Authenticator
	accounts.Registrar
	sessions accounts.Sessions
}

func (a entranceAccounts) Issue(ctx context.Context, previous string, userID int64, now time.Time) (string, time.Time, error) {
	token, record, err := a.sessions.Issue(ctx, previous, userID, now)
	return token, record.ExpiresAt, err
}

type registrationCreator struct{ pool *pgxpool.Pool }

func (c registrationCreator) Create(ctx context.Context, nickname, email, hash, network string) (accountdomain.Principal, error) {
	var principal accountdomain.Principal
	err := pgx.BeginFunc(ctx, c.pool, func(tx pgx.Tx) error {
		available, err := chatspg.NewStore(tx).ReserveNickname(ctx, nickname)
		if err != nil {
			return err
		}
		if !available {
			return accounts.ErrInvalidRegistration
		}
		principal, err = accountspg.NewAccounts(tx).Create(ctx, nickname, email, hash, network)
		return err
	})
	return principal, err
}

func sendRoomMessage(pool *pgxpool.Pool) chathttp.SendMessage {
	return func(ctx context.Context, session chatdomain.Session, clientID, body string) (roomdomain.Message, error) {
		var message roomdomain.Message
		err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			lifecycle := chats.NewService(chatspg.NewStore(tx), chatsessionsPolicy())
			if err := lifecycle.Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
				return err
			}
			preferences, err := preferencesService(tx).Get(ctx, session.IdentityKey)
			if err != nil {
				return err
			}
			peers, err := chatspg.NewStore(tx).Presence(ctx, session.RoomID)
			if err != nil {
				return err
			}
			names := []string{"Хичкок"}
			for _, peer := range peers {
				names = append(names, peer.Nickname)
			}
			recipient := roomapp.Recipient(body, names)
			appearance := roomdomain.Appearance{Dark: roomdomain.Colors{Nickname: preferences.Appearance.Dark.Nickname, Text: preferences.Appearance.Dark.Text}, Light: roomdomain.Colors{Nickname: preferences.Appearance.Light.Nickname, Text: preferences.Appearance.Light.Text}}
			message, err = roomapp.NewService(roompg.NewStore(tx)).Send(ctx, roomdomain.Author{Recipient: recipient, RoomID: session.RoomID, Identity: session.IdentityKey, Nickname: session.Nickname, Appearance: &appearance, FontID: preferences.Font, FontStyle: preferences.Style}, clientID, body)
			if err == nil && message.Inserted && strings.HasPrefix(session.IdentityKey, "user:") {
				userID, parseErr := strconv.ParseInt(strings.TrimPrefix(session.IdentityKey, "user:"), 10, 64)
				if parseErr != nil {
					return parseErr
				}
				return accounts.NewProgress(accountspg.NewAccounts(tx)).RecordMessage(ctx, userID)
			}
			return err
		})
		return message, err
	}
}
