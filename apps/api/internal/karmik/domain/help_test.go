package domain

import (
	"reflect"
	"testing"
)

func TestHelpTopics(t *testing.T) {
	for _, tc := range []struct {
		body string
		want []string
	}{
		{"как найти фразы кому?", []string{"history"}},
		{"где фильтр по автору?", []string{"history"}},
		{"как поставить фильтр для воды?", nil},
		{"как сделать AI-саммари за выбранный период?", []string{"history"}},
		{"где сводка погоды?", nil},
		{"где история сообщений?", []string{"history"}},
		{"как посмотреть старые сообщения?", []string{"history"}},
		{"хочу найти сообщения за вчера", []string{"history"}},
		{"как посмотреть историю чата за период?", []string{"history"}},
		{"расскажу как открыть историю чата", nil},
		{"какая история у этого города?", nil},
		{"вчера читал историю сообщений", nil},
		{"как запустить тетрис?", []string{"games"}},
		{"где таблица лидеров?", []string{"games"}},
		{"Вчера играл в тетрис", nil},
		{"/тетрис соло", nil},
		{"я знаю как играть в тетрис", nil},
		{"как открыть личные настройки?", []string{"appearance"}},
		{"где настройки чата?", []string{"appearance"}},
		{"как открыть настройки телефона?", nil},
		{"где настройки темы?", []string{"appearance"}},
		{"как отключить надпись кто-то печатает?", []string{"appearance"}},
		{"где скрыть индикатор набора текста?", []string{"appearance"}},
		{"что он печатает в типографии?", nil},
		{"как отправить гифку?", []string{"gif"}},
		{"как повысить звание?", []string{"ranks"}},
		{"как заказать видео ?", []string{"video"}},
		{"как заказывать видео", []string{"video"}},
		{"как отправить YouTube", []string{"video"}},
		{"как заказать музыку", []string{"music"}},
		{"как скрыть телевизор?", []string{"music"}},
		{"как свернуть плеер?", []string{"music"}},
		{"где очередь треков?", []string{"music"}},
		{"как открыть Чатлан ТВ?", []string{"music"}},
		{"где купить телевизор?", nil},
		{"я уже знаю как свернуть плеер", nil},
		{"вчера смотрел телевизор", nil},
		{"КАК поменять шрифт?", []string{"font"}},
		{"подскажите как поменять цвет ника и шрифт", []string{"font", "colors"}},
		{"не могу прикрепить фото", []string{"files"}},
		{"как написать в личку", []string{"private"}},
		{"как оставить записку чатлану?", []string{"notes"}},
		{"как проголосовать в опросе?", []string{"polls"}},
		{"голосовал вчера в опросе", nil},
		{"как ответить на сообщение с цитатой?", []string{"reply"}},
		{"где цитировать сообщение?", []string{"reply"}},
		{"ответил на сообщение вчера", nil},
		{"какие команды есть?", []string{"commands"}},
		{"где команды чата?", []string{"commands"}},
		{"помогите!", []string{"commands"}},
		{"нужна помощь", []string{"commands"}},
		{"какая хорошая музыка", nil},
		{"я уже знаю как поменять шрифт", nil},
		{"^Друг, как заказать музыку", nil},
		{"/музыка как заказать музыку", nil},
		{"помогите с домашним заданием", nil},
	} {
		t.Run(tc.body, func(t *testing.T) {
			got := HelpTopics(tc.body)
			if len(got) != 0 || len(tc.want) != 0 {
				if !reflect.DeepEqual(got, tc.want) {
					t.Fatalf("got %v want %v", got, tc.want)
				}
			}
		})
	}
}

func TestHelpCoversChatFeatures(t *testing.T) {
	for topic, question := range map[string]string{
		"emoji": "как поставить реакцию", "address": "как обратиться к участнику", "reply": "как ответить с цитатой", "ignore": "как включить игнор", "clear": "как очистить историю",
		"online": "где посмотреть кто был", "profile": "как изменить анкету", "account": "как зарегистрироваться", "notes": "как оставить записку", "karma": "почему Кармик понижает карму",
		"bots": "как общаться с ботами", "gallery": "как добавить фото в альбом", "library": "как написать статью", "chart": "как добавить трек в хит-парад", "polls": "как голосовать в опросе",
		"connection": "почему не отправляются сообщения", "leave": "как выйти из чата", "games": "как играть в шашки", "admin": "где админка",
	} {
		t.Run(topic, func(t *testing.T) {
			found := false
			for _, got := range HelpTopics(question) {
				if got == topic {
					found = true
				}
			}
			if !found {
				t.Fatalf("no %s help for %q", topic, question)
			}
		})
	}
}
