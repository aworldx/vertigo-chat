package domain

import "testing"

func TestRankQuota(t *testing.T) {
	for _, c := range []struct {
		limit, total int
		want         error
	}{{0, 0, ErrLimit}, {1, 0, nil}, {1, 1, ErrLimit}, {3, 2, nil}, {3, 3, ErrLimit}, {3, 50, ErrLimit}, {50, 49, nil}, {50, 50, ErrLimit}} {
		if err := Quota(c.limit, c.total); err != c.want {
			t.Fatal(c, err)
		}
	}
}
