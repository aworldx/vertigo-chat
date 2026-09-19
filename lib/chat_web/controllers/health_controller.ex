# Назначение файла: лёгкая техническая проверка готовности приложения без access-лога.
defmodule ChatWeb.HealthController do
  use ChatWeb, :controller

  def show(conn, _params), do: send_resp(conn, :ok, "ok")
end
