package domain

import "testing"

func TestAssessmentCannotTargetUnknownOrRepeatAuthor(t *testing.T) {
	eligible := map[int64]Message{1: {UserID: 7}, 2: {UserID: 7}}
	if Validate([]Assessment{{1, "good", "Помощь"}}, eligible) != nil {
		t.Fatal("valid rejected")
	}
	for _, bad := range [][]Assessment{{{3, "bad", "Нет"}}, {{1, "good", "Да"}, {2, "bad", "Нет"}}, {{1, "bad", ""}}, {{1, "invented", "Причина"}}} {
		if Validate(bad, eligible) == nil {
			t.Fatal("invalid accepted", bad)
		}
	}
}
