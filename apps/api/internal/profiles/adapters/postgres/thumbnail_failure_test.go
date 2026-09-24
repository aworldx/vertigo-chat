package postgres

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestThumbnailRejectsMismatchedSignaturesAndUnavailableProcessor(t *testing.T) {
	for _, tc := range []struct {
		data       []byte
		kind, want string
		valid      bool
	}{
		{[]byte{255, 216, 255}, "image/jpeg", "jpeg", true}, {[]byte("RIFF1234WEBP"), "image/webp", "webp", true}, {[]byte("bad"), "image/png", "", false}, {[]byte{255, 216, 255}, "image/png", "", false},
	} {
		format, valid := imageFormat(tc.data, tc.kind)
		if format != tc.want || valid != tc.valid {
			t.Fatal(format, valid)
		}
	}
	if _, err := thumbnail(context.Background(), []byte("bad"), "image/png"); err == nil {
		t.Fatal("invalid image accepted")
	}
	t.Setenv("PATH", t.TempDir())
	png := []byte("\x89PNG\r\n\x1a\n")
	if _, err := thumbnail(context.Background(), png, "image/png"); err == nil {
		t.Fatal("missing processor accepted")
	}
	processor := filepath.Join(t.TempDir(), "convert")
	if err := os.WriteFile(processor, []byte("#!/bin/sh\nexit 1\n"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", filepath.Dir(processor))
	if _, err := thumbnail(context.Background(), png, "image/png"); err == nil {
		t.Fatal("processor failure accepted")
	}
	t.Setenv("TMPDIR", filepath.Join(t.TempDir(), "missing"))
	if _, err := thumbnail(context.Background(), png, "image/png"); err == nil {
		t.Fatal("missing temporary directory accepted")
	}
}
func TestDatabaseMediaCannotReadRemoteObjects(t *testing.T) {
	if _, err := (databaseMedia{}).load(context.Background(), "remote-key"); err == nil {
		t.Fatal("remote key silently accepted by local media store")
	}
}
