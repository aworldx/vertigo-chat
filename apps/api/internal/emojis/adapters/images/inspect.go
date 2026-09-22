package images

import (
	"bytes"
	"chat/api/internal/emojis/application"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

type Inspector struct{}

func (Inspector) Inspect(ctx context.Context, data []byte, kind string) (int, int, bool, error) {
	formats := map[string]string{"image/png": "png", "image/gif": "gif", "image/webp": "webp"}
	format := formats[kind]
	if format == "" {
		return 0, 0, false, application.ErrUpload
	}
	binary, err := exec.LookPath("magick")
	args := []string{"identify"}
	if err != nil {
		binary, err = exec.LookPath("identify")
		args = nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	args = append(args, "-limit", "memory", "64MiB", "-limit", "map", "128MiB", "-limit", "disk", "0", "-limit", "time", "5", "-format", "%w %h %n\n", format+":-")
	command := exec.CommandContext(ctx, binary, args...)
	command.Stdin = bytes.NewReader(data)
	out, err := command.Output()
	if err != nil {
		return 0, 0, false, err
	}
	var width, height, frames int
	_, err = fmt.Fscan(strings.NewReader(string(out)), &width, &height, &frames)
	return width, height, frames > 1, err
}
