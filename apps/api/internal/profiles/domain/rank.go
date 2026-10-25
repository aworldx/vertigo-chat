package domain

type RankDefinition struct {
	Title, Icon     string
	Messages, Hours int
	FeatureUnlock   string
	Limits          PublicationLimits
}

// RankDefinitions returns a fresh copy of the progression rules.
func RankDefinitions() []RankDefinition {
	return []RankDefinition{
		{"Зритель первого ряда", "ticket", 0, 0, "", PublicationLimits{1, 1, 1}},
		{"Киноман", "users-group", 50, 5, "", PublicationLimits{2, 2, 2}},
		{"Статист", "armchair", 200, 20, "", PublicationLimits{3, 3, 3}},
		{"Исполнитель эпизода", "movie", 600, 60, "", PublicationLimits{5, 5, 5}},
		{"Актёр второго плана", "star", 1500, 150, "", PublicationLimits{8, 8, 8}},
		{"Звезда экрана", "device-tv", 3500, 350, "", PublicationLimits{12, 12, 12}},
		{"Сценарист", "file-text", 7000, 700, "", PublicationLimits{18, 18, 18}},
		{"Продюсер", "cash", 12000, 1200, "", PublicationLimits{25, 25, 25}},
		{"Режиссёр-постановщик", "camera", 20000, 2000, "", PublicationLimits{35, 35, 35}},
		{"Режиссер", "theater", 35000, 3500, "", PublicationLimits{50, 50, 50}},
	}
}

func CurrentRank(messages, seconds int) RankDefinition {
	ranks := RankDefinitions()
	current := ranks[0]
	for _, candidate := range ranks {
		if messages >= candidate.Messages && seconds >= candidate.Hours*3600 {
			current = candidate
		}
	}
	return current
}

func MeetsRank(messages, seconds int, title string) bool {
	for _, r := range RankDefinitions() {
		if r.Title == title {
			return messages >= r.Messages && seconds >= r.Hours*3600
		}
	}
	return false
}

// PublicationLimits are total stored items per registered author, not daily additions.
type PublicationLimits struct {
	Tracks, Articles, Photos int
}

func Rank(messages, seconds int) (string, string) {
	rank := CurrentRank(messages, seconds)
	return rank.Title, rank.Icon
}
