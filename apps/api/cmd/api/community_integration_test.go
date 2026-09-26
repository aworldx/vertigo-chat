package main

import (
	"bytes"
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	gallerypg "chat/api/internal/gallery/adapters/postgres"
	gallery "chat/api/internal/gallery/application"
	gallerydomain "chat/api/internal/gallery/domain"
	librarypg "chat/api/internal/library/adapters/postgres"
	library "chat/api/internal/library/application"
	librarydomain "chat/api/internal/library/domain"
	"chat/api/migrations"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
)

func TestCommunityPostgres(t *testing.T) {
	url := os.Getenv("GO_COMMUNITY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set GO_COMMUNITY_TEST_DATABASE_URL to an isolated disposable DB")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE registered_users SET public_message_count=200,chat_seconds=72000,is_admin=(nickname='fixture01'),can_moderate_emojis=(nickname='fixture02')`); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()
	store := accountspg.NewAccounts(pool)
	auth, err := accountshttp.NewHandler(accounts.NewAuthenticator(store, accountspg.PBKDF2Verifier{}), accounts.NewRegistrar(registrationCreator{pool}, accountspg.PBKDF2Verifier{}), accounts.NewSessions(store), server.URL)
	if err != nil {
		t.Fatal(err)
	}
	auth.Register(mux)
	registerFeedback(mux, pool, auth)
	if err := registerGallery(mux, pool, auth); err != nil {
		t.Fatal(err)
	}
	registerLibrary(mux, pool, auth)
	if err := registerAdmin(mux, pool, auth); err != nil {
		t.Fatal(err)
	}
	jar, _ := cookiejar.New(nil)
	f := chatFixture{pool: pool, server: server, client: &http.Client{Jar: jar}}
	t.Run("anonymous and CSRF boundaries", func(t *testing.T) {
		communityRequest(t, &f, "GET", "/api/v1/gallery", "", 200, false)
		communityRequest(t, &f, "POST", "/api/v1/library", `{"title":"x","body":"y"}`, 401, false)
		communityRequest(t, &f, "GET", "/api/v1/admin/database", "", 401, false)
		communityRequest(t, &f, "GET", "/api/v1/admin/bots", "", 401, false)
	})
	f.post(t, "/api/v1/auth/login", `{"nickname":"fixture01","password":"secret123"}`, 200)
	t.Run("bot settings permissions persistence and budget enforcement", f.botManagement)
	t.Run("registered feedback identity and CSRF", f.registeredFeedback)
	t.Run("library normalization ownership and validation", func(t *testing.T) {
		communityRequest(t, &f, "POST", "/api/v1/library", `{"title":"x","body":"y"}`, 403, false)
		body := communityRequest(t, &f, "POST", "/api/v1/library", `{"title":" Заголовок ","body":" Текст ","series":"","part_number":2}`, 201, true)
		var v struct{ ID int64 }
		_ = json.Unmarshal(body, &v)
		communityRequest(t, &f, "PUT", fmt.Sprintf("/api/v1/library/%d", v.ID), `{"title":"x","body":"y","user_id":2}`, 422, true)
		f.post(t, "/api/v1/auth/login", `{"nickname":"fixture02","password":"secret123"}`, 200)
		communityRequest(t, &f, "PUT", fmt.Sprintf("/api/v1/library/%d", v.ID), `{"title":"чужая","body":"x"}`, 403, true)
		var title string
		var part *int
		if err := pool.QueryRow(ctx, `SELECT title,part_number FROM library_articles WHERE id=$1`, v.ID).Scan(&title, &part); err != nil || title != "Заголовок" || part != nil {
			t.Fatal(title, part, err)
		}
	})
	t.Run("moderator cannot inspect database", func(t *testing.T) {
		communityRequest(t, &f, "GET", "/api/v1/admin/database", "", 403, false)
		communityRequest(t, &f, "GET", "/api/v1/admin/emojis", "", 200, false)
		body := communityRequest(t, &f, "POST", "/api/v1/admin/emoji-tags", `{"name":" ГРУСТЬ ","triggers":["Печаль","печаль"]}`, 201, true)
		var v struct{ ID int64 }
		_ = json.Unmarshal(body, &v)
		communityRequest(t, &f, "DELETE", fmt.Sprintf("/api/v1/admin/emoji-tags/%d", v.ID), "{}", 200, true)
	})
	t.Run("regular account cannot moderate", func(t *testing.T) {
		f.post(t, "/api/v1/auth/login", `{"nickname":"fixture03","password":"secret123"}`, 200)
		communityRequest(t, &f, "GET", "/api/v1/admin/emojis", "", 403, false)
		communityRequest(t, &f, "POST", "/api/v1/admin/emoji-tags", `{"name":"x","triggers":[]}`, 403, true)
	})
	t.Run("gallery concurrent quota and idempotent likes", func(t *testing.T) { communityGallery(t, pool) })
	t.Run("library concurrent daily quota", func(t *testing.T) { communityLibrary(t, pool) })
	t.Run("admin table whitelist", func(t *testing.T) {
		f.post(t, "/api/v1/auth/login", `{"nickname":"fixture01","password":"secret123"}`, 200)
		communityRequest(t, &f, "GET", "/api/v1/admin/database?table=registered_users%3BDROP%20TABLE%20registered_users", "", 200, false)
	})
	t.Run("gallery multipart invalid image", func(t *testing.T) {
		var body bytes.Buffer
		w := multipart.NewWriter(&body)
		file, err := w.CreateFormFile("image", "bad.png")
		if err != nil {
			t.Fatal(err)
		}
		_, _ = file.Write([]byte("not an image"))
		_ = w.Close()
		f.refresh(t)
		r, _ := http.NewRequest("POST", server.URL+"/api/v1/gallery", &body)
		r.Header.Set("Content-Type", w.FormDataContentType())
		r.Header.Set("X-CSRF-Token", f.csrf)
		res, err := f.client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		_ = res.Body.Close()
		if res.StatusCode != 422 {
			t.Fatal(res.StatusCode)
		}
	})
}
func communityRequest(t *testing.T, f *chatFixture, method, path, body string, status int, csrf bool) []byte {
	t.Helper()
	if csrf {
		f.refresh(t)
	}
	r, err := http.NewRequest(method, f.server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	r.Header.Set("Content-Type", "application/json")
	if csrf {
		r.Header.Set("X-CSRF-Token", f.csrf)
	}
	response, err := f.client.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = response.Body.Close() }()
	data, _ := io.ReadAll(response.Body)
	if response.StatusCode != status {
		t.Fatalf("%s %s: %d want %d: %s", method, path, response.StatusCode, status, data)
	}
	return data
}
func communityGallery(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	service := gallery.NewService(gallerypg.NewStore(pool, galleryUploadGate, nil), galleryPeople{accounts.NewDirectory(accountspg.NewAccounts(pool))})
	input := gallery.Upload{Image: gallery.Media{Bytes: []byte{137, 80, 78, 71, 13, 10, 26, 10}, ContentType: "image/png"}, Caption: " вечер "}
	var wg sync.WaitGroup
	results := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := service.Add(ctx, 1, input); results <- err }()
	}
	wg.Wait()
	close(results)
	success, limited := 0, 0
	for err := range results {
		switch err {
		case nil:
			success++
		case gallerydomain.ErrDaily:
			limited++
		default:
			t.Fatal(err)
		}
	}
	if success != 5 || limited != 3 {
		t.Fatal(success, limited)
	}
	communityGalleryOwnership(t, pool, service, input)
}
func communityGalleryOwnership(t *testing.T, pool *pgxpool.Pool, service gallery.Service, input gallery.Upload) {
	ctx := context.Background()
	photos, _, _, err := service.List(ctx, 2)
	if err != nil || len(photos) != 5 {
		t.Fatal(len(photos), err)
	}
	id := photos[0].ID
	if service.Caption(ctx, 2, id, "changed") != gallerydomain.ErrNotFound {
		t.Fatal("ownership")
	}
	if service.Like(ctx, 1, id, true) != gallerydomain.ErrForbidden {
		t.Fatal("own like")
	}
	for range 2 {
		if err := service.Like(ctx, 2, id, true); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM gallery_photo_likes WHERE photo_id=$1`, id).Scan(&count); err != nil || count != 1 {
		t.Fatal(count, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE registered_users SET public_message_count=199 WHERE id=3`); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Add(ctx, 3, input); err != gallerydomain.ErrRank {
		t.Fatal(err)
	}
}
func communityLibrary(t *testing.T, pool *pgxpool.Pool) {
	ctx := context.Background()
	service := library.NewService(librarypg.NewStore(pool, libraryGate), libraryPeople{accounts.NewDirectory(accountspg.NewAccounts(pool))})
	results := make(chan error, 12)
	var wg sync.WaitGroup
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.Save(ctx, 4, 0, library.Input{Title: "Title", Body: "Body"})
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	success, limited := 0, 0
	for err := range results {
		switch err {
		case nil:
			success++
		case librarydomain.ErrDaily:
			limited++
		default:
			t.Fatal(err)
		}
	}
	if success != 10 || limited != 2 {
		t.Fatal(success, limited)
	}
}

func (f *chatFixture) registeredFeedback(t *testing.T) {
	communityRequest(t, f, "POST", "/api/v1/chat/feedback", `{"name":"Forged","body":"Useful feedback"}`, 403, false)
	communityRequest(t, f, "POST", "/api/v1/chat/feedback", `{"name":"Forged","body":"Useful feedback"}`, 201, true)
	var name string
	if err := f.pool.QueryRow(context.Background(), `SELECT name FROM feedback_entries ORDER BY id DESC LIMIT 1`).Scan(&name); err != nil || name != "fixture01" {
		t.Fatal(name, err)
	}
}
