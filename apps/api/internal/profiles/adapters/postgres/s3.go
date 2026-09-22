package postgres

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

	"chat/api/internal/profiles/domain"
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

type s3Media struct {
	config S3Config
	client *http.Client
}

func NewS3Media(config S3Config) (mediaStore, error) {
	if config.Endpoint == "" || config.Region == "" || config.Bucket == "" || config.AccessKeyID == "" || config.SecretAccessKey == "" {
		return nil, errStorageUnavailable
	}
	return s3Media{config: config, client: &http.Client{Timeout: 30 * time.Second}}, nil
}

func (s s3Media) store(ctx context.Context, input domain.PhotoInput, thumbnail []byte) (storedMedia, storedMedia, error) {
	photoKey := objectKey("photo", input.Bytes, input.ContentType)
	thumbnailKey := objectKey("thumbnail", thumbnail, "image/webp")
	if err := s.putAndVerify(ctx, photoKey, input.Bytes, input.ContentType); err != nil {
		return storedMedia{}, storedMedia{}, err
	}
	if err := s.putAndVerify(ctx, thumbnailKey, thumbnail, "image/webp"); err != nil {
		return storedMedia{}, storedMedia{}, err
	}
	return storedMedia{key: &photoKey, contentType: input.ContentType}, storedMedia{key: &thumbnailKey, contentType: "image/webp"}, nil
}

func (s s3Media) load(ctx context.Context, key string) ([]byte, error) {
	publicURL, err := s.objectURL(key, true)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, publicURL, nil)
	if err != nil {
		return nil, err
	}
	response, err := s.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return nil, errStorageUnavailable
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func (s s3Media) putAndVerify(ctx context.Context, key string, body []byte, contentType string) error {
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
		return errStorageUnavailable
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
	actual, err := io.ReadAll(response.Body)
	if err != nil || response.StatusCode != http.StatusOK || !bytes.Equal(actual, body) {
		return errStorageUnavailable
	}
	return nil
}

func (s s3Media) objectURL(key string, public bool) (string, error) {
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
	} else {
		uri.Path = path.Join(uri.Path, s.config.Bucket)
	}
	uri.Path = path.Join(uri.Path, key)
	return uri.String(), nil
}

func (s s3Media) sign(request *http.Request, body []byte) error {
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

func objectKey(field string, body []byte, contentType string) string {
	return "profiles/" + field + "/" + hash(body) + "." + extension(contentType)
}
func extension(contentType string) string {
	return map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[contentType]
}
func hash(body []byte) string { digest := sha256.Sum256(body); return hex.EncodeToString(digest[:]) }
func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}
