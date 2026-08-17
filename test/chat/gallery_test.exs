# Назначение файла: тесты контекста общего фотоальбома.
defmodule Chat.GalleryTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Gallery

  test "stores a photo in its own table with its uploader" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photographer", "password" => "secret123"})

    assert {:ok, photo} = Gallery.upload_photo(user, <<1, 2, 3>>, "image/webp")
    assert photo.user.nickname == "photographer"

    assert [stored] = Gallery.list_photos()
    assert stored.id == photo.id
    assert stored.user.nickname == "photographer"
  end

  test "rejects an unsupported or oversized photo" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photo_rules", "password" => "secret123"})

    assert {:error, :invalid_photo} = Gallery.upload_photo(user, <<1>>, "image/svg+xml")

    assert {:error, :invalid_photo} =
             Gallery.upload_photo(user, :binary.copy(<<0>>, 2_000_001), "image/webp")
  end
end
