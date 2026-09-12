defmodule ChatWeb.MediaResponse do
  @moduledoc false
  import Plug.Conn

  def send(conn, {:redirect, url}) do
    conn
    |> put_resp_header("cache-control", "public, max-age=300")
    |> Phoenix.Controller.redirect(external: url)
  end

  def send(conn, {:inline, bytes, content_type}) do
    conn
    |> put_resp_content_type(content_type)
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(:ok, bytes)
  end

  def send(conn, :not_found), do: send_resp(conn, :not_found, "")
end
