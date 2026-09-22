package application

import "chat/api/internal/profiles/domain"

func Rank(messages, seconds int) (string, string) { return domain.Rank(messages, seconds) }
