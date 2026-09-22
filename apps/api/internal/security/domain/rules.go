package domain

import "time"

type Rule struct {
	Limit  int
	Window time.Duration
}

var Messages = []Rule{{3, 2 * time.Second}, {12, time.Minute}}
var GuestIP = []Rule{{30, time.Minute}}
var Media = []Rule{{3, time.Minute}, {10, time.Hour}}
