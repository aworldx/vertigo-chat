package main

import (
	"context"
	"errors"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/synctest"
	"time"
)

func executable(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "program")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body), 0700); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestDownloadPublishesOnlyValidatedOutput(t *testing.T) {
	yt := executable(t, `case "$*" in *--skip-download*) echo '{"duration":19}';; esac`)
	for _, tc := range []struct {
		name, body string
		limit      int64
		success    bool
	}{
		{"success", `for last; do :; done; printf video > "$last"`, 10, true},
		{"empty", `for last; do :; done; : > "$last"`, 10, false},
		{"oversized", `for last; do :; done; printf video > "$last"`, 4, false},
		{"missing", `exit 0`, 10, false},
		{"ffmpeg failure", `exit 2`, 10, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			output := filepath.Join(dir, "video.mp4")
			d := downloader{yt, executable(t, tc.body), tc.limit}
			err := d.Download(context.Background(), "jNQXAC9IVRw", output)
			if (err == nil) != tc.success {
				t.Fatalf("success=%v error=%v", tc.success, err)
			}
			data, readErr := os.ReadFile(output)
			if tc.success && (readErr != nil || string(data) != "video") {
				t.Fatalf("output=%q error=%v", data, readErr)
			}
			if !tc.success && !os.IsNotExist(readErr) {
				t.Fatalf("invalid output published: %v", readErr)
			}
			leftovers, _ := filepath.Glob(filepath.Join(dir, ".download-*"))
			if len(leftovers) > 0 {
				t.Fatal(leftovers)
			}
		})
	}
	d := downloader{yt, "/unused", 10}
	if err := d.Download(context.Background(), "jNQXAC9IVRw", filepath.Join(t.TempDir(), "missing", "video.mp4")); err == nil {
		t.Fatal("missing parent accepted")
	}
	d.ytDLP = executable(t, "exit 1")
	if err := d.Download(context.Background(), "jNQXAC9IVRw", filepath.Join(t.TempDir(), "video.mp4")); err == nil {
		t.Fatal("invalid metadata accepted")
	}
}

func TestWorkerConfigurationAndStartupErrors(t *testing.T) {
	for _, value := range []string{"", "garbage", "0", "-1", "42"} {
		t.Setenv("WORKER_TEST_NUMBER", value)
		want := int64(7)
		if value == "42" {
			want = 42
		}
		if got := envInt("WORKER_TEST_NUMBER", 7); got != want {
			t.Fatalf("%q: %d", value, got)
		}
	}
	t.Setenv("WORKER_TEST_STRING", "")
	if env("WORKER_TEST_STRING", "fallback") != "fallback" {
		t.Fatal("fallback")
	}
	t.Setenv("WORKER_TEST_STRING", "value")
	if env("WORKER_TEST_STRING", "fallback") != "value" {
		t.Fatal("value")
	}
	t.Setenv("YOUTUBE_YT_DLP_PATH", filepath.Join(t.TempDir(), "missing"))
	if run() == nil {
		t.Fatal("missing yt-dlp accepted")
	}
	t.Setenv("YOUTUBE_YT_DLP_PATH", "/bin/sh")
	t.Setenv("YOUTUBE_FFMPEG_PATH", filepath.Join(t.TempDir(), "missing"))
	if run() == nil {
		t.Fatal("missing ffmpeg accepted")
	}
	t.Setenv("YOUTUBE_FFMPEG_PATH", "/bin/sh")
	blocked := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocked, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("YOUTUBE_CACHE_DIR", blocked)
	if run() == nil {
		t.Fatal("file used as cache directory")
	}
	t.Setenv("YOUTUBE_CACHE_DIR", t.TempDir())
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = listener.Close() }()
	_, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("YOUTUBE_WORKER_PORT", port)
	t.Setenv("YOUTUBE_WORKER_HOST", "127.0.0.1")
	if run() == nil {
		t.Fatal("occupied address accepted")
	}
}

