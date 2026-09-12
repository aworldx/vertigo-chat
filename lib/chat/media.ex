defmodule Chat.Media do
  @moduledoc "Stores public media in S3, with legacy database reads during migration."

  import Ecto.Changeset

  def enabled?, do: config()[:enabled] == true
  def config, do: Application.get_env(:chat, __MODULE__, [])

  def fields(Chat.Profiles.Profile),
    do: [
      {:photo, :photo_key, :photo_content_type},
      {:thumbnail, :thumbnail_key, :thumbnail_content_type}
    ]

  def fields(Chat.Gallery.Photo),
    do: [
      {:image, :image_key, :content_type},
      {:thumbnail, :thumbnail_key, :thumbnail_content_type}
    ]

  def fields(Chat.MusicChart.Track), do: [{:audio, :audio_key, :content_type}]

  def persist(%{valid?: false} = changeset), do: {:error, changeset}

  def persist(changeset) do
    if enabled?() do
      with {:ok, changeset} <- ensure_thumbnail(changeset) do
        Enum.reduce_while(fields(changeset.data.__struct__), {:ok, changeset}, fn
          {field, key_field, type_field}, {:ok, changeset} ->
            case get_change(changeset, field) do
              bytes when is_binary(bytes) ->
                type = get_field(changeset, type_field)
                key = object_key(changeset.data.__struct__, field, bytes, type)

                case Chat.Media.S3.put(key, bytes, type) do
                  :ok ->
                    {:cont,
                     {:ok, changeset |> put_change(field, nil) |> put_change(key_field, key)}}

                  {:error, _} ->
                    {:halt, {:error, :storage_unavailable}}
                end

              _ ->
                {:cont, {:ok, changeset}}
            end
        end)
      end
    else
      {:ok, changeset}
    end
  end

  def resource(nil, _field), do: :not_found

  def resource(record, field) do
    {^field, key_field, type_field} =
      Enum.find(fields(record.__struct__), &(elem(&1, 0) == field))

    cond do
      is_binary(Map.get(record, key_field)) ->
        {:redirect, public_url(Map.fetch!(record, key_field))}

      is_binary(Map.get(record, field)) ->
        {:inline, Map.fetch!(record, field), Map.fetch!(record, type_field)}

      true ->
        :not_found
    end
  end

  def public_url(key), do: String.trim_trailing(public_base_url(), "/") <> "/" <> encode_key(key)

  def public_base_url do
    config()[:public_base_url] ||
      String.trim_trailing(Keyword.fetch!(config(), :endpoint), "/") <>
        "/" <> Keyword.fetch!(config(), :bucket)
  end

  def encode_key(key),
    do:
      key
      |> String.split("/")
      |> Enum.map_join("/", &URI.encode(&1, fn c -> URI.char_unreserved?(c) end))

  defp ensure_thumbnail(changeset) do
    original =
      case changeset.data.__struct__ do
        Chat.Profiles.Profile -> :photo
        Chat.Gallery.Photo -> :image
        _ -> nil
      end

    if original && is_binary(get_change(changeset, original)) &&
         is_nil(get_change(changeset, :thumbnail)) do
      case Chat.Media.Thumbnail.generate(get_change(changeset, original)) do
        {:ok, bytes} ->
          {:ok, change(changeset, thumbnail: bytes, thumbnail_content_type: "image/webp")}

        {:error, _} ->
          {:error, :invalid_photo}
      end
    else
      {:ok, changeset}
    end
  end

  defp object_key(schema, field, bytes, type) do
    prefix =
      case schema do
        Chat.Profiles.Profile -> "profiles"
        Chat.Gallery.Photo -> "gallery"
        Chat.MusicChart.Track -> "music-chart"
      end

    extension =
      %{
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "audio/mpeg" => "mp3",
        "audio/ogg" => "ogg",
        "audio/wav" => "wav"
      }[type] || "bin"

    digest = :crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower)
    "#{prefix}/#{field}/#{digest}.#{extension}"
  end
end
