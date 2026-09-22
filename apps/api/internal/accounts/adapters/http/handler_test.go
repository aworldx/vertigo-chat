package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
)

type readerStub struct{ principal domain.Principal }

func (s readerStub) FindByNickname(context.Context, string) (domain.Principal, string, error) {
	return s.principal, "hash", nil
}
func (s readerStub) FindPrincipal(context.Context, int64) (domain.Principal, error) {
	return s.principal, nil
}

type verifierStub bool

func (s verifierStub) Verify(string, string) bool  { return bool(s) }
func (s verifierStub) Hash(string) (string, error) { return "hash", nil }

type creatorStub struct{ principal domain.Principal }

func (s creatorStub) Create(context.Context, string, string, string, string) (domain.Principal, error) {
	return s.principal, nil
}

type sessionStore struct {
	mu      sync.Mutex
	records map[string]application.SessionRecord
}

func (s *sessionStore) FindSession(_ context.Context, digest string, now time.Time) (application.SessionRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, found := s.records[digest]
	if !found || !record.ExpiresAt.After(now) {
		return record, application.ErrInvalidSession
	}
	return record, nil
}
func (s *sessionStore) ReplaceSession(_ context.Context, previous string, next application.SessionRecord, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if previous != "" {
		old, exists := s.records[previous]
		if !exists || !old.ExpiresAt.After(now) {
			return application.ErrInvalidSession
		}
		delete(s.records, previous)
	}
	s.records[next.Digest] = next
	return nil
}
func (s *sessionStore) RevokeSession(_ context.Context, digest string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.records, digest)
	return nil
}

func setupHandler(t *testing.T, principal domain.Principal, verified bool) (*http.ServeMux, *sessionStore) {
	t.Helper()
	store := &sessionStore{records: map[string]application.SessionRecord{}}
	handler, err := NewHandler(application.NewAuthenticator(readerStub{principal}, verifierStub(verified)), application.NewRegistrar(creatorStub{principal}, verifierStub(true)), application.NewSessions(store), "https://chat.test")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	handler.Register(mux)
	return mux, store
}

type sessionResponse struct {
	Data struct {
		Principal *principalDTO `json:"principal"`
		CSRF      string        `json:"csrf_token"`
	} `json:"data"`
}

func decodeSession(t *testing.T, response *httptest.ResponseRecorder) sessionResponse {
	t.Helper()
	var body sessionResponse
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}
func request(mux *http.ServeMux, method, path, body string, cookie *http.Cookie, csrf string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://chat.test"+path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "https://chat.test")
	r.Header.Set("X-CSRF-Token", csrf)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	return w
}

func TestPublicSessionLoginRotationAndLogout(t *testing.T) {
	for _, principal := range []domain.Principal{{UserID: 7, Nickname: "alice"}, {UserID: 7, Nickname: "alice", Admin: true}, {UserID: 7, Nickname: "alice", CanModerateEmojis: true}} {
		t.Run(strings.Join(roles(principal), ","), func(t *testing.T) {
			mux, _ := setupHandler(t, principal, true)
			anonymous := request(mux, "GET", "/api/v1/auth/session", "", nil, "")
			first := anonymous.Result().Cookies()[0]
			assertSecureCookie(t, first)
			if decodeSession(t, anonymous).Data.Principal != nil {
				t.Fatal("anonymous principal")
			}
			login := request(mux, "POST", "/api/v1/auth/login", `{"nickname":"alice","password":"secret"}`, first, decodeSession(t, anonymous).Data.CSRF)
			if login.Code != 200 {
				t.Fatal(login.Body.String())
			}
			logged := decodeSession(t, login)
			second := login.Result().Cookies()[0]
			if first.Value == second.Value || logged.Data.CSRF == decodeSession(t, anonymous).Data.CSRF {
				t.Fatal("session was not rotated")
			}
			if logged.Data.Principal == nil || strings.Join(logged.Data.Principal.Roles, ",") != strings.Join(roles(principal), ",") {
				t.Fatal("wrong principal/roles")
			}
			stale := request(mux, "POST", "/api/v1/auth/logout", "", first, decodeSession(t, anonymous).Data.CSRF)
			if stale.Code != 401 {
				t.Fatalf("old cookie status %d", stale.Code)
			}
			logout := request(mux, "POST", "/api/v1/auth/logout", "", second, logged.Data.CSRF)
			if logout.Code != 204 || logout.Result().Cookies()[0].MaxAge != -1 {
				t.Fatal("logout did not clear cookie")
			}
			otherTab := request(mux, "GET", "/api/v1/auth/session", "", second, "")
			if decodeSession(t, otherTab).Data.Principal != nil {
				t.Fatal("revoked session still authenticates")
			}
			for _, response := range []*httptest.ResponseRecorder{anonymous, login, stale, logout, otherTab} {
				if response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("cacheable auth response")
				}
			}
		})
	}
}

