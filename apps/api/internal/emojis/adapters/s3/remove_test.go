package s3

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSignedRemovalAndFailure(t *testing.T) {
	status := 204
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" || r.URL.Path != "/test/emojis/image.webp" || r.Header.Get("Authorization") == "" {
			t.Error("invalid signed delete")
		}
		w.WriteHeader(status)
	}))
	defer server.Close()
	s, err := New(S3Config{Endpoint: server.URL, Region: "test", Bucket: "test", AccessKeyID: "test", SecretAccessKey: "test"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Remove(context.Background(), "emojis/image.webp"); err != nil {
		t.Fatal(err)
	}
	status = 503
	if err := s.Remove(context.Background(), "emojis/image.webp"); err == nil {
		t.Fatal("storage failure ignored")
	}
}
