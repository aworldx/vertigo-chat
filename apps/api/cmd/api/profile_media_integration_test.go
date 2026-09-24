package main

import (
	profilespg "chat/api/internal/profiles/adapters/postgres"
	profiles "chat/api/internal/profiles/application"
	profiledomain "chat/api/internal/profiles/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func (f *chatFixture) profileMediaBoundaries(t *testing.T) {
	ctx := context.Background()
	catalogue := profilespg.NewCatalogue(f.pool)
	for _, check := range []func() error{
		func() error { _, err := catalogue.GetByUserID(ctx, 999999999); return err },
		func() error {
			_, err := catalogue.UpdateByUserID(ctx, 999999999, profiledomain.UpdateInput{})
			return err
		},
		func() error { _, err := catalogue.MediaByNickname(ctx, "missing-profile", false); return err },
	} {
		if err := check(); !errors.Is(err, profiles.ErrNotFound) {
			t.Fatal(err)
		}
	}
	if _, err := catalogue.UpdatePhotoByUserID(ctx, 1, profiledomain.PhotoInput{Bytes: []byte("bad"), ContentType: "image/png"}); !errors.Is(err, profiles.ErrInvalidPhoto) {
		t.Fatal(err)
	}
	var user int64
	if err := f.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname='fixture12'`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := f.pool.Exec(context.Background(), `UPDATE profiles SET photo=NULL,photo_key=NULL,photo_content_type=NULL WHERE user_id=$1`, user); err != nil {
			t.Error(err)
		}
	})
	if _, err := f.pool.Exec(ctx, `UPDATE profiles SET photo=NULL,photo_key=NULL,photo_content_type='image/png' WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := catalogue.MediaByNickname(ctx, "fixture12", false); !errors.Is(err, profiles.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE profiles SET photo_key='photo/key' WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := catalogue.MediaByNickname(ctx, "fixture12", false); err == nil {
		t.Fatal("remote reference without storage succeeded")
	}
	f.readRemoteProfileMedia(t)
}
func (f *chatFixture) readRemoteProfileMedia(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bucket/photo/key" {
			t.Error(r.URL.Path)
		}
		_, _ = w.Write([]byte("remote image"))
	}))
	defer server.Close()
	storage, err := profilespg.NewS3Media(profilespg.S3Config{Endpoint: server.URL, Region: "test", Bucket: "bucket", AccessKeyID: "test", SecretAccessKey: "test"})
	if err != nil {
		t.Fatal(err)
	}
	remote := profilespg.NewCatalogueWithMedia(f.pool, storage)
	image, err := remote.MediaByNickname(ctx, "fixture12", false)
	if err != nil || string(image.Bytes) != "remote image" || image.ContentType != "image/png" {
		t.Fatal(image, err)
	}
}
