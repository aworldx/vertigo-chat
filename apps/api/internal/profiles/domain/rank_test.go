package domain

import "testing"

func TestRankRequiresBothThresholds(t *testing.T) {
	ranks := RankDefinitions()
	for i, rank := range ranks {
		title, icon := Rank(rank.Messages, rank.Hours*3600)
		if title != rank.Title || icon != rank.Icon {
			t.Fatalf("threshold: %s", rank.Title)
		}
		if i == 0 {
			continue
		}
		for _, input := range [][2]int{{rank.Messages - 1, rank.Hours * 3600}, {rank.Messages, rank.Hours*3600 - 1}} {
			title, _ = Rank(input[0], input[1])
			if title != ranks[i-1].Title {
				t.Fatalf("premature rank: %s", title)
			}
		}
	}
	ranks[0].Title = "changed"
	title, _ := Rank(-1, -1)
	if title != "Зритель первого ряда" {
		t.Fatal("definitions leaked mutable state")
	}
}
