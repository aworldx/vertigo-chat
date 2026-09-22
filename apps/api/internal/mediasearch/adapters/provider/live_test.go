package provider

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"
)

// Opt-in: no credentials, addresses, or upstream response bodies are logged.
func TestLiveMusicProxies(t *testing.T) {
	path := os.Getenv("MUSIC_LIVE_PROXY_FILE")
	if path == "" {
		t.Skip("set MUSIC_LIVE_PROXY_FILE for external verification")
	}
	pool := NewProxyPool(path)
	candidates := pool.candidates()
	if len(candidates) == 0 {
		t.Fatal("no valid proxy entries")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	defer cancel()
	for _, entry := range candidates {
		c := NewCatalogue("")
		c.Client = proxyClient(entry.address)
		c.Client.Transport = liveStatus{base: c.Client.Transport, t: t}
		tracks, err := c.directMusic(ctx, "Radiohead")
		c.Client.CloseIdleConnections()
		pool.report(entry.id, err == nil && len(tracks) > 0)
		if err == nil && len(tracks) > 0 {
			t.Logf("verified proxied search: %d tracks", len(tracks))
			return
		}
	}
	t.Fatal("all three proxy attempts failed; credentials and upstream errors withheld")
}

type liveStatus struct {
	base http.RoundTripper
	t    *testing.T
}

func (s liveStatus) RoundTrip(r *http.Request) (*http.Response, error) {
	response, err := s.base.RoundTrip(r)
	if err != nil {
		s.t.Logf("proxy transport failed (%T)", err)
	} else {
		s.t.Logf("proxy upstream HTTP %d", response.StatusCode)
		if location, err := response.Location(); err == nil {
			s.t.Logf("catalogue redirect host: %s", location.Hostname())
		}
	}
	return response, err
}

func TestLiveGIFCatalogue(t *testing.T) {
	if os.Getenv("MEDIA_LIVE_CHECK") != "1" {
		t.Skip("set MEDIA_LIVE_CHECK=1 for external verification")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	items, err := NewCatalogue("").Search(ctx, "gif", "hello")
	if err != nil || len(items) == 0 {
		t.Fatal("GIF catalogue returned no usable results")
	}
	t.Logf("verified GIF search: %d results", len(items))
}
func TestLiveYoutubeWorker(t *testing.T) {
	address := os.Getenv("YOUTUBE_LIVE_WORKER")
	if address == "" {
		t.Skip("set YOUTUBE_LIVE_WORKER to local verification worker")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()
	c := NewCatalogue(address)
	c.Client.Timeout = 30 * time.Second
	items, err := c.Search(ctx, "youtube", "Me at the zoo")
	if err != nil || len(items) == 0 {
		t.Fatal("YouTube worker search returned no usable results")
	}
	t.Logf("verified YouTube search: %d results", len(items))
}
