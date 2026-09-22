package http

import (
	"chat/api/internal/mediasearch/application"
	"io"
	"net/http"
	"strings"
	"time"
)

func proxyMedia(kind string) http.HandlerFunc {
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	return func(w http.ResponseWriter, r *http.Request) {
		address := r.URL.Query().Get("url")
		if !application.Allowed(kind, address) {
			http.Error(w, "invalid media", 400)
			return
		}
		request, err := http.NewRequestWithContext(r.Context(), "GET", address, nil)
		if err != nil {
			http.Error(w, "invalid media", 400)
			return
		}
		if value := r.Header.Get("Range"); value != "" {
			request.Header.Set("Range", value)
		}
		response, err := client.Do(request)
		if err != nil {
			http.Error(w, "media unavailable", http.StatusBadGateway)
			return
		}
		defer func() { _ = response.Body.Close() }()
		contentType := strings.ToLower(strings.Split(response.Header.Get("Content-Type"), ";")[0])
		valid := kind == "gif" && (contentType == "image/gif" || contentType == "image/webp") || kind == "music" && (strings.HasPrefix(contentType, "audio/") || contentType == "application/octet-stream")
		if !valid || (response.StatusCode != 200 && response.StatusCode != 206) {
			http.Error(w, "media unavailable", http.StatusBadGateway)
			return
		}
		for _, header := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"} {
			if value := response.Header.Get(header); value != "" {
				w.Header().Set(header, value)
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(response.StatusCode)
		_, _ = io.Copy(w, io.LimitReader(response.Body, 60_000_000))
	}
}
