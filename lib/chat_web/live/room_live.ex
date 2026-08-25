# Назначение файла: LiveView общей комнаты чата, связывает UI, Presence и контекст сообщений.
defmodule ChatWeb.RoomLive do
  use ChatWeb, :live_view

  alias Chat.Accounts
  alias Chat.Appearance
  alias Chat.Bot
  alias Chat.Chatlans
  alias Chat.MediaShares
  alias Chat.Messages
  alias Chat.Profiles
  alias Chat.PrivateMessages
  alias Chat.Themes
  alias Chat.Visits
  alias ChatWeb.AuthComponents
  alias ChatWeb.ClientSecurity
  alias ChatWeb.RoomComponents
  alias ChatWeb.ShellComponents
  alias ChatWeb.UserAuth

  @room_id "lobby"

  @impl true
  def mount(_params, _session, socket) do
    presence_key = Chatlans.guest_presence_key()
    security_subject = ClientSecurity.subject_from_socket(socket, presence_key)
    messages = Messages.list_recent_messages(@room_id)

    socket =
      socket
      |> assign(:nickname, nil)
      |> assign(:presence_key, presence_key)
      |> assign(:security_subject, security_subject)
      |> assign(:preference_nickname, nil)
      |> assign(:theme_id, Themes.default_theme_id())
      |> assign(:themes, Themes.list())
      |> assign(:theme_modes, Themes.list_modes())
      |> assign(:appearance, Appearance.default())
      |> assign_active_colors()
      |> assign(:joined?, false)
      |> assign(:visit, nil)
      |> assign(:current_user, nil)
      |> assign(:profile, nil)
      |> assign(:profile_form, nil)
      |> assign(:profile_editable?, false)
      |> assign(:settings_open?, false)
      |> assign(:screen, :login)
      |> assign(:entrance_error, nil)
      |> assign(:registration_error, nil)
      |> assign(:message_error, nil)
      |> assign(:media_error, nil)
      |> assign(:online, [])
      |> assign(:typing_peers, %{})
      |> assign(:bot_pending?, false)
      |> assign(:message_items, messages)
      |> assign_nickname_form()
      |> assign_registration_form()
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign_settings_form()
      |> stream(:messages, messages)
      |> allow_upload(:profile_photo,
        accept: ~w(.jpg .jpeg .png .webp),
        max_entries: 1,
        max_file_size: 1_500_000
      )

    socket =
      if connected?(socket) do
        Messages.subscribe(@room_id)
        PrivateMessages.subscribe(presence_key)
        MediaShares.subscribe_peer(@room_id, presence_key)

        assign(socket, :online, Chatlans.list_online(@room_id))
      else
        socket
      end

    {:ok, socket}
  end

  @impl true
  def handle_event("enter_chat", %{"entrance" => params}, socket) do
    nickname = Chatlans.normalize_nickname(params["nickname"], nil)

    with {:ok, user} <- Accounts.authorize_entrance(nickname, params["password"]),
         :ok <- Chatlans.ensure_nickname_available(@room_id, nickname),
         {:ok, visit} <- Visits.start_visit(nickname) do
      socket =
        socket
        |> assign(:nickname, nickname)
        |> assign(:current_user, user)
        |> assign(:visit, visit)
        |> assign(:entrance_error, nil)
        |> reset_colors_for_new_nickname(nickname)
        |> apply_registered_preferences(user)
        |> assign(:joined?, true)
        |> assign_nickname_form()
        |> assign_settings_form()
        |> reset_messages(Messages.list_recent_messages(@room_id))

      track_presence(socket)
      {:ok, _message} = Messages.announce_presence(nickname, @room_id, :joined)

      {:noreply,
       socket
       |> assign(:online, Chatlans.list_online(@room_id))
       |> maybe_save_guest_preferences(user)
       |> sync_user_auth(user)
       |> push_event("focus-message-input", %{})}
    else
      {:error, %Ecto.Changeset{}} ->
        {:noreply,
         socket
         |> assign(:nickname, nickname)
         |> assign(:entrance_error, "Не удалось сохранить вход. Попробуй ещё раз.")
         |> assign_nickname_form()}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:nickname, nickname)
         |> assign(:entrance_error, entrance_error(reason))
         |> assign_nickname_form()}
    end
  end

  def handle_event("show_registration", _params, socket) do
    {:noreply,
     socket
     |> assign(:screen, :registration)
     |> assign(:entrance_error, nil)
     |> assign(:registration_error, nil)
     |> assign_registration_form()}
  end

  def handle_event("show_login", _params, socket) do
    {:noreply,
     socket
     |> assign(:screen, :login)
     |> assign(:registration_error, nil)
     |> assign_nickname_form()}
  end

  def handle_event("register_user", %{"registration" => params}, socket) do
    case Accounts.register_user(params, socket.assigns.security_subject) do
      {:ok, user} ->
        {:noreply,
         socket
         |> assign(:nickname, user.nickname)
         |> assign(:screen, :login)
         |> assign(:registration_error, nil)
         |> assign(:entrance_error, "Регистрация завершена. Теперь введи пароль и войди.")
         |> assign_nickname_form()
         |> assign_registration_form()}

      {:error, changeset} ->
        {:noreply,
         socket
         |> assign(:registration_error, registration_error(changeset))
         |> assign(:registration_form, to_form(params, as: :registration))}
    end
  end

  def handle_event("send_message", %{"message" => %{"body" => body}}, socket) do
    if PrivateMessages.private_syntax?(body) do
      send_private_message(body, socket)
    else
      send_public_message(body, socket)
    end
  end

  def handle_event("send_private_message", %{"body" => body}, socket) do
    send_private_message(body, socket)
  end

  def handle_event("send_private_message", _params, socket) do
    {:reply, %{ok: false}, assign(socket, :message_error, "Сообщение имеет неверный формат.")}
  end

  def handle_event("typing", %{"typing" => typing?}, %{assigns: %{joined?: true}} = socket)
      when is_boolean(typing?) do
    :ok =
      Chatlans.broadcast_typing(
        @room_id,
        socket.assigns.presence_key,
        socket.assigns.nickname,
        typing?
      )

    {:noreply, socket}
  end

  def handle_event("typing", _params, socket), do: {:noreply, socket}

  def handle_event(
        "toggle_reaction",
        %{"message-id" => message_id, "emoji" => emoji},
        %{assigns: %{joined?: true}} = socket
      ) do
    Messages.toggle_reaction(
      socket.assigns.nickname,
      reaction_actor_key(socket),
      @room_id,
      message_id,
      emoji
    )

    {:noreply, socket}
  end

  def handle_event("toggle_reaction", _params, socket), do: {:noreply, socket}

  def handle_event("send_message", _params, socket) do
    {:noreply,
     socket
     |> assign(:message_error, "Сообщение имеет неверный формат.")
     |> assign(:message_form, to_form(%{"body" => ""}, as: :message))}
  end

  def handle_event("announce_media", params, socket) do
    result =
      if socket.assigns.joined? do
        MediaShares.announce(
          socket.assigns.current_user,
          @room_id,
          socket.assigns.presence_key,
          Map.merge(params, %{
            "theme_id" => socket.assigns.theme_id,
            "appearance" => socket.assigns.appearance
          }),
          message_security_subject(socket)
        )
      else
        {:error, :not_joined}
      end

    case result do
      {:ok, announcement} ->
        {:reply, %{ok: true, share_id: announcement.share_id}, assign(socket, :media_error, nil)}

      {:error, reason} ->
        message = media_error(reason)
        {:reply, %{ok: false, error: message}, assign(socket, :media_error, message)}
    end
  end

  def handle_event("request_media", %{"share_id" => share_id}, socket) do
    result =
      if socket.assigns.joined? do
        MediaShares.request_media(
          @room_id,
          socket.assigns.presence_key,
          socket.assigns.nickname,
          share_id
        )
      else
        {:error, :not_joined}
      end

    case result do
      :ok -> {:reply, %{ok: true}, socket}
      {:error, reason} -> {:reply, %{ok: false, error: media_error(reason)}, socket}
    end
  end

  def handle_event("request_media_relay", %{"share_id" => share_id}, socket) do
    result =
      if socket.assigns.joined? do
        MediaShares.request_relay(
          @room_id,
          socket.assigns.presence_key,
          socket.assigns.nickname,
          share_id
        )
      else
        {:error, :not_joined}
      end

    case result do
      :ok -> {:reply, %{ok: true}, socket}
      {:error, reason} -> {:reply, %{ok: false, error: media_error(reason)}, socket}
    end
  end

  def handle_event(
        "media_relay_chunk",
        %{"target" => target_peer, "share_id" => _share_id} = params,
        socket
      ) do
    result =
      if socket.assigns.joined? do
        MediaShares.relay_chunk(
          socket.assigns.current_user,
          message_security_subject(socket),
          @room_id,
          socket.assigns.presence_key,
          target_peer,
          params
        )
      else
        {:error, :not_joined}
      end

    case result do
      :ok -> {:reply, %{ok: true}, socket}
      {:error, _reason} -> {:reply, %{ok: false}, socket}
    end
  end

  def handle_event("media_relay_chunk", _params, socket),
    do: {:reply, %{ok: false}, socket}

  def handle_event(
        "media_signal",
        %{"target" => target_peer, "share_id" => _share_id} = params,
        socket
      ) do
    result =
      if socket.assigns.joined? do
        MediaShares.relay_signal(
          @room_id,
          socket.assigns.presence_key,
          target_peer,
          params
        )
      else
        {:error, :not_joined}
      end

    case result do
      :ok -> {:reply, %{ok: true}, socket}
      {:error, _reason} -> {:reply, %{ok: false}, socket}
    end
  end

  def handle_event("media_signal", _params, socket),
    do: {:reply, %{ok: false}, socket}

  def handle_event("start_private_message", %{"nickname" => nickname}, socket) do
    body = "^#{Chatlans.normalize_nickname(nickname, socket.assigns.nickname)}, "

    {:noreply,
     socket
     |> assign(:message_form, to_form(%{"body" => body}, as: :message))
     |> push_event("focus-message-input", %{})}
  end

  def handle_event("start_public_message", %{"nickname" => nickname}, socket) do
    body = "#{Chatlans.normalize_nickname(nickname, socket.assigns.nickname)}, "

    {:noreply,
     socket
     |> assign(:message_form, to_form(%{"body" => body}, as: :message))
     |> push_event("focus-message-input", %{})}
  end

  def handle_event("open_profile", %{"nickname" => nickname}, socket) do
    case Profiles.get_by_nickname(nickname) do
      {:ok, profile} ->
        editable? =
          socket.assigns.current_user && socket.assigns.current_user.id == profile.user_id

        {:noreply,
         socket
         |> assign(:profile, profile)
         |> assign(:profile_editable?, editable?)
         |> assign(:profile_form, to_form(Profiles.change_profile(profile)))}

      {:error, :not_found} ->
        profile = Profiles.guest_profile(nickname)

        {:noreply,
         socket
         |> assign(:profile, profile)
         |> assign(:profile_editable?, false)
         |> assign(:profile_form, to_form(Profiles.change_profile(profile)))}
    end
  end

  def handle_event("close_profile", _params, socket) do
    {:noreply, socket |> assign(:profile, nil) |> assign(:profile_form, nil)}
  end

  def handle_event("validate_profile", %{"profile" => params}, socket) do
    form =
      socket.assigns.profile
      |> Profiles.change_profile(params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, :profile_form, form)}
  end

  def handle_event("save_profile", %{"profile" => params}, socket) do
    with true <- socket.assigns.profile_editable?,
         {:ok, profile} <-
           Profiles.update_profile(socket.assigns.current_user, socket.assigns.profile, params),
         {:ok, profile} <- save_uploaded_photo(socket, profile) do
      {:noreply,
       socket
       |> assign(:profile, profile)
       |> assign(:profile_form, to_form(Profiles.change_profile(profile)))
       |> put_flash(:info, "Анкета сохранена.")}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :profile_form, to_form(changeset))}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось сохранить анкету.")}
    end
  end

  def handle_event("leave_chat", _params, socket) do
    if socket.assigns.joined? do
      :ok = broadcast_stopped_typing(socket)
      {:ok, _message} = Messages.announce_presence(socket.assigns.nickname, @room_id, :left)
      Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)
    end

    MediaShares.close_peer(@room_id, socket.assigns.presence_key)

    socket =
      socket
      |> close_visit()
      |> assign(:joined?, false)
      |> assign(:current_user, nil)
      |> assign(:profile, nil)
      |> assign(:settings_open?, false)
      |> assign(:screen, :login)
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign(:media_error, nil)
      |> assign_nickname_form()
      |> assign(:online, Chatlans.list_online(@room_id))
      |> assign(:typing_peers, %{})
      |> push_event("clear-user-auth", %{})

    {:noreply, socket}
  end

  def handle_event("toggle_settings", _params, socket) do
    {:noreply,
     socket
     |> assign(:settings_open?, !socket.assigns.settings_open?)
     |> assign_settings_form()}
  end

  def handle_event("preview_preferences", %{"preferences" => params}, socket) do
    {:noreply, assign_settings_draft(socket, params)}
  end

  def handle_event("load_preferences", params, socket) do
    old_nickname = socket.assigns.nickname

    socket =
      socket
      |> assign_preferences(params, allow_nickname?: true)
      |> assign(:preference_nickname, Chatlans.normalize_nickname(params["nickname"], nil))
      |> assign_nickname_form()
      |> assign_registration_form()
      |> assign_settings_form()
      |> update_presence(old_nickname)

    {:noreply, socket}
  end

  def handle_event("save_preferences", %{"preferences" => params}, socket) do
    case save_preferences(socket, params) do
      {:ok, socket} ->
        {:noreply,
         socket
         |> assign(:settings_open?, false)
         |> assign_settings_form()
         |> update_presence()
         |> rerender_messages()
         |> maybe_save_guest_preferences(socket.assigns.current_user)}

      {:error, changeset} ->
        {:noreply,
         socket
         |> assign_settings_draft(params)
         |> put_flash(:error, preferences_error(changeset))}
    end
  end

  @impl true
  def handle_async(:bot_reply, {:ok, {:ok, message}}, socket) do
    _message_was_broadcast_to_the_room = message
    {:noreply, socket |> assign(:bot_pending?, false) |> assign(:message_error, nil)}
  end

  def handle_async(:bot_reply, {:ok, {:error, :bot_busy}}, socket) do
    {:noreply, assign(socket, :bot_pending?, false)}
  end

  def handle_async(:bot_reply, _result, socket) do
    {:noreply,
     socket
     |> assign(:bot_pending?, false)
     |> assign(:message_error, "Хичкок сейчас не расположен к беседе. Попробуй немного позже.")}
  end

  @impl true
  def handle_info({:message_created, message}, socket) do
    {:noreply, insert_message(socket, message)}
  end

  def handle_info({:message_reacted, message}, socket) do
    {:noreply, insert_message(socket, message)}
  end

  def handle_info({:bot_status_changed, _status}, socket) do
    {:noreply, assign(socket, :online, Chatlans.list_online(@room_id))}
  end

  def handle_info({:start_bot_answer, request}, %{assigns: %{bot_pending?: true}} = socket) do
    {:noreply, start_async(socket, :bot_reply, fn -> Bot.answer(request) end)}
  end

  def handle_info({:start_bot_answer, _request}, socket), do: {:noreply, socket}

  def handle_info(
        {:typing_changed, peer_id, _nickname, _typing?},
        %{assigns: %{presence_key: peer_id}} = socket
      ),
      do: {:noreply, socket}

  def handle_info(
        {:typing_changed, peer_id, nickname, true},
        %{assigns: %{joined?: true}} = socket
      ) do
    {:noreply, update(socket, :typing_peers, &Map.put(&1, peer_id, nickname))}
  end

  def handle_info(
        {:typing_changed, peer_id, _nickname, false},
        %{assigns: %{joined?: true}} = socket
      ) do
    {:noreply, update(socket, :typing_peers, &Map.delete(&1, peer_id))}
  end

  def handle_info({:typing_changed, _peer_id, _nickname, _typing?}, socket),
    do: {:noreply, socket}

  def handle_info({:private_message_received, message}, %{assigns: %{joined?: true}} = socket) do
    {:noreply, insert_message(socket, message)}
  end

  def handle_info({:private_message_received, _message}, socket), do: {:noreply, socket}

  def handle_info({:media_announced, announcement}, %{assigns: %{joined?: true}} = socket) do
    {:noreply, insert_message(socket, announcement)}
  end

  def handle_info({:media_announced, _announcement}, socket), do: {:noreply, socket}

  def handle_info({:media_signal, signal}, %{assigns: %{joined?: true}} = socket) do
    {:noreply, push_event(socket, "media-signal", signal)}
  end

  def handle_info({:media_signal, _signal}, socket), do: {:noreply, socket}

  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff"}, socket) do
    online = Chatlans.list_online(@room_id)
    online_peer_ids = MapSet.new(online, & &1.peer_id)

    {:noreply,
     socket
     |> assign(:online, online)
     |> update(
       :typing_peers,
       &Map.filter(&1, fn {peer_id, _nickname} ->
         MapSet.member?(online_peer_ids, peer_id)
       end)
     )}
  end

  @impl true
  def terminate(_reason, socket) do
    if socket.assigns.joined? do
      :ok = broadcast_stopped_typing(socket)
      {:ok, _message} = Messages.announce_presence(socket.assigns.nickname, @room_id, :left)
    end

    MediaShares.close_peer(@room_id, socket.assigns.presence_key)

    socket.assigns
    |> Map.get(:visit)
    |> finish_visit()

    :ok
  end

  defp send_public_message(body, socket) do
    result =
      if socket.assigns.joined? do
        Messages.send_public_message(
          socket.assigns.nickname,
          @room_id,
          %{
            "body" => body,
            "theme_id" => socket.assigns.theme_id,
            "appearance" => socket.assigns.appearance
          },
          message_security_subject(socket)
        )
      else
        {:error, :not_joined}
      end

    case result do
      {:ok, message} ->
        socket = clear_message_input(socket)

        if message.recipient == Bot.name() do
          start_bot_reply(message.body, socket)
        else
          {:noreply, socket}
        end

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:message_error, message_error(reason))
         |> assign(:message_form, to_form(%{"body" => body}, as: :message))}
    end
  end

  defp send_private_message(body, socket) do
    case PrivateMessages.parse(%{"body" => body}) do
      {:ok, recipient, _private_body} ->
        if Bot.recipient?(recipient) do
          {:reply, %{ok: false},
           assign(socket, :message_error, "Хичкок отвечает только на публичные обращения.")}
        else
          send_chatlan_private_message(body, socket)
        end

      {:error, _reason} ->
        send_chatlan_private_message(body, socket)
    end
  end

  defp start_bot_reply(_body, %{assigns: %{bot_pending?: true}} = socket) do
    {:noreply, assign(socket, :message_error, "Дождись ответа Хичкока.")}
  end

  defp start_bot_reply(body, socket) do
    result =
      if Bot.available?() do
        with {:ok, question} <- Bot.addressed_body(body) do
          Bot.ask(
            socket.assigns.nickname,
            socket.assigns.current_user,
            message_security_subject(socket),
            question
          )
        end
      else
        {:error, :bot_busy}
      end

    case result do
      {:ok, request} ->
        Process.send_after(self(), {:start_bot_answer, request}, Bot.reply_delay_ms())

        socket =
          socket
          |> assign(:bot_pending?, true)
          |> assign(:message_error, nil)

        {:noreply, socket}

      {:error, reason} ->
        error = if reason == :bot_busy, do: nil, else: message_error(reason)
        {:noreply, assign(socket, :message_error, error)}
    end
  end

  defp send_chatlan_private_message(body, socket) do
    result =
      if socket.assigns.joined? do
        PrivateMessages.send_private_message(
          socket.assigns.nickname,
          socket.assigns.presence_key,
          @room_id,
          %{
            "body" => body,
            "theme_id" => socket.assigns.theme_id,
            "appearance" => socket.assigns.appearance
          },
          message_security_subject(socket)
        )
      else
        {:error, :not_joined}
      end

    case result do
      {:ok, _message} ->
        {:reply, %{ok: true}, clear_message_input(socket)}

      {:error, reason} ->
        {:reply, %{ok: false}, assign(socket, :message_error, private_message_error(reason))}
    end
  end

  defp assign_preferences(socket, params, opts \\ []) do
    theme_id = Themes.normalize_theme_id(params["theme_id"], socket.assigns.theme_id)
    appearance = Appearance.from_params(params, socket.assigns.appearance)

    socket =
      if Keyword.get(opts, :allow_nickname?, false) do
        assign(
          socket,
          :nickname,
          Chatlans.normalize_nickname(params["nickname"], socket.assigns.nickname)
        )
      else
        socket
      end

    socket
    |> assign(:theme_id, theme_id)
    |> assign(:appearance, appearance)
    |> assign_active_colors()
  end

  defp assign_settings_form(socket) do
    socket
    |> assign(:settings_theme_id, socket.assigns.theme_id)
    |> assign(:settings_appearance, socket.assigns.appearance)
    |> assign(:settings_form, to_form(public_preferences(socket), as: :preferences))
  end

  defp assign_settings_draft(socket, params) do
    theme_id = Themes.normalize_theme_id(params["theme_id"], socket.assigns.theme_id)
    appearance = Appearance.from_params(params, socket.assigns.appearance)

    preferences = %{
      "nickname" => socket.assigns.nickname,
      "theme_id" => theme_id,
      "appearance" => appearance
    }

    socket
    |> assign(:settings_theme_id, theme_id)
    |> assign(:settings_appearance, appearance)
    |> assign(:settings_form, to_form(preferences, as: :preferences))
  end

  defp assign_nickname_form(socket) do
    assign(
      socket,
      :nickname_form,
      to_form(%{"nickname" => socket.assigns.nickname, "password" => ""}, as: :entrance)
    )
  end

  defp assign_registration_form(socket) do
    assign(
      socket,
      :registration_form,
      to_form(%{"nickname" => socket.assigns.nickname, "password" => ""}, as: :registration)
    )
  end

  defp public_preferences(socket) do
    %{
      "nickname" => socket.assigns.nickname,
      "theme_id" => socket.assigns.theme_id,
      "appearance" => socket.assigns.appearance
    }
  end

  defp track_presence(socket) do
    Chatlans.track(
      self(),
      @room_id,
      socket.assigns.presence_key,
      public_appearance(socket)
    )
  end

  defp update_presence(socket, old_nickname \\ nil) do
    if connected?(socket) && socket.assigns.joined? do
      if old_nickname && old_nickname != socket.assigns.nickname do
        Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)
        track_presence(socket)
      else
        Chatlans.update(
          self(),
          @room_id,
          socket.assigns.presence_key,
          public_appearance(socket)
        )
      end
    end

    assign(socket, :online, Chatlans.list_online(@room_id))
  end

  defp reset_colors_for_new_nickname(socket, nickname) do
    if socket.assigns.preference_nickname in [nil, nickname] do
      socket
    else
      socket
      |> assign(:appearance, Appearance.default())
      |> assign(:theme_id, Themes.default_theme_id())
      |> assign_active_colors()
      |> assign(:preference_nickname, nil)
    end
  end

  defp apply_registered_preferences(socket, nil), do: socket

  defp apply_registered_preferences(socket, user) do
    socket
    |> assign_preferences(Accounts.user_preferences(user))
    |> assign(:preference_nickname, user.nickname)
  end

  defp save_preferences(%{assigns: %{current_user: nil}} = socket, params) do
    {:ok, assign_preferences(socket, params)}
  end

  defp save_preferences(socket, params) do
    case Accounts.update_preferences(socket.assigns.current_user, params) do
      {:ok, user} ->
        {:ok,
         socket
         |> assign(:current_user, user)
         |> assign_preferences(Accounts.user_preferences(user))}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp maybe_save_guest_preferences(socket, nil) do
    push_event(socket, "save-chat-preferences", public_preferences(socket))
  end

  defp maybe_save_guest_preferences(socket, _user), do: socket

  defp rerender_messages(socket) do
    Enum.reduce(socket.assigns.message_items, socket, fn message, socket ->
      stream_insert(socket, :messages, message)
    end)
  end

  defp reset_messages(socket, messages) do
    socket
    |> assign(:message_items, messages)
    |> stream(:messages, messages, reset: true)
  end

  defp insert_message(socket, message) do
    messages =
      case Enum.find_index(
             socket.assigns.message_items,
             &(to_string(&1.id) == to_string(message.id))
           ) do
        nil -> socket.assigns.message_items ++ [message]
        index -> List.replace_at(socket.assigns.message_items, index, message)
      end

    socket
    |> assign(:message_items, messages)
    |> stream_insert(:messages, message)
  end

  defp preferences_error(%Ecto.Changeset{}), do: "Не удалось сохранить настройки."

  defp public_appearance(socket) do
    Chatlans.appearance_attrs(
      socket.assigns.nickname,
      socket.assigns.theme_id,
      socket.assigns.appearance,
      registered?: not is_nil(socket.assigns.current_user)
    )
  end

  defp assign_active_colors(socket) do
    assign(socket, :theme_mode, Themes.mode_for_theme(socket.assigns.theme_id))
  end

  defp entrance_error(:not_found), do: "Такой ник не зарегистрирован."

  defp entrance_error(:nickname_online),
    do: "Этот ник уже используется в чате. Выбери другой."

  defp entrance_error(:invalid_nickname),
    do: "Введи ник из 3–24 букв, цифр, _ или -."

  defp entrance_error(:invalid_password), do: "Неверный пароль."

  defp entrance_error(:password_required),
    do: "Этот ник зарегистрирован. Введи пароль, чтобы войти."

  defp entrance_error(_reason), do: "Не удалось войти с этим ником и паролем."

  defp registration_error(%Ecto.Changeset{} = changeset) do
    cond do
      Keyword.has_key?(changeset.errors, :nickname) ->
        "Ник должен быть свободным и состоять из 3–24 букв, цифр, _ или -."

      Keyword.has_key?(changeset.errors, :password) ->
        "Пароль должен быть не короче 6 символов."

      true ->
        "Не удалось зарегистрироваться."
    end
  end

  defp registration_error(:rate_limited) do
    "С этого адреса уже создавали аккаунт. Повторная регистрация доступна через сутки."
  end

  defp message_security_subject(socket) do
    ClientSecurity.for_user(socket.assigns.security_subject, socket.assigns.current_user)
  end

  defp reaction_actor_key(socket), do: socket.assigns.presence_key

  defp message_error(:rate_limited), do: "Слишком часто. Подожди немного перед отправкой."
  defp message_error(:message_too_long), do: "Сообщение не должно превышать 1000 символов."
  defp message_error(:empty_body), do: "Нельзя отправить пустое сообщение."
  defp message_error(_reason), do: "Не удалось отправить сообщение."

  defp private_message_error(:private_recipient_required),
    do: "Укажи адресата: ^ник, сообщение или ник, сообщение."

  defp private_message_error(:recipient_offline), do: "Получатель уже вышел из чата."

  defp private_message_error(:ambiguous_recipient),
    do: "В чате несколько участников с таким ником."

  defp private_message_error(:self_recipient),
    do: "Нельзя отправить личное сообщение самому себе."

  defp private_message_error(reason), do: message_error(reason)

  defp clear_message_input(socket) do
    :ok = broadcast_stopped_typing(socket)

    socket
    |> assign(:message_error, nil)
    |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
    |> push_event("clear-message-input", %{})
  end

  defp broadcast_stopped_typing(socket) do
    Chatlans.broadcast_typing(
      @room_id,
      socket.assigns.presence_key,
      socket.assigns.nickname,
      false
    )
  end

  defp media_error(:registration_required),
    do: "Отправлять файлы могут только зарегистрированные чатлане."

  defp media_error(:invalid_content_type), do: "Можно выбрать изображение или аудиофайл."
  defp media_error(:invalid_image_size), do: "Размер изображения не должен превышать 5 МБ."
  defp media_error(:invalid_audio_size), do: "Размер аудиофайла не должен превышать 50 МБ."
  defp media_error(:rate_limited), do: "Слишком много вложений. Попробуй позже."
  defp media_error(:share_unavailable), do: "Файл больше недоступен."
  defp media_error(_reason), do: "Не удалось отправить файл."

  defp save_uploaded_photo(socket, profile) do
    case uploaded_entries(socket, :profile_photo) do
      {[], []} ->
        {:ok, profile}

      {[_entry], []} ->
        [result] =
          consume_uploaded_entries(socket, :profile_photo, fn %{path: path}, upload_entry ->
            bytes = File.read!(path)
            {:ok, {bytes, upload_entry.client_type}}
          end)

        {bytes, content_type} = result
        Profiles.put_photo(socket.assigns.current_user, profile, bytes, content_type)

      _entries ->
        {:error, :invalid_photo}
    end
  end

  defp sync_user_auth(socket, nil), do: push_event(socket, "clear-user-auth", %{})

  defp sync_user_auth(socket, user) do
    push_event(socket, "save-user-auth", %{token: UserAuth.sign(user)})
  end

  defp close_visit(socket) do
    socket.assigns
    |> Map.get(:visit)
    |> finish_visit()

    assign(socket, :visit, nil)
  end

  defp finish_visit(nil), do: :ok

  defp finish_visit(visit) do
    case Visits.finish_visit(visit) do
      {:ok, _visit} -> :ok
      {:error, _changeset} -> :error
    end
  end
end
