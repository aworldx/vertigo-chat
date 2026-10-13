package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	proxyScanInterval = time.Hour
	proxyProbeTimeout = 18 * time.Second
	proxyProbeWorkers = 4
	proxyProbeVideoID = "jNQXAC9IVRw"
)

// scan rereads the existing secret, probes every valid entry, and publishes
// one consistent snapshot. No proxy address or credential is logged.
func (p *proxyPool) scan(ctx context.Context, file string, probe func(context.Context, string) bool) {
	if p == nil || file == "" {
		return
	}
	started := time.Now()
	items, err := readProxies(file)
	if err != nil {
		p.mu.Lock()
		p.readOK = false
		p.mu.Unlock()
		slog.Warn("youtube_proxy_source_unreadable")
		return
	}
	var wg sync.WaitGroup
	slots := make(chan struct{}, proxyProbeWorkers)
	for i := range items {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		case slots <- struct{}{}:
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			defer func() { <-slots }()
			probeCtx, cancel := context.WithTimeout(ctx, proxyProbeTimeout)
			defer cancel()
			items[i].working = probe(probeCtx, items[i].address)
		}(i)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return
	}
	working := 0
	for _, item := range items {
		if item.working {
			working++
		}
	}
	p.mu.Lock()
	p.items = items
	p.next = 0
	p.readOK = true
	p.checkedAt = time.Now()
	p.mu.Unlock()
	slog.Info("youtube_proxy_scan", "total", len(items), "working", working, "duration", time.Since(started))
}

func (p *proxyPool) monitor(ctx context.Context, file string, probe func(context.Context, string) bool) {
	if p == nil || file == "" {
		return
	}
	p.scan(ctx, file, probe)
	ticker := time.NewTicker(proxyScanInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.scan(ctx, file, probe)
		}
	}
}

// yt-dlp --test fetches only a small fragment of a real YouTube video. A
// metadata-only check would miss the media-host timeouts seen in production.
func (d downloader) probeProxy(ctx context.Context, proxy string) bool {
	dir, err := os.MkdirTemp("", "youtube-proxy-probe-")
	if err != nil {
		return false
	}
	defer func() { _ = os.RemoveAll(dir) }()
	args := []string{
		"--ignore-config", "--quiet", "--no-warnings", "--no-playlist", "--no-part",
		"--socket-timeout", "8", "--retries", "0", "--js-runtimes", ytDLPJSRuntime,
		"--proxy", proxy, "--test", "--format", "bestvideo[vcodec^=avc1][height<=240]",
		"--output", filepath.Join(dir, "probe.%(ext)s"), "--", sourceURL(proxyProbeVideoID),
	}
	if command(ctx, d.ytDLP, args...).Run() != nil {
		return false
	}
	files, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, file := range files {
		info, err := file.Info()
		if err == nil && info.Mode().IsRegular() && info.Size() > 0 {
			return true
		}
	}
	return false
}
