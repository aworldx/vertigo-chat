package application

import (
	"context"
	"errors"
	"regexp"
)

var ErrUpload = errors.New("invalid emoji upload")
var codePattern = regexp.MustCompile(`^:[\p{Ll}\p{Nd}_]{2,30}:$`)

type Upload struct {
	UserID            int64
	Code, ContentType string
	Bytes             []byte
	Width, Height     int
	Animated          bool
}
type UploadStore interface {
	Submit(context.Context, Upload) error
}
type ImageInspector interface {
	Inspect(context.Context, []byte, string) (int, int, bool, error)
}
type Uploader struct {
	store  UploadStore
	images ImageInspector
}

func NewUploader(s UploadStore, i ImageInspector) Uploader { return Uploader{s, i} }
func (u Uploader) Submit(ctx context.Context, value Upload) error {
	if value.UserID <= 0 || !codePattern.MatchString(value.Code) || len(value.Bytes) == 0 || len(value.Bytes) > 700000 {
		return ErrUpload
	}
	width, height, animated, err := u.images.Inspect(ctx, value.Bytes, value.ContentType)
	if err != nil || width < 1 || width > 100 || height < 1 || height > 100 {
		return ErrUpload
	}
	value.Width = width
	value.Height = height
	value.Animated = animated
	return u.store.Submit(ctx, value)
}
