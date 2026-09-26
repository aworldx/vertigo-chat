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
		{"где настройки темы?", []string{"appearance"}},
		{"как отправить гифку?", []string{"gif"}},
		{"как повысить звание?", []string{"ranks"}},
		{"как заказать видео ?", []string{"video"}},
		{"как заказывать видео", []string{"video"}},
		{"как отправить YouTube", []string{"video"}},
		{"как заказать музыку", []string{"music"}},
		{"КАК поменять шрифт?", []string{"font"}},
		{"подскажите как поменять цвет ника и шрифт", []string{"font", "colors"}},
		{"не могу прикрепить фото", []string{"files"}},
		{"как написать в личку", []string{"private"}},
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
		"emoji": "как поставить реакцию", "address": "как обратиться к участнику", "ignore": "как включить игнор", "clear": "как очистить историю",
		"online": "где посмотреть кто был", "profile": "как изменить анкету", "account": "как зарегистрироваться", "karma": "почему Кармик понижает карму",
		"bots": "как общаться с ботами", "gallery": "как добавить фото в альбом", "library": "как написать статью", "chart": "как добавить трек в хит-парад",
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
