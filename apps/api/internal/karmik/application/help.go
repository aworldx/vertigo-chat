package application

import "chat/api/internal/karmik/domain"

func HelpTopics(body string) []string { return domain.HelpTopics(body) }
