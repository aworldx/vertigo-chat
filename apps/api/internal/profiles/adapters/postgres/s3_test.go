package postgres

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"chat/api/internal/profiles/domain"
)

func TestS3ObjectURLsMatchMediaLayout(t *testing.T) {
	media := s3Media{config: S3Config{Endpoint: "https://s3.example.test", Bucket: "vertigo", PublicBaseURL: "https://media.example.test"}}
	privateURL, err := media.objectURL("profiles/photo/hash.jpg", false)
	if err != nil || privateURL != "https://s3.example.test/vertigo/profiles/photo/hash.jpg" {
		t.Fatalf("private URL = %q, %v", privateURL, err)
	}
	publicURL, err := media.objectURL("profiles/photo/hash.jpg", true)
	if err != nil || publicURL != "https://media.example.test/profiles/photo/hash.jpg" {
		t.Fatalf("public URL = %q, %v", publicURL, err)
	}
}

func TestS3VirtualHostedURL(t *testing.T) {
	media := s3Media{config: S3Config{Endpoint: "https://s3.example.test", Bucket: "vertigo", VirtualHosted: true}}
	result, err := media.objectURL("profiles/thumbnail/hash.webp", false)
	if err != nil || result != "https://vertigo.s3.example.test/profiles/thumbnail/hash.webp" {
		t.Fatalf("URL = %q, %v", result, err)
	}
}

func TestS3StoreSignsAndVerifiesPublicBytes(t *testing.T) {
	objects := map[string][]byte{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			if r.Header.Get("Authorization") == "" || r.Header.Get("X-Amz-Date") == "" {
				t.Error("missing AWS signature")
			}
			body, _ := io.ReadAll(r.Body)
			objects[r.URL.Path] = body
			w.WriteHeader(http.StatusOK)
			return
		}
		if body, ok := objects[r.URL.Path]; ok {
			_, _ = w.Write(body)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	media, err := NewS3Media(S3Config{Endpoint: server.URL, PublicBaseURL: server.URL + "/bucket", Region: "test", Bucket: "bucket", AccessKeyID: "key", SecretAccessKey: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	photo, preview, err := media.store(t.Context(), domain.PhotoInput{Bytes: []byte("photo"), ContentType: "image/png"}, []byte("thumbnail"))
	if err != nil || photo.key == nil || preview.key == nil {
		t.Fatalf("store = %#v %#v %v", photo, preview, err)
	}
	loaded, err := media.load(t.Context(), *photo.key)
	if err != nil || string(loaded) != "photo" {
		t.Fatalf("load = %q, %v", loaded, err)
	}
}
