package main

import (
	"fmt"
	"net/http"
)

func (s *server) proxyMetrics(w http.ResponseWriter, _ *http.Request) {
	total, working, checkedAt, readOK := s.proxies.snapshot()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = fmt.Fprintf(w, "# HELP chat_youtube_proxies_total Valid proxies in the latest source-file scan.\n# TYPE chat_youtube_proxies_total gauge\nchat_youtube_proxies_total %d\n", total)
	_, _ = fmt.Fprintf(w, "# HELP chat_youtube_proxies_working Proxies that fetched a YouTube media fragment in the latest scan.\n# TYPE chat_youtube_proxies_working gauge\nchat_youtube_proxies_working %d\n", working)
	_, _ = fmt.Fprintf(w, "# HELP chat_youtube_proxy_source_read_success Whether the latest source-file read succeeded.\n# TYPE chat_youtube_proxy_source_read_success gauge\nchat_youtube_proxy_source_read_success %d\n", boolInt(readOK))
	checkedTimestamp := int64(0)
	if !checkedAt.IsZero() {
		checkedTimestamp = checkedAt.Unix()
	}
	_, _ = fmt.Fprintf(w, "# HELP chat_youtube_proxy_checked_timestamp_seconds Unix time of the latest completed scan.\n# TYPE chat_youtube_proxy_checked_timestamp_seconds gauge\nchat_youtube_proxy_checked_timestamp_seconds %d\n", checkedTimestamp)
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
