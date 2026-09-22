package application

import "testing"

func TestRecipientMatchesFirstKnownAddressAnywhere(t *testing.T) {
	names := []string{"Аня", "Борис"}
	for _, test := range []struct{ body, want string }{{"Привет, Аня, как дела?", "Аня"}, {"Чужой, Борис, Аня, привет", "Борис"}, {"НеАня, привет", ""}, {"Аня без запятой", ""}} {
		if got := Recipient(test.body, names); got != test.want {
			t.Errorf("%q: %q != %q", test.body, got, test.want)
		}
	}
}
