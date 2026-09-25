package http

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"chat/api/internal/profiles/application"
	"chat/api/internal/profiles/domain"
)

type catalogueStub struct{}

func (catalogueStub) List(_ context.Context, _ string, page, size int) (domain.Page, error) {
	return domain.Page{Number: page, Size: size, TotalPages: 1}, nil
}

type updaterStub struct{ input domain.UpdateInput }

type mediaStub struct{}

func (mediaStub) MediaByNickname(_ context.Context, nickname string, _ bool) (domain.Media, error) {
	if nickname == "missing" {
		return domain.Media{}, application.ErrNotFound
	}
	if nickname == "broken" {
		return domain.Media{}, errors.New("storage unavailable")
	}
	return domain.Media{Bytes: []byte("photo"), ContentType: "image/png"}, nil
}

func (s *updaterStub) UpdateByUserID(_ context.Context, _ int64, input domain.UpdateInput) (domain.Profile, error) {
	s.input = input
	return domain.Profile{Nickname: "owner"}, nil
}

func (s *updaterStub) UpdatePhotoByUserID(_ context.Context, _ int64, _ domain.PhotoInput) (domain.Profile, error) {
	return domain.Profile{Nickname: "owner"}, nil
}
func (catalogueStub) GetByNickname(_ context.Context, nickname string) (domain.Profile, error) {
	if nickname == "missing" {
		return domain.Profile{}, application.ErrNotFound
	}
	return domain.Profile{Nickname: nickname}, nil
}

func TestListPreservesProfileContract(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewCatalog(catalogueStub{})).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles?q=%20%20&page=1", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("missing no-store")
	}
	if response.Body.String() != "{\"data\":[],\"meta\":{\"page\":1,\"page_size\":12,\"query\":\"\",\"total\":0,\"total_pages\":1}}\n" {
		t.Fatalf("body = %s", response.Body.String())
	}
}
func TestShowReturnsNotFoundContract(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewCatalog(catalogueStub{})).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles/missing", nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestListRejectsNestedQueryParameters(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewCatalog(catalogueStub{})).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles?page%5Bnested%5D=1", nil))
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestMutationUsesSessionActorAndPreservesAbsentFields(t *testing.T) {
	updater := &updaterStub{}
	mux := http.NewServeMux()
	NewMutationHandler(application.NewEditor(updater), application.NewPhotoEditor(updater), application.NewAccountCatalog(updater), func(*http.Request, bool) (int64, int) { return 7, 0 }).Register(mux)
	request := httptest.NewRequest(http.MethodPatch, "/api/v1/account/profile", bytes.NewBufferString(`{"profile":{"name":"Алиса"}}`))
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	if !updater.input.Name.Set || updater.input.About.Set {
		t.Fatalf("input = %#v", updater.input)
	}
}

func TestMutationRejectsUntrustedCall(t *testing.T) {
	mux := http.NewServeMux()
	updater := &updaterStub{}
	NewMutationHandler(application.NewEditor(updater), application.NewPhotoEditor(updater), application.NewAccountCatalog(updater), func(*http.Request, bool) (int64, int) { return 0, http.StatusUnauthorized }).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/api/v1/account/profile", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestMediaPreservesExistingPublicResponse(t *testing.T) {
	mux := http.NewServeMux()
	NewMediaHandler(application.NewMediaService(mediaStub{})).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles/owner/photo", nil))
	if response.Code != http.StatusOK || response.Body.String() != "photo" {
		t.Fatalf("response = %d %q", response.Code, response.Body.String())
	}
	if response.Header().Get("Content-Type") != "image/png" || response.Header().Get("Cache-Control") != "public, max-age=300" {
		t.Fatalf("headers = %#v", response.Header())
	}
}

func TestMediaReturnsNotFoundWithoutLeakingStorageErrors(t *testing.T) {
	mux := http.NewServeMux()
	NewMediaHandler(application.NewMediaService(mediaStub{})).Register(mux)
	for _, nickname := range []string{"missing", "broken"} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles/"+nickname+"/photo", nil))
		if nickname == "missing" && response.Code != http.StatusNotFound {
			t.Fatalf("missing status = %d", response.Code)
		}
		if nickname == "broken" && response.Code != http.StatusBadGateway {
			t.Fatalf("broken status = %d", response.Code)
		}
	}
}

func (s *updaterStub) GetByUserID(context.Context, int64) (domain.Profile, error) {
	return domain.Profile{Nickname: "owner"}, nil
}

