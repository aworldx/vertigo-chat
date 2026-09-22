# Назначение файла: преобразует безопасные агрегаты Chat.Metrics в Prometheus text format.
defmodule ChatWeb.PrometheusFormatter do
  @moduledoc false

  def format(snapshot) do
    [
      "# HELP chat_http_requests_total HTTP requests completed by route and status.\n",
      "# TYPE chat_http_requests_total counter\n",
      http_metrics(snapshot.requests),
      "# HELP chat_public_messages_total Public messages created by kind.\n",
      "# TYPE chat_public_messages_total counter\n",
      counter_metrics(snapshot.counters),
      "# HELP chat_sessions Current chat sessions by status.\n",
      "# TYPE chat_sessions gauge\n",
      session_metrics(snapshot.sessions),
      "# HELP chat_beam_memory_bytes Total memory allocated by the BEAM.\n",
      "# TYPE chat_beam_memory_bytes gauge\nchat_beam_memory_bytes #{snapshot.vm.memory_bytes}\n",
      "# HELP chat_beam_run_queue Runnable processes in the BEAM.\n",
      "# TYPE chat_beam_run_queue gauge\nchat_beam_run_queue #{snapshot.vm.run_queue}\n"
    ]
    |> IO.iodata_to_binary()
  end

  defp http_metrics(requests) do
    Enum.map(requests, fn {{route, status}, data} ->
      labels = labels(%{route: route, status: status})

      [
        "chat_http_requests_total",
        labels,
        " ",
        Integer.to_string(data.count),
        "\n",
        "chat_http_requests_4xx_total",
        labels,
        " ",
        Integer.to_string(data.errors_4xx),
        "\n",
        "chat_http_requests_5xx_total",
        labels,
        " ",
        Integer.to_string(data.errors_5xx),
        "\n",
        "chat_http_request_duration_milliseconds_sum",
        labels,
        " ",
        Integer.to_string(data.duration_sum_ms),
        "\n",
        "chat_http_request_duration_milliseconds_count",
        labels,
        " ",
        Integer.to_string(data.count),
        "\n",
        histogram(data, labels)
      ]
    end)
  end

  defp histogram(data, base_labels) do
    buckets = Chat.Metrics.latency_buckets()

    Enum.map(buckets, fn bucket ->
      labels = String.replace_trailing(base_labels, "}", ",le=\"#{bucket}\"}")

      [
        "chat_http_request_duration_milliseconds_bucket",
        labels,
        " ",
        Integer.to_string(Map.get(data.buckets, bucket, 0)),
        "\n"
      ]
    end) ++
      [
        "chat_http_request_duration_milliseconds_bucket",
        String.replace_trailing(base_labels, "}", ",le=\"+Inf\"}"),
        " ",
        Integer.to_string(data.count),
        "\n"
      ]
  end

  defp counter_metrics(counters) do
    Enum.map(counters, fn {{metric, metric_labels}, value} ->
      name =
        case metric do
          :public_messages -> "chat_public_messages_total"
          :sessions_entered -> "chat_sessions_entered_total"
          :sessions_reconnected -> "chat_sessions_reconnected_total"
          :sessions_reconnecting -> "chat_sessions_reconnecting_total"
        end

      [name, labels(metric_labels), " ", Integer.to_string(value), "\n"]
    end)
  end

  defp session_metrics(sessions) do
    Enum.map(sessions, fn {status, count} ->
      ["chat_sessions", labels(%{status: status}), " ", Integer.to_string(count), "\n"]
    end)
  end

  defp labels(labels) do
    serialized = Enum.map_join(labels, ",", fn {key, value} -> "#{key}=\"#{escape(value)}\"" end)
    "{" <> serialized <> "}"
  end

  defp escape(value),
    do: value |> to_string() |> String.replace("\\", "\\\\") |> String.replace("\"", "\\\"")
end
