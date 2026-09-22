package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	size     int64
	accessed time.Time
}
type cacheFailure struct {
	until time.Time
	err   error
}
type cache struct {
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
	wg           sync.WaitGroup
	dir          string
	maxBytes     int64
	ttl, timeout time.Duration
	entries      map[string]cacheEntry
	pending      map[string]bool
	failures     map[string]cacheFailure
	jobs         chan string
	download     func(context.Context, string, string) error
}

func newCache(parent context.Context, dir string, maxBytes int64, workers int, ttl, timeout time.Duration, download func(context.Context, string, string) error) (*cache, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(parent)
	c := &cache{ctx: ctx, cancel: cancel, dir: dir, maxBytes: maxBytes, ttl: ttl, timeout: timeout, entries: map[string]cacheEntry{}, pending: map[string]bool{}, failures: map[string]cacheFailure{}, jobs: make(chan string, 128), download: download}
	files, err := os.ReadDir(dir)
	if err != nil {
		cancel()
		return nil, err
	}
	for _, f := range files {
		id := strings.TrimSuffix(f.Name(), ".mp4")
		if strings.HasPrefix(f.Name(), ".download-") {
			_ = os.RemoveAll(filepath.Join(dir, f.Name()))
			continue
		}
		if f.Type().IsRegular() && strings.HasSuffix(f.Name(), ".mp4") && validID.MatchString(id) {
			if info, err := f.Info(); err == nil && info.Size() > 0 {
				c.entries[id] = cacheEntry{info.Size(), info.ModTime()}
			}
		}
	}
	c.cleanupLocked(time.Now())
	for i := 0; i < workers; i++ {
		c.wg.Add(1)
		go c.run()
	}
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				c.mu.Lock()
				c.cleanupLocked(now)
				c.mu.Unlock()
			}
		}
	}()
	return c, nil
}
func (c *cache) close()                { c.cancel(); c.wg.Wait() }
func (c *cache) path(id string) string { return filepath.Join(c.dir, id+".mp4") }

// Open under the lock so eviction cannot race a reader opening the file.
func (c *cache) request(id string) (*os.File, error) {
	if !validID.MatchString(id) {
		return nil, errors.New("invalid_youtube")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ctx.Err() != nil {
		return nil, unavailable
	}
	if entry, ok := c.entries[id]; ok {
		f, err := os.Open(c.path(id))
		if err == nil {
			entry.accessed = time.Now()
			c.entries[id] = entry
			return f, nil
		}
		delete(c.entries, id)
	}
	if fail, ok := c.failures[id]; ok && time.Now().Before(fail.until) {
		return nil, fail.err
	}
	if c.pending[id] {
		return nil, nil
	}
	select {
	case c.jobs <- id:
		c.pending[id] = true
		return nil, nil
	default:
		return nil, errors.New("busy")
	}
}
func (c *cache) run() {
	defer c.wg.Done()
	for {
		select {
		case <-c.ctx.Done():
			return
		case id := <-c.jobs:
			ctx, cancel := context.WithTimeout(c.ctx, c.timeout)
			started := time.Now()
			err := c.download(ctx, id, c.path(id))
			cancel()
			var size int64
			if err == nil {
				info, statErr := os.Stat(c.path(id))
				err = statErr
				if err == nil {
					size = info.Size()
					if size <= 0 || size > c.maxBytes {
						err = errors.New("invalid_file_size")
					}
				}
			}
			c.mu.Lock()
			delete(c.pending, id)
			if err != nil {
				_ = os.Remove(c.path(id))
				c.failures[id] = cacheFailure{time.Now().Add(30 * time.Second), err}
				slog.Warn("youtube_cache_prepare_failed", "video_id", id, "error", err)
			} else {
				delete(c.failures, id)
				c.entries[id] = cacheEntry{size, time.Now()}
				c.cleanupLocked(time.Now())
				slog.Info("youtube_cache_prepared", "video_id", id, "bytes", size, "duration", time.Since(started))
			}
			c.mu.Unlock()
		}
	}
}
func (c *cache) cleanupLocked(now time.Time) {
	var total int64
	ids := []string{}
	for id, e := range c.entries {
		if now.Sub(e.accessed) > c.ttl {
			_ = os.Remove(c.path(id))
			delete(c.entries, id)
		} else {
			total += e.size
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return c.entries[ids[i]].accessed.Before(c.entries[ids[j]].accessed) })
	for _, id := range ids {
		if total <= c.maxBytes {
			break
		}
		total -= c.entries[id].size
		_ = os.Remove(c.path(id))
		delete(c.entries, id)
	}
	for id, f := range c.failures {
		if !now.Before(f.until) {
			delete(c.failures, id)
		}
	}
}
