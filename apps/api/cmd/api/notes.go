package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	noteshttp "chat/api/internal/notes/adapters/http"
	notespg "chat/api/internal/notes/adapters/postgres"
	notes "chat/api/internal/notes/application"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

func registerNotes(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) {
	noteshttp.NewHandler(notes.NewService(notespg.NewStore(pool)), auth.AccountIdentity).Register(mux)
}
