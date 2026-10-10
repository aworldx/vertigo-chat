package webdelivery

import (
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func searchRequest(t *testing.T) func(string, string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	shell := `<html><head><meta name="robots" content="noindex, follow" /></head><body>React</body></html>`
	if err := Register(mux, fstest.MapFS{"index.html": {Data: []byte(shell)}}, "https://chat.test"); err != nil {
		t.Fatal(err)
	}
	return func(method, path string) *httptest.ResponseRecorder {
		t.Helper()
		response := httptest.NewRecorder()
		request := httptest.NewRequest(method, "https://untrusted.test"+path, nil)
		mux.ServeHTTP(response, request)
		return response
	}
}

func TestSearchDiscoveryAndIndexPolicy(t *testing.T) {
	get := searchRequest(t)
	response := get("GET", "/sitemap.xml")
	var sitemap struct {
		XMLName xml.Name
		URLs    []struct {
			Location string `xml:"loc"`
		} `xml:"url"`
	}
	if response.Code != 200 || response.Header().Get("Content-Type") != "application/xml; charset=utf-8" {
		t.Fatalf("sitemap: %v", response)
	}
	if err := xml.Unmarshal(response.Body.Bytes(), &sitemap); err != nil {
		t.Fatal(err)
	}
	if sitemap.XMLName.Space != "http://www.sitemaps.org/schemas/sitemap/0.9" || len(sitemap.URLs) != 7 {
		t.Fatalf("unexpected sitemap: %+v", sitemap)
	}
	expected := []string{"/", "/library", "/help", "/articles", "/articles/chats-vs-messengers", "/articles/chat-platforms-russia", "/articles/how-vertigo-chat-works"}
	for i, path := range expected {
		if sitemap.URLs[i].Location != "https://chat.test"+path {
			t.Fatalf("unexpected URL: %s", sitemap.URLs[i].Location)
		}
		page := get("GET", path)
		if page.Code != 200 || !strings.Contains(page.Body.String(), `content="index, follow"`) || !strings.Contains(page.Body.String(), `href="https://chat.test`+path+`"`) {
			t.Fatalf("public metadata %s: %s", path, page.Body.String())
		}
	}
}

func TestSearchPrivatePagesAndRobots(t *testing.T) {
	get := searchRequest(t)
	for _, path := range []string{"/account", "/chat", "/history", "/notes", "/polls", "/profiles", "/gallery"} {
		page := get("GET", path)
		if !strings.Contains(page.Body.String(), `content="noindex, follow"`) || strings.Contains(page.Body.String(), `rel="canonical"`) {
			t.Fatalf("private index policy: %s", path)
		}
	}
	robots := get("GET", "/robots.txt")
	if robots.Code != 200 || !strings.Contains(robots.Body.String(), "Sitemap: https://chat.test/sitemap.xml\n") {
		t.Fatalf("robots: %s", robots.Body.String())
	}
	for _, path := range []string{"/sitemap.xml", "/robots.txt"} {
		head := get("HEAD", path)
		if head.Code != 200 || head.Body.Len() != 0 {
			t.Fatalf("HEAD %s: %v", path, head)
		}
	}
	for _, method := range []string{"GET", "HEAD"} {
		redirect := get(method, "/about")
		if redirect.Code != http.StatusMovedPermanently || redirect.Header().Get("Location") != "https://chat.test/" {
			t.Fatalf("about redirect: %v", redirect)
		}
	}
}

func TestSearchPreservesPrerenderedMetadata(t *testing.T) {
	content := []byte(`<meta name="robots" content="index, follow" /><link rel="canonical" href="https://chat.test/articles" />`)
	if got := string(searchPage(content, "https://chat.test", "/articles")); got != string(content) {
		t.Fatalf("changed article metadata: %s", got)
	}
}
