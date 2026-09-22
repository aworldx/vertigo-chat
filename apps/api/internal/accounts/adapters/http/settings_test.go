package http

import (
	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type emailStoreStub struct {
	email   *string
	actor   int64
	calls   int
	failure error
}

func (s *emailStoreStub) ReadEmail(_ context.Context, id int64) (*string, error) {
	s.actor = id
	s.calls++
	return s.email, s.failure
}
func (s *emailStoreStub) UpdateEmail(_ context.Context, id int64, email string) error {
	s.actor = id
	s.calls++
	if s.failure != nil {
		return s.failure
	}
	s.email = &email
	return nil
}

func TestPrivateSettingsBoundary(t *testing.T) {
	sessions := &sessionStore{records: map[string]application.SessionRecord{}}
	auth, err := NewHandler(application.NewAuthenticator(readerStub{domain.Principal{UserID: 7}}, verifierStub(true)), application.NewRegistrar(creatorStub{}, verifierStub(true)), application.NewSessions(sessions), "https://chat.test")
	if err != nil {
		t.Fatal(err)
	}
	store := &emailStoreStub{}
	mux := http.NewServeMux()
	auth.Register(mux)
	NewSettingsHandler(application.NewSettings(store), auth.AccountIdentity).Register(mux)
	anon := request(mux, "GET", "/api/v1/auth/session", "", nil, "")
	anonCookie := anon.Result().Cookies()[0]
	if response := request(mux, "GET", "/api/v1/account/settings", "", anonCookie, ""); response.Code != 401 || store.calls != 0 {
		t.Fatal("anonymous private read", response.Code)
	}
	login := request(mux, "POST", "/api/v1/auth/login", `{"nickname":"alice","password":"secret"}`, anonCookie, decodeSession(t, anon).Data.CSRF)
	cookie := login.Result().Cookies()[0]
	csrf := decodeSession(t, login).Data.CSRF
	response := request(mux, "GET", "/api/v1/account/settings", "", cookie, "")
	if response.Code != 200 || response.Body.String() != "{\"data\":{\"email\":null}}\n" || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal(response.Body.String())
	}
	testSettingsRejectedRequests(t, mux, store, cookie, csrf)
	w := request(mux, "PUT", "/api/v1/account/settings/email", `{"email":"  PRIVATE@Example.Test  "}`, cookie, csrf)
	if w.Code != 200 || store.actor != 7 || store.email == nil || *store.email != "private@example.test" {
		t.Fatal(w.Body.String())
	}
	testSettingsFailureResponses(t, mux, store, cookie, csrf)
	store.failure = nil
	request(mux, "POST", "/api/v1/auth/logout", "", cookie, csrf)
	before := store.calls
	if w = request(mux, "GET", "/api/v1/account/settings", "", cookie, ""); w.Code != 401 || store.calls != before {
		t.Fatal("revoked session read")
	}
}

func testSettingsRejectedRequests(t *testing.T, mux *http.ServeMux, store *emailStoreStub, cookie *http.Cookie, csrf string) {
	t.Helper()
	for _, scenario := range []string{"csrf", "origin", "host", "cross_site"} {
		r := httptest.NewRequest("PUT", "https://chat.test/api/v1/account/settings/email", strings.NewReader(`{"email":"private@example.test"}`))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-CSRF-Token", csrf)
		r.AddCookie(cookie)
		switch scenario {
		case "csrf":
			r.Header.Del("X-CSRF-Token")
		case "origin":
			r.Header.Set("Origin", "https://evil.test")
		case "host":
			r.Host = "evil.test"
		case "cross_site":
			r.Header.Set("Sec-Fetch-Site", "cross-site")
		}
		before := store.calls
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != 403 || store.calls != before {
			t.Fatalf("boundary %s: %d", scenario, w.Code)
		}
	}
	for _, body := range []string{`{}`, `null`, `{"email":null}`, `{"email":5}`, `{"email":""}`, `{"email":"invalid"}`, `{"email":"x@y.z","user_id":9}`, `{"email":"x@y.z","is_admin":true}`, `{"email":"x@y.z"} {}`} {
		before := store.calls
		w := request(mux, "PUT", "/api/v1/account/settings/email", body, cookie, csrf)
		if w.Code != 422 || store.calls != before {
			t.Fatalf("input %s: %d", body, w.Code)
		}
	}
}

func testSettingsFailureResponses(t *testing.T, mux *http.ServeMux, store *emailStoreStub, cookie *http.Cookie, csrf string) {
	t.Helper()
	for _, failure := range []struct {
		err    error
		status int
		code   string
	}{{application.ErrEmailTaken, 422, "email_taken"}, {application.ErrAccountNotFound, 401, "unauthorized"}, {errors.New("database private failure"), 503, "unavailable"}} {
		store.failure = failure.err
		w := request(mux, "PUT", "/api/v1/account/settings/email", `{"email":"x@y.z"}`, cookie, csrf)
		if w.Code != failure.status || w.Body.String() != "{\"error\":\""+failure.code+"\"}\n" {
			t.Fatal(w.Body.String())
		}
	}
}
