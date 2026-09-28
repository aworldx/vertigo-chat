package domain

import "math"

func RatingChange(rating float64, place int, opponents []float64, places []int) float64 {
	if len(opponents) == 0 {
		return 0
	}
	change := 0.0
	for i, other := range opponents {
		score := 0.5
		if place < places[i] {
			score = 1
		} else if place > places[i] {
			score = 0
		}
		expected := 1 / (1 + math.Pow(10, (other-rating)/400))
		change += score - expected
	}
	return 32 * change / float64(len(opponents))
}
