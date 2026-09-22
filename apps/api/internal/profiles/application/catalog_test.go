package application

import (
	"context"
	"testing"

	"chat/api/internal/profiles/domain"
)

type catalogueStub struct {
	query string
	page  int
}

func (s *catalogueStub) List(_ context.Context, query string, page, _ int) (domain.Page, error) {
	s.query, s.page = query, page
	return domain.Page{Number: page}, nil
}
func (s *catalogueStub) GetByNickname(_ context.Context, nickname string) (domain.Profile, error) {
	return domain.Profile{Nickname: nickname}, nil
}

func TestCatalogNormalizesQueryBeforeRepository(t *testing.T) {
	repository := &catalogueStub{}
	result, query, err := NewCatalog(repository).List(context.Background(), "  Алиса  ", 2)
	if err != nil || query != "Алиса" || repository.query != "Алиса" || result.Number != 2 {
		t.Fatalf("unexpected result: %#v, %q, %v", result, query, err)
	}
}
func TestCatalogRejectsInvalidInput(t *testing.T) {
	catalog := NewCatalog(&catalogueStub{})
	if _, _, err := catalog.List(context.Background(), "ok", 0); err != ErrInvalidPage {
		t.Fatalf("page error = %v", err)
	}
	if _, _, err := catalog.List(context.Background(), string(make([]rune, 81)), 1); err != ErrInvalidQuery {
		t.Fatalf("query error = %v", err)
	}
}

type updaterStub struct{ input domain.UpdateInput }

func (s *updaterStub) UpdateByUserID(_ context.Context, _ int64, input domain.UpdateInput) (domain.Profile, error) {
	s.input = input
	return domain.Profile{}, nil
}

func TestEditorAllowsPartialUpdateWithoutTurningAbsentFieldsIntoNull(t *testing.T) {
	repository := &updaterStub{}
	name := "Алиса"
	input := domain.UpdateInput{Name: domain.StringField{Set: true, Value: &name}}
	if _, err := NewEditor(repository).Update(context.Background(), 1, input); err != nil {
		t.Fatal(err)
	}
	if !repository.input.Name.Set || repository.input.About.Set {
		t.Fatalf("unexpected input: %#v", repository.input)
	}
}

func TestEditorRejectsFutureBirthDate(t *testing.T) {
	future := "2999-01-01"
	input := domain.UpdateInput{BirthDate: domain.StringField{Set: true, Value: &future}}
	if _, err := NewEditor(&updaterStub{}).Update(context.Background(), 1, input); err != ErrInvalidProfile {
		t.Fatalf("error = %v", err)
	}
}
