package main

import "testing"

func TestBotEnablement(t *testing.T) {
	for _, tc := range []struct {
		claire, ambient         string
		wantClaire, wantAmbient bool
	}{
		{"", "", false, false},
		{"false", "true", false, false},
		{"true", "", true, false},
		{"true", "true", true, true},
	} {
		t.Run(tc.claire+"/"+tc.ambient, func(t *testing.T) {
			t.Setenv("CLAIRE_ENABLED", tc.claire)
			t.Setenv("CLAIRE_AMBIENT_ENABLED", tc.ambient)
			if claireEnabled() != tc.wantClaire || ambientEnabled() != tc.wantAmbient {
				t.Fatal("unexpected bot enablement")
			}
		})
	}
}
