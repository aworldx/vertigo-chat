# Назначение файла: LiveView-тесты общей комнаты чата и отправки сообщений через UI.
defmodule ChatWeb.RoomLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Visits

  test "renders the entrance screen and current chatlan info", %{conn: conn} do
    {:ok, view, html} = live(conn, ~p"/")

    assert html =~ "Vertigo"
    assert html =~ ~s(data-chat-theme="vertigo")
    assert html =~ "Вход в чат"
    assert html =~ "Ник"
    assert html =~ "Сейчас в чате"
    refute html =~ "Общая комната"
    assert has_element?(view, "a[href='/profiles'][target='_blank']")
    assert has_element?(view, "a[href='/gallery'][target='_blank']")
    assert has_element?(view, "a[href='/visits'][target='_blank']")
    assert has_element?(view, "a[href='/library'][target='_blank']")
    assert has_element?(view, "aside.hidden.md\\:block #online-list")
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

  test "registers a nickname and returns to the entrance screen", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    assert view |> element("#show-registration") |> render_click() =~ "Регистрация"

    html =
      view
      |> form("#registration-form",
        registration: %{nickname: "registered", password: "secret123"}
      )
      |> render_submit()

    assert html =~ "Вход в чат"
    assert html =~ "Регистрация завершена"
    assert Accounts.registered_nickname?("registered")
  end

  test "returns from registration to login and shows validation errors", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    view |> element("#show-registration") |> render_click()
    assert view |> element("#show-login") |> render_click() =~ "Вход в чат"

    view |> element("#show-registration") |> render_click()

    assert view
           |> form("#registration-form", registration: %{nickname: "x", password: "secret123"})
           |> render_submit() =~ "Ник должен быть свободным"

    assert view
           |> form("#registration-form", registration: %{nickname: "valid_user", password: "x"})
           |> render_submit() =~ "Пароль должен быть не короче"
  end

  test "enters the chat with a registered nickname and password", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "registered", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "registered", "secret123")

    assert html =~ "Общая комната"
    assert html =~ "registered"
  end

  test "opens and updates the authenticated user's profile", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "profiled", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "profiled", "secret123")

    html =
      view
      |> element("#profile-link-profiled")
      |> render_click()

    assert html =~ "profile-modal"
    assert has_element?(view, "#profile-form")
    assert has_element?(view, "#save-profile")

    view
    |> form("#profile-form",
      profile: %{
        name: "Мария",
        birth_date: "1995-07-21",
        gender: "female",
        about: "Пишу из теста"
      }
    )
    |> render_submit()

    assert has_element?(view, "#profile-form input[value='Мария']")
  end

  test "does not show profile editing controls to a guest", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "readonly", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "guest_user")

    view |> element("#message-form") |> render_submit(%{message: %{body: "hello"}})
    render_hook(view, "open_profile", %{"nickname" => "readonly"})

    assert has_element?(view, "#profile-form")
    refute has_element?(view, "#save-profile")
  end

  test "opens, validates and closes a guest profile", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "viewer")

    render_hook(view, "open_profile", %{"nickname" => "guest_missing"})
    assert has_element?(view, "#profile-modal")
    refute has_element?(view, "#save-profile")

    render_hook(view, "validate_profile", %{"profile" => %{"name" => String.duplicate("x", 81)}})
    assert has_element?(view, "#profile-form")

    view |> element("#close-profile") |> render_click()
    refute has_element?(view, "#profile-modal")
  end

  test "shows validation errors while saving an authenticated profile", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "invalid_profile", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "invalid_profile", "secret123")
    render_hook(view, "open_profile", %{"nickname" => "invalid_profile"})

    html =
      view
      |> form("#profile-form", profile: %{birth_date: Date.add(Date.utc_today(), 1)})
      |> render_submit()

    assert html =~ "не может быть в будущем"
  end

  test "uploads an authenticated user's profile photo", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "photo_profile", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "photo_profile", "secret123")
    render_hook(view, "open_profile", %{"nickname" => "photo_profile"})

    upload =
      file_input(view, "#profile-form", :profile_photo, [
        %{
          name: "photo.webp",
          content: <<"RIFF", 0, 0, 0, 0, "WEBP", "test">>,
          type: "image/webp"
        }
      ])

    render_upload(upload, "photo.webp")
    view |> form("#profile-form", profile: %{name: "С фото"}) |> render_submit()

    assert has_element?(view, "#profile-form img[src^='data:image/webp;base64,']")
  end

  test "prefills an addressed message after a nickname click and highlights it for recipient", %{
    conn: conn
  } do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice")
    enter_chat(bob_view, "bob")
    render(alice_view)

    alice_view
    |> element("#private-message-bob")
    |> render_click()

    assert has_element?(alice_view, "#message-body[value='bob, ']")

    alice_view
    |> form("#message-form", message: %{body: "bob, личное сообщение"})
    |> render_submit()

    render(bob_view)

    assert has_element?(bob_view, "#messages [data-addressed-to-me='true']")
    refute has_element?(alice_view, "#messages [data-addressed-to-me='true']")
  end

  test "does not allow guest entrance with a registered nickname", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "registered", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "registered")

    assert html =~ "Этот ник зарегистрирован"
    refute html =~ "Общая комната"
  end

  test "does not allow entrance with a wrong password", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "registered", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "registered", "wrong123")

    assert html =~ "Неверный пароль"
    refute html =~ "Общая комната"
  end

  test "reports unknown registered-user credentials", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    assert enter_chat(view, "unknown_user", "secret123") =~ "Такой ник не зарегистрирован"
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

  test "renders an emoji picker next to the message input", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "emoji_user")

    assert has_element?(
             view,
             "#emoji-input-controls > div.hidden.sm\\:block #toggle-emoji-picker"
           )

    assert has_element?(view, "#emoji-picker button[data-emoji='😀']")
    assert has_element?(view, "#emoji-input-controls")
    assert has_element?(view, "#send-message[aria-label='Отправить сообщение'] .sm\\:hidden")
    assert has_element?(view, "#leave-chat[aria-label='Выйти из чата'] .sm\\:hidden")
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

  test "ignores malformed message events", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    render_hook(view, "send_message", %{})

    assert has_element?(view, "#entrance-form")
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

  test "retracks a joined guest after loading another nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "before_name")

    render_hook(view, "load_preferences", %{
      "nickname" => "after_name",
      "theme_id" => "vertigo",
      "appearance" => %{}
    })

    assert render(view) =~ "after_name"
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

  test "records entrance and exit timestamps", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "history_user")

    assert [visit] = Visits.list_recent_visits()
    assert visit.nickname == "history_user"
    assert visit.left_at == nil

    view |> element("#leave-chat") |> render_click()

    assert [finished] = Visits.list_recent_visits()
    assert finished.id == visit.id
    assert finished.left_at
  end

  defp enter_chat(view, nickname, password \\ "") do
    view
    |> form("#entrance-form", entrance: %{nickname: nickname, password: password})
    |> render_submit()
  end
end
