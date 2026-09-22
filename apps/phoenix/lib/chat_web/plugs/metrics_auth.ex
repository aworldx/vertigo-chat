# Назначение файла: не допускает публичного чтения диагностических метрик.
defmodule ChatWeb.MetricsAuth do
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    expected = Application.fetch_env!(:chat, :metrics_token)

    case get_req_header(conn, "authorization") do
      ["Bearer " <> provided] when byte_size(provided) == byte_size(expected) ->
        if Plug.Crypto.secure_compare(provided, expected), do: conn, else: reject(conn)

      _ ->
        reject(conn)
    end
  end

  defp reject(conn), do: conn |> send_resp(401, "unauthorized") |> halt()
end
