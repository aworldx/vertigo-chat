package provider

import (
	"bytes"
	"chat/api/internal/mediasearch/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func youtubeID(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.Port() != "" {
		return ""
	}
	var id string
	switch u.Hostname() {
	case "youtu.be", "www.youtu.be":
		id = strings.TrimPrefix(u.Path, "/")
	case "youtube.com", "www.youtube.com", "m.youtube.com":
		if u.Path == "/watch" {
			id = u.Query().Get("v")
		} else {
			for _, prefix := range []string{"/shorts/", "/embed/"} {
				if strings.HasPrefix(u.Path, prefix) {
					id = strings.TrimPrefix(u.Path, prefix)
				}
			}
		}
	}
	if !domain.Allowed("youtube", "/youtube-proxy/"+id) {
		return ""
	}
	return id
}
func (c Catalogue) prepareYoutube(ctx context.Context, query, id string) ([]domain.Item, error) {
	payload, _ := json.Marshal(map[string]string{"source_url": query})
	r, err := http.NewRequestWithContext(ctx, "POST", c.Youtube+"/youtube/prepare", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	r.Header.Set("Content-Type", "application/json")
	raw, err := c.request(r)
	if err != nil {
		return nil, err
	}
	var response struct {
		Title    string  `json:"title"`
		Duration float64 `json:"duration"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	if response.Duration <= 0 || response.Duration > 1200 {
		return nil, errors.New("video_unavailable")
	}
	return []domain.Item{{Kind: "youtube", Title: response.Title, URL: "/youtube-proxy/" + id, Source: query, Duration: fmt.Sprintf("%d:%02d", int(response.Duration)/60, int(response.Duration)%60)}}, nil
}
