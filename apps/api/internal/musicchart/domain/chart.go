package domain

import (
	"bytes"
	"errors"
	"strings"
	"unicode/utf8"
)

var ErrUnavailable = errors.New("chart media storage unavailable")
var ErrInvalid = errors.New("invalid chart input")
var ErrForbidden = errors.New("track action forbidden")
var ErrLimit = errors.New("track limit reached")
var ErrNotFound = errors.New("track not found")

const MaxAudioBytes = 20_000_000
const MaxTracks = 5

type Comment struct {
	ID     int64  `json:"id"`
	Author string `json:"author"`
	Body   string `json:"body"`
}
type Track struct {
	ID       int64     `json:"id"`
	Title    string    `json:"title"`
	Author   string    `json:"author"`
	Own      bool      `json:"own"`
	Likes    int       `json:"likes_count"`
	Liked    bool      `json:"liked"`
	Comments []Comment `json:"comments"`
}
type Audio struct {
	Bytes            []byte
	Key, ContentType string
}

func Text(raw string, max int) (string, error) {
	text := strings.TrimSpace(raw)
	if text == "" || utf8.RuneCountInString(text) > max {
		return "", ErrInvalid
	}
	return text, nil
}
func ValidAudio(data []byte, kind string) bool {
	if len(data) == 0 || len(data) > MaxAudioBytes {
		return false
	}
	switch kind {
	case "audio/mpeg":
		return bytes.HasPrefix(data, []byte("ID3")) || len(data) >= 2 && data[0] == 255 && data[1] >= 0xe2 && data[1] <= 0xfb
	case "audio/ogg":
		return bytes.HasPrefix(data, []byte("OggS"))
	case "audio/wav":
		return len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WAVE"
	}
	return false
}
