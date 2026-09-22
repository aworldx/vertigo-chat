package postgres

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
)

func thumbnail(ctx context.Context, bytes []byte, contentType string) ([]byte, error) {
	format, ok := imageFormat(bytes, contentType)
	if !ok {
		return nil, errInvalidPhoto
	}
	directory, err := os.MkdirTemp("", "chat-thumbnail-")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(directory) }()
	input := filepath.Join(directory, "input")
	output := filepath.Join(directory, "thumbnail.webp")
	if err := os.WriteFile(input, bytes, 0o600); err != nil {
		return nil, err
	}
	processor, err := exec.LookPath("magick")
	if err != nil {
		processor, err = exec.LookPath("convert")
	}
	if err != nil {
		return nil, err
	}
	command := exec.CommandContext(ctx, processor,
		"-limit", "memory", "64MiB", "-limit", "map", "128MiB", "-limit", "disk", "256MiB", "-limit", "time", "15",
		format+":"+input+"[0]", "-auto-orient", "-thumbnail", "480x480>", "-strip", "-quality", "75", output,
	)
	if err := command.Run(); err != nil {
		return nil, err
	}
	return os.ReadFile(output)
}

var errInvalidPhoto = errors.New("invalid profile photo")

func imageFormat(bytes []byte, contentType string) (string, bool) {
	if contentType == "image/jpeg" && len(bytes) >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
		return "jpeg", true
	}
	if contentType == "image/png" && len(bytes) >= 8 && string(bytes[:8]) == "\x89PNG\r\n\x1a\n" {
		return "png", true
	}
	if contentType == "image/webp" && len(bytes) >= 12 && string(bytes[:4]) == "RIFF" && string(bytes[8:12]) == "WEBP" {
		return "webp", true
	}
	return "", false
}
