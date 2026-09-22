defmodule ChatWeb.MusicChartTrackController do
  use ChatWeb, :controller

  def show(conn, %{"id" => id}) do
    result =
      case Integer.parse(id) do
        {id, ""} when id > 0 -> Chat.MusicChart.audio_resource(id)
        _ -> :not_found
      end

    ChatWeb.MediaResponse.send(conn, result)
  end
end
