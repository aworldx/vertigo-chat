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

func TestPublicationLimitsFollowBothRankThresholds(t *testing.T) {
	expected := []int{1, 2, 3, 5, 8, 12, 18, 25, 35, 50}
	for i, rank := range RankDefinitions() {
		want := PublicationLimits{expected[i], expected[i], expected[i]}
		if got := CurrentRank(rank.Messages, rank.Hours*3600).Limits; got != want {
			t.Fatalf("%s: got %+v want %+v", rank.Title, got, want)
		}
		if i == 0 {
			continue
		}
		for _, counters := range [][2]int{{rank.Messages - 1, rank.Hours * 3600}, {rank.Messages, rank.Hours*3600 - 1}} {
			if got := CurrentRank(counters[0], counters[1]).Limits; got.Tracks != expected[i-1] || got.Articles != expected[i-1] || got.Photos != expected[i-1] {
				t.Fatalf("premature limit: %+v", got)
			}
		}
	}
}
