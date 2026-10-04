package domain

import (
	"bytes"
	"image"
	"image/png"
	"strings"
	"testing"
)

func TestImagesAndSeries(t *testing.T) {
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	v, err := NormalizeImage(Image{Bytes: b.Bytes(), ContentType: "text/html"})
	if err != nil || v.ContentType != "image/png" {
		t.Fatal(v.ContentType, err)
	}
	for _, data := range [][]byte{nil, []byte("<svg onload='alert(1)'/>"), b.Bytes()[:20], make([]byte, MaxImageBytes+1)} {
		if _, err := NormalizeImage(Image{Bytes: data}); err != ErrImage {
			t.Fatal(err)
		}
	}
	for _, url := range []string{"https://example.com/a.png", "data:image/png,x", "/library/images/0", "/library/images/1?x", "//evil/a.png"} {
		if ValidCover(url) {
			t.Fatal(url)
		}
	}
	for _, url := range []string{"", "/library/images/2", "/images/library-cover-books.png"} {
		if !ValidCover(url) {
			t.Fatal(url)
		}
	}
	s, err := NormalizeSeries(SeriesInput{" Old ", " New ", " Description "})
	if err != nil || s.Name != "New" || s.Description != "Description" {
		t.Fatal(s, err)
	}
	for _, s := range []SeriesInput{{"old", "", ""}, {"old", "new", strings.Repeat("я", 2001)}, {"", "new", ""}} {
		if _, err := NormalizeSeries(s); err != ErrInvalid {
			t.Fatal(err)
		}
	}
}