func TestCacheRestoresAndEvictsOldest(t *testing.T) {
	dir := t.TempDir()
	old := time.Now().Add(-time.Minute)
	for i, id := range []string{"jNQXAC9IVRw", "abcdefghijk"} {
		path := filepath.Join(dir, id+".mp4")
		if err := os.WriteFile(path, []byte("123456"), 0600); err != nil {
			t.Fatal(err)
		}
		at := old.Add(time.Duration(i) * time.Second)
		if err := os.Chtimes(path, at, at); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(dir, ".download-stale"), 0700); err != nil {
		t.Fatal(err)
	}
	c, err := newCache(context.Background(), dir, 10, 0, time.Hour, time.Second, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer c.close()
	if _, ok := c.entries["jNQXAC9IVRw"]; ok {
		t.Fatal("oldest retained above budget")
	}
	f, err := c.request("abcdefghijk")
	if err != nil || f == nil {
		t.Fatal("restored file unavailable", err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, ".download-stale")); !os.IsNotExist(err) {
		t.Fatal("stale work retained")
	}
	testCacheQueueAndCooldown(t, c, old)
}
func testCacheQueueAndCooldown(t *testing.T, c *cache, old time.Time) {
	t.Helper()
	c.mu.Lock()
	c.failures["expired"] = cacheFailure{old, errors.New("expired")}
	c.cleanupLocked(time.Now())
	_, exists := c.failures["expired"]
	c.mu.Unlock()
	if exists {
		t.Fatal("expired failure retained")
	}
	if err := os.Remove(c.path("abcdefghijk")); err != nil {
		t.Fatal(err)
	}
	if f, err := c.request("abcdefghijk"); err != nil || f != nil {
		t.Fatal("missing disk file not requeued")
	}
	// No workers: fill the bounded queue deterministically.
	for len(c.jobs) < cap(c.jobs) {
		c.jobs <- "jNQXAC9IVRw"
	}
	if _, err := c.request("01234567890"); err == nil || err.Error() != "busy" {
		t.Fatal("full queue accepted", err)
	}
	c.close()
	if _, err := c.request("jNQXAC9IVRw"); !errors.Is(err, errUnavailable) {
		t.Fatal(err)
	}
}

func TestDownloaderMetadataFailuresAndSearchLimit(t *testing.T) {
	if len([]rune(title(strings.Repeat("я", 200)))) != 160 {
		t.Fatal("title not bounded")
	}
	for _, program := range []string{"/does/not/exist", executable(t, "exit 1"), executable(t, `echo '{"entries":[]}'`)} {
		if _, err := (downloader{ytDLP: program}).Search(context.Background(), "query"); err == nil {
			t.Fatal("failure ignored")
		}
	}
	entries := strings.TrimSuffix(strings.Repeat(`{"id":"jNQXAC9IVRw","duration":1},`, 7), ",")
	d := downloader{ytDLP: executable(t, `echo '{"entries":[`+entries+`]}'`)}
	videos, err := d.Search(context.Background(), "query")
	if err != nil || len(videos) != 5 {
		t.Fatalf("%v %v", videos, err)
	}
}

func TestCacheFailuresAreRetriedAfterCooldown(t *testing.T) {
	for _, mode := range []string{"download", "missing", "empty", "oversized"} {
		t.Run(mode, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				calls := 0
				c := testCache(t, func(_ context.Context, _ string, path string) error {
					calls++
					switch mode {
					case "download":
						return errors.New("download_failed")
					case "missing":
						return nil
					case "empty":
						return os.WriteFile(path, nil, 0600)
					default:
						return os.WriteFile(path, make([]byte, 1025), 0600)
					}
				})
				const id = "jNQXAC9IVRw"
				if f, err := c.request(id); f != nil || err != nil {
					t.Fatal("initial request", err)
				}
				synctest.Wait()
				if _, err := c.request(id); err == nil {
					t.Fatal("failed download not reported")
				}
				if calls != 1 {
					t.Fatal("failure not cached", calls)
				}
				if _, err := os.Stat(c.path(id)); !os.IsNotExist(err) {
					t.Fatal("partial file retained")
				}
				time.Sleep(31 * time.Second)
				if f, err := c.request(id); f != nil || err != nil {
					t.Fatal("cooldown did not allow retry", err)
				}
				synctest.Wait()
				if calls != 2 {
					t.Fatal("download not retried", calls)
				}
				time.Sleep(time.Minute)
				synctest.Wait()
				c.close()
			})
		})
	}
}
