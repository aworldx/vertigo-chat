package domain

import (
	"bytes"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrNotFound    = errors.New("not_found")
	ErrForbidden   = errors.New("forbidden")
	ErrRank        = errors.New("statist_required")
	ErrTotal       = errors.New("photo_limit_reached")
	ErrDaily       = errors.New("daily_photo_limit_reached")
	ErrCaption     = errors.New("invalid_caption")
	ErrPhoto       = errors.New("invalid_photo")
	ErrThumbnail   = errors.New("invalid_thumbnail")
	ErrUnavailable = errors.New("unavailable")
)

const MaxPhotoBytes = 2_000_000
const MaxThumbnailBytes = 300_000

type Media struct {
	Bytes            []byte
	Key, ContentType string
}
type Upload struct {
	Image, Thumbnail Media
	Caption          string
}
type Photo struct {
	ID, UserID   int64
	Caption      string
	InsertedAt   time.Time
	HasThumbnail bool
	Likes        int
	Liked        bool
}

func Caption(value string) (string, error) {
	value = strings.TrimSpace(value)
	if !utf8.ValidString(value) || utf8.RuneCountInString(value) > 280 {
		return "", ErrCaption
	}
	return value, nil
}
func ValidImage(m Media, limit int) bool {
	if len(m.Bytes) == 0 || len(m.Bytes) > limit {
		return false
	}
	switch m.ContentType {
	case "image/jpeg":
		return bytes.HasPrefix(m.Bytes, []byte{0xff, 0xd8, 0xff})
	case "image/png":
		return bytes.HasPrefix(m.Bytes, []byte{137, 80, 78, 71, 13, 10, 26, 10})
	case "image/webp":
		return len(m.Bytes) >= 12 && string(m.Bytes[:4]) == "RIFF" && string(m.Bytes[8:12]) == "WEBP"
	}
	return false
}
func Normalize(u Upload) (Upload, error) {
	caption, err := Caption(u.Caption)
	if err != nil {
		return u, err
	}
	u.Caption = caption
	if !ValidImage(u.Image, MaxPhotoBytes) {
		return u, ErrPhoto
	}
	if len(u.Thumbnail.Bytes) > 0 || u.Thumbnail.ContentType != "" {
		if !ValidImage(u.Thumbnail, MaxThumbnailBytes) {
			return u, ErrThumbnail
		}
	}
	return u, nil
}
func Quota(allowed bool, total, daily int) error {
	if !allowed {
		return ErrRank
	}
	if total >= 20 {
		return ErrTotal
	}
	if daily >= 5 {
		return ErrDaily
	}
	return nil
}
