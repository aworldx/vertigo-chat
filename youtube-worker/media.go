package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

const maxDuration = 20 * 60

var validID = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
var unavailable = errors.New("video_unavailable")

type video struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Duration  int    `json:"duration"`
	SourceURL string `json:"source_url"`
}
type metadata struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Duration   float64 `json:"duration"`
	IsLive     bool    `json:"is_live"`
	LiveStatus string  `json:"live_status"`
}

func sourceURL(id string) string { return "https://www.youtube.com/watch?v=" + id }
func normalizeLink(link string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(link))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return "", errors.New("invalid_youtube")
	}
	var id string
	switch strings.ToLower(u.Hostname()) {
	case "youtube.com", "www.youtube.com", "m.youtube.com":
		if u.Path == "/watch" {
			id = u.Query().Get("v")
		} else {
			for _, prefix := range []string{"/shorts/", "/embed/"} {
				if strings.HasPrefix(u.Path, prefix) {
					id = strings.Split(strings.TrimPrefix(u.Path, prefix), "/")[0]
				}
			}
		}
	case "youtu.be", "www.youtu.be":
		id = strings.Split(strings.TrimPrefix(u.Path, "/"), "/")[0]
	}
	if !validID.MatchString(id) {
		return "", errors.New("invalid_youtube")
	}
	return id, nil
}
func title(s string) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) == 0 {
		return "YouTube-видео"
	}
	if len(r) > 160 {
		r = r[:160]
	}
	return string(r)
}

type media interface {
	Search(context.Context, string) ([]video, error)
	Prepare(context.Context, string) (video, error)
	Download(context.Context, string, string) error
}
type downloader struct {
	ytDLP, ffmpeg string
	maxBytes      int64
}

// Kill the process group on cancellation, including yt-dlp's ffmpeg children.
// The worker targets Linux containers and macOS development machines.
func command(ctx context.Context, program string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, program, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if err == syscall.ESRCH {
			return os.ErrProcessDone
		}
		return err
	}
	cmd.WaitDelay = 2 * time.Second
	return cmd
}
func (d downloader) json(ctx context.Context, target any, args ...string) error {
	base := []string{"--ignore-config", "--quiet", "--no-warnings", "--no-playlist", "--socket-timeout", "15", "--retries", "1", "--js-runtimes", "node", "--dump-single-json"}
	cmd := command(ctx, d.ytDLP, append(base, args...)...)
	// Keep diagnostics out of JSON and never buffer unbounded subprocess output.
	output, err := cmd.StdoutPipe()
	if err != nil {
		return unavailable
	}
	if err = cmd.Start(); err != nil {
		return unavailable
	}
	data, readErr := io.ReadAll(io.LimitReader(output, 8*1024*1024+1))
	if readErr != nil || len(data) > 8*1024*1024 {
		_ = cmd.Cancel()
	}
	if err = cmd.Wait(); err != nil || readErr != nil || len(data) > 8*1024*1024 {
		return unavailable
	}
	if json.Unmarshal(data, target) != nil {
		return unavailable
	}
	return nil
}
func (d downloader) Search(ctx context.Context, query string) ([]video, error) {
	var result struct {
		Entries []metadata `json:"entries"`
	}
	if err := d.json(ctx, &result, "--flat-playlist", "--", "ytsearch5:"+query); err != nil {
		return nil, err
	}
	videos := []video{}
	for _, entry := range result.Entries {
		if !validID.MatchString(entry.ID) || entry.Duration < 1 || entry.Duration > maxDuration || entry.IsLive || entry.LiveStatus == "is_upcoming" {
			continue
		}
		videos = append(videos, video{entry.ID, title(entry.Title), int(entry.Duration), sourceURL(entry.ID)})
		if len(videos) == 5 {
			break
		}
	}
	if len(videos) == 0 {
		return nil, errors.New("not_found")
	}
	return videos, nil
}
func (d downloader) Prepare(ctx context.Context, id string) (video, error) {
	var entry metadata
	if err := d.json(ctx, &entry, "--skip-download", "--", sourceURL(id)); err != nil {
		return video{}, err
	}
	if entry.IsLive || entry.LiveStatus == "is_upcoming" || entry.Duration < 1 {
		return video{}, unavailable
	}
	if entry.Duration > maxDuration {
		return video{}, errors.New("video_too_long")
	}
	return video{id, title(entry.Title), int(entry.Duration), sourceURL(id)}, nil
}
func (d downloader) Download(ctx context.Context, id, path string) error {
	// Revalidate here too: the public proxy can be requested without /prepare.
	if _, err := d.Prepare(ctx, id); err != nil {
		return err
	}
	dir, err := os.MkdirTemp(filepath.Dir(path), ".download-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	input := filepath.Join(dir, "source.mp4")
	args := []string{"--ignore-config", "--quiet", "--no-warnings", "--no-playlist", "--no-part", "--socket-timeout", "15", "--retries", "1", "--js-runtimes", "node", "--ffmpeg-location", d.ffmpeg,
		"--max-filesize", fmt.Sprint(d.maxBytes), "--format", "bestvideo[vcodec^=avc1][height<=360]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=360]", "--merge-output-format", "mp4", "--output", input, "--", sourceURL(id)}
	if err := command(ctx, d.ytDLP, args...).Run(); err != nil {
		return err
	}
	output := filepath.Join(dir, "ready.mp4")
	if err := command(ctx, d.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", input, "-c", "copy", "-movflags", "+faststart", "-f", "mp4", output).Run(); err != nil {
		return err
	}
	info, err := os.Stat(output)
	if err != nil {
		return err
	}
	if info.Size() == 0 || info.Size() > d.maxBytes {
		return errors.New("invalid_file_size")
	}
	return os.Rename(output, path)
}
