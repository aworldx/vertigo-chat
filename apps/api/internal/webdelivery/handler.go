// Package webdelivery serves the standalone React build without Phoenix.
package webdelivery

import (
	"io/fs"
	"net/http"
)

func Register(mux *http.ServeMux, assets fs.FS, origin string) error {
	index, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		return err
	}
	page := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(index)
	}
	for _, route := range []string{"/account/login", "/account/register", "/profiles", "/music-chart", "/chat", "/{$}"} {
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
