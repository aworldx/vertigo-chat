package application

import (
	"regexp"
	"strings"
)

var addressedWord = regexp.MustCompile(`[\p{L}\p{N}_-]+,`)

func Recipient(body string, nicknames []string) string {
	known := map[string]bool{}
	for _, nickname := range nicknames {
		known[nickname] = true
	}
	for _, word := range addressedWord.FindAllString(body, -1) {
		nickname := strings.TrimSuffix(word, ",")
		if known[nickname] {
			return nickname
		}
	}
	return ""
}
