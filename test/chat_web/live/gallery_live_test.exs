# Назначение файла: LiveView-тесты фотоальбома, авторизации и загрузки снимков.
defmodule ChatWeb.GalleryLiveTest do
  use ChatWeb.ConnCase

  import Ecto.Query

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Gallery
  alias Chat.Gallery.Photo
  alias Chat.Repo
  alias ChatWeb.UserAuth

  test "shows photos as a gallery with their uploader", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "gallery_author", "password" => "secret123"})

    user = promote_to_statist(user)

    {:ok, _photo} = Gallery.upload_photo(user, webp_bytes(), "image/webp")

    {:ok, view, _html} = live(conn, ~p"/gallery")

    assert has_element?(view, "#gallery-photos[phx-update='stream']")
    assert has_element?(view, "[data-photo-author='gallery_author']")
    assert has_element?(view, "[data-photo-author='gallery_author'] [data-gallery-lightbox-open]")
    assert has_element?(view, "[data-photo-author='gallery_author'] img[data-gallery-full-image]")
    assert has_element?(view, "#gallery-lightbox[role='dialog'][phx-update='ignore']")
    assert has_element?(view, "#close-gallery-lightbox[data-gallery-lightbox-close]")

    assert has_element?(
             view,
             "a[href='/'][target='vertigo-chat'][data-return-to-chat]",
             "Вернуться в чат"
           )

    refute has_element?(view, "#gallery-upload-form")
  end

  test "lets an authenticated registered user upload a photo", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "gallery_uploader", "password" => "secret123"})

    user = promote_to_statist(user)

    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => UserAuth.sign(user)})

    assert has_element?(view, "#gallery-upload-form")

    upload =
      file_input(view, "#gallery-upload-form", :gallery_photo, [
        %{name: "photo.webp", content: webp_bytes(), type: "image/webp"}
      ])

    render_upload(upload, "photo.webp")

    view
    |> form("#gallery-upload-form", gallery: %{caption: "Летний вечер"})
    |> render_submit()

    assert has_element?(
             view,
             "[data-photo-author='gallery_uploader'][data-photo-caption='Летний вечер']",
             "Летний вечер"
           )

    assert has_element?(
             view,
             "[data-photo-author='gallery_uploader'] [data-gallery-caption='Летний вечер']"
           )

    assert [photo] = Gallery.list_photos()
    assert photo.caption == "Летний вечер"
    assert has_element?(view, "#gallery-photo-thumbnail[type='hidden']")
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

    user = promote_to_statist(user)

    render_hook(view, "authenticate_gallery", %{"token" => UserAuth.sign(user)})
    view |> element("#gallery-upload-form") |> render_change()
    html = view |> element("#gallery-upload-form") |> render_submit()

    assert html =~ "Не удалось загрузить фотографию"
    assert Gallery.list_photos() == []
  end

  test "explains unsupported formats and oversized gallery photos", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "invalid_gallery_photo", "password" => "secret123"})

    user = promote_to_statist(user)

    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => UserAuth.sign(user)})

    unsupported =
      file_input(view, "#gallery-upload-form", :gallery_photo, [
        %{name: "photo.gif", content: "GIF89a", type: "image/gif"}
      ])

    assert {:error, _errors} = render_upload(unsupported, "photo.gif")

    assert render(view) =~
             "Неподдерживаемый формат. Выберите фотографию в формате JPG, PNG или WebP."

    oversized =
      file_input(view, "#gallery-upload-form", :gallery_photo, [
        %{
          name: "large.webp",
          content: :binary.copy(<<0>>, 2_000_001),
          type: "image/webp"
        }
      ])

    assert {:error, _errors} = render_upload(oversized, "large.webp")

    assert render(view) =~
             "Фотография слишком большая: после сжатия файл должен быть не больше 2 МБ."
  end

  test "rejects non-binary tokens and tokens for missing users" do
    assert {:error, :invalid_token} = UserAuth.verify(nil)

    token = UserAuth.sign(%User{id: -1})
    assert {:error, :invalid_token} = UserAuth.verify(token)
  end

  test "explains the daily upload quota", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "daily_gallery", "password" => "secret123"})

    user = promote_to_statist(user)

    for _index <- 1..Gallery.max_photos_per_day() do
      assert {:ok, _photo} = Gallery.upload_photo(user, webp_bytes(), "image/webp")
    end

    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => UserAuth.sign(user)})
    upload_photo(view)

    assert has_element?(view, "#flash-error", "Дневной лимит")
  end

  test "explains the total upload quota", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "total_gallery", "password" => "secret123"})

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

    {:ok, view, _html} = live(conn, ~p"/gallery")
    render_hook(view, "authenticate_gallery", %{"token" => UserAuth.sign(user)})
    upload_photo(view)

    assert has_element?(
             view,
             "#flash-error",
             "не больше #{Gallery.max_photos_per_user()} фотографий"
           )
  end

  defp upload_photo(view) do
    upload =
      file_input(view, "#gallery-upload-form", :gallery_photo, [
        %{name: "quota.webp", content: webp_bytes(), type: "image/webp"}
      ])

    render_upload(upload, "quota.webp")
    view |> element("#gallery-upload-form") |> render_submit()
  end

  defp webp_bytes, do: <<"RIFF", 0, 0, 0, 0, "WEBP", "test">>

  defp promote_to_statist(user) do
    Repo.update_all(from(user_row in User, where: user_row.id == ^user.id),
      set: [public_message_count: 200, chat_seconds: 72_000]
    )

    Accounts.get_user(user.id)
  end
end
