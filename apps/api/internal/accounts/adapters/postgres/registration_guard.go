package postgres

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"net/netip"
)

// Match the existing Phoenix guard key: SHA256 of Erlang's external term
// encoding for {:ip, address_tuple}. Keeping this storage representation also
// preserves claims made before cutover; the UTC day remains a separate column.
func registrationFingerprint(address string) (string, error) {
	ip, err := netip.ParseAddr(address)
	if err != nil {
		return "", fmt.Errorf("registration peer: %w", err)
	}
	encoded := []byte{131, 104, 2, 119, 2, 'i', 'p', 104}
	if ip.Is4() {
		encoded = append(encoded, 4)
		for _, octet := range ip.As4() {
			encoded = append(encoded, 97, octet)
		}
	} else {
		encoded = append(encoded, 8)
		bytes := ip.As16()
		for index := 0; index < len(bytes); index += 2 {
			part := binary.BigEndian.Uint16(bytes[index : index+2])
			if part < 256 {
				encoded = append(encoded, 97, byte(part))
			} else {
				encoded = append(encoded, 98, 0, 0, byte(part>>8), byte(part))
			}
		}
	}
	digest := sha256.Sum256(encoded)
	return base64.RawURLEncoding.EncodeToString(digest[:]), nil
}
