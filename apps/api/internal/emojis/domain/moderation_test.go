package domain

import (
	"strings"
	"testing"
)

func TestModerationNormalization(t *testing.T) {
	v, err := NormalizeModeration(Moderation{Code: " КОТ ", Status: "approved"})
	if err != nil || v.Code != ":кот:" {
		t.Fatal(v, err)
	}
	if _, err := NormalizeModeration(Moderation{Code: "кот", Status: "admin"}); err != ErrInvalid {
		t.Fatal(err)
	}
	tag, err := NormalizeTag(Tag{Name: " ГРУСТЬ ", Triggers: []string{" Печаль ", "печаль", "", "😢"}})
	if err != nil || tag.Name != "грусть" || len(tag.Triggers) != 2 {
		t.Fatal(tag, err)
	}
	if _, err := NormalizeTag(Tag{Name: strings.Repeat("я", 41)}); err != ErrInvalid {
		t.Fatal(err)
	}
}
