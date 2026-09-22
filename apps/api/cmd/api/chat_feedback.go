package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	feedbackhttp "chat/api/internal/feedback/adapters/http"
	feedbackpg "chat/api/internal/feedback/adapters/postgres"
	feedback "chat/api/internal/feedback/application"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

func registerFeedback(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) {
	actor := func(w http.ResponseWriter, r *http.Request) (int64, string, bool) {
		if _, ok := auth.AuthorizeMutation(w, r); !ok {
			return 0, "", false
		}
		id, status := auth.AccountIdentity(r, false)
		if status == 401 {
			return 0, "", true
		}
		if status != 0 {
			http.Error(w, "forbidden", status)
			return 0, "", false
		}
		profile, err := accounts.NewPreferences(accountspg.NewAccounts(pool)).Get(r.Context(), id)
		if err != nil {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return 0, "", false
		}
		return id, profile.Nickname, true
	}
	feedbackhttp.NewHandler(feedback.NewService(feedbackpg.NewStore(pool)), actor).Register(mux)
}
