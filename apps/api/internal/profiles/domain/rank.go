package domain

func Rank(messages, seconds int) (string, string) {
	ranks := []struct {
		title, icon     string
		messages, hours int
	}{{"Зритель первого ряда", "ticket", 0, 0}, {"Киноман", "users-group", 50, 5}, {"Статист", "armchair", 200, 20}, {"Исполнитель эпизода", "movie", 600, 60}, {"Актёр второго плана", "star", 1500, 150}, {"Звезда экрана", "device-tv", 3500, 350}, {"Сценарист", "file-text", 7000, 700}, {"Продюсер", "cash", 12000, 1200}, {"Режиссёр-постановщик", "camera", 20000, 2000}, {"Режиссер", "theater", 35000, 3500}}
	current := ranks[0]
	for _, candidate := range ranks {
		if messages >= candidate.messages && seconds >= candidate.hours*3600 {
			current = candidate
		}
	}
	return current.title, current.icon
}
