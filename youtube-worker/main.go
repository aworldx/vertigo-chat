package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"
)

type server struct {
	media          media
	cache          *cache
	metadataSlots  chan struct{}
	requestTimeout time.Duration
}

func sendJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func sendError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	code := "video_unavailable"
	switch err.Error() {
	case "invalid_json":
		status = 400
		code = err.Error()
	case "invalid_youtube", "video_too_long", "query_required", "query_too_long":
		status = 422
		code = err.Error()
	case "not_found":
		status = 404
		code = err.Error()
	case "busy":
		status = 503
		w.Header().Set("Retry-After", "1")
	}
	sendJSON(w, status, map[string]string{"error": code})
}
func readJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	decoder := json.NewDecoder(r.Body)
	if decoder.Decode(target) != nil {
		return errors.New("invalid_json")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return errors.New("invalid_json")
	}
	return nil
}
func (s *server) metadataContext(w http.ResponseWriter, r *http.Request) (context.Context, func(), bool) {
	select {
	case s.metadataSlots <- struct{}{}:
		ctx, cancel := context.WithTimeout(r.Context(), s.requestTimeout)
		return ctx, func() { cancel(); <-s.metadataSlots }, true
	default:
		sendError(w, errors.New("busy"))
		return nil, nil, false
	}
}
func (s *server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = io.WriteString(w, "ok")
	})
	mux.HandleFunc("POST /youtube/search", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Query string `json:"query"`
		}
		if err := readJSON(w, r, &body); err != nil {
			sendError(w, err)
			return
		}
		query := strings.TrimSpace(body.Query)
		if query == "" {
			sendError(w, errors.New("query_required"))
			return
		}
		if utf8.RuneCountInString(query) > 200 {
			sendError(w, errors.New("query_too_long"))
			return
		}
		ctx, done, ok := s.metadataContext(w, r)
		if !ok {
			return
		}
		defer done()
		videos, err := s.media.Search(ctx, query)
		if err != nil {
			sendError(w, err)
			return
		}
		sendJSON(w, 200, map[string]any{"videos": videos})
	})
	mux.HandleFunc("POST /youtube/prepare", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			SourceURL string `json:"source_url"`
		}
		if err := readJSON(w, r, &body); err != nil {
			sendError(w, err)
			return
		}
		id, err := normalizeLink(body.SourceURL)
		if err != nil {
			sendError(w, err)
			return
		}
		ctx, done, ok := s.metadataContext(w, r)
		if !ok {
			return
		}
		defer done()
		video, err := s.media.Prepare(ctx, id)
		if err != nil {
			sendError(w, err)
			return
		}
		sendJSON(w, 200, map[string]any{"title": video.Title, "duration": video.Duration})
	})
	mux.HandleFunc("GET /youtube-proxy/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		f, err := s.cache.request(r.PathValue("id"))
		if err != nil {
			sendError(w, err)
			return
		}
		if f == nil {
			w.Header().Set("Retry-After", "1")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(202)
			return
		}
		defer f.Close()
		info, err := f.Stat()
		if err != nil {
			sendError(w, unavailable)
			return
		}
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeContent(w, r, info.Name(), info.ModTime(), f)
	})
	return mux
}
func envInt(name string, defaultValue int64) int64 {
	value, err := strconv.ParseInt(os.Getenv(name), 10, 64)
	if err != nil || value <= 0 {
		return defaultValue
	}
	return value
}
func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
func main() {
	if err := run(); err != nil {
		slog.Error("youtube_worker_stopped", "error", err)
		os.Exit(1)
	}
}
func run() error {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	yt, err := exec.LookPath(env("YOUTUBE_YT_DLP_PATH", "yt-dlp"))
	if err != nil {
		return err
	}
	ffmpeg, err := exec.LookPath(env("YOUTUBE_FFMPEG_PATH", "ffmpeg"))
	if err != nil {
		return err
	}
	maxBytes := envInt("YOUTUBE_CACHE_MAX_BYTES", 2*1024*1024*1024)
	media := downloader{yt, ffmpeg, maxBytes}
	cache, err := newCache(ctx, env("YOUTUBE_CACHE_DIR", filepath.Join(os.TempDir(), "chat-youtube-cache")), maxBytes, int(envInt("YOUTUBE_CACHE_MAX_PREPARATIONS", 1)), 6*time.Hour, time.Duration(envInt("YOUTUBE_DOWNLOAD_TIMEOUT_MS", 120000))*time.Millisecond, media.Download)
	if err != nil {
		return err
	}
	defer cache.close()
	s := server{media, cache, make(chan struct{}, 4), time.Duration(envInt("YOUTUBE_REQUEST_TIMEOUT_MS", 25000)) * time.Millisecond}
	httpServer := &http.Server{Addr: net.JoinHostPort(env("YOUTUBE_WORKER_HOST", "127.0.0.1"), strconv.FormatInt(envInt("YOUTUBE_WORKER_PORT", 4001), 10)), Handler: s.handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	stopped := make(chan error, 1)
	go func() {
		slog.Info("youtube_worker_listening", "address", httpServer.Addr)
		stopped <- httpServer.ListenAndServe()
	}()
	select {
	case err := <-stopped:
		return err
	case <-ctx.Done():
		shutdown, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		return httpServer.Shutdown(shutdown)
	}
}
