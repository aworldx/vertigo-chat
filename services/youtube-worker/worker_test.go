package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type fakeMedia struct{ calls atomic.Int32 }

func (f *fakeMedia) Search(ctx context.Context, q string) ([]video, error) {
	f.calls.Add(1)
	if q == "empty" {
		return nil, errors.New("not_found")
	}
	return []video{{"jNQXAC9IVRw", "Me at the zoo", 19, sourceURL("jNQXAC9IVRw")}}, nil
}
func (f *fakeMedia) Prepare(ctx context.Context, id string) (video, error) {
	f.calls.Add(1)
	return video{id, "Title", 19, sourceURL(id)}, nil
}
func (f *fakeMedia) Download(ctx context.Context, id, path string) error {
	return os.WriteFile(path, []byte("0123456789"), 0600)
}
func testCache(t *testing.T, download func(context.Context, string, string) error) *cache {
	t.Helper()
	c, err := newCache(context.Background(), t.TempDir(), 1024, 1, time.Hour, time.Second, download)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(c.close)
	return c
}
func TestHTTPContract(t *testing.T) {
	media := &fakeMedia{}
	c := testCache(t, media.Download)
	s := server{media, c, make(chan struct{}, 4), time.Second}
	handler := s.handler()
	for _, test := range []struct {
		path, body string
		status     int
		contains   string
	}{
		{"/youtube/search", `{"query":"короткий ролик"}`, 200, `"id":"jNQXAC9IVRw"`},
		{"/youtube/search", `{"query":"empty"}`, 404, "not_found"},
		{"/youtube/search", `{"query":"  "}`, 422, "query_required"},
		{"/youtube/search", `{"query":"` + strings.Repeat("я", 201) + `"}`, 422, "query_too_long"},
		{"/youtube/search", `{"query":42}`, 400, "invalid_json"},
		{"/youtube/search", `{} {}`, 400, "invalid_json"},
		{"/youtube/search", `{"query":"` + strings.Repeat("a", 17000) + `"}`, 400, "invalid_json"},
		{"/youtube/prepare", `{"source_url":"https://youtu.be/jNQXAC9IVRw"}`, 200, `"duration":19`},
		{"/youtube/prepare", `{"source_url":"https://evil.test/watch?v=jNQXAC9IVRw"}`, 422, "invalid_youtube"},
	} {
		t.Run(test.body[:min(len(test.body), 50)], func(t *testing.T) {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest("POST", test.path, strings.NewReader(test.body)))
			if w.Code != test.status || !strings.Contains(w.Body.String(), test.contains) {
				t.Fatalf("%d %s", w.Code, w.Body)
			}
		})
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/youtube-proxy/invalid", nil))
	if w.Code != 422 {
		t.Fatal(w.Code)
	}
	// A full metadata pool rejects excess work instead of spawning more processes.
	for i := 0; i < 4; i++ {
		s.metadataSlots <- struct{}{}
	}
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("POST", "/youtube/search", strings.NewReader(`{"query":"test"}`)))
	if w.Code != 503 {
		t.Fatal(w.Code)
	}
}
func TestRanges(t *testing.T) {
	media := &fakeMedia{}
	c := testCache(t, media.Download)
	id := "jNQXAC9IVRw"
	_ = os.WriteFile(c.path(id), []byte("0123456789"), 0600)
	c.entries[id] = cacheEntry{10, time.Now()}
	s := server{media, c, make(chan struct{}, 4), time.Second}
	for _, test := range []struct {
		method, rng        string
		status             int
		body, contentRange string
	}{
		{"GET", "", 200, "0123456789", ""}, {"GET", "bytes=2-5", 206, "2345", "bytes 2-5/10"}, {"GET", "bytes=7-", 206, "789", "bytes 7-9/10"}, {"GET", "bytes=-3", 206, "789", "bytes 7-9/10"}, {"GET", "bytes=99-", 416, "", "bytes */10"}, {"HEAD", "", 200, "", ""},
	} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(test.method, "/youtube-proxy/"+id, nil)
		if test.rng != "" {
			r.Header.Set("Range", test.rng)
		}
		s.handler().ServeHTTP(w, r)
		if w.Code != test.status || w.Header().Get("Content-Range") != test.contentRange {
			t.Fatalf("%s: %d %v", test.rng, w.Code, w.Header())
		}
		if test.status != 416 && w.Body.String() != test.body {
			t.Fatal(w.Body.String())
		}
		if w.Header().Get("Access-Control-Allow-Origin") != "*" {
			t.Fatal("missing CORS")
		}
	}
}
func TestCacheDedupQueueAndFailure(t *testing.T) {
	started := make(chan string, 4)
	release := make(chan struct{})
	var calls atomic.Int32
	c := testCache(t, func(ctx context.Context, id, path string) error {
		calls.Add(1)
		started <- id
		select {
		case <-release:
			return errors.New("failed")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	s := server{&fakeMedia{}, c, make(chan struct{}, 4), time.Second}
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, httptest.NewRequest("GET", "/youtube-proxy/jNQXAC9IVRw", nil))
	if w.Code != 202 || w.Header().Get("Retry-After") != "1" {
		t.Fatal(w)
	}
	if id := <-started; id != "jNQXAC9IVRw" {
		t.Fatal(id)
	}
	for i := 0; i < 20; i++ {
		_, _ = c.request("jNQXAC9IVRw")
	}
	_, _ = c.request("dQw4w9WgXcQ")
	c.mu.Lock()
	if len(c.pending) != 2 || len(c.jobs) != 1 {
		t.Error("queue not deduplicated")
	}
	c.mu.Unlock()
	close(release)
	if id := <-started; id != "dQw4w9WgXcQ" {
		t.Fatal(id)
	}
	// Starting the next job happens after recording failure of the first one.
	if _, err := c.request("jNQXAC9IVRw"); err == nil {
		t.Fatal("failure should be cached")
	}
	if calls.Load() != 2 {
		t.Fatal(calls.Load())
	}
}
func TestCacheRecoveryEvictionAndOpenReaders(t *testing.T) {
	dir := t.TempDir()
	id := "jNQXAC9IVRw"
	_ = os.WriteFile(filepath.Join(dir, id+".mp4"), []byte("0123456789"), 0600)
	c, err := newCache(context.Background(), dir, 15, 1, time.Hour, time.Second, (&fakeMedia{}).Download)
	if err != nil {
		t.Fatal(err)
	}
	defer c.close()
	f, err := c.request(id)
	if err != nil || f == nil {
		t.Fatalf("cache recovery: %v", err)
	}
	defer func() { _ = f.Close() }()
	c.mu.Lock()
	c.entries[id] = cacheEntry{10, time.Now().Add(-time.Minute)}
	other := "dQw4w9WgXcQ"
	_ = os.WriteFile(c.path(other), []byte("abcdefghij"), 0600)
	c.entries[other] = cacheEntry{10, time.Now()}
	c.cleanupLocked(time.Now())
	_, exists := c.entries[id]
	c.mu.Unlock()
	if exists {
		t.Fatal("old entry not evicted")
	}
	data, _ := io.ReadAll(f)
	if string(data) != "0123456789" {
		t.Fatal("eviction broke reader")
	}
}
func TestDownloaderSearchFiltering(t *testing.T) {
	// A real child process exercises argument passing and clean JSON decoding.
	dir := t.TempDir()
	program := filepath.Join(dir, "yt-dlp")
	script := `#!/bin/sh
case "$*" in *--flat-playlist*) ;; *) exit 1;; esac
cat <<'JSON'
{"entries":[{"id":"jNQXAC9IVRw","title":"Zoo","duration":19},{"id":"dQw4w9WgXcQ","duration":1201},{"id":"invalid","duration":2},{"id":"abcdefghijk","duration":30,"is_live":true},null]}
JSON
`
	if err := os.WriteFile(program, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	d := downloader{ytDLP: program}
	videos, err := d.Search(context.Background(), "quote ' ; $(bad)")
	if err != nil || len(videos) != 1 || videos[0].ID != "jNQXAC9IVRw" {
		t.Fatalf("%v %v", videos, err)
	}
	encoded, _ := json.Marshal(videos)
	if !strings.Contains(string(encoded), "source_url") {
		t.Fatal(string(encoded))
	}
}
func TestNormalizeLinks(t *testing.T) {
	for _, link := range []string{"https://youtu.be/jNQXAC9IVRw?t=1", "https://m.youtube.com/shorts/jNQXAC9IVRw", "https://www.youtube.com/embed/jNQXAC9IVRw", "https://youtube.com/watch?v=jNQXAC9IVRw"} {
		if id, err := normalizeLink(link); err != nil || id != "jNQXAC9IVRw" {
			t.Fatal(link)
		}
	}
	for _, link := range []string{"file:///etc/passwd", "https://youtube.com.evil.test/watch?v=jNQXAC9IVRw", "https://youtu.be/../../etc", "--exec=bad"} {
		if _, err := normalizeLink(link); err == nil {
			t.Fatal(link)
		}
	}
}
func TestCancelledProcess(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cmd := command(ctx, "/bin/sh", "-c", "sleep 60 & wait")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	cancel()
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("expected cancellation")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("process group was not stopped")
	}
}

var _ http.Handler = (&server{}).handler()

func TestPrepareMetadataValidation(t *testing.T) {
	for _, test := range []struct {
		body, wantError string
		duration        int
	}{
		{`{"duration":19,"title":"  Zoo  "}`, "", 19},
		{`{"duration":1200,"title":"Limit"}`, "", 1200},
		{`{"duration":1200.5}`, "video_too_long", 0},
		{`{"duration":0}`, "video_unavailable", 0},
		{`{"duration":10,"is_live":true}`, "video_unavailable", 0},
		{`{"duration":10,"live_status":"is_upcoming"}`, "video_unavailable", 0},
		{`not json`, "video_unavailable", 0},
	} {
		t.Run(test.body, func(t *testing.T) {
			program := filepath.Join(t.TempDir(), "yt-dlp")
			_ = os.WriteFile(program, []byte("#!/bin/sh\ncat <<'JSON'\n"+test.body+"\nJSON\n"), 0700)
			d := downloader{ytDLP: program}
			v, err := d.Prepare(context.Background(), "jNQXAC9IVRw")
			if test.wantError != "" {
				if err == nil || err.Error() != test.wantError {
					t.Fatalf("expected %s, got %v", test.wantError, err)
				}
			} else if err != nil || v.Duration != test.duration || v.Title == "" {
				t.Fatalf("%+v %v", v, err)
			}
		})
	}
}

func TestDownloadFailureDoesNotPublishPartialFile(t *testing.T) {
	dir := t.TempDir()
	yt := filepath.Join(dir, "yt-dlp")
	ffmpeg := filepath.Join(dir, "ffmpeg")
	// Metadata succeeds, downloading fails. ffmpeg must never publish a file.
	_ = os.WriteFile(yt, []byte("#!/bin/sh\ncase \"$*\" in *--skip-download*) echo '{\"duration\":19}';; *) exit 1;; esac\n"), 0700)
	marker := filepath.Join(dir, "ffmpeg-called")
	_ = os.WriteFile(ffmpeg, []byte("#!/bin/sh\ntouch '"+marker+"'\n"), 0700)
	output := filepath.Join(dir, "jNQXAC9IVRw.mp4")
	d := downloader{ytDLP: yt, ffmpeg: ffmpeg, maxBytes: 1024}
	if err := d.Download(context.Background(), "jNQXAC9IVRw", output); err == nil {
		t.Fatal("expected download failure")
	}
	if _, err := os.Stat(output); !os.IsNotExist(err) {
		t.Fatal("partial output published")
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("ffmpeg ran after download failed")
	}
	leftovers, _ := filepath.Glob(filepath.Join(dir, ".download-*"))
	if len(leftovers) != 0 {
		t.Fatal(leftovers)
	}
}
