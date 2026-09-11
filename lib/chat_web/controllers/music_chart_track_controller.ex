# Назначение файла: раздача аудиофайлов хит-парада отдельными HTTP-ответами.
defmodule ChatWeb.MusicChartTrackController do
  use ChatWeb, :controller

  alias Chat.MusicChart

  def show(conn, %{"id" => id}) do
    with {:ok, id} <- parse_id(id),
         %{audio: audio, content_type: content_type} <- MusicChart.get_track(id),
         true <- is_binary(audio) and is_binary(content_type) do
      conn
      |> put_resp_content_type(content_type)
      |> put_resp_header("cache-control", "public, max-age=300")
      |> send_resp(:ok, audio)
    else
      _ -> send_resp(conn, :not_found, "")
    end
  end

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {number, ""} when number > 0 -> {:ok, number}
      _ -> :error
    end
  end

  defp parse_id(_id), do: :error
end
