package domain

import "testing"

func TestPositiveEvidenceRejectsCourtesyAndFiller(t *testing.T) {
	for _, body := range []string{"", "ку", "КУ!!!", "Маша, ку", "@Alice, привет всем!", "спасибо за помощь", "добрый вечер, всем", "👍❤️", ":хы:", "12345", "ага, ок", "Класс, молодец!", "держись, я рядом", "hello :)"} {
		if PositiveEvidence(body) {
			t.Errorf("reward allowed for %q", body)
		}
	}
	for _, body := range []string{"Маша, открой настройки и выбери шрифт, затем сохрани.", "Ты не виноват в травле, давай вместе обратимся к модератору.", "Вызови скорую"} {
		if !PositiveEvidence(body) {
			t.Errorf("semantic review blocked for %q", body)
		}
	}
}
