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
		allowed      bool
		total, daily int
		want         error
	}{{false, 0, 0, ErrRank}, {true, 20, 0, ErrTotal}, {true, 2, 5, ErrDaily}, {true, 19, 4, nil}} {
		if err := Quota(c.allowed, c.total, c.daily); err != c.want {
			t.Fatal(c, err)
		}
	}
}
