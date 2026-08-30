# Назначение файла: тесты контекста общего фотоальбома.
defmodule Chat.GalleryTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Gallery
  alias Chat.Gallery.Photo
  alias Chat.Repo

  test "stores a photo in its own table with its uploader" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photographer", "password" => "secret123"})

    user = promote_to_statist(user)

    assert {:ok, photo} = Gallery.upload_photo(user, webp_bytes(), "image/webp")
    assert photo.user.nickname == "photographer"

    assert [stored] = Gallery.list_photos()
    assert stored.id == photo.id
    assert stored.user.nickname == "photographer"
  end

  test "stores a trimmed optional photo caption and validates its length" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "caption_writer", "password" => "secret123"})

    user = promote_to_statist(user)

    assert {:ok, photo} =
             Gallery.upload_photo(user, webp_bytes(), "image/webp", "  Вечерний город  ")

    assert photo.caption == "Вечерний город"

    assert {:error, :invalid_caption} =
             Gallery.upload_photo(
               user,
               webp_bytes(),
               "image/webp",
               String.duplicate("я", Gallery.max_caption_length() + 1)
             )
  end

  test "rejects an unsupported or oversized photo" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photo_rules", "password" => "secret123"})

    user = promote_to_statist(user)

    assert {:error, :invalid_photo} = Gallery.upload_photo(user, <<1>>, "image/svg+xml")

    assert {:error, :invalid_photo} =
             Gallery.upload_photo(user, :binary.copy(<<0>>, 2_000_001), "image/webp")

    assert {:error, :invalid_photo} =
             Gallery.upload_photo(user, "not really an image", "image/webp")
  end

  test "enforces the daily photo quota in the context" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photo_quota", "password" => "secret123"})

    user = promote_to_statist(user)

    for _index <- 1..Gallery.max_photos_per_day() do
      assert {:ok, _photo} = Gallery.upload_photo(user, webp_bytes(), "image/webp")
    end

    assert {:error, :daily_photo_limit_reached} =
             Gallery.upload_photo(user, webp_bytes(), "image/webp")
  end

  test "enforces the total photo quota in the context" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "total_photo_quota", "password" => "secret123"})

    user = promote_to_statist(user)

    inserted_at = DateTime.utc_now() |> DateTime.add(-172_800) |> DateTime.truncate(:second)

    rows =
      for _index <- 1..Gallery.max_photos_per_user() do
        %{
          user_id: user.id,
          image: webp_bytes(),
          content_type: "image/webp",
          inserted_at: inserted_at,
          updated_at: inserted_at
        }
      end

    Repo.insert_all(Photo, rows)

    assert {:error, :photo_limit_reached} =
             Gallery.upload_photo(user, webp_bytes(), "image/webp")
  end

  defp webp_bytes, do: <<"RIFF", 0, 0, 0, 0, "WEBP", "test">>

  defp promote_to_statist(user) do
    Repo.update_all(from(user_row in User, where: user_row.id == ^user.id),
      set: [public_message_count: 200, chat_seconds: 72_000]
    )

    Accounts.get_user(user.id)
  end
end
