package main

import (
	accountshttp "chat/api/internal/accounts/adapters/http"
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	galleryhttp "chat/api/internal/gallery/adapters/http"
	gallerypg "chat/api/internal/gallery/adapters/postgres"
	gallerys3 "chat/api/internal/gallery/adapters/s3"
	gallery "chat/api/internal/gallery/application"
	profiles "chat/api/internal/profiles/application"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
	"os"
)

type galleryPeople struct{ directory accounts.Directory }

func (p galleryPeople) Viewer(ctx context.Context, id int64) (gallery.Viewer, error) {
	v, err := p.directory.PublicationProfile(ctx, id, false)
	return gallery.Viewer{Nickname: v.Nickname, CanUpload: profiles.CanAddGalleryPhotos(v.Messages, v.Seconds)}, err
}
func (p galleryPeople) Names(ctx context.Context, ids []int64) (map[int64]string, error) {
	return p.directory.PublicNames(ctx, ids)
}
func galleryUploadGate(ctx context.Context, tx pgx.Tx, id int64) (bool, error) {
	v, err := accounts.NewDirectory(accountspg.NewAccounts(tx)).PublicationProfile(ctx, id, true)
	return profiles.CanAddGalleryPhotos(v.Messages, v.Seconds), err
}
func registerGallery(mux *http.ServeMux, pool *pgxpool.Pool, auth accountshttp.Handler) error {
	var storage gallerypg.Storage
	if os.Getenv("S3_ENABLED") == "true" {
		var err error
		storage, err = gallerys3.New(gallerys3.S3Config{Endpoint: os.Getenv("S3_ENDPOINT"), Region: os.Getenv("S3_REGION"), Bucket: os.Getenv("S3_BUCKET"), AccessKeyID: os.Getenv("S3_ACCESS_KEY_ID"), SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"), PublicBaseURL: os.Getenv("S3_PUBLIC_BASE_URL"), VirtualHosted: os.Getenv("S3_VIRTUAL_HOSTED") == "true"})
		if err != nil {
			return err
		}
	}
	service := gallery.NewService(gallerypg.NewStore(pool, galleryUploadGate, storage), galleryPeople{accounts.NewDirectory(accountspg.NewAccounts(pool))})
	galleryhttp.NewHandler(service, auth.AccountIdentity).Register(mux)
	return nil
}
