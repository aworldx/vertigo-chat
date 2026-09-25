package domain

import "time"

func Mood(date string) string {
	day, err := time.Parse("2006-01-02", date)
	if err != nil {
		return ""
	}
	holiday := map[time.Month][]int{time.January: {1, 2, 3, 4, 5, 6, 7, 8}, time.February: {23}, time.March: {8}, time.May: {1, 9}, time.June: {12}, time.August: {13}, time.November: {4}, time.December: {31}}
	mood := "Сегодня ты в отличном настроении: бодр, азартен и охотно поддерживаешь беседу. Не ссылайся на лень, плохое настроение, съёмку или занятость, чтобы уйти от ответа. Любопытствуй о собеседнике, если вопрос возникает естественно."
	for _, d := range holiday[day.Month()] {
		if d == day.Day() {
			mood = "Сегодня праздник: настроение хорошее. Общайся так же коротко и просто, без обязательных шуток, тостов и встречных вопросов."
		}
	}
	return "Местная дата: " + date + ".\n" + mood
}
