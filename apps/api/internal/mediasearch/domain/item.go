package domain

import (
	"net/url"
	"regexp"
	"strings"
)

type Item struct {
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	Preview  string `json:"preview"`
	Artist   string `json:"artist"`
	Duration string `json:"duration"`
	Source   string `json:"source"`
}

var videoID = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func Allowed(kind, raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.User != nil || u.RawQuery != "" && kind == "youtube" {
		return false
	}
	if kind == "youtube" {
		return strings.HasPrefix(raw, "/youtube-proxy/") && videoID.MatchString(strings.TrimPrefix(raw, "/youtube-proxy/"))
	}
	if u.Scheme != "https" || u.Port() != "" {
		return false
	}
	host := u.Hostname()
	if kind == "music" {
		return (host == "sunproxy.net" || strings.HasSuffix(host, ".sunproxy.net")) && strings.HasPrefix(u.Path, "/file/")
	}
	if kind == "gif" {
		return allowedGIF(host, u.Path)
	}
	return false
}
func allowedGIF(host, path string) bool {
	if host == "gifsnap.com" {
		return strings.HasPrefix(path, "/api/v1/media/")
	}
	trusted := host == "static.klipy.com" || strings.HasPrefix(host, "pub-") && strings.HasSuffix(host, ".r2.dev")
	return trusted && (strings.HasSuffix(path, ".gif") || strings.HasSuffix(path, ".webp"))
}
