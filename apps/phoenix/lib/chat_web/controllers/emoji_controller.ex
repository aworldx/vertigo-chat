defmodule ChatWeb.EmojiController do
  use ChatWeb, :controller

  alias Chat.Emojis
  alias Chat.Media

  def show(conn, %{"id" => id}) do
    with {id, ""} when id > 0 <- Integer.parse(id),
         emoji <- Emojis.get(id),
         {:ok, conn} <- respond_with_emoji(conn, emoji) do
      conn
    else
      _ -> send_resp(conn, :not_found, "")
    end
  end

  defp respond_with_emoji(
         conn,
         %{image: image, image_key: key} = emoji
       )
       when is_binary(image) or is_binary(key) do
    case Media.resource(emoji, :image) do
      {:redirect, url} ->
        {:ok, redirect(conn, external: url)}

      {:inline, bytes, type} ->
        {:ok,
         conn
         |> put_resp_content_type(type)
         |> put_resp_header("cache-control", "public, max-age=300")
         |> send_resp(:ok, bytes)}

      :not_found ->
        :error
    end
  end

  defp respond_with_emoji(_conn, _emoji), do: :error
end
