defmodule ChatWeb.AdminControllerTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Emojis.{Emoji, Tag}
  alias Chat.Repo

  test "shows a regular login form and lets an admin sign in", %{conn: conn} do
    response = get(conn, "/admin") |> response(:ok)
    assert response =~ "admin-login-form"
    assert response =~ "name=\"_csrf_token\""
    assert response =~ "/assets/css/app.css"
    refute response =~ "/assets/js/app.js"

    {:ok, admin} =
      Accounts.register_user(%{"nickname" => "admin_http", "password" => "secret123"})

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => admin.nickname, "password" => "secret123"}
      })

    assert redirected_to(conn) == "/admin"
    response = get(recycle(conn), "/admin") |> response(:ok)
    assert response =~ "admin-database-table"
    assert response =~ "feedback_entries"
    assert response =~ "karmik_assessments"

    response = get(recycle(conn), "/admin?table=feedback_entries") |> response(:ok)
    assert response =~ "feedback_entries"
    refute response =~ "admin-login-form"
  end

  test "lets an emoji moderator sign in to moderation", %{conn: conn} do
    {:ok, _admin} =
      Accounts.register_user(%{"nickname" => "admin_owner", "password" => "secret123"})

    {:ok, moderator} =
      Accounts.register_user(%{"nickname" => "emoji_mod", "password" => "secret123"})

    {:ok, _moderator} =
      moderator
      |> Ecto.Changeset.change(can_moderate_emojis: true)
      |> Repo.update()

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => "emoji_mod", "password" => "secret123"}
      })

    assert redirected_to(conn) == "/admin"

    response = get(recycle(conn), "/admin") |> response(:ok)
    assert response =~ "admin-emojis-list"
    assert response =~ ">Теги</a>"
    refute response =~ "admin-database-table"
  end

  test "edits an emoji code, removes tags and deletes an emoji", %{conn: conn} do
    {:ok, moderator} =
      Accounts.register_user(%{"nickname" => "emoji_deleter", "password" => "secret123"})

    {:ok, moderator} =
      moderator
      |> Ecto.Changeset.change(can_moderate_emojis: true)
      |> Repo.update()

    emoji =
      Repo.insert!(%Emoji{
        code: ":delete_me:",
        image: <<1>>,
        content_type: "image/gif",
        status: :pending,
        width: 1,
        height: 1,
        animated: false,
        user_id: moderator.id
      })

    tag = Repo.insert!(%Tag{name: "удалить"})
    Repo.insert_all("emoji_tag_assignments", [%{emoji_id: emoji.id, emoji_tag_id: tag.id}])

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => moderator.nickname, "password" => "secret123"}
      })

    conn =
      post(recycle(conn), "/admin/emojis/#{emoji.id}", %{
        "emoji" => %{"code" => "переименован", "status" => "pending"}
      })

    assert redirected_to(conn) == "/admin?section=emojis"
    updated_emoji = Repo.preload(Repo.get!(Emoji, emoji.id), :emoji_tags)
    assert updated_emoji.code == ":переименован:"
    assert updated_emoji.emoji_tags == []

    conn = delete(recycle(conn), "/admin/emojis/#{emoji.id}")
    assert redirected_to(conn) == "/admin?section=emojis"
    assert Repo.get(Emoji, emoji.id) == nil
  end
end
