package s3

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"chat/api/internal/musicchart/domain"
)

type S3Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	PublicBaseURL   string
	VirtualHosted   bool
}

type Store struct {
	config S3Config
	client *http.Client
}

func New(config S3Config) (*Store, error) {
	if config.Endpoint == "" || config.Region == "" || config.Bucket == "" || config.AccessKeyID == "" || config.SecretAccessKey == "" {
		return nil, domain.ErrUnavailable
	}
	return &Store{config: config, client: &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (s Store) Save(ctx context.Context, input domain.Audio) (domain.Audio, error) {
	key := "music-chart/audio/" + hash(input.Bytes) + "." + map[string]string{"audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav"}[input.ContentType]
	if err := s.putAndVerify(ctx, key, input.Bytes, input.ContentType); err != nil {
		return domain.Audio{}, err
	}
	return domain.Audio{Key: key, ContentType: input.ContentType}, nil
}

func (s Store) putAndVerify(ctx context.Context, key string, body []byte, contentType string) error {
	requestURL, err := s.objectURL(key, false)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("Cache-Control", "public, max-age=31536000, immutable")
	if err := s.sign(request, body); err != nil {
		return err
	}
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	_ = response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return domain.ErrUnavailable
	}
	publicURL, err := s.objectURL(key, true)
	if err != nil {
		return err
	}
	verify, err := http.NewRequestWithContext(ctx, http.MethodGet, publicURL, nil)
	if err != nil {
		return err
	}
	response, err = s.client.Do(verify)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	actual, err := io.ReadAll(io.LimitReader(response.Body, domain.MaxAudioBytes+1))
	if err != nil || response.StatusCode != http.StatusOK || !bytes.Equal(actual, body) {
		return domain.ErrUnavailable
	}
	return nil
}

func (s Store) objectURL(key string, public bool) (string, error) {
	base := s.config.Endpoint
	if public && s.config.PublicBaseURL != "" {
		base = s.config.PublicBaseURL
	}
	uri, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil {
		return "", err
	}
	if !public && s.config.VirtualHosted {
		uri.Host = s.config.Bucket + "." + uri.Host
	} else if !public || s.config.PublicBaseURL == "" {
		uri.Path = path.Join(uri.Path, s.config.Bucket)
	}
	uri.Path = path.Join(uri.Path, key)
	return uri.String(), nil
}

func (s Store) sign(request *http.Request, body []byte) error {
	now := time.Now().UTC()
	payload := hash(body)
	request.Header.Set("X-Amz-Content-Sha256", payload)
	request.Header.Set("X-Amz-Date", now.Format("20060102T150405Z"))
	canonicalHeaders := "cache-control:" + request.Header.Get("Cache-Control") + "\ncontent-type:" + request.Header.Get("Content-Type") + "\nhost:" + request.URL.Host + "\nx-amz-content-sha256:" + payload + "\nx-amz-date:" + request.Header.Get("X-Amz-Date") + "\n"
	signedHeaders := "cache-control;content-type;host;x-amz-content-sha256;x-amz-date"
	canonical := request.Method + "\n" + request.URL.EscapedPath() + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payload
	date := now.Format("20060102")
	scope := date + "/" + s.config.Region + "/s3/aws4_request"
	stringToSign := "AWS4-HMAC-SHA256\n" + request.Header.Get("X-Amz-Date") + "\n" + scope + "\n" + hash([]byte(canonical))
	key := hmacSHA256([]byte("AWS4"+s.config.SecretAccessKey), date)
	key = hmacSHA256(key, s.config.Region)
	key = hmacSHA256(key, "s3")
	key = hmacSHA256(key, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(key, stringToSign))
	request.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", s.config.AccessKeyID, scope, signedHeaders, signature))
	return nil
}

func hash(body []byte) string { digest := sha256.Sum256(body); return hex.EncodeToString(digest[:]) }
func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}
