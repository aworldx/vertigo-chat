package domain

import (
	"regexp"
	"strings"
)

var helpQuestion = regexp.MustCompile(`(^|[^\p{L}])(как|где|куда|почему|какие|что|хочу)([^\p{L}]|$)|подскаж|помог|не (могу|знаю|получается|понимаю)`)
var helpResolved = regexp.MustCompile(`(не нужна|не надо|не требуется) помощь|я (уже )?(знаю|понял|поняла|разобрал)|расскажу как|объясню как`)
var helpSubjects = []struct {
	id    string
	words *regexp.Regexp
}{
	{"video", regexp.MustCompile(`видео|ролик|клип|ют[ую]б|youtube`)},
	{"music", regexp.MustCompile(`музык|песн|трек`)},
	{"font", regexp.MustCompile(`шрифт|курсив|начертани`)},
	{"colors", regexp.MustCompile(`цвет`)},
	{"files", regexp.MustCompile(`файл|фото|картинк|изображен|вложени|аудио`)},
	{"private", regexp.MustCompile(`личк|личн|приват|написать одному`)},
	{"gif", regexp.MustCompile(`гиф|gif|анимаци`)},
	{"emoji", regexp.MustCompile(`смайл|эмодзи|эмоджи|реакци`)},
	{"address", regexp.MustCompile(`обратиться|обращени|упомя|обратит`)},
	{"ignore", regexp.MustCompile(`игнор|заблокир|скрыть.*(участник|чатлан|сообщения)`)},
	{"clear", regexp.MustCompile(`очист|удалить.*(истори|переписк|сообщени)`)},
	{"online", regexp.MustCompile(`кто.*(чате|онлайн|заходил|был)|участник.*(спис|онлайн)|спис.*чатлан|посещени`)},
	{"appearance", regexp.MustCompile(`тем[ауые]([^\p{L}]|$)|оформлен|фон|рамк|вид сообщений|интерфейс`)},
	{"profile", regexp.MustCompile(`анкет|профил|аватар|фото.*(себ|профил)`)},
	{"account", regexp.MustCompile(`регистрац|зарегистр|парол|аккаунт|войти|вход|сменить ник|поменять ник`)},
	{"ranks", regexp.MustCompile(`зван|ранг|уровень|прогресс|статист|киноман`)},
	{"karma", regexp.MustCompile(`кармик|карм|рейтинг|котик|кот[а ]`)},
	{"bots", regexp.MustCompile(`(^|[^\p{L}])бот|клэр|хичкок|токен`)},
	{"gallery", regexp.MustCompile(`альбом|галере`)},
	{"library", regexp.MustCompile(`библиотек|стать[юяи]|статей|сери[яию]`)},
	{"chart", regexp.MustCompile(`хит.?парад|топ.*(музык|трек)|коммент.*трек`)},
	{"connection", regexp.MustCompile(`связ|соединени|не отправ|не достав|не уход|переподключ|другой вклад|лимит|ошибк`)},
	{"leave", regexp.MustCompile(`выйти|выход|покинуть`)},
	{"games", regexp.MustCompile(`(^|[^\p{L}])игр|шашк|балда|морской бой|дурак`)},
	{"admin", regexp.MustCompile(`админ|модерац`)},
	{"commands", regexp.MustCompile(`команд|пользоваться чатом|работает чат`)},
}

// HelpTopics recognizes explicit questions about chat controls. It never treats
// message text as instructions or generates unverified advice. These local
// hints work for guests immediately, independently of karma quotas/AI budget.
func HelpTopics(body string) []string {
	text := strings.ToLower(strings.TrimSpace(body))
	if strings.HasPrefix(text, "^") || strings.HasPrefix(text, "/") || helpResolved.MatchString(text) || (!helpQuestion.MatchString(text) && text != "нужна помощь") {
		return nil
	}
	topics := []string{}
	for _, subject := range helpSubjects {
		if subject.words.MatchString(text) {
			topics = append(topics, subject.id)
		}
	}
	if len(topics) == 0 && (text == "помогите" || text == "помогите!" || text == "нужна помощь" || text == "как пользоваться чатом?") {
		return []string{"commands"}
	}
	return topics
}
