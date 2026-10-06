package main

// This test-only server is never included in the production binary. Its fixture
// provider and clock controls allow browser tests without Google credentials.
import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chatshttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	entrancehttp "chat/api/internal/entrance/adapters/http"
	entrance "chat/api/internal/entrance/application"
	geopg "chat/api/internal/geogame/adapters/postgres"
	"chat/api/internal/geogame/domain"
	"chat/api/internal/observability"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"chat/api/internal/webdelivery"
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
	"testing"
	"time"
)

type browserGeoQuestions struct{}

func (browserGeoQuestions) Configured() bool { return true }
func (browserGeoQuestions) Prepare(context.Context) ([]domain.Question, error) {
	qs := make([]domain.Question, 5)
	for i := range qs {
		qs[i] = domain.Question{ID: fmt.Sprintf("test-only-%d", i), PanoID: fmt.Sprintf("fixture-%d", i), Place: domain.Place{Country: "Италия", City: "Манарола", Countries: []string{"Италия", "Italy", "IT"}, Cities: []string{"Манарола", "Manarola"}}, Position: domain.Point{Lat: 44.1078, Lng: 9.7292}, Source: "TEST FIXTURE", Author: "TEST"}
	}
	return qs, nil
}
func TestGeoBrowserServer(t *testing.T) {
	if os.Getenv("GEO_BROWSER_TEST") != "1" {
		t.Skip("explicit local browser fixture server only")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	mux := http.NewServeMux()
	origin := "http://127.0.0.1:4094"
	store := accountspg.NewAccounts(pool)
	auth, err := accountshttp.NewHandler(accounts.NewAuthenticator(store, accountspg.PBKDF2Verifier{}), accounts.NewRegistrar(registrationCreator{pool}, accountspg.PBKDF2Verifier{}), accounts.NewSessions(store), origin)
	if err != nil {
		t.Fatal(err)
	}
	auth.Register(mux)
	entrancehttp.NewHandler(entrance.NewService(entranceWork(pool)), auth.AuthorizeMutation, auth.SetSessionCookie, func(result entrance.Result) string {
		return chatshttp.EncodeResume(chatshttp.Resume{SessionID: result.Session.ID, IdentityKey: result.Session.IdentityKey, Secret: result.ResumeSecret})
	}).WithUpgrade(upgradeChatAccount(pool)).Register(mux)
	lifecycle := chats.NewService(chatspg.NewStore(pool), chatsessionsPolicy())
	chatshttp.NewSocket(lifecycle, chatspg.NewStore(pool), rooms.NewService(roompg.NewStore(pool)), sendRoomMessage(pool), origin).WithExperience(roomExperience(pool, observability.NewMetrics())).Register(mux)
	registerGeoProvider(ctx, mux, pool, origin, browserGeoQuestions{}, "test-public-key")
	if err := webdelivery.Register(mux, os.DirFS(os.Getenv("WEB_ASSETS_DIR")), origin); err != nil {
		t.Fatal(err)
	}
	geoBrowserControls(mux, pool)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("test-fixture-server")) })
	server := &http.Server{Addr: "0.0.0.0:4094", Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	t.Log("TEST ONLY geography browser fixture listening on :4094")
	if err := server.ListenAndServe(); err != nil {
		t.Fatal(err)
	}
}
func geoBrowserControls(mux *http.ServeMux, pool *pgxpool.Pool) {
	mux.HandleFunc("POST /__test/geo/advance", func(w http.ResponseWriter, r *http.Request) {
		room := r.URL.Query().Get("room")
		if room == "" {
			room = "lobby"
		}
		err := (geopg.Store{Pool: pool}).Update(r.Context(), room, func(g *domain.Game) error {
			g.Deadline = time.Now().Add(-time.Second)
			g.Advance(time.Now())
			return nil
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /__test/geo/reset", func(w http.ResponseWriter, r *http.Request) {
		if _, err := pool.Exec(r.Context(), `DELETE FROM geo_room_games`); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
