package http

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
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

func TestMutationRequiresInternalTokenAndPreservesAbsentFields(t *testing.T) {
	updater := &updaterStub{}
	mux := http.NewServeMux()
	NewMutationHandler(application.NewEditor(updater), application.NewPhotoEditor(updater), "test-token").Register(mux)
	request := httptest.NewRequest(http.MethodPatch, "/internal/v1/profiles/7", bytes.NewBufferString(`{"profile":{"name":"Алиса"}}`))
	request.Header.Set("X-Internal-Profile-Token", "test-token")
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
	NewMutationHandler(application.NewEditor(updater), application.NewPhotoEditor(updater), "test-token").Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPatch, "/internal/v1/profiles/7", nil))
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
