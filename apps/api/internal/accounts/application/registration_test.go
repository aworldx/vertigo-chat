package application

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestRegistrationValidationRejectsBeforeHashingOrWriting(t *testing.T) {
	// Nil ports make any attempt to hash or persist invalid input fail this test.
	registrar := NewRegistrar(nil, nil)
	for _, tc := range []struct {
		name, nickname, email, password string
		want                            error
	}{
		{"invalid nickname", "!", "", "secret123", ErrRegistrationNickname},
		{"short password", "чатланин", "", "пять!", ErrRegistrationPassword},
		{"long password", "чатланин", "", strings.Repeat("я", 129), ErrRegistrationPassword},
		{"invalid email", "чатланин", "missing-dot@example", "secret123", ErrRegistrationEmail},
		{"nickname precedes password", "!", "invalid", "x", ErrRegistrationNickname},
		{"password precedes email", "чатланин", "invalid", "x", ErrRegistrationPassword},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := registrar.Register(context.Background(), tc.nickname, tc.email, tc.password, "192.0.2.1")
			if !errors.Is(err, tc.want) || !errors.Is(err, ErrInvalidRegistration) {
				t.Fatalf("error = %v, want %v and invalid registration", err, tc.want)
			}
		})
	}
}
