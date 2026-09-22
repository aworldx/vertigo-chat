package postgres

import "testing"

func TestPBKDF2VerifierMatchesLegacyPhoenixFormat(t *testing.T) {
	// PBKDF2-HMAC-SHA256("secret123", "salt", 2), URL-safe base64 without padding.
	hash := "pbkdf2_sha256$2$c2FsdA$H2F1bw5i7upfSYTSkchLt-oxI5D0lR9WTT6YvjGNNRA"
	verifier := PBKDF2Verifier{}
	if !verifier.Verify("secret123", hash) {
		t.Fatal("expected valid legacy password")
	}
	if verifier.Verify("wrong", hash) || verifier.Verify("secret123", "invalid") {
		t.Fatal("accepted invalid credential")
	}
}
