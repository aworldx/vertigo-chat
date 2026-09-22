# Назначение файла: защищённая Prometheus-выгрузка агрегатов чата.
defmodule ChatWeb.MetricsController do
  use ChatWeb, :controller

  def show(conn, _params) do
    conn
    |> put_resp_content_type("text/plain", "utf-8")
    |> send_resp(200, ChatWeb.PrometheusFormatter.format(Chat.Metrics.snapshot()))
  end
end
