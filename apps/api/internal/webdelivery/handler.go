// Package webdelivery serves the standalone React build without Phoenix.
package webdelivery

import (
	"bytes"
	"io/fs"
	"net/http"
	"strings"
)

func Register(mux *http.ServeMux, assets fs.FS, origin string) error {
	index, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		return err
	}
	page := func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/visits" || r.URL.Path == "/admin" {
			w.Header().Set("X-Robots-Tag", "noindex, nofollow")
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		content := index
		if strings.HasPrefix(r.URL.Path, "/articles") {
			if rendered, err := fs.ReadFile(assets, "pages/"+strings.ReplaceAll(strings.TrimPrefix(r.URL.Path, "/"), "/", "-")+".html"); err == nil {
				content = bytes.ReplaceAll(rendered, []byte("__SITE_ORIGIN__"), []byte(origin))
			}
		}
		_, _ = w.Write(content)
	}
	for _, route := range []string{"/admin", "/articles", "/articles/chats-vs-messengers", "/articles/chat-platforms-russia", "/articles/how-vertigo-chat-works", "/about", "/library", "/gallery", "/account", "/account/login", "/account/register", "/profiles", "/music-chart", "/visits", "/help", "/ranks", "/chat", "/{$}"} {
		mux.HandleFunc("GET "+route, canonicalPage(origin, page))
	}
	files := http.FileServer(http.FS(assets))
	serve := func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Path[1:]
		info, err := fs.Stat(assets, name)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}
	for _, prefix := range []string{"/assets/", "/fonts/", "/images/", "/icons/", "/sounds/"} {
		mux.HandleFunc("GET "+prefix, serve)
	}
	return nil
}
