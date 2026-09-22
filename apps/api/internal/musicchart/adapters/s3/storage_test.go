package s3

import (
	"chat/api/internal/musicchart/domain"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSignedUploadAndPublicVerification(t *testing.T) {
	var data []byte
	var mismatch bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ") || !strings.HasPrefix(r.URL.Path, "/bucket/music-chart/audio/") {
				t.Error("invalid signed upload")
			}
			data, _ = io.ReadAll(r.Body)
			w.WriteHeader(http.StatusOK)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/public/music-chart/audio/") {
			t.Error("public base incorrectly rewritten")
		}
		if mismatch {
			_, _ = w.Write([]byte("wrong bytes"))
		} else {
			_, _ = w.Write(data)
		}
	}))
	defer server.Close()
	storage, err := New(S3Config{Endpoint: server.URL, PublicBaseURL: server.URL + "/public", Region: "test", Bucket: "bucket", AccessKeyID: "test", SecretAccessKey: "test"})
	if err != nil {
		t.Fatal(err)
	}
	audio, err := storage.Save(t.Context(), domain.Audio{Bytes: []byte("ID3-audio"), ContentType: "audio/mpeg"})
	if err != nil || len(audio.Bytes) != 0 || !strings.HasPrefix(audio.Key, "music-chart/audio/") || !strings.HasSuffix(audio.Key, ".mp3") {
		t.Fatal(audio, err)
	}
	mismatch = true
	if _, err := storage.Save(t.Context(), domain.Audio{Bytes: []byte("ID3-new"), ContentType: "audio/mpeg"}); err == nil {
		t.Fatal("unverified public bytes accepted")
	}
}
