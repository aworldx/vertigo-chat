package openai

import (
	"bytes"
	"chat/api/internal/karmik/domain"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type Provider struct {
	ObserveHeaders       func(http.Header)
	Key, Model, Endpoint string
	Client               *http.Client
	Observe              func(status int, err error)
}

func NewProvider(key, model string) Provider {
	return Provider{Key: key, Model: model, Endpoint: "https://api.openai.com/v1/responses", Client: &http.Client{Timeout: 120 * time.Second}}
}
func (p Provider) Assess(ctx context.Context, input domain.Input) (assessments []domain.Assessment, usage domain.Usage, requestErr error) {
	if p.Key == "" {
		return nil, domain.Usage{}, domain.ErrInvalid
	}
	data, _ := json.Marshal(input)
	payload, err := json.Marshal(map[string]any{
		"model":             p.Model,
		"instructions":      domain.Instructions,
		"input":             []map[string]string{{"role": "user", "content": string(data)}},
		"max_output_tokens": 1536,
		"reasoning":         map[string]string{"effort": "none"},
		"text": map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "karmik_assessment",
				"strict": true,
				"schema": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"assessments"},
					"properties": map[string]any{
						"assessments": map[string]any{
							"type":     "array",
							"maxItems": 12,
							"items": map[string]any{
								"type":                 "object",
								"additionalProperties": false,
								"required":             []string{"message_id", "verdict", "reason"},
								"properties": map[string]any{
									"message_id": map[string]any{"type": "integer"},
									"verdict":    map[string]any{"type": "string", "enum": []string{"good", "bad", "neutral"}},
									"reason":     map[string]any{"type": "string", "minLength": 1, "maxLength": 300},
								},
							},
						},
					},
				},
			},
			"verbosity": "low",
		},
		"store": false,
	})
	if err != nil {
		return nil, domain.Usage{}, err
	}
	request, err := http.NewRequestWithContext(ctx, "POST", p.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, domain.Usage{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+p.Key)
	status := 0
	defer func() {
		if p.Observe != nil {
			p.Observe(status, requestErr)
		}
	}()
	response, err := p.Client.Do(request)
	if err != nil {
		return nil, domain.Usage{}, err
	}
	status = response.StatusCode
	if p.ObserveHeaders != nil {
		p.ObserveHeaders(response.Header)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != 200 {
		return nil, domain.Usage{}, domain.ErrInvalid
	}
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
	if json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&body) != nil {
		return nil, domain.Usage{}, domain.ErrInvalid
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
	if text == "" || body.Usage.Total <= 0 {
		return nil, domain.Usage{}, domain.ErrInvalid
	}
	var decoded struct {
		Assessments []domain.Assessment `json:"assessments"`
	}
	if err := json.Unmarshal([]byte(text), &decoded); err != nil {
		return nil, domain.Usage{}, err
	}
	return decoded.Assessments, domain.Usage{Input: body.Usage.Input, Output: body.Usage.Output, Total: body.Usage.Total}, nil
}
