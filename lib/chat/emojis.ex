defmodule Chat.Emojis do
  @moduledoc "User-submitted chat emojis and their moderation workflow."

  import Ecto.Query

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Emojis.Emoji
  alias Chat.Emojis.Tag
  alias Chat.Repo
  alias Chat.Uploads
  alias Chat.Media.S3

  @topic "emojis"
  @max_size 512
  @max_bytes 3_000_000
  @accepted_types ~w(image/png image/webp image/gif)

  def list do
    Repo.all(
      from emoji in Emoji,
        where: emoji.status == :approved,
        order_by: [asc: emoji.code],
        preload: [:emoji_tags]
    )
    |> Enum.map(&put_tag_names/1)
  end

  def list_for_moderation do
    Repo.all(
      from emoji in Emoji,
        order_by: [asc: emoji.status, desc: emoji.inserted_at],
        preload: [:user, :emoji_tags]
    )
  end

  def pending_count do
    Repo.aggregate(from(emoji in Emoji, where: emoji.status == :pending), :count)
  end

  def get(id) when is_integer(id) and id > 0, do: Repo.get(Emoji, id)
  def get(_id), do: nil

  def submit(%User{} = user, code, image, content_type)
      when is_binary(code) and is_binary(image) and is_binary(content_type) do
    with {:ok, {width, height, animated?}} <- validate_image(image, content_type),
         {:ok, emoji} <-
           %Emoji{}
           |> Emoji.submission_changeset(%{
             code: code,
             image: image,
             content_type: content_type,
             width: width,
             height: height,
             animated: animated?,
             user_id: user.id
           })
           |> Repo.insert() do
      {:ok, emoji}
    end
  end

  def submit(_user, _code, _image, _content_type), do: {:error, :invalid_emoji}

  def submit_remote(%User{} = user, code, key, content_type)
      when is_binary(code) and is_binary(key) and is_binary(content_type) do
    with {:ok, image} <- S3.get(key),
         {:ok, {width, height, animated?}} <- validate_image(image, content_type),
         {:ok, emoji} <-
           %Emoji{}
           |> Emoji.submission_changeset(%{
             code: code,
             content_type: content_type,
             width: width,
             height: height,
             animated: animated?,
             user_id: user.id
           })
           |> Ecto.Changeset.put_change(:image_key, key)
           |> Repo.insert() do
      {:ok, emoji}
    end
  end

  def submit_remote(_user, _code, _key, _content_type), do: {:error, :invalid_emoji}

  def moderate(%User{} = moderator, emoji_id, attrs) when is_map(attrs) do
    with true <- Accounts.emoji_moderator?(moderator),
         %Emoji{} = emoji <- get(emoji_id),
         emoji <- Repo.preload(emoji, :emoji_tags),
         tags <- tags_from_ids(Map.get(attrs, "tag_ids", [])),
         {:ok, emoji} <-
           emoji
           |> Emoji.moderation_changeset(attrs)
           |> Ecto.Changeset.put_assoc(:emoji_tags, tags)
           |> Ecto.Changeset.put_change(:tags, Enum.map(tags, & &1.name))
           |> Repo.update() do
      Phoenix.PubSub.broadcast(Chat.PubSub, @topic, {:emoji_updated, emoji})
      {:ok, emoji}
    else
      false -> {:error, :forbidden}
      nil -> {:error, :not_found}
      {:error, changeset} -> {:error, changeset}
    end
  end

  def list_tags, do: Repo.all(from tag in Tag, order_by: [asc: tag.name])

  def search_tags(query) when is_binary(query) do
    query = String.trim(query)

    if query == "" do
      []
    else
      Repo.all(
        from tag in Tag,
          where:
            fragment(
              "? @@ websearch_to_tsquery('russian', ?)",
              tag.search_document,
              ^query
            ),
          order_by:
            fragment(
              "ts_rank(?, websearch_to_tsquery('russian', ?)) DESC",
              tag.search_document,
              ^query
            )
      )
    end
  end

  def create_tag(%User{} = moderator, attrs) when is_map(attrs) do
    if Accounts.emoji_moderator?(moderator),
      do: %Tag{} |> Tag.changeset(attrs) |> Repo.insert(),
      else: {:error, :forbidden}
  end

  def create_tag(_moderator, _attrs), do: {:error, :forbidden}

  def update_tag(%User{} = moderator, tag_id, attrs) when is_integer(tag_id) and is_map(attrs) do
    with true <- Accounts.emoji_moderator?(moderator), %Tag{} = tag <- Repo.get(Tag, tag_id) do
      tag |> Tag.changeset(attrs) |> Repo.update()
    else
      false -> {:error, :forbidden}
      nil -> {:error, :not_found}
    end
  end

  def update_tag(_moderator, _tag_id, _attrs), do: {:error, :forbidden}

  def delete_tag(%User{} = moderator, tag_id) when is_integer(tag_id) do
    with true <- Accounts.emoji_moderator?(moderator), %Tag{} = tag <- Repo.get(Tag, tag_id) do
      Repo.delete(tag)
    else
      false -> {:error, :forbidden}
      nil -> {:error, :not_found}
    end
  end

  def delete_tag(_moderator, _tag_id), do: {:error, :forbidden}

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)
  def max_size, do: @max_size
  def max_bytes, do: @max_bytes
  def accepted_types, do: @accepted_types

  defp validate_image(image, content_type)
       when content_type in @accepted_types and byte_size(image) <= @max_bytes do
    with true <- Uploads.valid_image?(image, content_type),
         {:ok, {width, height}} <- Uploads.image_dimensions(image, content_type),
         true <- width > 0 and height > 0 and width <= @max_size and height <= @max_size do
      {:ok, {width, height, Uploads.animated?(image, content_type)}}
    else
      false -> {:error, :invalid_emoji}
      :error -> {:error, :invalid_emoji}
    end
  end

  defp validate_image(_image, _content_type), do: {:error, :invalid_emoji}

  defp tags_from_ids(ids) when is_list(ids) do
    ids = ids |> Enum.map(&to_string/1) |> Enum.filter(&String.match?(&1, ~r/^\d+$/))
    Repo.all(from tag in Tag, where: tag.id in ^ids)
  end

  defp tags_from_ids(_ids), do: []

  defp put_tag_names(emoji) do
    tags = Enum.map(emoji.emoji_tags, & &1.name)
    suggestion_terms = Enum.flat_map(emoji.emoji_tags, &[&1.name | &1.triggers]) |> Enum.uniq()

    %{emoji | tags: tags, suggestion_terms: suggestion_terms}
  end
end
