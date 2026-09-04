# Назначение файла: временные совместные штрихи поверх рамки сообщений.
defmodule Chat.Drawings do
  @moduledoc """
  Broadcasts short-lived drawing segments to chatlans in the same room.

  Drawings are deliberately ephemeral: they are never written to the message history.
  """

  @max_points 12
  @max_stroke_id_length 64

  def subscribe(room_id) when is_binary(room_id) do
    Phoenix.PubSub.subscribe(Chat.PubSub, topic(room_id))
  end

  def broadcast_segment(room_id, author, attrs) when is_binary(room_id) and is_binary(author) do
    with {:ok, stroke_id} <- normalize_stroke_id(Map.get(attrs, "stroke_id")),
         {:ok, points} <- normalize_points(Map.get(attrs, "points")) do
      segment = %{
        "author" => author,
        "stroke_id" => stroke_id,
        "points" => points,
        "started" => Map.get(attrs, "started") == true
      }

      :ok = Phoenix.PubSub.broadcast(Chat.PubSub, topic(room_id), {:drawing_segment, segment})
      :ok
    end
  end

  def broadcast_segment(_room_id, _author, _attrs), do: {:error, :invalid_segment}

  defp topic(room_id), do: "drawings:" <> room_id

  defp normalize_stroke_id(stroke_id) when is_binary(stroke_id) do
    stroke_id = String.trim(stroke_id)

    if byte_size(stroke_id) in 1..@max_stroke_id_length and
         Regex.match?(~r/^[a-zA-Z0-9_-]+$/, stroke_id) do
      {:ok, stroke_id}
    else
      {:error, :invalid_segment}
    end
  end

  defp normalize_stroke_id(_stroke_id), do: {:error, :invalid_segment}

  defp normalize_points(points) when is_list(points) and length(points) in 2..@max_points do
    points
    |> Enum.reduce_while({:ok, []}, fn point, {:ok, normalized} ->
      case normalize_point(point) do
        {:ok, point} -> {:cont, {:ok, [point | normalized]}}
        {:error, _reason} -> {:halt, {:error, :invalid_segment}}
      end
    end)
    |> then(fn
      {:ok, points} -> {:ok, Enum.reverse(points)}
      error -> error
    end)
  end

  defp normalize_points(_points), do: {:error, :invalid_segment}

  defp normalize_point(%{"x" => x, "y" => y})
       when is_number(x) and is_number(y) and x >= 0 and x <= 1 and y >= 0 and y <= 1 do
    {:ok, %{"x" => Float.round(x * 1.0, 4), "y" => Float.round(y * 1.0, 4)}}
  end

  defp normalize_point(_point), do: {:error, :invalid_segment}
end
