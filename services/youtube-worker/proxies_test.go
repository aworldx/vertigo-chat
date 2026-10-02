package main

import (
	"context"
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
}
