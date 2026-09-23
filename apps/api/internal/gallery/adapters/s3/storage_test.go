package s3

import (
	"bytes"
	"chat/api/internal/gallery/domain"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGalleryStorageRoundTrip(t *testing.T) {
	objects := map[string][]byte{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			if r.Header.Get("Authorization") == "" {
				t.Error("unsigned write")
			}
			objects[r.URL.Path], _ = io.ReadAll(r.Body)
			w.WriteHeader(http.StatusOK)
			return
		}
		data, ok := objects[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(data)
	}))
	defer server.Close()
	storage, err := New(S3Config{Endpoint: server.URL, Region: "test", Bucket: "gallery-test", AccessKeyID: "test", SecretAccessKey: "test", PublicBaseURL: server.URL + "/gallery-test"})
	if err != nil {
		t.Fatal(err)
	}
	input := domain.Media{Bytes: []byte("test image"), ContentType: "image/png"}
	result, err := storage.Save(context.Background(), input, "image")
	if err != nil || len(result.Bytes) != 0 || result.Key == "" {
		t.Fatal(result, err)
	}
	loaded, err := storage.Load(context.Background(), result.Key)
	if err != nil || !bytes.Equal(loaded, input.Bytes) {
		t.Fatal(loaded, err)
	}
	if _, err := storage.Load(context.Background(), "missing"); err == nil {
		t.Fatal("missing object accepted")
	}
}
