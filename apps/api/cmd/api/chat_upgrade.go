package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chathttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	entrancehttp "chat/api/internal/entrance/adapters/http"
	entrance "chat/api/internal/entrance/application"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"time"
)

func upgradeChatAccount(pool *pgxpool.Pool) entrancehttp.Upgrade {
	return func(ctx context.Context, token string, generation int, input entrance.Input) (entrance.Result, error) {
		credential, err := chathttp.DecodeResume(token)
		if err != nil {
			return entrance.Result{}, accounts.ErrInvalidSession
		}
		var result entrance.Result
		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			store := chatspg.NewStore(tx)
			session, err := chats.NewCommandAuthenticator(store).Authenticate(ctx, credential.SessionID, credential.IdentityKey, credential.Secret, generation)
			if err != nil || !strings.HasPrefix(session.IdentityKey, "guest:") || session.Nickname != strings.TrimSpace(input.Nickname) {
				return accounts.ErrInvalidSession
			}
			if _, err := store.ReserveNickname(ctx, session.Nickname); err != nil {
				return err
			}
			lifecycle := chats.NewService(store, chatsessionsPolicy())
			if err := lifecycle.Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
				return err
			}
			preferences, err := preferencesService(tx).Get(ctx, session.IdentityKey)
			if err != nil {
				return err
			}
			accountStore := accountspg.NewAccounts(tx)
			principal, err := accounts.NewRegistrar(accountStore, accountspg.PBKDF2Verifier{}).Register(ctx, input.Nickname, input.Email, input.Password, input.NetworkIdentity)
			if err != nil {
				return err
			}
			result.Session, result.ResumeSecret, err = lifecycle.RegisterIdentity(ctx, session.ID, session.IdentityKey, session.Generation, principal.UserID, principal.Nickname, time.Now())
			if err != nil {
				return err
			}
			raw, err := json.Marshal(preferences)
			if err != nil {
				return err
			}
			if err := accounts.NewPreferences(accountStore).Save(ctx, principal.UserID, raw); err != nil {
				return err
			}
			token, record, err := accounts.NewSessions(accountStore).Issue(ctx, input.PreviousAccountToken, principal.UserID, time.Now())
			result.AccountToken = token
			result.AccountExpires = record.ExpiresAt
			return err
		})
		return result, err
	}
}
