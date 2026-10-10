package webdelivery

import (
	"bytes"
	"encoding/xml"
	"html"
	"net/http"
	"strings"
)

// Only public, canonical pages belong in the sitemap. Personal sections and
// session-bound games keep the default noindex policy of the React shell.
var publicSearchPaths = []string{
	"/",
	"/library",
	"/help",
	"/articles",
	"/articles/chats-vs-messengers",
	"/articles/chat-platforms-russia",
	"/articles/how-vertigo-chat-works",
}

func searchPage(content []byte, origin, path string) []byte {
	for _, publicPath := range publicSearchPaths {
		if path != publicPath {
			continue
		}
		// Prerendered articles already provide their own canonical metadata.
		metadata := `<meta name="robots" content="index, follow" /><link rel="canonical" href="` +
			html.EscapeString(strings.TrimRight(origin, "/")+path) + `" />`
		return bytes.Replace(content, []byte(`<meta name="robots" content="noindex, follow" />`), []byte(metadata), 1)
	}
	return content
}

func registerSearch(mux *http.ServeMux, origin string) error {
	origin = strings.TrimRight(origin, "/")
	type sitemapURL struct {
		Location string `xml:"loc"`
	}
	document := struct {
		XMLName xml.Name     `xml:"urlset"`
		XMLNS   string       `xml:"xmlns,attr"`
		URLs    []sitemapURL `xml:"url"`
	}{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, path := range publicSearchPaths {
		document.URLs = append(document.URLs, sitemapURL{Location: origin + path})
	}
	data, err := xml.MarshalIndent(document, "", "  ")
	if err != nil {
		return err
	}
	sitemap := append([]byte(xml.Header), data...)
	mux.HandleFunc("GET /sitemap.xml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		if r.Method != http.MethodHead {
			_, _ = w.Write(sitemap)
		}
	})
	mux.HandleFunc("GET /robots.txt", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		if r.Method != http.MethodHead {
			_, _ = w.Write([]byte("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /internal/\nDisallow: /monitoring/\nSitemap: " + origin + "/sitemap.xml\n"))
		}
	})
	mux.HandleFunc("GET /about", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, origin+"/", http.StatusMovedPermanently)
	})
	return nil
}
