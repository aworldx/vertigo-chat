# Назначение файла: LiveView-тесты общей комнаты чата и отправки сообщений через UI.
defmodule ChatWeb.RoomLiveTest do
  use ChatWeb.ConnCase

  test "renders the entrance screen and current chatlan info", %{conn: conn} do
    {:ok, _view, html} = live(conn, ~p"/")

    assert html =~ "August Chat"
    assert html =~ "Вход в чат"
    assert html =~ "Ник"
    assert html =~ "Сейчас в чате"
    refute html =~ "Общая комната"
  end

  test "enters the chat with a nickname and renders the initial system message", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "tester")

    assert html =~ "Общая комната"
    assert html =~ "Добро пожаловать в первый Phoenix-чат"
    assert html =~ "ты вошел как"
    assert html =~ "tester"
    assert has_element?(view, "#messages[phx-hook='ChatMessages']")
  end

  test "sends a public message from the form", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "tester")

    view
    |> form("#message-form", message: %{body: "  привет из теста  "})
    |> render_submit()

    html = render(view)

    assert html =~ "привет из теста"
    refute html =~ "  привет из теста  "
  end

  test "does not render an empty public message", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "tester")

    html =
      view
      |> form("#message-form", message: %{body: "   "})
      |> render_submit()

    assert html =~ "Добро пожаловать в первый Phoenix-чат"
    refute html =~ ~s(<p class="mt-1 break-words text-sm leading-6 text-zinc-200"></p>)
  end

  test "saves nickname and text colors from the chatlan settings panel", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "tester")

    assert view |> element("#toggle-settings") |> render_click() =~ "Цвета для режима"

    view
    |> form("#preferences-form",
      preferences: %{
        appearance: %{
          dark: %{nickname_color: "#00ff88", text_color: "#3366aa"},
          light: %{nickname_color: "#9a3412", text_color: "#1f2937"}
        }
      }
    )
    |> render_submit()

    html = render(view)

    assert html =~ "--nick-dark: #00ff88"
    refute html =~ "Цвета для режима"

    view
    |> form("#message-form", message: %{body: "цветное сообщение"})
    |> render_submit()

    html = render(view)

    assert html =~ "цветное сообщение"
    assert html =~ "--nick-dark: #00ff88"
    assert html =~ "--text-dark: #3366aa"
  end

  test "previews nickname and text colors before saving", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "tester")

    view |> element("#toggle-settings") |> render_click()

    html =
      view
      |> form("#preferences-form",
        preferences: %{
          appearance: %{
            dark: %{nickname_color: "#cc2255", text_color: "#33aa77"},
            light: %{nickname_color: "#9a3412", text_color: "#1f2937"}
          }
        }
      )
      |> render_change()

    assert html =~ "пример текста"
    assert html =~ "--nick-dark: #cc2255"
    assert html =~ "--text-dark: #33aa77"
    assert html =~ "Цвета для режима"
  end

  test "switches to the night sky theme as a dark mode theme", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "tester")

    view |> element("#toggle-settings") |> render_click()

    html =
      view
      |> form("#preferences-form",
        preferences: %{
          theme_id: "night_sky",
          appearance: %{
            dark: %{nickname_color: "#fcd34d", text_color: "#e4e4e7"},
            light: %{nickname_color: "#9a3412", text_color: "#1f2937"}
          }
        }
      )
      |> render_change()

    assert html =~ "Ночное небо"
    assert html =~ ~s(data-chat-theme="night_sky")
    assert html =~ ~s(data-chat-mode="dark")
  end

  test "loads saved guest preferences in the context of the saved nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "load_preferences", %{
      "nickname" => "guest-saved",
      "theme_id" => "dark",
      "appearance" => %{
        "dark" => %{"nickname_color" => "#aa44cc", "text_color" => "#22aa88"},
        "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
      }
    })

    enter_chat(view, "guest-saved")

    html = render(view)

    assert html =~ "guest-saved"
    assert html =~ "--nick-dark: #aa44cc"

    view
    |> form("#message-form", message: %{body: "сообщение сохраненного ника"})
    |> render_submit()

    html = render(view)

    assert html =~ "сообщение сохраненного ника"
    assert html =~ "guest-saved"
    assert html =~ "--text-dark: #22aa88"
  end

  test "does not apply saved colors when entering with another nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "load_preferences", %{
      "nickname" => "guest-saved",
      "theme_id" => "dark",
      "appearance" => %{
        "dark" => %{"nickname_color" => "#aa44cc", "text_color" => "#22aa88"},
        "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
      }
    })

    enter_chat(view, "another")

    html = render(view)

    assert html =~ "another"
    assert html =~ "--nick-dark: #fcd34d"
    refute html =~ "--nick-dark: #aa44cc"
  end

  test "leaves the chat and returns to the entrance form", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    enter_chat(view, "tester")

    html = view |> element("#leave-chat") |> render_click()

    assert html =~ "Вход в чат"
    assert html =~ "Ник"
    refute html =~ "Общая комната"
    refute html =~ "Напиши сообщение"
    refute html =~ "Настройки"
  end

  defp enter_chat(view, nickname) do
    view
    |> form("#entrance-form", entrance: %{nickname: nickname})
    |> render_submit()
  end
end
