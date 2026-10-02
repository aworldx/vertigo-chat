package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	pollshttp "chat/api/internal/polls/adapters/http"
	pollspg "chat/api/internal/polls/adapters/postgres"
	polls "chat/api/internal/polls/application"
	"context"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

func registerPolls(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) {
	principal := accounts.NewAuthenticator(accountspg.NewAccounts(pool), accountspg.PBKDF2Verifier{})
	admin := func(ctx context.Context, id int64) (bool, error) {
		p, err := principal.Principal(ctx, id)
		return p.HasRole("admin"), err
	}
	credentials := chats.NewCredentials(chatspg.NewStore(pool))
	chatIdentity := func(ctx context.Context, token string) (string, error) {
		v, err := chatshttp.DecodeResume(token)
		if err != nil {
			return "", err
		}
		session, err := credentials.Verify(ctx, v.SessionID, v.IdentityKey, v.Secret)
		if err != nil {
			return "", err
		}
		return session.Nickname, nil
	}
	pollshttp.NewHandler(polls.NewService(pollspg.NewStore(pool)), auth.AccountIdentity, auth.SessionIdentity, chatIdentity, admin).Register(mux)
}
