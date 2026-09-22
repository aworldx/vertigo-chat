defmodule ChatWeb.GalleryPhotoControllerTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Gallery.Photo
  alias Chat.Repo

  test "serves the full gallery image and thumbnail separately", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "gallery_photo_owner", "password" => "secret123"})

    image = <<"RIFF", 0, 0, 0, 0, "WEBP", "full">>
    thumbnail = <<"RIFF", 0, 0, 0, 0, "WEBP", "thumbnail">>

    photo =
      Repo.insert!(%Photo{
        user_id: user.id,
        image: image,
        content_type: "image/webp",
        thumbnail: thumbnail,
        thumbnail_content_type: "image/webp"
      })

    full = get(conn, ~p"/gallery/photos/#{photo.id}")
    assert response(full, :ok) == image
    assert ["image/webp" <> _charset] = get_resp_header(full, "content-type")

    preview = get(build_conn(), ~p"/gallery/photos/#{photo.id}/thumbnail")
    assert response(preview, :ok) == thumbnail
  end

  test "does not expose a missing gallery thumbnail", %{conn: conn} do
    assert get(conn, ~p"/gallery/photos/999999/thumbnail") |> response(:not_found) == ""
  end
end
