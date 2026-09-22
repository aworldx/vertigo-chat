package domain

type RankDefinition struct {
	Title, Icon     string
	Messages, Hours int
	FeatureUnlock   string
}

// RankDefinitions returns a fresh copy of the progression rules.
func RankDefinitions() []RankDefinition {
	return []RankDefinition{
		{"Зритель первого ряда", "ticket", 0, 0, ""},
		{"Киноман", "users-group", 50, 5, "Можно добавлять статьи в библиотеку"},
		{"Статист", "armchair", 200, 20, "Можно добавлять фотографии в фотоальбом"},
		{"Исполнитель эпизода", "movie", 600, 60, ""},
		{"Актёр второго плана", "star", 1500, 150, ""},
		{"Звезда экрана", "device-tv", 3500, 350, ""},
		{"Сценарист", "file-text", 7000, 700, ""},
		{"Продюсер", "cash", 12000, 1200, ""},
		{"Режиссёр-постановщик", "camera", 20000, 2000, ""},
		{"Режиссер", "theater", 35000, 3500, ""},
	}
}

func Rank(messages, seconds int) (string, string) {
	ranks := RankDefinitions()
	current := ranks[0]
	for _, candidate := range ranks {
		if messages >= candidate.Messages && seconds >= candidate.Hours*3600 {
			current = candidate
		}
	}
	return current.Title, current.Icon
}