func TestRejectsCSRFAndCrossOriginBeforeCredentials(t *testing.T) {
	mux, _ := setupHandler(t, domain.Principal{UserID: 7}, true)
	anonymous := request(mux, "GET", "/api/v1/auth/session", "", nil, "")
	cookie := anonymous.Result().Cookies()[0]
	for _, path := range []string{"login", "register", "logout"} {
		for _, scenario := range []string{"missing_csrf", "wrong_csrf", "wrong_origin", "null_origin", "cross_site", "wrong_host"} {
			t.Run(path+"/"+scenario, func(t *testing.T) {
				r := httptest.NewRequest("POST", "https://chat.test/api/v1/auth/"+path, strings.NewReader(`{}`))
				r.AddCookie(cookie)
				r.Header.Set("X-CSRF-Token", decodeSession(t, anonymous).Data.CSRF)
				switch scenario {
				case "missing_csrf":
					r.Header.Del("X-CSRF-Token")
				case "wrong_csrf":
					r.Header.Set("X-CSRF-Token", "wrong")
				case "wrong_origin":
					r.Header.Set("Origin", "https://evil.test")
				case "null_origin":
					r.Header.Set("Origin", "null")
				case "cross_site":
					r.Header.Set("Sec-Fetch-Site", "cross-site")
				case "wrong_host":
					r.Host = "evil.test"
				}
				w := httptest.NewRecorder()
				mux.ServeHTTP(w, r)
				if w.Code != 403 {
					t.Fatalf("status %d", w.Code)
				}
			})
		}
	}
}

func TestInvalidPasswordInputAndExpiredCookie(t *testing.T) {
	mux, store := setupHandler(t, domain.Principal{UserID: 7}, false)
	anonymous := request(mux, "GET", "/api/v1/auth/session", "", nil, "")
	cookie := anonymous.Result().Cookies()[0]
	csrf := decodeSession(t, anonymous).Data.CSRF
	invalid := request(mux, "POST", "/api/v1/auth/login", `{"nickname":"alice","password":"wrong"}`, cookie, csrf)
	if invalid.Code != 401 || len(invalid.Result().Cookies()) != 0 {
		t.Fatal("invalid password accepted")
	}
	for _, body := range []string{`{"nickname":"alice","password":"secret","user_id":1}`, `{} {}`, `{"nickname":42}`, strings.Repeat(" ", 8193)} {
		if got := request(mux, "POST", "/api/v1/auth/login", body, cookie, csrf); got.Code != 422 {
			t.Fatalf("status %d", got.Code)
		}
	}
	for digest, record := range store.records {
		record.ExpiresAt = time.Now().Add(-time.Second)
		store.records[digest] = record
	}
	expired := request(mux, "POST", "/api/v1/auth/logout", "", cookie, csrf)
	if expired.Code != 401 {
		t.Fatalf("expired status %d", expired.Code)
	}
	cookie.Value = "forged"
	if got := request(mux, "POST", "/api/v1/auth/logout", "", cookie, csrfToken(cookie.Value)); got.Code != 401 {
		t.Fatalf("forged status %d", got.Code)
	}
}

func TestRegistrationAndNoInternalAuthentication(t *testing.T) {
	mux, _ := setupHandler(t, domain.Principal{UserID: 8, Nickname: "новый"}, true)
	anonymous := request(mux, "GET", "/api/v1/auth/session", "", nil, "")
	registration := request(mux, "POST", "/api/v1/auth/register", `{"nickname":"новый","password":"secret123","email":""}`, anonymous.Result().Cookies()[0], decodeSession(t, anonymous).Data.CSRF)
	if registration.Code != 200 || decodeSession(t, registration).Data.Principal.Nickname != "новый" {
		t.Fatal(registration.Body.String())
	}
	if got := request(mux, "POST", "/internal/v1/accounts/authenticate", "", nil, ""); got.Code != 404 {
		t.Fatal("legacy internal auth route remains")
	}
}

func TestOriginRequiresSecureDeployment(t *testing.T) {
	for _, origin := range []string{"http://chat.test", "https://chat.test/", "https://user@chat.test", "https://chat.test?q=x", ""} {
		if _, err := validateOrigin(origin); err == nil {
			t.Fatalf("accepted %q", origin)
		}
	}
	for _, origin := range []string{"http://127.0.0.1:4020", "http://localhost:4020", "https://chat.test"} {
		if _, err := validateOrigin(origin); err != nil {
			t.Fatal(err)
		}
	}
}

func TestDatabaseFailureIsUnavailable(t *testing.T) {
	response := httptest.NewRecorder()
	writeFailure(response, errors.New("database offline"))
	if response.Code != 503 || strings.Contains(response.Body.String(), "database") {
		t.Fatal(response.Body.String())
	}
}

func assertSecureCookie(t *testing.T, cookie *http.Cookie) {
	t.Helper()
	if !cookie.HttpOnly || !cookie.Secure || cookie.Name != "__Host-chat_account" || cookie.Path != "/" || cookie.Domain != "" || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("unsafe cookie: %v", cookie)
	}
}
