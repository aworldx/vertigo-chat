package http

import (
	"chat/api/internal/gallery/domain"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

func (h Handler) upload(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, true)
	if status != 0 {
		failureStatus(w, status, "forbidden")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2_400_000)
	if r.ParseMultipartForm(2_400_000) != nil {
		failure(w, domain.ErrPhoto)
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	image, err := readImage(r, "image", domain.MaxPhotoBytes)
	if err != nil {
		failure(w, domain.ErrPhoto)
		return
	}
	thumbnail, err := readImage(r, "thumbnail", domain.MaxThumbnailBytes)
	if err != nil && err != http.ErrMissingFile {
		failure(w, domain.ErrThumbnail)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	id, err := h.s.Add(ctx, user, domain.Upload{Image: image, Thumbnail: thumbnail, Caption: r.FormValue("caption")})
	if err != nil {
		failure(w, err)
		return
	}
	respond(w, 201, map[string]int64{"id": id})
}
func readImage(r *http.Request, name string, limit int64) (domain.Media, error) {
	file, header, err := r.FormFile(name)
	if err != nil {
		return domain.Media{}, err
	}
	return readFile(file, header, limit)
}
func readFile(file multipart.File, header *multipart.FileHeader, limit int64) (domain.Media, error) {
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	return domain.Media{Bytes: data, ContentType: header.Header.Get("Content-Type")}, err
}
