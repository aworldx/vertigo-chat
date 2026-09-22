package openai

import (
	"bytes"
	"chat/api/internal/bot/domain"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Provider struct {
	Key, Model, Endpoint string
	Client               *http.Client
}

func NewProvider(key, model string) Provider {
	return Provider{Key: key, Model: model, Endpoint: "https://api.openai.com/v1/responses", Client: &http.Client{Timeout: 120 * time.Second}}
}
func (p Provider) Generate(ctx context.Context, input domain.Context) (domain.Result, error) {
	result, err := p.request(ctx, input)
	if errors.Is(err, domain.ErrEmptyResponse) && !input.Summarize {
		if len(input.Messages) > 0 {
			input.Messages = input.Messages[len(input.Messages)-1:]
		}
		return p.request(ctx, input)
	}
	return result, err
}
func (p Provider) request(ctx context.Context, input domain.Context) (domain.Result, error) {
	if p.Key == "" {
		return domain.Result{}, domain.ErrUnavailable
	}
	hash := sha256.Sum256([]byte(input.Identity))
	instructions := domain.Instructions + "\n" + domain.Mood(input.Date)
	tokens := 240
	if input.Summarize {
		instructions = "Обнови долговременную память о собеседнике на русском языке. Сохраняй только устойчивые факты, предпочтения, важные события и характер общения. Не сохраняй пароли, контакты, адреса и другие чувствительные данные. Верни только краткое резюме не длиннее 700 символов."
		tokens = 220
	}
	if input.Memory != "" {
		instructions += "\nПамять о собеседнике:\n" + input.Memory
	}
	payload, err := json.Marshal(map[string]any{"model": p.Model, "instructions": instructions, "input": input.Messages, "max_output_tokens": tokens, "reasoning": map[string]string{"effort": "none"}, "text": map[string]string{"verbosity": "low"}, "store": false, "safety_identifier": hex.EncodeToString(hash[:])})
	if err != nil {
		return domain.Result{}, err
	}
	request, err := http.NewRequestWithContext(ctx, "POST", p.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return domain.Result{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+p.Key)
	response, err := p.Client.Do(request)
	if err != nil {
		return domain.Result{}, err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode == http.StatusTooManyRequests {
		return domain.Result{}, rateLimit(response.Header.Get("Retry-After"))
	}
	if response.StatusCode != 200 {
		return domain.Result{}, domain.ErrUnavailable
	}
	return decode(response.Body)
}

func decode(reader io.Reader) (domain.Result, error) {
	var body struct {
		Output []struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
		Usage struct {
			Input  int `json:"input_tokens"`
			Output int `json:"output_tokens"`
			Total  int `json:"total_tokens"`
		} `json:"usage"`
	}
	if json.NewDecoder(io.LimitReader(reader, 1<<20)).Decode(&body) != nil {
		return domain.Result{}, domain.ErrUnavailable
	}
	text := ""
	for _, output := range body.Output {
		for _, part := range output.Content {
			if part.Type == "output_text" {
				text += part.Text
			}
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return domain.Result{}, domain.ErrEmptyResponse
	}
	if body.Usage.Input < 0 || body.Usage.Output < 0 || body.Usage.Total < 0 {
		return domain.Result{}, domain.ErrUnavailable
	}
	return domain.Result{Text: text, Input: body.Usage.Input, Output: body.Usage.Output, Total: body.Usage.Total}, nil
}

func rateLimit(header string) error {
	seconds, err := strconv.Atoi(header)
	if err != nil || seconds <= 0 {
		seconds = 60
	}
	return domain.RateLimited{RetryAfter: time.Duration(seconds) * time.Second}
}
