package provider

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestMusicRedirectKeepsProxyAndRejectsForeignHost(t *testing.T) {
	for _, host := range []string{"mp3mn.net", "foreign.example"} {
		t.Run(host, func(t *testing.T) {
			requests := 0
			c := NewCatalogue("")
			c.Client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
				requests++
				if requests == 1 {
					return &http.Response{StatusCode: 301, Header: http.Header{"Location": []string{"https://" + host + "/search"}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
				}
				return &http.Response{StatusCode: 200, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(`<li><a class="playlist-play" data-url="https://sunproxy.net/file/test"></a><a href="/t/test" class="playlist-down"></a><span class="playlist-duration">3:01</span><span class="playlist-name-artist"><a>A</a></span><span class="playlist-name-title"><a>B</a></span></li>`)), Request: r}, nil
			})
			tracks, err := c.directMusic(context.Background(), "test")
			if host == "mp3mn.net" {
				if err != nil || len(tracks) != 1 || requests != 2 {
					t.Fatal("same-catalogue redirect failed")
				}
			} else if err == nil || requests != 1 {
				t.Fatal("foreign redirect followed")
			}
		})
	}
}
func TestYoutubeLinkUsesPreparation(t *testing.T) {
	c := NewCatalogue("http://worker.local")
	c.Client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != "POST" || r.URL.Path != "/youtube/prepare" {
			t.Errorf("unexpected worker request")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"title":"Video","duration":123}`))}, nil
	})
	tracks, err := c.Search(context.Background(), "youtube", "https://youtu.be/abcdefghijk")
	if err != nil || len(tracks) != 1 || tracks[0].Duration != "2:03" || tracks[0].URL != "/youtube-proxy/abcdefghijk" {
		t.Fatal(tracks, err)
	}
	for _, invalid := range []string{"https://youtube.com.evil/watch?v=abcdefghijk", "https://youtube.com/watch?v=bad", "file:///abcdefghijk"} {
		if youtubeID(invalid) != "" {
			t.Fatal("invalid video source accepted")
		}
	}
}

func TestYoutubeSearchKeepsLegacyDurationLimitAndFormat(t *testing.T) {
	c := NewCatalogue("http://worker.local")
	c.Client.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"videos":[{"id":"abcdefghijk","title":"Valid","duration":19},{"id":"bcdefghijkl","title":"Too long","duration":1201},{"id":"cdefghijklm","title":"Unknown","duration":0}]}`))}, nil
	})
	items, err := c.Search(context.Background(), "youtube", "query")
	if err != nil || len(items) != 1 || items[0].Duration != "00:19" || items[0].Source != "https://www.youtube.com/watch?v=abcdefghijk" {
		t.Fatal(items, err)
	}
}

func TestCatalogueGIFValidationAndFailures(t *testing.T) {
	for _, body := range []string{`{"data":[{"title":"Cat","url":"https://gifsnap.com/api/v1/media/1","preview_url":"https://static.klipy.com/a.webp"},{"url":"https://evil.example/a.gif","preview_url":"https://static.klipy.com/a.webp"}]}`, `bad JSON`} {
		c := NewCatalogue("")
		c.Client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Query().Get("q") != "cat & dog" {
				t.Fatal(r.URL)
			}
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
		})
		items, err := c.Search(context.Background(), "gif", "cat & dog")
		if body == "bad JSON" {
			if err == nil {
				t.Fatal("invalid JSON accepted")
			}
		} else if err != nil || len(items) != 1 || items[0].Title != "Cat" {
			t.Fatal(items, err)
		}
	}
	c := NewCatalogue("")
	c.Client.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 503, Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	if _, err := c.Search(context.Background(), "gif", "cat"); err == nil {
		t.Fatal("upstream error ignored")
	}
}
func TestMusicSearchBoundsResultsAndFiltersForeignMedia(t *testing.T) {
	c := NewCatalogue("")
	item := `<li><a class="playlist-play" data-url="https://sunproxy.net/file/test"></a><span class="playlist-name-title"><a>Song &amp; title</a></span></li>`
	c.Client.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`<li><a class="playlist-play" data-url="https://evil.example/file"></a></li>` + strings.Repeat(item, 20)))}, nil
	})
	items, err := c.Search(context.Background(), "music", "song")
	if err != nil || len(items) != 15 || items[0].Title != "Song & title" {
		t.Fatal(items, err)
	}
}

func TestMusicFallsBackAfterProxyFailure(t *testing.T) {
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "CONNECT" {
			t.Error("expected HTTPS tunnel")
		}
		w.WriteHeader(502)
	}))
	defer proxy.Close()
	file := filepath.Join(t.TempDir(), "proxies.txt")
	if err := os.WriteFile(file, []byte(strings.TrimPrefix(proxy.URL, "http://")+":test:test"), 0600); err != nil {
		t.Fatal(err)
	}
	c := NewCatalogue("")
	c.Proxies = NewProxyPool(file)
	c.Client.Transport = transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`<li><a class="playlist-play" data-url="https://sunproxy.net/file/test"></a></li>`))}, nil
	})
	items, err := c.Search(context.Background(), "music", "query")
	if err != nil || len(items) != 1 {
		t.Fatal(items, err)
	}
	candidates := c.Proxies.candidates()
	if len(candidates) != 1 || candidates[0].failures != 1 {
		t.Fatal("failed proxy not cooled down")
	}
}