func TestMutationClearsExplicitNullAndRejectsCallerIdentity(t *testing.T) {
	updater := &updaterStub{}
	mux := http.NewServeMux()
	NewMutationHandler(application.NewEditor(updater), application.NewPhotoEditor(updater), application.NewAccountCatalog(updater), func(*http.Request, bool) (int64, int) { return 7, 0 }).Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/api/v1/account/profile", bytes.NewBufferString(`{"profile":{"name":null}}`)))
	if response.Code != http.StatusOK || !updater.input.Name.Set || updater.input.Name.Value != nil {
		t.Fatal("explicit null did not clear field")
	}
	response = httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/api/v1/account/profile", bytes.NewBufferString(`{"user_id":8,"profile":{"name":"other"}}`)))
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatal("accepted caller-supplied identity")
	}
}

func TestChatProfileIncludesKarmaAndHandlesMissingProfile(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewCatalog(catalogueStub{})).Register(mux)
	for _, tc := range []struct {
		nickname string
		status   int
	}{{"owner", 200}, {"missing", 404}} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/chat/profiles/"+tc.nickname, nil))
		if w.Code != tc.status {
			t.Fatal(w.Code, w.Body)
		}
		if tc.status == 200 && !bytes.Contains(w.Body.Bytes(), []byte(`"karma":0`)) {
			t.Fatal(w.Body)
		}
	}
}

type failingUpdater struct{ err error }

func (s failingUpdater) UpdateByUserID(context.Context, int64, domain.UpdateInput) (domain.Profile, error) {
	return domain.Profile{}, s.err
}
func (s failingUpdater) UpdatePhotoByUserID(context.Context, int64, domain.PhotoInput) (domain.Profile, error) {
	return domain.Profile{}, s.err
}
func (s failingUpdater) GetByUserID(context.Context, int64) (domain.Profile, error) {
	return domain.Profile{}, s.err
}
func TestProfileMutationFailureContracts(t *testing.T) {
	for _, tc := range []struct {
		method, body string
		identity     int
		err          error
		status       int
	}{
		{"PATCH", `{"profile":{}}`, 403, nil, 403}, {"PATCH", `{"profile":{}}`, 503, nil, 503},
		{"PATCH", `{"profile":{}}`, 0, application.ErrNotFound, 404}, {"PATCH", `{"profile":{}}`, 0, errors.New("private database details"), 502},
		{"GET", "", 0, application.ErrNotFound, 404},
		{"PATCH", `{"profile":{"name":false}}`, 0, nil, 422}, {"PATCH", `{"profile":{"birth_date":42}}`, 0, nil, 422}, {"PATCH", `{"profile":{"gender":[]}}`, 0, nil, 422}, {"PATCH", `{"profile":{"about":{}}}`, 0, nil, 422}, {"PATCH", `{} {}`, 0, nil, 422},
		{"PATCH", `{"profile":{"birth_date":"not a date"}}`, 0, nil, 422},
	} {
		t.Run(tc.method+tc.body, func(t *testing.T) {
			store := failingUpdater{tc.err}
			mux := http.NewServeMux()
			NewMutationHandler(application.NewEditor(store), application.NewPhotoEditor(store), application.NewAccountCatalog(store), func(*http.Request, bool) (int64, int) { return 1, tc.identity }).Register(mux)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest(tc.method, "/api/v1/account/profile", bytes.NewBufferString(tc.body)))
			if w.Code != tc.status || bytes.Contains(w.Body.Bytes(), []byte("private database details")) {
				t.Fatal(w.Code, w.Body)
			}
		})
	}
}

func TestPhotoUploadReturnsDistinctValidationMissingAndStorageErrors(t *testing.T) {
	for _, tc := range []struct {
		err    error
		status int
	}{{application.ErrNotFound, 404}, {application.ErrInvalidPhoto, 422}, {errors.New("storage offline"), 502}} {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		header := textproto.MIMEHeader{}
		header.Set("Content-Disposition", `form-data; name="photo"; filename="photo.png"`)
		header.Set("Content-Type", "image/png")
		file, err := writer.CreatePart(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte("\x89PNG\r\n\x1a\n")); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		store := failingUpdater{tc.err}
		mux := http.NewServeMux()
		NewMutationHandler(application.NewEditor(store), application.NewPhotoEditor(store), application.NewAccountCatalog(store), func(*http.Request, bool) (int64, int) { return 1, 0 }).Register(mux)
		r := httptest.NewRequest("PUT", "/api/v1/account/profile/photo", &body)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatal(w.Code, w.Body)
		}
	}
}

func TestProfileListRejectsMalformedPageAndOversizedQuery(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewCatalog(catalogueStub{})).Register(mux)
	for _, query := range []string{"?page=oops", "?page=0", "?q=" + string(bytes.Repeat([]byte("a"), 81))} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/profiles"+query, nil))
		if response.Code != http.StatusUnprocessableEntity || !bytes.Contains(response.Body.Bytes(), []byte("invalid_params")) {
			t.Fatalf("%s: %d %s", query, response.Code, response.Body.String())
		}
	}
}
