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
		limit, total int
		want         error
	}{{0, 0, ErrRank}, {1, 0, nil}, {1, 1, ErrTotal}, {3, 2, nil}, {3, 3, ErrTotal}, {3, 50, ErrTotal}, {50, 49, nil}, {50, 50, ErrTotal}} {
		if err := Quota(c.limit, c.total); err != c.want {
			t.Fatal(c, err)
		}
	}
}

func TestWorkAuthorAttribution(t *testing.T) {
	v, err := Normalize(Input{Title: "История", Body: "Текст", WorkAuthor: " Uniform "})
	if err != nil || v.WorkAuthor != "Uniform" {
		t.Fatal(v, err)
	}
	for _, name := range []string{strings.Repeat("я", 121), "Alice\nBob", "Alice\tBob", string([]byte{0xff})} {
		if _, err := Normalize(Input{Title: "История", Body: "Текст", WorkAuthor: name}); err != ErrInvalid {
			t.Fatal(name, err)
		}
	}
}
