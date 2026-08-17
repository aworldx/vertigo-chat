# Назначение файла: LiveView-тесты фотоальбома, авторизации и загрузки снимков.
defmodule ChatWeb.GalleryLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Gallery
  alias ChatWeb.GalleryAuth

  test "shows photos as a gallery with their uploader", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "gallery_author", "password" => "secret123"})

    {:ok, _photo} = Gallery.upload_photo(user, <<1, 2, 3>>, "image/webp")

    {:ok, view, _html} = live(conn, ~p"/gallery")

    assert has_element?(view, "#gallery-photos[phx-update='stream']")
    assert has_element?(view, "[data-photo-author='gallery_author']")
    assert has_element?(view, "[data-photo-author='gallery_author'] [data-gallery-lightbox-open]")
    assert has_element?(view, "#gallery-lightbox[role='dialog'][phx-update='ignore']")
    assert has_element?(view, "#close-gallery-lightbox[data-gallery-lightbox-close]")
    refute has_element?(view, "#gallery-upload-form")
  end

  test "lets an authenticated registered user upload a photo", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "gallery_uploader", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => GalleryAuth.sign(user)})

    assert has_element?(view, "#gallery-upload-form")

    upload =
      file_input(view, "#gallery-upload-form", :gallery_photo, [
        %{name: "photo.webp", content: <<1, 2, 3, 4>>, type: "image/webp"}
      ])

    render_upload(upload, "photo.webp")
    view |> element("#gallery-upload-form") |> render_submit()

    assert has_element?(view, "[data-photo-author='gallery_uploader']")
    assert [_photo] = Gallery.list_photos()
  end

  test "rejects an invalid gallery authentication token", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => "invalid"})

    assert has_element?(view, "#gallery-login-hint")
    refute has_element?(view, "#gallery-upload-form")
  end

  test "handles missing authentication and an upload without a ready photo", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/gallery")

    render_hook(view, "authenticate_gallery", %{})
    assert has_element?(view, "#gallery-login-hint")

    {:ok, user} =
      Accounts.register_user(%{"nickname" => "empty_upload", "password" => "secret123"})

    render_hook(view, "authenticate_gallery", %{"token" => GalleryAuth.sign(user)})
    view |> element("#gallery-upload-form") |> render_change()
    html = view |> element("#gallery-upload-form") |> render_submit()

    assert html =~ "Не удалось загрузить фотографию"
    assert Gallery.list_photos() == []
  end

  test "rejects non-binary tokens and tokens for missing users" do
    assert {:error, :invalid_token} = GalleryAuth.verify(nil)

    token = GalleryAuth.sign(%User{id: -1})
    assert {:error, :invalid_token} = GalleryAuth.verify(token)
  end
end
