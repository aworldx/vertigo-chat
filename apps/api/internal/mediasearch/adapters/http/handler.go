package http

import (
	"chat/api/internal/mediasearch/application"
	"encoding/json"
	"net/http"
	"net/http/httputil"
	"net/url"
)

type Authorize func(http.ResponseWriter, *http.Request) bool
type Handler struct {
	service   application.Service
	authorize Authorize
}

func NewHandler(s application.Service, a Authorize) Handler { return Handler{s, a} }
func (h Handler) Register(mux *http.ServeMux, youtube string) {
	mux.HandleFunc("GET /api/v1/chat/media/{kind}", h.search)
	mux.HandleFunc("GET /gif-proxy", proxyMedia("gif"))
	mux.HandleFunc("GET /music-proxy", proxyMedia("music"))
	if youtube != "" {
		if target, err := url.Parse(youtube); err == nil && (target.Scheme == "http" || target.Scheme == "https") {
			proxy := httputil.NewSingleHostReverseProxy(target)
			mux.HandleFunc("GET /youtube-proxy/{id}", func(w http.ResponseWriter, r *http.Request) {
				if !application.Allowed("youtube", r.URL.Path) {
					http.NotFound(w, r)
					return
				}
				r.Header.Del("Cookie")
				r.Header.Del("Authorization")
				proxy.ServeHTTP(w, r)
			})
		}
	}
}
func (h Handler) search(w http.ResponseWriter, r *http.Request) {
	if !h.authorize(w, r) {
		return
	}
	items, err := h.service.Search(r.Context(), r.PathValue("kind"), r.URL.Query().Get("q"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		w.WriteHeader(502)
		_, _ = w.Write([]byte(`{"error":"Поиск сейчас недоступен. Попробуй позже."}`))
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"data": items})
}
