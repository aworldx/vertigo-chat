package provider

import (
	"bytes"
	"chat/api/internal/mediasearch/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type Catalogue struct {
	Proxies *ProxyPool
	Youtube string
	Client  *http.Client
}

func NewCatalogue(youtube string) Catalogue {
	return Catalogue{Youtube: strings.TrimRight(youtube, "/"), Client: &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (c Catalogue) Search(ctx context.Context, kind, query string) ([]domain.Item, error) {
	switch kind {
	case "gif":
		return c.gifs(ctx, query)
	case "music":
		return c.music(ctx, query)
	default:
		return c.youtube(ctx, query)
	}
}
func (c Catalogue) get(ctx context.Context, address string) ([]byte, error) {
	r, err := http.NewRequestWithContext(ctx, "GET", address, nil)
	if err != nil {
		return nil, err
	}
	r.Header.Set("User-Agent", "VertigoChat/1.0")
	return c.request(r)
}
func (c Catalogue) request(r *http.Request) ([]byte, error) {
	response, err := c.Client.Do(r)
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != 200 {
		return nil, errors.New("provider_unavailable")
	}
	return io.ReadAll(io.LimitReader(response.Body, 2<<20))
}
func (c Catalogue) gifs(ctx context.Context, query string) ([]domain.Item, error) {
	raw, err := c.get(ctx, "https://gifsnap.com/api/v1/gifs/search?q="+url.QueryEscape(query)+"&page=1&limit=12")
	if err != nil {
		return nil, err
	}
	var body struct {
		Data []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Preview string `json:"preview_url"`
		} `json:"data"`
	}
	if err = json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	result := make([]domain.Item, 0)
	for _, item := range body.Data {
		if domain.Allowed("gif", item.URL) && domain.Allowed("gif", item.Preview) {
			result = append(result, domain.Item{Kind: "gif", Title: item.Title, URL: item.URL, Preview: item.Preview})
		}
	}
	return result, nil
}

var listPattern = regexp.MustCompile(`(?s)<li(?:\s[^>]*)?>(.*?)</li>`)
var tags = regexp.MustCompile(`<[^>]*>`)
var fields = map[string]*regexp.Regexp{
	"url":      regexp.MustCompile(`class="[^"]*playlist-play[^"]*"[^>]*data-url="([^"]+)"`),
	"source":   regexp.MustCompile(`href="(/t/[^\"]+)"[^>]*class="[^"]*playlist-down[^"]*"`),
	"duration": regexp.MustCompile(`class="playlist-duration">([^<]+)<`),
	"artist":   regexp.MustCompile(`(?s)class="playlist-name-artist"[^>]*>\s*<a[^>]*>(.*?)</a>`),
	"title":    regexp.MustCompile(`(?s)class="playlist-name-title"[^>]*>\s*<a[^>]*>(.*?)</a>`),
}

func field(item, name string) string {
	m := fields[name].FindStringSubmatch(item)
	if len(m) != 2 {
		return ""
	}
	return strings.TrimSpace(html.UnescapeString(tags.ReplaceAllString(m[1], "")))
}
func (c Catalogue) music(ctx context.Context, query string) ([]domain.Item, error) {
	for _, proxy := range c.Proxies.candidates() {
		attempt := c
		attempt.Client = proxyClient(proxy.address)
		tracks, err := attempt.directMusic(ctx, query)
		attempt.Client.CloseIdleConnections()
		c.Proxies.report(proxy.id, err == nil && len(tracks) > 0)
		if err == nil && len(tracks) > 0 {
			return tracks, nil
		}
	}
	return c.directMusic(ctx, query)
}
func (c Catalogue) directMusic(ctx context.Context, query string) ([]domain.Item, error) {
	client := *c.Client
	client.CheckRedirect = musicRedirect
	c.Client = &client
	raw, err := c.get(ctx, "https://mp3mn.net/?song="+url.QueryEscape(query))
	if err != nil {
		return nil, err
	}
	result := make([]domain.Item, 0)
	for _, match := range listPattern.FindAllStringSubmatch(string(raw), -1) {
		item := match[1]
		audio := field(item, "url")
		if !domain.Allowed("music", audio) {
			continue
		}
		result = append(result, domain.Item{Kind: "music", URL: audio, Source: "https://mp3mn.net" + field(item, "source"), Title: field(item, "title"), Artist: field(item, "artist"), Duration: field(item, "duration")})
		if len(result) >= 15 {
			break
		}
	}
	return result, nil
}
func (c Catalogue) youtube(ctx context.Context, query string) ([]domain.Item, error) {
	if c.Youtube == "" {
		return nil, errors.New("youtube_not_configured")
	}
	if id := youtubeID(query); id != "" {
		return c.prepareYoutube(ctx, query, id)
	}
	payload, _ := json.Marshal(map[string]string{"query": query})
	r, err := http.NewRequestWithContext(ctx, "POST", c.Youtube+"/youtube/search", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Content-Type", "application/json")
	raw, err := c.request(r)
	if err != nil {
		return nil, err
	}
	var response struct {
		Videos []struct {
			ID       string  `json:"id"`
			Title    string  `json:"title"`
			Duration float64 `json:"duration"`
			Source   string  `json:"source_url"`
		} `json:"videos"`
	}
	if err = json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	result := make([]domain.Item, 0)
	for _, video := range response.Videos {
		address := "/youtube-proxy/" + video.ID
		if domain.Allowed("youtube", address) && video.Duration > 0 && video.Duration <= 1200 {
			result = append(result, domain.Item{Kind: "youtube", Title: video.Title, URL: address, Source: "https://www.youtube.com/watch?v=" + video.ID, Duration: fmt.Sprintf("%02d:%02d", int(video.Duration)/60, int(video.Duration)%60)})
		}
		if len(result) == 5 {
			break
		}
	}
	return result, nil
}

func musicRedirect(r *http.Request, via []*http.Request) error {
	if len(via) >= 3 || r.URL.Scheme != "https" || r.URL.User != nil || r.URL.Port() != "" || (r.URL.Hostname() != "mp3mn.net" && r.URL.Hostname() != "www.mp3mn.net") {
		return http.ErrUseLastResponse
	}
	return nil
}
