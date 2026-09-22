package provider

import (
	"context"
	"io"
	"net/http"
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
