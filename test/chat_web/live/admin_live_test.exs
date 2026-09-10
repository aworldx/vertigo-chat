defmodule ChatWeb.AdminLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Feedback
  alias Chat.Karmik
  alias Chat.Security.Subject
  alias ChatWeb.UserAuth

  test "keeps feedback hidden until an administrator authenticates", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/admin")

    assert has_element?(view, "#admin-login-required")
    assert has_element?(view, "#admin-login-form")
    refute has_element?(view, "#admin-feedback-list")
  end

  test "lets an administrator sign in directly from the admin page", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "direct_admin", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/admin")

    view
    |> form("#admin-login-form", admin_auth: %{nickname: admin.nickname, password: "secret123"})
    |> render_submit()

    assert has_element?(view, "#admin-feedback-section")
  end

  test "renders feedback for an authenticated administrator", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "admin_reader", "password" => "secret123"})

    assert {:ok, _entry} =
             Feedback.submit(
               nil,
               %{"name" => "Гость", "body" => "Добавьте поиск по истории"},
               Subject.internal(:admin_live_feedback)
             )

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(admin)})
      |> live(~p"/admin")

    assert has_element?(view, "#admin-feedback-section")
    assert has_element?(view, "#admin-feedback-list article", "Добавьте поиск по истории")
    assert has_element?(view, "#admin-feedback-count", "1")
  end

  test "renders Karmik's audit trail for an authenticated administrator", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{
               "nickname" => "karmik_audit_admin",
               "password" => "secret123"
             })

    assert {:ok, chatlan} =
             Accounts.register_user(%{"nickname" => "audited_chatlan", "password" => "secret123"})

    assert {:ok, _user} =
             Karmik.review(
               %{id: 801, kind: :text, author: chatlan.nickname, body: "Ты идиот"},
               ChatWeb.AdminLiveTest.BadProvider
             )

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(admin)})
      |> live(~p"/admin")

    assert has_element?(view, "#admin-karmik-audit-table")
    assert has_element?(view, "#admin-karmik-audit-list tr", "audited_chatlan")
    assert has_element?(view, "#admin-karmik-audit-list tr", "Явное оскорбление.")
    assert has_element?(view, "#admin-karmik-audit-list tr", "Ты идиот")
  end

  test "lets an administrator upload a 30 pixel PNG emoji", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "emoji_admin", "password" => "secret123"})

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(admin)})
      |> live(~p"/admin")

    upload =
      file_input(view, "#admin-emoji-form", :emoji_image, [
        %{name: "moon.png", content: png_bytes(16, 16), type: "image/png"}
      ])

    render_upload(upload, "moon.png")

    view
    |> form("#admin-emoji-form", emoji: %{code: "-moon-"})
    |> render_submit()

    assert has_element?(view, "#admin-emojis-list", "-moon-")
  end

  test "denies a registered non-administrator", %{conn: conn} do
    assert {:ok, _admin} =
             Accounts.register_user(%{"nickname" => "primary_admin", "password" => "secret123"})

    assert {:ok, member} =
             Accounts.register_user(%{"nickname" => "regular_member", "password" => "secret123"})

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(member)})
      |> live(~p"/admin")

    assert has_element?(view, "#admin-forbidden", "regular_member")
    refute has_element?(view, "#admin-feedback-list")
  end

  defp png_bytes(width, height) do
    <<0x89, "PNG\r\n", 0x1A, "\n", 0::32, "IHDR", width::32, height::32, 8, 6, 0, 0, 0>>
  end

  defmodule BadProvider do
    def assess(_body) do
      {:ok,
       %{
         verdict: :bad,
         reason: "Явное оскорбление.",
         usage: %{input_tokens: 4, output_tokens: 1, total_tokens: 5}
       }}
    end
  end
end
