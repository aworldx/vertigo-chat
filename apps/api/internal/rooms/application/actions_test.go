package application

import "testing"

func TestPrivateNeverAcceptsMalformedOrSelfAddress(t *testing.T) {
	for _, body := range []string{"^me, secret", "^ab secret", "^peer,", "public text", "^peer, ", "^peer, " + string(make([]rune, 1001))} {
		if _, _, err := ParsePrivate("me", body); err == nil {
			t.Fatalf("accepted %q", body)
		}
	}
	name, body, err := ParsePrivate("sender", "^peer, Личное сообщение")
	if err != nil || name != "peer" || body != "Личное сообщение" {
		t.Fatal(name, body, err)
	}
}
