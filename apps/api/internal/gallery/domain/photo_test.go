package domain

import (
	"strings"
	"testing"
)

func TestGalleryRules(t *testing.T) {
	if _, err := Caption(strings.Repeat("я", 280)); err != nil {
		t.Fatal(err)
	}
	if _, err := Caption(strings.Repeat("я", 281)); err != ErrCaption {
		t.Fatal(err)
	}
	if v, err := Caption("  вечер \n"); err != nil || v != "вечер" {
		t.Fatal(v, err)
	}
	if ValidImage(Media{Bytes: []byte("<svg>"), ContentType: "image/png"}, 100) {
		t.Fatal("signature bypass")
	}
	if ValidImage(Media{Bytes: []byte{137, 80, 78, 71, 13, 10, 26, 10}, ContentType: "image/jpeg"}, 100) {
		t.Fatal("MIME mismatch")
	}
	for _, c := range []struct {
		limit, total int
		want         error
	}{{0, 0, ErrRank}, {1, 0, nil}, {1, 1, ErrTotal}, {3, 2, nil}, {3, 3, ErrTotal}, {3, 50, ErrTotal}, {50, 49, nil}, {50, 50, ErrTotal}} {
		if err := Quota(c.limit, c.total); err != c.want {
			t.Fatal(c, err)
		}
	}
}
