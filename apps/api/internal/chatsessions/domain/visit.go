package domain

import "time"

// Visit contains only the public history projection, never session credentials.
type Visit struct {
	ID        int64
	Nickname  string
	EnteredAt time.Time
	LeftAt    *time.Time
}

// CollapseActiveVisits keeps the newest active entry per nickname.
// Input is ordered by entered_at DESC, id DESC. Finished visits remain distinct.
func CollapseActiveVisits(visits []Visit) []Visit {
	result := make([]Visit, 0, len(visits))
	active := make(map[string]bool)
	for _, visit := range visits {
		if visit.LeftAt == nil {
			if active[visit.Nickname] {
				continue
			}
			active[visit.Nickname] = true
		}
		result = append(result, visit)
	}
	return result
}
