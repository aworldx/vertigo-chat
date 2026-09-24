package openai

import (
	"chat/api/internal/openaicosts/domain"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Client struct {
	Key, Organization, Endpoint string
	HTTP                        *http.Client
}

func NewClient(key, organization string) Client {
	return Client{Key: key, Organization: organization, Endpoint: "https://api.openai.com/v1/organization/costs", HTTP: &http.Client{Timeout: 20 * time.Second}}
}

type costPage struct {
	Data []struct {
		Start   int64 `json:"start_time"`
		Results []struct {
			Amount struct {
				Value    *float64 `json:"value"`
				Currency string   `json:"currency"`
			} `json:"amount"`
		} `json:"results"`
	} `json:"data"`
	HasMore  bool   `json:"has_more"`
	NextPage string `json:"next_page"`
}

func (c Client) Read(ctx context.Context, start, end time.Time) ([]domain.Bucket, error) {
	if c.Key == "" {
		return nil, errors.New("OpenAI Costs admin key is not configured")
	}
	buckets := []domain.Bucket{}
	cursor := ""
	seen := map[string]bool{}
	for range 100 {
		page, err := c.page(ctx, start, end, cursor)
		if err != nil {
			return nil, err
		}
		values, err := page.buckets()
		if err != nil {
			return nil, err
		}
		buckets = append(buckets, values...)
		if !page.HasMore {
			return buckets, nil
		}
		if page.NextPage == "" || seen[page.NextPage] {
			return nil, errors.New("invalid OpenAI Costs pagination")
		}
		cursor = page.NextPage
		seen[cursor] = true
	}
	return nil, errors.New("OpenAI Costs pagination limit exceeded")
}
func (c Client) page(ctx context.Context, start, end time.Time, cursor string) (costPage, error) {
	var page costPage
	endpoint, err := url.Parse(c.Endpoint)
	if err != nil {
		return page, errors.New("invalid OpenAI Costs endpoint")
	}
	query := url.Values{"start_time": {strconv.FormatInt(start.Unix(), 10)}, "end_time": {strconv.FormatInt(end.Unix(), 10)}, "bucket_width": {"1d"}, "limit": {"31"}}
	if cursor != "" {
		query.Set("page", cursor)
	}
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return page, errors.New("invalid OpenAI Costs request")
	}
	req.Header.Set("Authorization", "Bearer "+c.Key)
	if c.Organization != "" {
		req.Header.Set("OpenAI-Organization", c.Organization)
	}
	response, err := c.HTTP.Do(req)
	if err != nil {
		return page, errors.New("OpenAI Costs transport failed")
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return page, fmt.Errorf("OpenAI Costs HTTP %d", response.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&page); err != nil {
		return page, errors.New("invalid OpenAI Costs response")
	}
	if page.Data == nil {
		return page, errors.New("missing OpenAI Costs data")
	}
	return page, nil
}
func (p costPage) buckets() ([]domain.Bucket, error) {
	buckets := make([]domain.Bucket, 0, len(p.Data))
	for _, item := range p.Data {
		bucket := domain.Bucket{Start: time.Unix(item.Start, 0).UTC()}
		for _, result := range item.Results {
			if result.Amount.Currency != "usd" || result.Amount.Value == nil {
				return nil, errors.New("invalid OpenAI Costs amount or currency")
			}
			bucket.USD += *result.Amount.Value
		}
		buckets = append(buckets, bucket)
	}
	return buckets, nil
}
