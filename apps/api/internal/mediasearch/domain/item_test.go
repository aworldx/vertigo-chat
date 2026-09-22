package domain

import "testing"

func TestMediaURLBoundary(t *testing.T) {
	for _, test := range []struct {
		kind, url string
		allowed   bool
	}{
		{"music", "https://sunproxy.net/file/song.mp3", true}, {"music", "https://sunproxy.net.evil.test/file/song.mp3", false}, {"gif", "https://gifsnap.com/api/v1/media/test", true}, {"gif", "http://127.0.0.1/image.gif", false}, {"gif", "https://static.klipy.com/image.gif", true}, {"youtube", "/youtube-proxy/jNQXAC9IVRw", true}, {"youtube", "/youtube-proxy/../../secret", false},
	} {
		if got := Allowed(test.kind, test.url); got != test.allowed {
			t.Errorf("%s: %v", test.url, got)
		}
	}
}
