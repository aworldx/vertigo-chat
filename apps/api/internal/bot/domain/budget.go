package domain

// Budget describes the application's shared daily allowance, not an OpenAI account balance.
type Budget struct {
	Limit, Used, StopThreshold, Remaining, Available int
}

func NewBudget(limit, used, stopThreshold int) Budget {
	return Budget{Limit: limit, Used: used, StopThreshold: stopThreshold,
		Remaining: max(0, limit-used), Available: max(0, stopThreshold-used)}
}
