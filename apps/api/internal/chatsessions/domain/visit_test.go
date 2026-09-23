package domain

import (
	"reflect"
	"testing"
	"time"
)

func TestCollapseActiveVisitsPreservesFinishedAndExactNicknames(t *testing.T) {
	left := time.Now()
	input := []Visit{{ID: 7, Nickname: "same"}, {ID: 6, Nickname: "same", LeftAt: &left}, {ID: 5, Nickname: "same"}, {ID: 4, Nickname: "Same"}, {ID: 3, Nickname: "same", LeftAt: &left}}
	got := CollapseActiveVisits(input)
	ids := []int64{}
	for _, visit := range got {
		ids = append(ids, visit.ID)
	}
	if !reflect.DeepEqual(ids, []int64{7, 6, 4, 3}) {
		t.Fatal(ids)
	}
	if len(input) != 5 || input[2].ID != 5 {
		t.Fatal("mutated source")
	}
	if CollapseActiveVisits(nil) == nil {
		t.Fatal("empty history must serialize as array")
	}
}
