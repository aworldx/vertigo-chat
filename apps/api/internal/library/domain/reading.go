package domain

import (
	"bytes"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"regexp"
	"strconv"
	"strings"
)

var ErrSeriesConflict = errors.New("series_exists")
var ErrImage = errors.New("invalid_image")
var ErrImageQuota = errors.New("image_limit_reached")

const MaxImageBytes = 2_000_000

type SeriesInput struct{ OriginalName, Name, Description string }
type Image struct {
	Bytes       []byte
	ContentType string
}

var uploadedImage = regexp.MustCompile(`^/library/images/([1-9][0-9]*)$`)
var staticCover = regexp.MustCompile(`^/images/[a-z0-9-]+\.(png|webp|jpg)$`)

func ImageID(value string) int64 {
	matches := uploadedImage.FindStringSubmatch(value)
	if len(matches) != 2 {
		return 0
	}
	id, _ := strconv.ParseInt(matches[1], 10, 64)
	return id
}
func ValidCover(value string) bool {
	return value == "" || staticCover.MatchString(value) || ImageID(value) > 0
}
func NormalizeSeries(v SeriesInput) (SeriesInput, error) {
	v.OriginalName = strings.TrimSpace(v.OriginalName)
	v.Name = strings.TrimSpace(v.Name)
	v.Description = strings.TrimSpace(v.Description)
	if !valid(v.OriginalName, 120, true) || !valid(v.Name, 120, true) || !valid(v.Description, 2000, false) {
		return v, ErrInvalid
	}
	return v, nil
}
func NormalizeImage(v Image) (Image, error) {
	if len(v.Bytes) == 0 || len(v.Bytes) > MaxImageBytes {
		return v, ErrImage
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(v.Bytes))
	if err != nil || (format != "png" && format != "jpeg") || config.Width < 1 || config.Height < 1 || config.Width > 4096 || config.Height > 4096 {
		return v, ErrImage
	}
	if _, _, err = image.Decode(bytes.NewReader(v.Bytes)); err != nil {
		return v, ErrImage
	}
	v.ContentType = "image/" + format
	return v, nil
}
