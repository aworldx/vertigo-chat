# Назначение файла: LiveView-тесты общей комнаты чата и отправки сообщений через UI.
defmodule ChatWeb.RoomLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Bot.Status, as: BotStatus
  alias Chat.Messages.Registry, as: MessageRegistry
  alias Chat.Visits

  setup do
    :sys.replace_state(MessageRegistry, &Map.delete(&1, "lobby"))
    :ok
  end

  test "renders the entrance screen and current chatlan info", %{conn: conn} do
    {:ok, view, html} = live(conn, ~p"/")

    assert html =~ "Vertigo"
    assert html =~ ~s(data-chat-theme="vertigo")
    assert html =~ "Вход в чат"
    assert html =~ "Ник"
    assert has_element?(view, "#entrance-nickname")
    assert has_element?(view, "#entrance-nickname.text-base")
    refute html =~ ~r/value="guest-[^"]+"/
    assert html =~ "Сейчас в чате"
    refute html =~ "Общая комната"
    assert has_element?(view, "a[href='/profiles'][target='vertigo-profiles']")
    assert has_element?(view, "a[href='/gallery'][target='vertigo-gallery']")
    assert has_element?(view, "a[href='/visits'][target='vertigo-visits']")
    assert has_element?(view, "a[href='/library'][target='vertigo-library']")
    assert has_element?(view, "aside.hidden.md\\:block #online-list")
    assert has_element?(view, "#chat-room.h-dvh.max-h-dvh.min-h-0.overflow-hidden")
  end

  test "does not enter the chat without an explicit valid nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "")

    assert html =~ "Введи ник из 3–24 букв, цифр"
    assert has_element?(view, "#entrance-form")
    refute has_element?(view, "#message-form")
  end

  test "enters the chat with a nickname and renders the initial system message", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    html = enter_chat(view, "tester")

    refute html =~ "Общая комната"
    assert html =~ "Добро пожаловать в чат!"
    assert html =~ "tester"

    assert has_element?(
             view,
             "#messages [data-message-kind='system'].text-center",
             "в чат заходит tester"
           )

    assert has_element?(view, "#messages [data-message-kind='system'] time[datetime]")

    assert has_element?(view, "#messages[phx-hook='ChatMessages']")
    assert has_element?(view, "#messages time[datetime]")
    assert has_element?(view, "#message-form.shrink-0")
    assert has_element?(view, "#emoji-input-controls.flex-wrap.sm\\:flex-nowrap")
    assert has_element?(view, "#message-body.text-base.basis-full.sm\\:basis-auto")
    assert has_element?(view, "#current-chatlan-online", "В сети")
    assert has_element?(view, "#current-chatlan-reconnecting[hidden]", "Связь…")
    assert has_element?(view, "#online-list [class*='text-emerald-300']", "В сети")
    assert has_element?(view, "#online-list [id^='bot-chatlan-'][aria-label='Чат-бот']")

    assert has_element?(
             view,
             "#online-list [id^='anonymous-chatlan-'] .size-5.border-dashed",
             "?"
           )

    refute has_element?(view, "#online-list [id^='profile-link-']")
    assert has_element?(view, "#emoji-input-controls:not([disabled])")
    assert_push_event(view, "focus-message-input", %{})
    assert has_element?(view, "#attach-media[disabled]")
    refute has_element?(view, "#media-file-input")
  end

  test "restores a registered chatlan after a LiveView reconnect", %{conn: conn} do
    assert {:ok, user} =
             Accounts.register_user(%{
               "nickname" => "returning_member",
               "password" => "secret123"
             })

    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "restore_user_session", %{"token" => ChatWeb.UserAuth.sign(user)})

    assert has_element?(view, "#message-form")
    assert has_element?(view, "#online-list", "returning_member")
    assert_push_event(view, "save-user-auth", %{token: _token})
  end

  test "restores a guest chatlan only from an active saved session", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "restore_guest_session", %{
      "nickname" => "returning_guest",
      "theme_id" => "vertigo",
      "appearance" => %{}
    })

    assert has_element?(view, "#message-form")
    assert has_element?(view, "#online-list", "returning_guest")
    assert_push_event(view, "save-chat-preferences", %{"nickname" => "returning_guest"})
  end

  test "answers a public address so that the whole room sees it", %{conn: conn} do
    {:ok, sender, _html} = live(conn, ~p"/")
    {:ok, observer, _html} = live(build_conn(), ~p"/")
    enter_chat(sender, "bot_sender")
    enter_chat(observer, "bot_observer")

    render_hook(sender, "start_public_message", %{"nickname" => "Хичкок"})

    assert has_element?(sender, "#message-body[value='Хичкок, ']")

    sender
    |> form("#message-form", message: %{body: "Хичкок, Как создать саспенс?"})
    |> render_submit()

    render_async(sender)

    assert has_element?(
             sender,
             "#messages [data-private='false'] .chat-message-author",
             "Хичкок"
           )

    assert has_element?(
             sender,
             "#messages [data-private='false'] .chat-message-body",
             "Как создать саспенс?"
           )

    render(observer)
    assert has_element?(observer, "#messages .chat-message-author", "Хичкок")
    assert render(observer) =~ "Как создать саспенс?"
  end

  test "does not answer a private message addressed to Hitchcock", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "private_bot_sender")

    render_hook(view, "send_private_message", %{
      "body" => "^Хичкок, Это никто не увидит?"
    })

    assert render(view) =~ "Хичкок отвечает только на публичные обращения"
    refute has_element?(view, "#messages .chat-message-author", "Хичкок")
  end

  test "shows Hitchcock as busy while the provider limit is active", %{conn: conn} do
    on_exit(&BotStatus.reset/0)
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "busy_status_viewer")

    :ok = BotStatus.mark_busy(5_000)
    render(view)

    assert has_element?(view, "#bot-chatlan-busy[aria-label='Хичкок занят']", "Занят")

    refute has_element?(
             view,
             "#private-message-bot-hitchcock ~ span span.text-emerald-300",
             "В сети"
           )
  end

  test "rejects a nickname that is already online", %{conn: conn} do
    {:ok, first_view, _html} = live(conn, ~p"/")
    {:ok, second_view, _html} = live(build_conn(), ~p"/")

    enter_chat(first_view, "same_nickname")
    html = enter_chat(second_view, "same_nickname")

    assert html =~ "Этот ник уже используется в чате"
    assert has_element?(second_view, "#entrance-form")
    refute has_element?(second_view, "#message-form")
    assert has_element?(first_view, "#message-form")
  end

  test "shows when another chatlan is typing without shifting the layout", %{conn: conn} do
    {:ok, writer, _html} = live(conn, ~p"/")
    {:ok, reader, _html} = live(build_conn(), ~p"/")
    enter_chat(writer, "typing_writer")
    enter_chat(reader, "typing_reader")

    assert has_element?(reader, "#typing-indicator.h-6", "")

    render_hook(writer, "typing", %{"typing" => true})
    render(reader)
    assert has_element?(reader, "#typing-indicator.h-6", "typing_writer печатает…")
    refute render(writer) =~ "typing_writer печатает…"

    render_hook(writer, "typing", %{"typing" => false})
    render(reader)
    refute render(reader) =~ "typing_writer печатает…"
  end

  test "shows image attachment controls only to a registered chatlan", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "image_author", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "image_author", "secret123")

    assert has_element?(view, "#media-share-controls[phx-hook='MediaSharing']")
    assert has_element?(view, "#media-file-input[accept*='audio/mpeg']")
    assert has_element?(view, "#attach-media:not([disabled])")
  end

  test "backend rejects an image announcement from a guest", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "guest_image")

    render_hook(view, "announce_media", %{
      "share_id" => Ecto.UUID.generate(),
      "name" => "photo.png",
      "type" => "image/png",
      "size" => 1_024
    })

    assert has_element?(view, "#media-error", "только зарегистрированные")
    refute has_element?(view, "[data-message-kind='image']")
  end

  test "renders a hidden image placeholder after a registered announcement", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "photo_sender", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "photo_sender", "secret123")
    share_id = Ecto.UUID.generate()

    render_hook(view, "announce_media", %{
      "share_id" => share_id,
      "name" => "hidden-photo.webp",
      "type" => "image/webp",
      "size" => 25_000
    })

    assert has_element?(view, "[data-message-kind='image']")
    assert has_element?(view, "#media-preview-#{share_id}[data-media-kind='image']")
    assert has_element?(view, "#open-media-#{share_id}", "Показать изображение")
    refute has_element?(view, "#media-preview-#{share_id} img")
  end

  test "renders an audio streaming card after a registered announcement", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "music_sender", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "music_sender", "secret123")
    share_id = Ecto.UUID.generate()

    render_hook(view, "announce_media", %{
      "share_id" => share_id,
      "name" => "local-track.mp3",
      "type" => "audio/mpeg",
      "size" => 8_000_000
    })

    assert has_element?(view, "[data-message-kind='audio']")
    assert has_element?(view, "#media-preview-#{share_id}[data-media-kind='audio']")
    assert has_element?(view, "#open-media-#{share_id}", "Слушать")
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

  test "lets a guest register the current nickname without leaving the chat", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "guest_registering")

    assert has_element?(view, "#show-registration", "Регистрация")
    assert view |> element("#show-registration") |> render_click() =~ "registration-modal"

    assert has_element?(
             view,
             "#registration-modal #registration-nickname[readonly][value='guest_registering']"
           )

    view
    |> form("#registration-form",
      registration: %{nickname: "another_nickname", password: "secret123"}
    )
    |> render_submit()

    assert has_element?(view, "#message-form")
    assert_push_event(view, "enable-media-sharing", %{})
    refute has_element?(view, "#registration-modal")
    refute has_element?(view, "#show-registration")
    assert Accounts.registered_nickname?("guest_registering")
    refute Accounts.registered_nickname?("another_nickname")
  end

  test "closes in-chat registration without leaving the chat", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "guest_staying")

    view |> element("#show-registration") |> render_click()
    assert view |> element("#close-registration") |> render_click() =~ "message-form"

    refute has_element?(view, "#registration-modal")
    assert has_element?(view, "#show-registration")
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

    assert has_element?(view, "#message-form")
    assert html =~ "registered"
  end

  test "opens and updates the authenticated user's profile", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "profiled", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "profiled", "secret123")

    html =
      view
      |> element("button[id^='profile-link-'][phx-value-nickname='profiled']")
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

    refute has_element?(view, "[id^='profile-link-'][phx-value-nickname='guest_user']")

    assert has_element?(
             view,
             "#online-list [id^='anonymous-chatlan-'][aria-label='Анонимный чатланин'] .size-5.border-dashed",
             "?"
           )

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

  test "delivers a private message only to sender and recipient", %{
    conn: conn
  } do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")
    {:ok, eve_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice")
    enter_chat(bob_view, "bob")
    enter_chat(eve_view, "eve")
    render(alice_view)

    assert has_element?(
             alice_view,
             "button[id^='private-message-'][phx-hook='PrivateNickname'][data-private-nickname='bob']"
           )

    render_hook(alice_view, "start_private_message", %{"nickname" => "bob"})

    assert has_element?(alice_view, "#message-body[value='^bob, ']")

    alice_view
    |> form("#message-form", message: %{body: "^bob, личное сообщение"})
    |> render_submit()

    render(alice_view)
    render(bob_view)
    render(eve_view)

    assert has_element?(alice_view, "#messages [data-private='true']", "личное сообщение")
    assert has_element?(bob_view, "#messages [data-private='true']", "личное сообщение")
    assert has_element?(bob_view, "#messages [data-private='true'].border-amber-300", "Лично вам")

    assert has_element?(
             bob_view,
             "#messages [data-private='true'] .chat-message-body strong",
             "^bob,"
           )

    assert has_element?(
             alice_view,
             "#messages [data-private='true'][class~='border-sky-400/50']",
             "Лично для bob"
           )

    refute has_element?(eve_view, "#messages [data-private='true']")
    refute render(eve_view) =~ "личное сообщение"
  end

  test "a single nickname click prepares a public addressed message", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice_public")
    enter_chat(bob_view, "bob_public")
    render(alice_view)

    render_hook(alice_view, "start_public_message", %{"nickname" => "bob_public"})

    assert has_element?(alice_view, "#message-body[value='bob_public, ']")
  end

  test "renders the addressed nickname in the recipient's selected color", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice_address")
    enter_chat(bob_view, "bob_address")

    bob_view |> element("#toggle-settings") |> render_click()

    bob_view
    |> form("#preferences-form",
      preferences: %{
        appearance: %{
          dark: %{nickname_color: "#12ab34", text_color: "#e4e4e7"},
          light: %{nickname_color: "#7654ab", text_color: "#1f2937"}
        }
      }
    )
    |> render_submit()

    render(alice_view)

    alice_view
    |> form("#message-form", message: %{body: "привет, bob_address, как дела?"})
    |> render_submit()

    render(bob_view)

    assert has_element?(
             bob_view,
             "#messages .chat-message-body strong.chat-message-recipient[style*='--nick-dark: #12ab34'][style*='--nick-light: #7654ab']",
             "bob_address,"
           )
  end

  test "does not highlight an ordinary word followed by a comma as a nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "comma_writer")

    view
    |> form("#message-form", message: %{body: "слово, которое не никнейм"})
    |> render_submit()

    assert has_element?(
             view,
             "#messages [data-addressed-to-me='false'] .chat-message-body",
             "слово, которое не никнейм"
           )

    refute has_element?(view, "#messages .chat-message-recipient", "слово,")
  end

  test "highlights an addressed nickname at the end of a message without a comma", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice_trailing_address")
    enter_chat(bob_view, "bob_trailing_address")
    render(alice_view)

    alice_view
    |> form("#message-form", message: %{body: "тест bob_trailing_address"})
    |> render_submit()

    assert has_element?(bob_view, "#messages .chat-message-recipient", "bob_trailing_address")
  end

  test "highlights an addressed message for a recipient using the frameless view", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice_compact_address")
    enter_chat(bob_view, "bob_compact_address")

    bob_view |> element("#toggle-settings") |> render_click()

    bob_view
    |> form("#preferences-form",
      preferences: %{appearance: %{message_frame: "false"}}
    )
    |> render_submit()

    alice_view
    |> form("#message-form", message: %{body: "bob_compact_address, привет"})
    |> render_submit()

    render(bob_view)

    assert has_element?(
             bob_view,
             "#messages [data-message-frame='false'][data-addressed-to-me='true'].bg-amber-300\\/20",
             "bob_compact_address, привет"
           )

    refute has_element?(
             alice_view,
             "#messages [data-message-frame='true'][data-addressed-to-me='false'].bg-amber-300\\/20",
             "bob_compact_address, привет"
           )
  end

  test "accepts the Ctrl+Enter private-message event with comma addressing", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "alice_ctrl")
    enter_chat(bob_view, "bob_ctrl")

    render_hook(alice_view, "send_private_message", %{"body" => "bob_ctrl, секрет"})
    render(bob_view)

    assert has_element?(bob_view, "#messages [data-private='true']", "секрет")
  end

  test "loads recent public history for a newcomer without private messages", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/")

    enter_chat(alice_view, "history_alice")
    enter_chat(bob_view, "history_bob")

    alice_view
    |> form("#message-form", message: %{body: "публичная история"})
    |> render_submit()

    alice_view
    |> form("#message-form", message: %{body: "^history_bob, скрытая история"})
    |> render_submit()

    {:ok, newcomer_view, _html} = live(build_conn(), ~p"/")
    html = enter_chat(newcomer_view, "newcomer")

    assert html =~ "публичная история"
    refute html =~ "скрытая история"
    refute has_element?(newcomer_view, "#messages [data-private='true']")
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

  test "keeps a registered user in chat after the first message", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "stable_member", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "stable_member", "secret123")

    view
    |> form("#message-form", message: %{body: "Первое сообщение"})
    |> render_submit()

    assert has_element?(view, "#chat-room")
    assert has_element?(view, "#message-form")
    assert has_element?(view, "#messages .chat-message-author", "stable_member")
    assert has_element?(view, "#messages .chat-message-body", "Первое сообщение")
    refute has_element?(view, "#entrance-form")
  end

  test "toggles an emoji reaction on another chatlan's message", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/")
    enter_chat(alice_view, "reaction_alice")

    {:ok, bob_view, _html} = live(recycle(conn), ~p"/")
    enter_chat(bob_view, "reaction_bob")

    alice_view
    |> form("#message-form", message: %{body: "сообщение с реакцией"})
    |> render_submit()

    assert has_element?(
             alice_view,
             "#messages [data-reaction-counts] [data-reaction-burst-layer][phx-update='ignore']"
           )

    assert has_element?(bob_view, "button[data-reaction-picker-emoji='👍']")

    bob_view
    |> element("button[data-reaction-picker-emoji='👍']")
    |> render_click()

    assert has_element?(
             bob_view,
             "button.chat-reaction-entry[data-reaction-emoji='👍'][data-reaction-count='1'][aria-pressed='true']"
           )

    assert has_element?(
             alice_view,
             "span[data-reaction-emoji='👍'][data-reaction-count='1']"
           )

    bob_view
    |> element("button[data-reaction-picker-emoji='❤️']")
    |> render_click()

    refute has_element?(bob_view, "[data-reaction-emoji='👍']")
    refute has_element?(alice_view, "[data-reaction-emoji='👍']")

    assert has_element?(
             bob_view,
             "button[data-reaction-emoji='❤️'][data-reaction-count='1'][aria-pressed='true']"
           )

    assert has_element?(
             alice_view,
             "span[data-reaction-emoji='❤️'][data-reaction-count='1']"
           )

    bob_view
    |> element("button[data-reaction-emoji='❤️']")
    |> render_click()

    refute has_element?(bob_view, "[data-reaction-emoji='❤️']")
    refute has_element?(alice_view, "[data-reaction-emoji='❤️']")
  end

  test "renders an emoji picker next to the message input", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "emoji_user")

    assert has_element?(
             view,
             "#emoji-input-controls > div.hidden.sm\\:block #toggle-emoji-picker"
           )

    assert has_element?(view, "#emoji-picker button[data-emoji='😀']")
    assert has_element?(view, "#emoji-picker[phx-click-away]")
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

    assert html =~ "Добро пожаловать в чат!"
    refute html =~ ~s(<p class="mt-1 break-words text-sm leading-6 text-zinc-200"></p>)
  end

  test "ignores malformed message events", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    render_hook(view, "send_message", %{})
    render_hook(view, "send_private_message", %{})
    render_hook(view, "toggle_reaction", %{})

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

  test "hides the chatlan list while settings are open", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "settings_focus")

    assert has_element?(view, "#online-list")

    view |> element("#toggle-settings") |> render_click()

    assert has_element?(view, "#preferences-form")
    refute has_element?(view, "#online-list")
  end

  test "renders a frameless public message without badges or reactions", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "compact_user")

    view
    |> form("#message-form", message: %{body: "сообщение меняет оформление"})
    |> render_submit()

    assert has_element?(
             view,
             "#messages [data-message-frame='true'] .chat-message-body",
             "сообщение меняет оформление"
           )

    {:ok, other_view, _html} = live(build_conn(), ~p"/")
    enter_chat(other_view, "framed_viewer")

    assert has_element?(
             other_view,
             "#messages [data-message-frame='true'] .chat-message-body",
             "сообщение меняет оформление"
           )

    view |> element("#toggle-settings") |> render_click()

    view
    |> form("#preferences-form",
      preferences: %{appearance: %{message_frame: "false"}}
    )
    |> render_submit()

    view
    |> form("#message-form", message: %{body: "сообщение строкой"})
    |> render_submit()

    assert has_element?(
             view,
             "#messages [data-message-frame='false'] [data-compact-message]",
             "compact_user: сообщение меняет оформление"
           )

    refute has_element?(
             view,
             "#messages [data-message-frame='false'] [aria-label='Реакции на сообщение']"
           )

    refute has_element?(view, "#messages [data-message-frame='false'] time")

    refute has_element?(
             other_view,
             "#messages [data-message-frame='false'] [data-compact-message]",
             "compact_user: сообщение меняет оформление"
           )

    assert has_element?(
             other_view,
             "#messages [data-message-frame='true'] .chat-message-body",
             "сообщение меняет оформление"
           )

    view |> element("#toggle-settings") |> render_click()

    view
    |> form("#preferences-form",
      preferences: %{appearance: %{message_frame: "true"}}
    )
    |> render_submit()

    assert has_element?(
             view,
             "#messages [data-message-frame='true'] .chat-message-body",
             "сообщение меняет оформление"
           )
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
    assert has_element?(view, "#chat-room[data-chat-theme='vertigo']")
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
    assert has_element?(view, "#theme-id option[value='night_sky'][selected]")
    assert has_element?(view, "#chat-room[data-chat-theme='vertigo'][data-chat-mode='dark']")
  end

  test "discards an unsaved settings draft when the panel closes", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "draft_user")

    view |> element("#toggle-settings") |> render_click()

    view
    |> form("#preferences-form", preferences: %{theme_id: "night_sky"})
    |> render_change()

    assert has_element?(view, "#theme-id option[value='night_sky'][selected]")
    assert has_element?(view, "#chat-room[data-chat-theme='vertigo']")

    view |> element("#toggle-settings") |> render_click()
    view |> element("#toggle-settings") |> render_click()

    assert has_element?(view, "#theme-id option[value='vertigo'][selected]")
    assert has_element?(view, "#chat-room[data-chat-theme='vertigo']")
  end

  test "offers the light newspaper theme in settings", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "newspaper_reader")

    view |> element("#toggle-settings") |> render_click()

    assert has_element?(view, "#theme-id option[value='newspaper']", "Газета · Светлая")
  end

  test "persists registered chatlan settings in the database", %{conn: conn} do
    assert {:ok, user} =
             Accounts.register_user(%{
               "nickname" => "persistent_style",
               "password" => "secret123"
             })

    {:ok, view, _html} = live(conn, ~p"/")
    enter_chat(view, "persistent_style", "secret123")
    view |> element("#toggle-settings") |> render_click()

    view
    |> form("#preferences-form",
      preferences: %{
        theme_id: "night_sky",
        appearance: %{
          message_frame: "false",
          dark: %{nickname_color: "#aa44cc", text_color: "#22aa88"},
          light: %{nickname_color: "#9a3412", text_color: "#1f2937"}
        }
      }
    )
    |> render_submit()

    assert has_element?(view, "#chat-room[data-chat-theme='night_sky']")
    refute has_element?(view, "#preferences-form")

    stored = Accounts.get_user(user.id)
    assert stored.theme_id == "night_sky"
    assert stored.appearance["dark"]["nickname_color"] == "#aa44cc"
    refute stored.appearance["message_frame"]

    view |> element("#leave-chat") |> render_click()

    {:ok, restored_view, _html} = live(recycle(conn), ~p"/")
    enter_chat(restored_view, "persistent_style", "secret123")

    assert has_element?(restored_view, "#chat-room[data-chat-theme='night_sky']")
    assert render(restored_view) =~ "--nick-dark: #aa44cc"

    restored_view |> element("#toggle-settings") |> render_click()
    assert has_element?(restored_view, "#message-frame option[value='false'][selected]")
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

  test "shows subtle system messages when a chatlan joins and leaves", %{conn: conn} do
    {:ok, observer, _html} = live(conn, ~p"/")
    {:ok, participant, _html} = live(build_conn(), ~p"/")
    enter_chat(observer, "observer")
    enter_chat(participant, "participant")

    assert has_element?(
             observer,
             "#messages [data-message-kind='system'].text-center p.text-zinc-500",
             "в чат заходит participant"
           )

    participant |> element("#leave-chat") |> render_click()

    assert has_element?(
             observer,
             "#messages [data-message-kind='system'].text-center p.text-zinc-500",
             "из чата выходит participant"
           )

    refute has_element?(observer, "#messages [data-message-kind='system'] .chat-message-author")
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
