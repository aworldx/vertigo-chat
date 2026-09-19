# Назначение файла: LiveView-тесты общей комнаты чата и отправки сообщений через UI.
defmodule ChatWeb.RoomLiveTest do
  use ChatWeb.ConnCase

  import ExUnit.CaptureLog
  import Ecto.Query

  alias Chat.Accounts
  alias Chat.Bot.Status, as: BotStatus
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Messages.Registry, as: MessageRegistry
  alias Chat.Repo
  alias Chat.Sessions.ChatSession
  alias Chat.Visits
  alias Chat.Visits.Visit

  setup do
    :sys.replace_state(MessageRegistry, &Map.delete(&1, "lobby"))

    :ok
  end

  test "renders the entrance screen and current chatlan info", %{conn: conn} do
    {:ok, view, html} = live(conn, ~p"/chat")

    assert html =~ "Vertigo"
    assert html =~ ~s(data-chat-theme="vertigo")
    assert html =~ "Вход в чат"
    assert has_element?(view, "#chat-login-link[href='/']", "Войти на главной")
    assert has_element?(view, "#chat-room[data-chat-joined='false']")
    refute has_element?(view, "#entrance-form")
    assert has_element?(view, "#chat-logo", "Vertigo")
    refute has_element?(view, "#chat-logo[href]")
    refute html =~ ~r/value="guest-[^"]+"/
    assert html =~ "Сейчас в чате"
    refute html =~ "Общая комната"
    assert has_element?(view, "a[href='/profiles'][target='vertigo-profiles']")
    assert has_element?(view, "a[href='/gallery'][target='vertigo-gallery']")
    assert has_element?(view, "a[href='/visits'][target='vertigo-visits']")
    assert has_element?(view, "#about-main-menu summary", "О чате")
    assert has_element?(view, "#about-main-menu a[href='/help'][target='vertigo-help']", "Помощь")

    assert has_element?(
             view,
             "#about-main-menu a[href='/articles'][target='vertigo-articles']",
             "Статьи"
           )

    assert has_element?(view, "a[href='/library'][target='vertigo-library']")
    assert has_element?(view, "#games-main-menu a[href='/games'][target='vertigo-games']")
    assert has_element?(view, "#about-main-menu #show-feedback", "Обратная связь")
    assert has_element?(view, "aside.hidden.md\\:block #online-list")
    assert has_element?(view, "#chat-room.h-dvh.max-h-dvh.min-h-0.overflow-hidden")
    refute has_element?(view, "#client-error")
    refute has_element?(view, "#server-error")
  end

  test "does not enter the chat without an explicit valid nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    html = enter_chat(view, "")

    assert html =~ "Введи ник из 3–24 букв, цифр"
    assert has_element?(view, "#chat-login-link")
    refute has_element?(view, "#message-form")
  end

  test "links to the entrance on the home page", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert has_element?(view, "#chat-login-link[href='/']")
  end

  test "collects feedback from a guest and requires their name", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    view |> element("#show-feedback") |> render_click()

    assert has_element?(view, "#feedback-modal[role='dialog'] #feedback-form")
    assert has_element?(view, "#feedback-form #feedback_name")

    view
    |> form("#feedback-form", feedback: %{name: "", body: "Добавьте поиск"})
    |> render_submit()

    assert has_element?(view, "#feedback-form [role='alert']", "can't be blank")
  end

  test "enters the chat with a nickname and renders the initial system message", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    html = enter_chat(view, "tester")

    refute html =~ "Общая комната"
    assert html =~ "Добро пожаловать в чат!"
    assert html =~ "tester"
    assert has_element?(view, "[data-system-notice='features']", "Новое в чате")
    assert has_element?(view, "[data-system-notice='features']", "/музыка")
    assert has_element?(view, "[data-system-notice='features']", "/гиф")
    assert has_element?(view, "[data-system-notice='features']", "/ютуб")

    assert has_element?(
             view,
             "#messages [data-message-kind='system'].text-center",
             "в чат заходит tester"
           )

    assert has_element?(view, "#messages [data-message-kind='system'] time[datetime]")

    assert has_element?(view, "#messages[phx-hook='ChatMessages']")
    assert has_element?(view, "#messages[phx-update='stream']")
    assert has_element?(view, "#pending-messages[phx-update='ignore'][aria-live='polite']")
    assert has_element?(view, "#messages time[datetime]")
    assert has_element?(view, "#message-form.shrink-0")
    assert has_element?(view, "#command-autocomplete")

    assert has_element?(
             view,
             "#command-autocomplete-menu[role='listbox'] [data-command='/помощь']"
           )

    assert has_element?(view, "#command-autocomplete-menu [data-command='/гиф ']")
    assert has_element?(view, "#command-autocomplete-menu [data-command='/ютуб ']")
    assert has_element?(view, "#command-autocomplete-menu [data-command='/очистить']")

    assert has_element?(view, "#emoji-input-controls.flex")
    assert has_element?(view, "#emoji-composer-controls.grid")
    assert has_element?(view, "#command-autocomplete.col-span-3.row-start-1")
    assert has_element?(view, "#send-message.col-start-4.row-start-1")
    assert has_element?(view, "#show-command-menu[aria-controls='command-autocomplete-menu']")
    assert has_element?(view, "#command-autocomplete.col-span-3.row-start-1")
    assert has_element?(view, "#message-body.w-full.text-base")
    assert has_element?(view, "#send-message")
    assert has_element?(view, "#current-chatlan-online", "В сети")
    assert has_element?(view, "#current-chatlan-reconnecting[hidden]", "Нет связи")
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

  test "wakes Karmik when a joined chatlan pets him", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "karmik_pet_user")

    assert has_element?(view, "#karmik-sprite[phx-hook='KarmikPet'][role='button'][tabindex='0']")

    render_hook(view, "pet_karmik", %{})

    assert has_element?(view, "#karmik[data-mood='happy']")
    assert has_element?(view, "#karmik-purr[aria-live='polite']", "Мур-р-р!")
  end

  test "restores a registered chatlan from connection parameters", %{conn: conn} do
    assert {:ok, user} =
             Accounts.register_user(%{
               "nickname" => "returning_member",
               "password" => "secret123"
             })

    user = user |> Ecto.Changeset.change(is_admin: true) |> Repo.update!()

    Repo.insert!(%Chat.Emojis.Emoji{
      code: ":waiting_emoji:",
      image: <<1>>,
      content_type: "image/gif",
      status: :pending,
      width: 1,
      height: 1,
      animated: false
    })

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{
        "user_auth_token" => ChatWeb.UserAuth.sign(user),
        "chat_session_token" => saved_session_token(user.nickname, "secret123")
      })
      |> live(~p"/chat")

    assert has_element?(view, "#message-form")
    assert has_element?(view, "#online-list", "returning_member")
    assert_push_event(view, "save-user-auth", %{token: _token})
    refute has_element?(view, "[data-system-notice='features']")
    assert has_element?(view, "[data-system-notice='emoji-moderation']", "На проверке 1 смайл")
  end

  test "restores a guest chatlan only from an active saved session", %{conn: conn} do
    {:ok, view, _html} =
      conn
      |> put_connect_params(%{
        "guest_nickname" => "returning_guest",
        "guest_session_token" => saved_session_token("returning_guest"),
        "guest_identity_token" => saved_guest_identity("returning_guest"),
        "theme_id" => "vertigo",
        "appearance" => %{}
      })
      |> live(~p"/chat")

    assert has_element?(view, "#message-form")
    assert has_element?(view, "#online-list", "returning_guest")
    assert_push_event(view, "save-chat-preferences", %{"nickname" => "returning_guest"})
    refute has_element?(view, "[data-system-notice='features']")
  end

  test "does not restore a guest from a long-lived identity without its tab session", %{
    conn: conn
  } do
    nickname = "guest_without_session"

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{
        "guest_nickname" => nickname,
        "guest_identity_token" => ChatWeb.UserAuth.sign_guest_identity(nickname),
        "theme_id" => "vertigo",
        "appearance" => %{}
      })
      |> live(~p"/chat")

    refute has_element?(view, "#message-form")
    assert has_element?(view, "#chat-login-link")
  end

  test "renews a guest session without creating a new visit", %{conn: conn} do
    nickname = "guest_heartbeat_#{System.unique_integer([:positive])}"
    session_token = saved_session_token(nickname)

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{
        "guest_nickname" => nickname,
        "guest_session_token" => session_token,
        "guest_identity_token" => saved_guest_identity(nickname),
        "theme_id" => "vertigo",
        "appearance" => %{}
      })
      |> live(~p"/chat")

    assert has_element?(view, "#chat-room[phx-hook='ChatPreferences'][data-chat-joined='true']")

    assert [%{id: visit_id}] =
             Enum.filter(Visits.list_recent_visits(), &(&1.nickname == nickname))

    assert_push_event(view, "save-chat-preferences", %{"session_token" => ^session_token})

    render_hook(view, "touch_chat_session", %{})

    assert_push_event(view, "save-chat-preferences", %{
      "nickname" => ^nickname,
      "session_token" => renewed_token
    })

    assert {:ok, credentials} = ChatWeb.UserAuth.verify_chat_resume(renewed_token, nickname)
    assert {:ok, ^credentials} = ChatWeb.UserAuth.verify_chat_resume(session_token, nickname)

    assert [%{id: ^visit_id}] =
             Enum.filter(Visits.list_recent_visits(), &(&1.nickname == nickname))
  end

  test "writes heartbeat diagnostics only while session debug is enabled", %{conn: conn} do
    previous_setting = Application.get_env(:chat, :session_debug)
    previous_log_level = Logger.level()
    Application.put_env(:chat, :session_debug, true)
    Logger.configure(level: :info)

    on_exit(fn ->
      Application.put_env(:chat, :session_debug, previous_setting)
      Logger.configure(level: previous_log_level)
    end)

    nickname = "debug_heartbeat_#{System.unique_integer([:positive])}"
    session_token = saved_session_token(nickname)

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{
        "guest_nickname" => nickname,
        "guest_session_token" => session_token,
        "guest_identity_token" => saved_guest_identity(nickname),
        "theme_id" => "vertigo",
        "appearance" => %{}
      })
      |> live(~p"/chat")

    log =
      capture_log(
        [level: :info],
        fn -> render_hook(view, "touch_chat_session", %{"visibility" => "hidden"}) end
      )

    assert log =~ "session_debug event=heartbeat"
    assert log =~ "nickname=#{nickname}"
    assert log =~ "visibility=hidden"

    capture_log([level: :info], fn ->
      render_hook(view, "session_debug_client", %{
        "event" => "visibility_changed",
        "visibility" => "hidden"
      })
    end)

    assert %ChatSession{last_visibility: "hidden"} =
             Repo.one(from(session in ChatSession, where: session.nickname == ^nickname))
  end

  test "restores a guest during page refresh while its previous connection is still online", %{
    conn: conn
  } do
    nickname = "guest_refresh_#{System.unique_integer([:positive])}"
    session_token = saved_session_token(nickname)

    params = %{
      "guest_nickname" => nickname,
      "guest_session_token" => session_token,
      "guest_identity_token" => saved_guest_identity(nickname),
      "theme_id" => "vertigo",
      "appearance" => %{}
    }

    {:ok, previous_view, _html} = conn |> put_connect_params(params) |> live(~p"/chat")
    assert has_element?(previous_view, "#message-form")

    {:ok, refreshed_view, _html} = build_conn() |> put_connect_params(params) |> live(~p"/chat")

    assert has_element?(refreshed_view, "#message-form")
    assert 1 == Enum.count(Chatlans.list_online("lobby"), &(&1.nickname == nickname))
    assert 1 == Enum.count(Visits.list_recent_visits(), &(&1.nickname == nickname))
  end

  test "allows a registered chatlan with the correct password to take over an active session", %{
    conn: conn
  } do
    nickname = "two_tabs_#{System.unique_integer([:positive])}"

    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => nickname, "password" => "secret123"})

    {:ok, first_tab, _html} = live(conn, ~p"/chat")
    enter_chat(first_tab, nickname, "secret123")

    {:ok, second_tab, _html} = live(build_conn(), ~p"/chat")
    enter_chat(second_tab, nickname, "secret123")

    assert has_element?(second_tab, "#message-form")

    assert 1 ==
             Repo.aggregate(
               from(visit in Visit, where: visit.nickname == ^nickname and is_nil(visit.left_at)),
               :count
             )
  end

  test "answers a public address so that the whole room sees it", %{conn: conn} do
    {:ok, sender, _html} = live(conn, ~p"/chat")
    {:ok, observer, _html} = live(build_conn(), ~p"/chat")
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

  test "sends a selected music search result to the shared chat", %{conn: conn} do
    previous_config = Application.get_env(:chat, Chat.Music)

    Application.put_env(:chat, Chat.Music,
      endpoint: "https://mp3mn.net/",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, Chat.Music, previous_config) end)

    music_response = fn request ->
      Req.Test.html(request, """
      <ul class="playlist">
        <li>
          <a class="playlist-play" data-url="https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3">Прослушать</a>
          <a href="/t/165-bakr_privet/" class="playlist-down">Скачать</a>
          <span class="playlist-duration">2:35</span>
          <span class="playlist-name-artist"><a>Bakr</a></span>
          <span class="playlist-name-title"><a>Привет</a></span>
        </li>
      </ul>
      """)
    end

    Req.Test.expect(__MODULE__, music_response)

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "music_picker")

    view
    |> form("#message-form", message: %{body: "/музыка Bakr Привет"})
    |> render_submit()

    render_async(view)

    assert has_element?(view, "[id^='send-music-']", "В чат")
    assert has_element?(view, "[id^='dismiss-music-search-']", "Закрыть")

    view
    |> element("[id^='dismiss-music-search-']")
    |> render_click()

    refute has_element?(view, "[data-command-result='music']")

    Req.Test.expect(__MODULE__, music_response)

    view
    |> form("#message-form", message: %{body: "/музыка Bakr Привет"})
    |> render_submit()

    render_async(view)

    view
    |> element("[id^='send-music-']")
    |> render_click()

    assert has_element?(view, "[data-message-kind='music'] [id^='music-message-player-']")
    assert has_element?(view, "[data-message-kind='music'].ml-auto.max-w-xl")
    refute has_element?(view, "[data-command-result='music']")
  end

  test "shows the current track beside a chatlan while audio is playing", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "listening_guest")

    render_hook(view, "music_started", %{"track" => "Bakr — Привет"})

    assert has_element?(view, "[id^='listening-chatlan-'][title='Слушает: Bakr — Привет']")

    render_hook(view, "music_stopped", %{"track" => "Bakr — Привет"})

    refute has_element?(view, "[id^='listening-chatlan-']")
  end

  test "paginates music search results in groups of five", %{conn: conn} do
    previous_config = Application.get_env(:chat, Chat.Music)

    Application.put_env(:chat, Chat.Music,
      endpoint: "https://mp3mn.net/",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, Chat.Music, previous_config) end)

    Req.Test.expect(__MODULE__, fn request ->
      tracks =
        for index <- 1..6 do
          """
          <li>
            <a class="playlist-play" data-url="https://mn1.sunproxy.net/file/test/track-#{index}.mp3">Прослушать</a>
            <a href="/t/track-#{index}/" class="playlist-down">Скачать</a>
            <span class="playlist-duration">3:#{index}0</span>
            <span class="playlist-name-artist"><a>Исполнитель #{index}</a></span>
            <span class="playlist-name-title"><a>Трек #{index}</a></span>
          </li>
          """
        end

      Req.Test.html(request, "<ul>#{tracks}</ul>")
    end)

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "music_pagination")

    view
    |> form("#message-form", message: %{body: "/музыка тест"})
    |> render_submit()

    render_async(view)

    for index <- 1..5 do
      assert has_element?(view, "[id^='music-track-'][id$='-#{index}']")
    end

    refute has_element?(view, "[id^='music-track-'][id$='-6']")
    assert has_element?(view, "[id^='music-page-'][phx-value-page='2']", "2")
    assert has_element?(view, "[data-command-result='music']", "Исполнитель 1")

    view
    |> element("[id^='music-page-'][phx-value-page='2']")
    |> render_click()

    assert has_element?(view, "[id^='music-track-'][id$='-6']")
    refute has_element?(view, "[id^='music-track-'][id$='-1']")
    assert has_element?(view, "[data-command-result='music']", "Исполнитель 6")
    refute has_element?(view, "[data-command-result='music']", "Исполнитель 1")
  end

  test "shares a YouTube link as a compact server-proxied video", %{conn: conn} do
    previous_config = Application.get_env(:chat, Chat.YouTube)
    test_pid = self()

    Application.put_env(:chat, Chat.YouTube,
      duration_resolver: fn _source_url ->
        send(test_pid, {:youtube_duration_requested, self()})

        receive do
          :resolve_youtube_duration -> {:ok, 600}
        end
      end,
      title_resolver: fn _source_url -> {:ok, "Тестовое видео"} end
    )

    on_exit(fn -> Application.put_env(:chat, Chat.YouTube, previous_config) end)

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "youtube_sender")

    view
    |> form("#message-form", message: %{body: "/ютуб https://youtu.be/dQw4w9WgXcQ"})
    |> render_submit()

    assert_receive {:youtube_duration_requested, task_pid}
    assert has_element?(view, "[data-command-result='youtube']", "Подготавливаю видео")
    assert has_element?(view, "#message-body[value='']")

    send(task_pid, :resolve_youtube_duration)
    render_async(view)

    assert has_element?(view, "[data-message-kind='youtube'] [id^='youtube-message-player-']")
    assert has_element?(view, "[data-message-kind='youtube'].ml-auto.max-w-sm")
    assert has_element?(view, "[data-video-src='/youtube-proxy/dQw4w9WgXcQ']")
    assert has_element?(view, "[data-lazy-youtube-play]", "Воспроизвести")
    assert has_element?(view, "[data-message-kind='youtube']", "Тестовое видео")
    refute has_element?(view, "[data-command-result='youtube']", "Подготавливаю видео")
    refute has_element?(view, "video[src='/youtube-proxy/dQw4w9WgXcQ']")
    assert has_element?(view, "#message-body[value='']")
  end

  test "searches YouTube by text and lets a chatlan publish one result", %{conn: conn} do
    previous_config = Application.get_env(:chat, Chat.YouTube)
    test_pid = self()

    Application.put_env(:chat, Chat.YouTube,
      search_resolver: fn _query ->
        {:ok,
         [
           %{"id" => "dQw4w9WgXcQ", "title" => "Найденный ролик", "duration" => 120},
           %{"id" => "9bZkp7q19f0", "title" => "Длинный ролик", "duration" => 1_201}
         ]}
      end,
      duration_resolver: fn _source_url ->
        send(test_pid, {:youtube_search_duration_requested, self()})

        receive do
          :resolve_youtube_search_duration -> {:ok, 120}
        end
      end,
      title_resolver: fn _source_url -> {:ok, "Найденный ролик"} end
    )

    on_exit(fn -> Application.put_env(:chat, Chat.YouTube, previous_config) end)

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "youtube_searcher")

    view
    |> form("#message-form", message: %{body: "/ютуб найденный ролик"})
    |> render_submit()

    render_async(view)

    assert has_element?(view, "[data-command-result='youtube_search']", "Найденный ролик")
    assert has_element?(view, "[id^='youtube-result-'][id$='-dQw4w9WgXcQ']")
    refute has_element?(view, "[data-command-result='youtube_search']", "Длинный ролик")

    view
    |> element("[id^='send-youtube-'][id$='-dQw4w9WgXcQ']")
    |> render_click()

    assert_receive {:youtube_search_duration_requested, task_pid}
    send(task_pid, :resolve_youtube_search_duration)
    render_async(view)

    assert has_element?(view, "[data-message-kind='youtube']")
    refute has_element?(view, "[data-command-result='youtube_search']")
  end

  test "does not answer a private message addressed to Hitchcock", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "private_bot_sender")

    render_hook(view, "send_private_message", %{
      "body" => "^Хичкок, Это никто не увидит?"
    })

    assert render(view) =~ "Хичкок отвечает только на публичные обращения"
    refute has_element?(view, "#messages .chat-message-author", "Хичкок")
  end

  test "shows Hitchcock as busy while the provider limit is active", %{conn: conn} do
    on_exit(&BotStatus.reset/0)
    {:ok, view, _html} = live(conn, ~p"/chat")
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
    {:ok, first_view, _html} = live(conn, ~p"/chat")
    {:ok, second_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(first_view, "same_nickname")
    html = enter_chat(second_view, "same_nickname")

    assert html =~ "Этот ник уже используется в чате"
    assert has_element?(second_view, "#chat-login-link")
    refute has_element?(second_view, "#message-form")
    assert has_element?(first_view, "#message-form")
  end

  test "shows when another chatlan is typing without shifting the layout", %{conn: conn} do
    {:ok, writer, _html} = live(conn, ~p"/chat")
    {:ok, reader, _html} = live(build_conn(), ~p"/chat")
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

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "image_author", "secret123")

    assert has_element?(view, "#media-share-controls[phx-hook='MediaSharing']")
    assert has_element?(view, "#media-file-input[accept*='audio/mpeg']")
    assert has_element?(view, "#attach-media:not([disabled])")
  end

  test "backend rejects an image announcement from a guest", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
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

    {:ok, view, _html} = live(conn, ~p"/chat")
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

    {:ok, view, _html} = live(conn, ~p"/chat")
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
    {:ok, view, _html} = live(conn, ~p"/chat")

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
    {:ok, view, _html} = live(conn, ~p"/chat")
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

    assert_push_event(view, "save-user-auth", %{token: token, session_token: session_token})
    [visit] = Visits.list_recent_visits()

    {:ok, refreshed, _} =
      build_conn()
      |> put_connect_params(%{"user_auth_token" => token, "chat_session_token" => session_token})
      |> live(~p"/chat")

    assert has_element?(refreshed, "#message-form")
    assert [%{id: visit_id, user_id: user_id}] = Visits.list_recent_visits()
    assert visit_id == visit.id
    assert user_id
    refute has_element?(refreshed, "#show-registration")
  end

  test "closes in-chat registration without leaving the chat", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "guest_staying")

    view |> element("#show-registration") |> render_click()
    assert view |> element("#close-registration") |> render_click() =~ "message-form"

    refute has_element?(view, "#registration-modal")
    assert has_element?(view, "#show-registration")
  end

  test "returns from registration to login and shows validation errors", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

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

    {:ok, view, _html} = live(conn, ~p"/chat")

    html = enter_chat(view, "registered", "secret123")

    assert has_element?(view, "#message-form")
    assert html =~ "registered"
  end

  test "opens and updates the authenticated user's profile", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "profiled", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "profiled", "secret123")

    html =
      view
      |> element("button[id^='profile-link-'][phx-value-nickname='profiled']")
      |> render_click()

    assert html =~ "profile-modal"
    assert has_element?(view, "#profile-modal.fixed.inset-0.z-50")
    assert has_element?(view, "#profile-view")
    assert has_element?(view, "#edit-profile")
    refute has_element?(view, "#profile-form")

    view |> element("#edit-profile") |> render_click()
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

    assert has_element?(view, "#profile-display-name", "Мария")
    refute has_element?(view, "#profile-form")
  end

  test "does not show profile editing controls to a guest", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "readonly", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "guest_user")

    refute has_element?(view, "[id^='profile-link-'][phx-value-nickname='guest_user']")

    assert has_element?(
             view,
             "#online-list [id^='anonymous-chatlan-'][aria-label='Анонимный чатланин'] .size-5.border-dashed",
             "?"
           )

    view |> element("#message-form") |> render_submit(%{message: %{body: "hello"}})
    render_hook(view, "open_profile", %{"nickname" => "readonly"})

    assert has_element?(view, "#profile-view")
    refute has_element?(view, "#profile-form")
    refute has_element?(view, "#edit-profile")
    refute has_element?(view, "#save-profile")
  end

  test "opens, validates and closes a guest profile", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "viewer")

    render_hook(view, "open_profile", %{"nickname" => "guest_missing"})
    assert has_element?(view, "#profile-modal")
    assert has_element?(view, "#profile-view", "Пока ничего не рассказал о себе.")
    refute has_element?(view, "#profile-form")
    refute has_element?(view, "#save-profile")

    render_hook(view, "validate_profile", %{"profile" => %{"name" => String.duplicate("x", 81)}})
    refute has_element?(view, "#profile-form")

    view |> element("#close-profile") |> render_click()
    refute has_element?(view, "#profile-modal")
  end

  test "shows validation errors while saving an authenticated profile", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "invalid_profile", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "invalid_profile", "secret123")
    render_hook(view, "open_profile", %{"nickname" => "invalid_profile"})
    view |> element("#edit-profile") |> render_click()

    html =
      view
      |> form("#profile-form", profile: %{birth_date: Date.add(Date.utc_today(), 1)})
      |> render_submit()

    assert html =~ "не может быть в будущем"
  end

  test "uploads an authenticated user's profile photo", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "photo_profile", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "photo_profile", "secret123")
    render_hook(view, "open_profile", %{"nickname" => "photo_profile"})
    view |> element("#edit-profile") |> render_click()

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

    assert has_element?(view, "#profile-avatar-image[src='/profiles/photo_profile/photo']")
    assert render(view) =~ "h-[min(30vh,18rem)]"
    refute render(view) =~ "min-h-[24rem]"
  end

  test "delivers a private message only to sender and recipient", %{
    conn: conn
  } do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")
    {:ok, eve_view, _html} = live(build_conn(), ~p"/chat")

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

  test "notifies a chatlan about addressed and private messages when sound is enabled", %{
    conn: conn
  } do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "sound_alice")
    enter_chat(bob_view, "sound_bob")

    bob_view |> element("#toggle-settings") |> render_click()

    bob_view
    |> form("#preferences-form", preferences: %{message_sound_enabled: "true"})
    |> render_submit()

    alice_view
    |> form("#message-form", message: %{body: "sound_bob, публичное обращение"})
    |> render_submit()

    assert_push_event(bob_view, "play-message-notification", %{})

    alice_view
    |> form("#message-form", message: %{body: "^sound_bob, личное сообщение"})
    |> render_submit()

    assert_push_event(bob_view, "play-message-notification", %{})
  end

  test "renders the author's selected typography only on their messages", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "type_alice")
    enter_chat(bob_view, "type_bob")

    alice_view |> element("#toggle-settings") |> render_click()

    alice_view
    |> form("#preferences-form", preferences: %{font_id: "serif", font_style: "italic"})
    |> render_submit()

    alice_view
    |> form("#message-form", message: %{body: "сообщение с личным шрифтом"})
    |> render_submit()

    assert has_element?(
             bob_view,
             "#messages .chat-message-entry[data-message-font='serif'][data-message-font-style='italic'] .chat-message-body",
             "сообщение с личным шрифтом"
           )

    refute has_element?(bob_view, "#chat-room[data-chat-font]")
  end

  test "a single nickname click prepares a public addressed message", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "alice_public")
    enter_chat(bob_view, "bob_public")
    render(alice_view)

    render_hook(alice_view, "start_public_message", %{"nickname" => "bob_public"})

    assert has_element?(alice_view, "#message-body[value='bob_public, ']")
  end

  test "renders the addressed nickname in the recipient's selected color", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

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
    {:ok, view, _html} = live(conn, ~p"/chat")
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
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "alice_trailing_address")
    enter_chat(bob_view, "bob_trailing_address")
    render(alice_view)

    alice_view
    |> form("#message-form", message: %{body: "тест bob_trailing_address"})
    |> render_submit()

    assert has_element?(bob_view, "#messages .chat-message-recipient", "bob_trailing_address")
  end

  test "highlights an addressed message for a recipient using the frameless view", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

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
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "alice_ctrl")
    enter_chat(bob_view, "bob_ctrl")

    render_hook(alice_view, "send_private_message", %{"body" => "bob_ctrl, секрет"})
    render(bob_view)

    assert has_element?(bob_view, "#messages [data-private='true']", "секрет")
  end

  test "loads recent public history for a newcomer without private messages", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    {:ok, bob_view, _html} = live(build_conn(), ~p"/chat")

    enter_chat(alice_view, "history_alice")
    enter_chat(bob_view, "history_bob")

    alice_view
    |> form("#message-form", message: %{body: "публичная история"})
    |> render_submit()

    alice_view
    |> form("#message-form", message: %{body: "^history_bob, скрытая история"})
    |> render_submit()

    {:ok, newcomer_view, _html} = live(build_conn(), ~p"/chat")
    html = enter_chat(newcomer_view, "newcomer")

    assert html =~ "публичная история"
    refute html =~ "скрытая история"
    refute has_element?(newcomer_view, "#messages [data-private='true']")
  end

  test "does not allow guest entrance with a registered nickname", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "registered", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")

    html = enter_chat(view, "registered")

    assert html =~ "Этот ник зарегистрирован"
    refute html =~ "Общая комната"
  end

  test "does not allow entrance with a wrong password", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "registered", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")

    html = enter_chat(view, "registered", "wrong123")

    assert html =~ "Неверный пароль"
    refute html =~ "Общая комната"
  end

  test "reports unknown registered-user credentials", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    assert enter_chat(view, "unknown_user", "secret123") =~ "Такой ник не зарегистрирован"
  end

  test "sends a public message from the form", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "tester")

    view
    |> form("#message-form", message: %{body: "  привет из теста  "})
    |> render_submit()

    html = render(view)

    assert html =~ "привет из теста"
    refute html =~ "  привет из теста  "
    refute has_element?(view, "#send-message[phx-disable-with]")
    assert has_element?(view, "#send-message.size-10[title='Отправить сообщение'] .size-5")
    assert has_element?(view, "#message-form.relative.z-20")
    refute has_element?(view, "#messages[style*='--chat-composer-height']")
  end

  test "silently ignores an invalid message sync cursor", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "synccursor")

    render_hook(view, "sync_messages", %{"cursor" => "not-a-cursor"})

    assert has_element?(view, "#message-form")
  end

  test "keeps a registered user in chat after the first message", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "stable_member", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "stable_member", "secret123")

    view
    |> form("#message-form", message: %{body: "Первое сообщение"})
    |> render_submit()

    assert has_element?(view, "#chat-room")
    assert has_element?(view, "#message-form")
    assert has_element?(view, "#messages .chat-message-author", "stable_member")
    assert has_element?(view, "#messages .chat-message-body", "Первое сообщение")
    refute has_element?(view, "#chat-login-link")
  end

  test "toggles an emoji reaction on another chatlan's message", %{conn: conn} do
    {:ok, alice_view, _html} = live(conn, ~p"/chat")
    enter_chat(alice_view, "reaction_alice")

    {:ok, bob_view, _html} = live(recycle(conn), ~p"/chat")
    enter_chat(bob_view, "reaction_bob")

    alice_view
    |> form("#message-form", message: %{body: "сообщение с реакцией"})
    |> render_submit()

    assert has_element?(
             alice_view,
             "#messages [phx-hook='ChatWeb.RoomComponents.ReactionBurst'][data-reaction-counts] [data-reaction-burst-layer][phx-update='ignore']"
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

  test "renders a full-width emoji picker inside the message frame", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "emoji_user")

    assert has_element?(view, "#emoji-input-controls #toggle-emoji-picker")

    assert has_element?(view, "#emoji-picker-list")
    assert has_element?(view, "#emoji-autosuggest[checked]")
    refute has_element?(view, "#open-emoji-submission")
    assert has_element?(view, "#emoji-picker.w-full")
    refute has_element?(view, "#emoji-frequency")
    assert has_element?(view, "#emoji-input-controls")
    assert has_element?(view, "#send-message[aria-label='Отправить сообщение'] .size-5")
    assert has_element?(view, "#leave-chat[aria-label='Выйти из чата'] .sm\\:hidden")
  end

  test "offers saved frequency sorting only to registered chatlan", %{conn: conn} do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "emoji_member", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "emoji_member", "secret123")

    assert has_element?(view, "#emoji-input-controls[data-registered='true']")
    assert has_element?(view, "#emoji-order-mode[role='radiogroup']")
    assert has_element?(view, "#emoji-autosuggest[type='radio'][checked]")
    assert has_element?(view, "#emoji-frequency[type='radio'][value='frequency']")
    assert has_element?(view, "#open-emoji-submission")
  end

  test "acknowledges a public message with its client and server ids", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "draft_clearing_sender")
    client_id = Ecto.UUID.generate()

    render_hook(view, "send_message", %{
      "message" => %{"body" => "первое сообщение", "client_id" => client_id}
    })

    assert_push_event(view, "public-message-acknowledged", %{
      client_id: ^client_id,
      message_id: message_id
    })

    assert is_integer(message_id)
    assert has_element?(view, "#messages [data-client-id='#{client_id}']", "первое сообщение")
    assert has_element?(view, "#messages [data-delivery-state='published']", "✓✓")
  end

  test "rejects an outbox message explicitly when server validation fails", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "rejected_outbox_sender")
    client_id = Ecto.UUID.generate()

    render_hook(view, "send_message", %{
      "message" => %{
        "body" => String.duplicate("я", Chat.Messages.max_body_length() + 1),
        "client_id" => client_id
      }
    })

    assert_push_event(view, "public-message-rejected", %{
      client_id: ^client_id,
      reason: "message_too_long"
    })

    assert has_element?(view, "#message-error", "Сообщение не должно превышать")
  end

  test "rejects a rate-limited outbox message without publishing it", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "rate_limit_outbox")

    for index <- 1..3 do
      render_hook(view, "send_message", %{
        "message" => %{"body" => "сообщение #{index}", "client_id" => Ecto.UUID.generate()}
      })
    end

    client_id = Ecto.UUID.generate()

    render_hook(view, "send_message", %{
      "message" => %{"body" => "оставить в поле", "client_id" => client_id}
    })

    assert_push_event(view, "public-message-rejected", %{
      client_id: ^client_id,
      reason: "rate_limited"
    })

    refute has_element?(view, "#message-body[value='оставить в поле']")
    refute has_element?(view, "#messages .chat-message-body", "оставить в поле")
    assert has_element?(view, "#message-error", "Слишком часто")
  end

  test "does not render an empty public message", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "tester")

    html =
      view
      |> form("#message-form", message: %{body: "   "})
      |> render_submit()

    assert html =~ "Добро пожаловать в чат!"
    refute html =~ ~s(<p class="mt-1 break-words text-sm leading-6 text-zinc-200"></p>)
  end

  test "ignores malformed message events", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    render_hook(view, "send_message", %{})
    render_hook(view, "send_private_message", %{})
    render_hook(view, "toggle_reaction", %{})

    assert has_element?(view, "#chat-login-link")
  end

  test "saves nickname and text colors from the chatlan settings panel", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "tester")

    assert view |> element("#toggle-settings") |> render_click() =~ "Цвета моих сообщений"

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
    refute html =~ "Цвета моих сообщений"

    view
    |> form("#message-form", message: %{body: "цветное сообщение"})
    |> render_submit()

    html = render(view)

    assert html =~ "цветное сообщение"
    assert html =~ "--nick-dark: #00ff88"
    assert html =~ "--text-dark: #3366aa"
  end

  test "opens settings in a modal without hiding the chatlan list", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "settings_focus")

    assert has_element?(view, "#online-list")

    view |> element("#toggle-settings") |> render_click()

    assert has_element?(view, "#settings-modal[role='dialog'] #preferences-form")
    assert has_element?(view, "#online-list")
    assert has_element?(view, "#close-settings")
  end

  test "renders a frameless public message without badges or reactions", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "compact_user")

    view
    |> form("#message-form", message: %{body: "сообщение меняет оформление"})
    |> render_submit()

    assert has_element?(
             view,
             "#messages [data-message-frame='true'] .chat-message-body",
             "сообщение меняет оформление"
           )

    {:ok, other_view, _html} = live(build_conn(), ~p"/chat")
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
    {:ok, view, _html} = live(conn, ~p"/chat")
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
    assert html =~ "Цвета моих сообщений"
    assert has_element?(view, "#chat-room[data-chat-theme='vertigo']")
  end

  test "switches to the night sky theme as a dark mode theme", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
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
    {:ok, view, _html} = live(conn, ~p"/chat")
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
    {:ok, view, _html} = live(conn, ~p"/chat")
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

    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "persistent_style", "secret123")
    view |> element("#toggle-settings") |> render_click()

    view
    |> form("#preferences-form",
      preferences: %{
        theme_id: "night_sky",
        font_id: "serif",
        font_style: "italic",
        message_sound_enabled: "true",
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
    assert stored.font_id == "serif"
    assert stored.font_style == "italic"
    assert stored.message_sound_enabled
    assert stored.appearance["dark"]["nickname_color"] == "#aa44cc"
    refute stored.appearance["message_frame"]

    view |> element("#leave-chat") |> render_click()

    {:ok, restored_view, _html} = live(recycle(conn), ~p"/chat")
    enter_chat(restored_view, "persistent_style", "secret123")

    assert has_element?(restored_view, "#chat-room[data-chat-theme='night_sky']")
    refute has_element?(restored_view, "#chat-room[data-chat-font]")

    assert render(restored_view) =~ "--nick-dark: #aa44cc"

    restored_view |> element("#toggle-settings") |> render_click()
    assert has_element?(restored_view, "#message-frame option[value='false'][selected]")
    assert has_element?(restored_view, "#font-id option[value='serif'][selected]")
    assert has_element?(restored_view, "#font-style option[value='italic'][selected]")
    assert has_element?(restored_view, "#message-sound-enabled[checked]")
  end

  test "loads saved guest preferences in the context of the saved nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

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
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "before_name")

    render_hook(view, "load_preferences", %{
      "nickname" => "after_name",
      "theme_id" => "vertigo",
      "appearance" => %{}
    })

    assert render(view) =~ "after_name"
  end

  test "does not apply saved colors when entering with another nickname", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

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

  test "leaves the chat and redirects to the home page", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    enter_chat(view, "tester")

    view |> element("#leave-chat") |> render_click()

    assert_redirect(view, ~p"/")
    assert [visit] = Visits.list_recent_visits()
    assert visit.left_at
  end

  test "clears browser session data before sending an explicit exit", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "logout_session")

    assert render(view) =~ "phx:clear-chat-session"
  end

  test "renders a local framed command result and lets a chatlan be addressed", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "command_user")

    view
    |> form("#message-form", message: %{body: "/помощь"})
    |> render_submit()

    assert has_element?(view, "[data-command-result='help']", "Доступные текстовые команды")
    assert has_element?(view, "[data-command-result='help']", "/игнор ник")

    view
    |> form("#message-form", message: %{body: "/кто"})
    |> render_submit()

    assert has_element?(view, "[data-command-result='who']")
    assert has_element?(view, "[data-command-result='who'] button", "command_user")

    view
    |> element("[data-command-result='who'] button[phx-value-nickname='command_user']")
    |> render_click()

    assert has_element?(view, "#message-body[value='command_user, ']")
  end

  test "clears only the current chat frame", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "clear_frame_user")

    view
    |> form("#message-form", message: %{body: "Сообщение для очистки"})
    |> render_submit()

    assert has_element?(view, ".chat-message-body", "Сообщение для очистки")

    view
    |> form("#message-form", message: %{body: "/очистить"})
    |> render_submit()

    refute has_element?(view, ".chat-message-body", "Сообщение для очистки")
    refute has_element?(view, "[data-command-result='clear']")
  end

  test "toggles ignored chatlan messages without publishing the command", %{conn: conn} do
    {:ok, viewer, _html} = live(conn, ~p"/chat")
    {:ok, sender, _html} = live(build_conn(), ~p"/chat")
    enter_chat(viewer, "ignore_viewer")
    enter_chat(sender, "ignore_sender")

    sender
    |> form("#message-form", message: %{body: "Это должно исчезнуть"})
    |> render_submit()

    assert has_element?(viewer, ".chat-message-body", "Это должно исчезнуть")

    viewer
    |> form("#message-form", message: %{body: "/игнор ignore_sender"})
    |> render_submit()

    refute has_element?(viewer, ".chat-message-body", "Это должно исчезнуть")

    assert has_element?(
             viewer,
             "[data-command-result='ignore']",
             "Сообщения ignore_sender скрыты"
           )

    viewer
    |> form("#message-form", message: %{body: "/игнор ignore_sender"})
    |> render_submit()

    assert has_element?(viewer, ".chat-message-body", "Это должно исчезнуть")
  end

  test "shows subtle system messages when a chatlan joins and leaves", %{conn: conn} do
    {:ok, observer, _html} = live(conn, ~p"/chat")
    {:ok, participant, _html} = live(build_conn(), ~p"/chat")
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

  test "does not immediately announce a departure when a LiveView process terminates", %{
    conn: conn
  } do
    nickname = "reload_#{System.unique_integer([:positive])}"
    :ok = Messages.subscribe("lobby")

    {:ok, participant, _html} = live(conn, ~p"/chat")
    enter_chat(participant, nickname)
    assert_receive {:message_created, %{body: "в чат заходит " <> ^nickname}}

    :ok = GenServer.stop(participant.pid, :normal)

    refute_receive {:message_created, %{body: "из чата выходит " <> ^nickname}}
  end

  test "records entrance and exit timestamps", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")
    enter_chat(view, "history_user")

    assert [visit] = Visits.list_recent_visits()
    assert visit.nickname == "history_user"
    assert visit.left_at == nil

    view |> element("#leave-chat") |> render_click()

    assert [finished] = Visits.list_recent_visits()
    assert finished.id == visit.id
    assert finished.left_at
  end

  defp saved_session_token(nickname, password \\ "") do
    {:ok, session} =
      Chat.Sessions.enter("lobby", nickname, password,
        presence_key: Chatlans.guest_presence_key()
      )

    ChatWeb.UserAuth.sign_chat_resume(nickname, session.session_id, session.resume_secret)
  end

  defp saved_guest_identity(nickname) do
    session = Enum.find(Chat.Sessions.Store.live("lobby"), &(&1.nickname == nickname))
    "guest:" <> identity_id = session.identity_key
    ChatWeb.UserAuth.sign_guest_identity(nickname, identity_id)
  end

  defp enter_chat(view, nickname, password \\ "") do
    view
    |> render_hook("enter_chat", %{
      "entrance" => %{"nickname" => nickname, "password" => password}
    })
  end
end
