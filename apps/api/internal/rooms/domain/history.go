package domain

// HistoryFilters matches exact public-message nicknames, case-insensitively.
type HistoryFilters struct{ Author, Recipient string }
