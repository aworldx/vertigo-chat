package postgres

import (
	"strings"
	"testing"
	"time"
)

func TestDatabaseDisplayPreservesTypesWithoutInvalidUTF8(t *testing.T) {
	for _, tc := range []struct {
		value any
		want  string
	}{
		{nil, "nil"}, {"text", "text"}, {[]byte("utf8"), "utf8"}, {[]byte{255, 254}, "<binary 2 bytes>"}, {true, "true"}, {false, "false"}, {42, "42"}, {map[string]int{"a": 1}, `{"a":1}`}, {time.Date(2026, 9, 24, 3, 0, 0, 0, time.FixedZone("MSK", 10800)), "2026-09-24 00:00:00"},
	} {
		if got := display(tc.value); got != tc.want {
			t.Fatalf("%#v: %q", tc.value, got)
		}
	}
	if got := display(make(chan int)); !strings.HasPrefix(got, "0x") {
		t.Fatal(got)
	}
}
