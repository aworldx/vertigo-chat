defmodule ChatWeb.LandingLiveTest do
  use ChatWeb.ConnCase

  alias Chat.{Accounts, Messages, Repo, Visits}
  alias Chat.Sessions.ChatSession
  alias ChatWeb.UserAuth

  setup do
    :sys.replace_state(Messages.Registry, &Map.delete(&1, "lobby"))
    :ok
  end

  test "describes every public section and registration without entering the chat", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    assert has_element?(view, "#landing-poster[src='/images/vertigo-poster.png']")
    assert has_element?(view, "#entrance-form #entrance-nickname.text-base")
    assert has_element?(view, "#enter-chat[phx-disable-with='Входим…']")
    assert has_element?(view, "#landing-registration", "ни настоящее имя, ни почта, ни телефон")
    assert has_element?(view, "#landing-registration", "С ростом звания")

    for {section, path} <- [
          {"profiles", "/profiles"},
          {"library", "/library"},
          {"gallery", "/gallery"},
          {"visits", "/visits"},
          {"articles", "/articles"},
          {"help", "/help"}
        ] do
      assert has_element?(view, "#landing-section-#{section}[href='#{path}']")
    end

    for path <- ~w(/games /checkers /games/battleship /games/durak /games/balda) do
      assert has_element?(view, "#landing-section-games a[href='#{path}']")
    end

    assert [] = Visits.list_recent_visits()
    assert [] = Repo.all(ChatSession)
    render_hook(view, "chat_session_saved", %{})
    refute_redirected(view)
  end

  test "validates guest and registered credentials on the home page", %{conn: conn} do
    {:ok, _user} =
      Accounts.register_user(%{"nickname" => "landing_member", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")

    enter(view, "x")
    assert has_element?(view, "#entrance-error[role='alert']", "3–24")
    enter(view, "landing_member")
    assert has_element?(view, "#entrance-error", "Введи пароль")
    enter(view, "landing_member", "incorrect")
    assert has_element?(view, "#entrance-error", "Неверный пароль")
    assert has_element?(view, "#entrance-nickname[value='landing_member']")
    assert has_element?(view, "#entrance-password[value='']")
    assert [] = Visits.list_recent_visits()
  end

  test "guest entrance navigates only after saving tokens, and refresh keeps the same visit", %{
    conn: conn
  } do
    {:ok, view, _html} = live(conn, ~p"/")
    enter(view, "landing_guest")
    assert_push_event(view, "prepare-chat-navigation", tokens)
    assert tokens.user_token == nil

    assert {:ok, _identity} =
             UserAuth.verify_guest_identity(tokens.identity_token, tokens.nickname)

    assert {:ok, {session_id, _secret}} =
             UserAuth.verify_chat_resume(tokens.session_token, tokens.nickname)

    assert [visit] = Visits.list_recent_visits()
    refute_redirected(view)

    # A repeated submit must reuse the accepted session and its announcement.
    enter(view, "landing_guest")
    assert_push_event(view, "prepare-chat-navigation", %{session_token: same_token})

    assert {:ok, {^session_id, _secret}} =
             UserAuth.verify_chat_resume(same_token, tokens.nickname)

    assert [%{id: visit_id}] = Visits.list_recent_visits()
    assert visit_id == visit.id

    render_hook(view, "chat_session_saved", %{})
    assert_redirect(view, ~p"/chat")

    params = %{
      "guest_nickname" => tokens.nickname,
      "guest_session_token" => tokens.session_token,
      "guest_identity_token" => tokens.identity_token
    }

    {:ok, room, _html} = build_conn() |> put_connect_params(params) |> live(~p"/chat")
    assert has_element?(room, "#message-form")
    assert has_element?(room, "#online-list", tokens.nickname)
    :ok = GenServer.stop(room.pid, :normal)
    {:ok, refreshed, _html} = build_conn() |> put_connect_params(params) |> live(~p"/chat")
    assert has_element?(refreshed, "#message-form")
    assert [%{id: ^visit_id}] = Visits.list_recent_visits()

    assert Enum.count(
             Messages.list_recent_messages("lobby"),
             &(&1.body == "в чат заходит landing_guest")
           ) == 1

    refreshed |> element("#leave-chat") |> render_click()
    {:ok, exited, _html} = build_conn() |> put_connect_params(params) |> live(~p"/chat")
    refute has_element?(exited, "#message-form")
    assert has_element?(exited, "#chat-login-link[href='/']")
  end

  test "registered entrance restores its account in the room", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "landing_login", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter(view, user.nickname, "secret123")
    assert_push_event(view, "prepare-chat-navigation", tokens)
    assert tokens.identity_token == nil
    assert {:ok, %{id: user_id}} = UserAuth.verify(tokens.user_token)
    assert user_id == user.id
    render_hook(view, "chat_session_saved", %{})
    assert_redirect(view, ~p"/chat")

    {:ok, room, _html} =
      build_conn()
      |> put_connect_params(%{
        "user_auth_token" => tokens.user_token,
        "chat_session_token" => tokens.session_token
      })
      |> live(~p"/chat")

    assert has_element?(room, "#message-form")
    refute has_element?(room, "#show-registration")
  end

  test "registers using only nickname and password and starts the first chat session", %{
    conn: conn
  } do
    {:ok, view, _html} = live(conn, ~p"/")
    view |> element("#landing-register") |> render_click()
    assert has_element?(view, "#registration-form")
    refute has_element?(view, "#entrance-form")
    refute has_element?(view, "input[type='email'], input[type='tel']")

    view
    |> form("#registration-form", registration: %{nickname: "new_landing_user", password: "123"})
    |> render_submit()

    assert has_element?(view, "#registration-error[role='alert']", "6 символов")
    assert [] = Visits.list_recent_visits()

    view
    |> form("#registration-form",
      registration: %{nickname: "new_landing_user", password: "secret123"}
    )
    |> render_submit()

    assert_push_event(view, "prepare-chat-navigation", tokens)
    assert {:ok, %{nickname: "new_landing_user"}} = UserAuth.verify(tokens.user_token)
    assert [_visit] = Visits.list_recent_visits()
    render_hook(view, "register_user", %{"registration" => %{}})
    assert_push_event(view, "prepare-chat-navigation", _same_tokens)
    assert [_visit] = Visits.list_recent_visits()
    render_hook(view, "chat_session_saved", %{})
    assert_redirect(view, ~p"/chat")
  end

  test "releases a nickname if the browser cannot store the accepted session", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter(view, "storage_guest")
    assert_push_event(view, "prepare-chat-navigation", tokens)
    render_hook(view, "chat_storage_failed", %{})
    assert has_element?(view, "#entrance-error", "Разреши хранение данных")
    assert [%{left_at: left_at}] = Visits.list_recent_visits()
    assert left_at

    assert {:ok, {session_id, _}} =
             UserAuth.verify_chat_resume(tokens.session_token, tokens.nickname)

    assert Repo.get!(ChatSession, session_id).status == "ended"
    enter(view, "storage_guest")
    assert_push_event(view, "prepare-chat-navigation", %{nickname: "storage_guest"})
  end

  defp enter(view, nickname, password \\ "") do
    view
    |> form("#entrance-form", entrance: %{nickname: nickname, password: password})
    |> render_submit()
  end
end
