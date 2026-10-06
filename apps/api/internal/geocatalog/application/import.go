package application

import "chat/api/internal/geocatalog/domain"

// Store serializes concurrent updates, persisting only a successful callback.
type Store interface {
	Update(func(domain.Catalog) (domain.Catalog, error), bool) error
}

func Import(store Store, source domain.Source, records []domain.Record, apply bool) (domain.Report, error) {
	var report domain.Report
	err := store.Update(func(current domain.Catalog) (domain.Catalog, error) {
		next, result, err := domain.Merge(current, source, records)
		report = result
		return next, err
	}, apply)
	if err != nil {
		return domain.Report{}, err
	}
	return report, nil
}
