package postgres

import (
	"chat/api/internal/rooms/domain"
	"testing"
)

func TestLegacyAppearance(t *testing.T) {
	got := decodeAppearance([]byte(`{"dark":{"nickname_color":"#ABCDEF","text_color":"url(unsafe)"},"light":{"nickname_color":"#123456","text_color":"#987654"},"message_frame":false}`))
	if got.Dark.Nickname != "#abcdef" || got.Dark.Text != "#e4e4e7" || got.Light.Nickname != "#123456" || got.Light.Text != "#987654" {
		t.Fatalf("legacy appearance: %+v", got)
	}
	for _, raw := range []string{`{}`, `null`, `{"dark":false}`, `{"dark":{"text_color":23}}`} {
		if got := decodeAppearance([]byte(raw)); got.Dark.Text != "#e4e4e7" || got.Light.Nickname != "#9a3412" {
			t.Fatalf("fallback for %s: %+v", raw, got)
		}
	}
	message := domain.Message{FontID: "invalid", FontStyle: "oblique"}
	normalizeTypography(&message)
	if message.FontID != "theme" || message.FontStyle != "normal" {
		t.Fatalf("typography fallback: %+v", message)
	}
}
