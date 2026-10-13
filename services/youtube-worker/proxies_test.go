package main

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProxyPoolParsesAndRotatesSecretEntries(t *testing.T) {
	file := filepath.Join(t.TempDir(), "proxies")
	if err := os.WriteFile(file, []byte("bad\nfirst.example:8080:user:password\nsecond.example:3128:name:secret\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool := newProxyPool(file)
	first := pool.candidates()
	if len(first) != 2 || first[0] != "http://user:password@first.example:8080" {
		t.Fatalf("unexpected proxies: %#v", first)
	}
	second := pool.candidates()
	if len(second) != 2 || second[0] != "http://name:secret@second.example:3128" {
		t.Fatalf("pool did not rotate: %#v", second)
	}
}

func TestDownloadUsesMountedProxySecret(t *testing.T) {
	dir := t.TempDir()
	proxyFile := filepath.Join(dir, "proxies")
	if err := os.WriteFile(proxyFile, []byte("proxy.example:8080:user:password\n"), 0600); err != nil {
		t.Fatal(err)
	}
	argsFile := filepath.Join(dir, "yt-dlp-args")
	yt := executable(t, `case "$*" in *--skip-download*) echo '{"duration":19}';; *) printf '%s' "$*" > "`+argsFile+`";; esac`)
	ffmpeg := executable(t, `for last; do :; done; printf video > "$last"`)
	output := filepath.Join(dir, "video.mp4")
	d := downloader{ytDLP: yt, ffmpeg: ffmpeg, maxBytes: 1024, proxies: newProxyPool(proxyFile)}
	if err := d.Download(context.Background(), "jNQXAC9IVRw", output); err != nil {
		t.Fatal(err)
	}
	args, err := os.ReadFile(argsFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(args), "--proxy http://user:password@proxy.example:8080") {
		t.Fatalf("yt-dlp was not given the configured proxy: %q", args)
	}
	if !strings.Contains(string(args), "--format "+downloadFormat) {
		t.Fatal("yt-dlp did not use the fast-start AVC format")
	}
}

func TestProxyMonitorRefreshesSourceAndPrioritizesWorking(t *testing.T) {
	seed := filepath.Join(t.TempDir(), "seed")
	source := filepath.Join(t.TempDir(), "source")
	if err := os.WriteFile(seed, []byte("seed.example:8080:user:pass\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("bad.example:8080:user:pass\ngood.example:8080:user:pass\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool := newProxyPool(seed)
	pool.scan(context.Background(), source, func(_ context.Context, address string) bool {
		return strings.Contains(address, "good.example")
	})
	total, working, checkedAt, readOK := pool.snapshot()
	if total != 2 || working != 1 || checkedAt.IsZero() || !readOK {
		t.Fatalf("unexpected snapshot: total=%d working=%d checked=%v read=%v", total, working, checkedAt, readOK)
	}
	if candidates := pool.candidates(); len(candidates) != 1 || !strings.Contains(candidates[0], "good.example") {
		t.Fatalf("unhealthy proxy was selected: %#v", candidates)
	}
}

func TestProxyMonitorReloadsSource(t *testing.T) {
	source := filepath.Join(t.TempDir(), "source")
	if err := os.WriteFile(source, []byte("old.example:8080:user:pass\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool := newProxyPool(source)
	probe := func(_ context.Context, _ string) bool { return true }
	pool.scan(context.Background(), source, probe)
	if err := os.WriteFile(source, []byte("new-good.example:8080:user:pass\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool.scan(context.Background(), source, probe)
	total, working, _, readOK := pool.snapshot()
	if total != 1 || working != 1 || !readOK || !strings.Contains(pool.candidates()[0], "new-good.example") {
		t.Fatal("updated source file was not applied")
	}
	if err := os.Remove(source); err != nil {
		t.Fatal(err)
	}
	pool.scan(context.Background(), source, probe)
	_, _, _, readOK = pool.snapshot()
	if readOK {
		t.Fatal("source read failure was hidden")
	}
}

func TestProxyMetricsExposeCountsWithoutSecrets(t *testing.T) {
	file := filepath.Join(t.TempDir(), "proxies")
	if err := os.WriteFile(file, []byte("good.example:8080:user:secret\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool := newProxyPool(file)
	pool.scan(context.Background(), file, func(_ context.Context, _ string) bool { return true })
	response := httptest.NewRecorder()
	(&server{proxies: pool}).handler().ServeHTTP(response, httptest.NewRequest("GET", "/internal/metrics", nil))
	body := response.Body.String()
	if response.Code != 200 || !strings.Contains(body, "chat_youtube_proxies_total 1") || !strings.Contains(body, "chat_youtube_proxies_working 1") || strings.Contains(body, "secret") {
		t.Fatalf("invalid proxy metrics: status=%d body=%q", response.Code, body)
	}
}

func TestProbeProxyRequiresDownloadedFragment(t *testing.T) {
	yt := executable(t, `previous=""; for arg do if [ "$previous" = "--output" ]; then printf fragment > "$arg"; exit 0; fi; previous="$arg"; done; exit 1`)
	d := downloader{ytDLP: yt}
	if !d.probeProxy(context.Background(), "http://user:secret@proxy.example:8080") {
		t.Fatal("downloaded test fragment was not accepted")
	}
	d.ytDLP = executable(t, `exit 1`)
	if d.probeProxy(context.Background(), "http://user:secret@proxy.example:8080") {
		t.Fatal("failed test download was marked working")
	}
}
