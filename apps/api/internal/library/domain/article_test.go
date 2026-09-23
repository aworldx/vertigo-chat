package domain

import (
	"strings"
	"testing"
)

func TestLibraryValidation(t *testing.T) {
	part := 2
	v, err := Normalize(Input{Title: " Заголовок ", Body: " Текст ", Part: &part})
	if err != nil || v.Title != "Заголовок" || v.Body != "Текст" || v.Part != nil {
		t.Fatal(v, err)
	}
	for _, v := range []Input{{Title: "", Body: "text"}, {Title: "title", Body: ""}, {Title: strings.Repeat("я", 161), Body: "text"}, {Title: "title", Body: strings.Repeat("я", 12001)}} {
		if _, err := Normalize(v); err != ErrInvalid {
			t.Fatal(err)
		}
	}
	for _, c := range []struct {
		allowed      bool
		total, daily int
		want         error
	}{{false, 0, 0, ErrRank}, {true, 50, 0, ErrTotal}, {true, 1, 10, ErrDaily}, {true, 49, 9, nil}} {
		if err := Quota(c.allowed, c.total, c.daily); err != c.want {
			t.Fatal(c, err)
		}
	}
}
