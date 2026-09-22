package openai

import (
	"chat/api/internal/bot/domain"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestResponsesPayloadAndNestedOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Store  bool             `json:"store"`
			Input  []domain.Message `json:"input"`
			Safety string           `json:"safety_identifier"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Store || len(body.Input) != 1 || body.Safety == "guest:one" || len(body.Safety) != 64 {
			t.Errorf("unsafe payload: %+v", body)
		}
		_, _ = w.Write([]byte(`{"output":[{"type":"reasoning"},{"content":[{"type":"output_text","text":"Ответ"}]}],"usage":{"input_tokens":10,"output_tokens":2,"total_tokens":12}}`))
	}))
	defer server.Close()
	provider := NewProvider("test-key", "existing-model")
	provider.Endpoint = server.URL
	result, err := provider.Generate(context.Background(), domain.Context{Identity: "guest:one", Messages: []domain.Message{{Role: "user", Content: "Привет"}}})
	if err != nil || result.Text != "Ответ" || result.Total != 12 {
		t.Fatal(result, err)
	}
}
func TestUnconfiguredBotDoesNotMakeRequest(t *testing.T) {
	p := NewProvider("", "model")
	if _, err := p.Generate(context.Background(), domain.Context{}); err == nil {
		t.Fatal("missing key accepted")
	}
}

func TestRateLimitPreservesRetryAfter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "17")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()
	p := NewProvider("test", "model")
	p.Endpoint = server.URL
	_, err := p.Generate(context.Background(), domain.Context{})
	var limited domain.RateLimited
	if !errors.As(err, &limited) || limited.RetryAfter != 17*time.Second {
		t.Fatal("provider backoff lost", err)
	}
}

func TestEmptyReplyRetriesOnlyCurrentMessage(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body struct {
			Input []domain.Message `json:"input"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if calls == 1 {
			if len(body.Input) != 2 {
				t.Error("initial history missing")
			}
			_, _ = w.Write([]byte(`{"output":[],"usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}`))
			return
		}
		if len(body.Input) != 1 || body.Input[0].Content != "current" {
			t.Error("recovery must use only current message")
		}
		_, _ = w.Write([]byte(`{"output":[{"content":[{"type":"output_text","text":"Ответ"}]}],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`))
	}))
	defer server.Close()
	p := NewProvider("test", "model")
	p.Endpoint = server.URL
	result, err := p.Generate(context.Background(), domain.Context{Messages: []domain.Message{{Role: "assistant", Content: "history"}, {Role: "user", Content: "current"}}})
	if err != nil || result.Text != "Ответ" || calls != 2 {
		t.Fatal(result, err, calls)
	}
}
