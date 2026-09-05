# Назначение файла: LiveView общей комнаты чата, связывает UI, Presence и контекст сообщений.
defmodule ChatWeb.RoomLive do
  use ChatWeb, :live_view

  require Logger

  alias Chat.Accounts
  alias Chat.Appearance
  alias Chat.Bot
  alias Chat.Chatlans
  alias Chat.Commands
  alias Chat.Drawings
  alias Chat.Feedback
  alias Chat.Gifs
  alias Chat.MediaShares
  alias Chat.Music
  alias Chat.Messages
  alias Chat.Profiles
  alias Chat.PrivateMessages
  alias Chat.Themes
  alias Chat.Typography
  alias Chat.Ranks
  alias Chat.Visits
  alias ChatWeb.AuthComponents
  alias ChatWeb.ClientSecurity
  alias ChatWeb.RoomComponents
  alias ChatWeb.ShellComponents
  alias ChatWeb.UserAuth

  @room_id "lobby"
  @music_page_size 5

  @impl true
  def mount(_params, _session, socket) do
    presence_key = Chatlans.guest_presence_key()
    security_subject = ClientSecurity.subject_from_socket(socket, presence_key)
    messages = Messages.list_recent_messages(@room_id)

    socket =
      socket
      |> assign(:nickname, nil)
      |> assign(:presence_key, presence_key)
      |> assign(:chat_session_token, nil)
      |> assign(:chat_session_id, nil)
      |> assign(:identity_key, nil)
      |> assign(:guest_identity_token, nil)
      |> assign(:security_subject, security_subject)
      |> assign(:preference_nickname, nil)
      |> assign(:theme_id, Themes.default_theme_id())
      |> assign(:themes, Themes.list())
      |> assign(:theme_modes, Themes.list_modes())
      |> assign(:font_id, Typography.default_font_id())
      |> assign(:fonts, Typography.list())
      |> assign(:font_style, Typography.default_font_style())
      |> assign(:font_styles, Typography.list_styles())
      |> assign(:message_sound_enabled, false)
      |> assign(:appearance, Appearance.default())
      |> assign_active_colors()
      |> assign(:joined?, false)
      |> assign(:visit, nil)
      |> assign(:current_user, nil)
      |> assign(:profile, nil)
      |> assign(:profile_form, nil)
      |> assign(:profile_editable?, false)
      |> assign(:profile_editing?, false)
      |> assign(:settings_open?, false)
      |> assign(:screen, :login)
      |> assign(:entrance_error, nil)
      |> assign(:registration_error, nil)
      |> assign(:registration_open?, false)
      |> assign(:feedback_open?, false)
      |> assign(:message_error, nil)
      |> assign(:media_error, nil)
      |> assign(:online, [])
      |> assign(:typing_peers, %{})
      |> assign(:bot_pending?, false)
      |> assign(:music_pending?, false)
      |> assign(:music_results, [])
      |> assign(:music_page, 1)
      |> assign(:music_search_message_id, nil)
      |> assign(:gif_pending?, false)
      |> assign(:gif_results, [])
      |> assign(:gif_search_message_id, nil)
      |> assign(:ignored_nicknames, MapSet.new())
      |> assign(:message_items, messages)
      |> assign(:all_message_items, messages)
      |> assign_nickname_form()
      |> assign_registration_form()
      |> assign_feedback_form()
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
        Drawings.subscribe(@room_id)
        PrivateMessages.subscribe(presence_key)
        MediaShares.subscribe_peer(@room_id, presence_key)

        socket
        |> restore_connection_session()
        |> assign(:online, Chatlans.list_online(@room_id))
      else
        socket
      end

    {:ok, socket}
  end

  @impl true
  def handle_event("enter_chat", %{"entrance" => params}, socket) do
    nickname = Chatlans.normalize_nickname(params["nickname"], nil)
    log_entrance_attempt(nickname, params["password"])

    with {:ok, user} <- Accounts.authorize_entrance(nickname, params["password"]),
         {identity_key, guest_identity_token} <- identity_for_entrance(user, nickname),
         :ok <- Chatlans.ensure_nickname_available(@room_id, nickname, nil, nil, identity_key),
         session_token = UserAuth.sign_chat_session(nickname),
         {:ok, session_id} <- UserAuth.verify_chat_session(session_token, nickname),
         {:ok, visit} <-
           Visits.start_visit(user || nickname, DateTime.utc_now(),
             session_id: session_id,
             identity_key: identity_key
           ) do
      socket =
        socket
        |> assign(:nickname, nickname)
        |> assign(:current_user, user)
        |> assign(:chat_session_token, session_token)
        |> assign(:chat_session_id, session_id)
        |> assign(:identity_key, identity_key)
        |> assign(:guest_identity_token, guest_identity_token)
        |> assign(:visit, visit)
        |> assign(:entrance_error, nil)
        |> reset_colors_for_new_nickname(nickname)
        |> apply_registered_preferences(user)
        |> assign(:joined?, true)
        |> assign_nickname_form()
        |> assign_settings_form()
        |> reset_messages(Messages.list_recent_messages(@room_id))
        |> insert_features_notice()

      track_presence(socket)
      {:ok, _message} = Messages.announce_presence(nickname, @room_id, :joined)

      log_session("entered", socket)

      {:noreply,
       socket
       |> assign(:online, Chatlans.list_online(@room_id))
       |> maybe_save_guest_preferences(user)
       |> sync_user_auth(user)
       |> push_event("focus-message-input", %{})}
    else
      {:error, %Ecto.Changeset{}} ->
        log_entrance_failure(nickname, :visit_persist_failed)

        {:noreply,
         socket
         |> assign(:nickname, nickname)
         |> assign(:entrance_error, "Не удалось сохранить вход. Попробуй ещё раз.")
         |> assign_nickname_form()}

      {:error, reason} ->
        log_entrance_failure(nickname, reason)

        {:noreply,
         socket
         |> assign(:nickname, nickname)
         |> assign(:entrance_error, entrance_error(reason))
         |> assign_nickname_form()}
    end
  end

  def handle_event("touch_chat_session", _params, %{assigns: %{joined?: true}} = socket) do
    {:noreply, renew_chat_session(socket)}
  end

  def handle_event("touch_chat_session", _params, socket), do: {:noreply, socket}

  def handle_event("show_registration", _params, socket) do
    socket =
      socket
      |> assign(:entrance_error, nil)
      |> assign(:registration_error, nil)
      |> assign_registration_form()

    if socket.assigns.joined? do
      {:noreply, assign(socket, :registration_open?, true)}
    else
      {:noreply, assign(socket, :screen, :registration)}
    end
  end

  def handle_event("close_registration", _params, socket) do
    {:noreply,
     socket
     |> assign(:registration_open?, false)
     |> assign(:registration_error, nil)}
  end

  def handle_event("show_login", _params, socket) do
    {:noreply,
     socket
     |> assign(:screen, :login)
     |> assign(:registration_error, nil)
     |> assign_nickname_form()}
  end

  def handle_event("show_feedback", _params, socket) do
    {:noreply, socket |> assign(:feedback_open?, true) |> assign_feedback_form()}
  end

  def handle_event("close_feedback", _params, socket) do
    {:noreply, socket |> assign(:feedback_open?, false) |> assign_feedback_form()}
  end

  def handle_event("validate_feedback", %{"feedback" => params}, socket) do
    form =
      socket.assigns.current_user
      |> Feedback.change_entry(params)
      |> Map.put(:action, :validate)
      |> to_form(as: :feedback)

    {:noreply, assign(socket, :feedback_form, form)}
  end

  def handle_event("submit_feedback", %{"feedback" => params}, socket) do
    case Feedback.submit(socket.assigns.current_user, params, socket.assigns.security_subject) do
      {:ok, _entry} ->
        {:noreply,
         socket
         |> assign(:feedback_open?, false)
         |> assign_feedback_form()
         |> put_flash(:info, "Спасибо! Пожелание отправлено.")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :feedback_form, to_form(changeset, as: :feedback))}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, feedback_error(reason))}
    end
  end

  def handle_event("register_user", %{"registration" => params}, socket) do
    params =
      if socket.assigns.joined? do
        Map.put(params, "nickname", socket.assigns.nickname)
      else
        params
      end

    case Accounts.register_user(params, socket.assigns.security_subject) do
      {:ok, user} ->
        if socket.assigns.joined? do
          {:noreply,
           socket
           |> assign(:current_user, user)
           |> assign(:registration_open?, false)
           |> assign(:registration_error, nil)
           |> assign_registration_form()
           |> update_presence()
           |> sync_user_auth(user)
           |> push_event("enable-media-sharing", %{})
           |> put_flash(:info, "Регистрация завершена. Теперь доступны все возможности чата.")}
        else
          {:noreply,
           socket
           |> assign(:nickname, user.nickname)
           |> assign(:screen, :login)
           |> assign(:registration_error, nil)
           |> assign(:entrance_error, "Регистрация завершена. Теперь введи пароль и войди.")
           |> assign_nickname_form()
           |> assign_registration_form()}
        end

      {:error, changeset} ->
        {:noreply,
         socket
         |> assign(:registration_error, registration_error(changeset))
         |> assign(:registration_form, to_form(params, as: :registration))}
    end
  end

  def handle_event("send_message", %{"message" => %{"body" => body}}, socket) do
    case execute_command(body, socket) do
      {:handled, result} ->
        result

      :not_a_command ->
        if PrivateMessages.private_syntax?(body) do
          send_private_message(body, socket)
        else
          send_public_message(body, socket)
        end
    end
  end

  def handle_event("draw_segment", params, %{assigns: %{joined?: true}} = socket) do
    _result = Drawings.broadcast_segment(@room_id, socket.assigns.nickname, params)
    {:noreply, socket}
  end

  def handle_event("draw_segment", _params, socket), do: {:noreply, socket}

  def handle_event("send_private_message", %{"body" => body}, socket) do
    send_private_message(body, socket)
  end

  def handle_event("send_private_message", _params, socket) do
    {:reply, %{ok: false}, assign(socket, :message_error, "Сообщение имеет неверный формат.")}
  end

  def handle_event("send_gif", %{"id" => id}, %{assigns: %{joined?: true}} = socket) do
    case Enum.find(socket.assigns.gif_results, &(&1.id == id)) do
      nil ->
        {:noreply,
         assign(socket, :message_error, "Эта GIF больше недоступна. Выполни поиск ещё раз.")}

      gif ->
        send_chatlan_gif(gif, socket)
    end
  end

  def handle_event("send_gif", _params, socket), do: {:noreply, socket}

  def handle_event("send_music", %{"id" => id}, %{assigns: %{joined?: true}} = socket) do
    case Enum.find(socket.assigns.music_results, &(to_string(&1.id) == id)) do
      nil ->
        {:noreply,
         assign(socket, :message_error, "Этот трек больше недоступен. Выполни поиск ещё раз.")}

      track ->
        send_chatlan_music(track, socket)
    end
  end

  def handle_event("send_music", _params, socket), do: {:noreply, socket}

  def handle_event("dismiss_gif_search", _params, socket) do
    {:noreply,
     socket
     |> cancel_async(:gif_search)
     |> assign(:gif_pending?, false)
     |> assign(:gif_results, [])
     |> remove_gif_search_result()}
  end

  def handle_event("dismiss_music_search", _params, socket) do
    {:noreply,
     socket
     |> cancel_async(:music_search)
     |> assign(:music_pending?, false)
     |> assign(:music_results, [])
     |> assign(:music_page, 1)
     |> remove_music_search_result()}
  end

  def handle_event("change_music_page", %{"page" => page}, %{assigns: %{joined?: true}} = socket) do
    case music_page(page, socket.assigns.music_results) do
      nil ->
        {:noreply, socket}

      page ->
        {:noreply,
         socket
         |> assign(:music_page, page)
         |> replace_music_search_result(
           "Музыка",
           "Выбери трек для общей комнаты.",
           socket.assigns.music_results,
           page
         )}
    end
  end

  def handle_event("change_music_page", _params, socket), do: {:noreply, socket}

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
    {:noreply, open_profile(socket, nickname)}
  end

  def handle_event("close_profile", _params, socket) do
    {:noreply,
     socket
     |> assign(:profile, nil)
     |> assign(:profile_form, nil)
     |> assign(:profile_editing?, false)}
  end

  def handle_event("edit_profile", _params, %{assigns: %{profile_editable?: true}} = socket) do
    {:noreply, assign(socket, :profile_editing?, true)}
  end

  def handle_event("edit_profile", _params, socket), do: {:noreply, socket}

  def handle_event("cancel_profile_edit", _params, socket) do
    {:noreply,
     socket
     |> assign(:profile_editing?, false)
     |> assign(:profile_form, to_form(Profiles.change_profile(socket.assigns.profile)))}
  end

  def handle_event(
        "validate_profile",
        %{"profile" => params},
        %{assigns: %{profile_editable?: true, profile_editing?: true}} = socket
      ) do
    form =
      socket.assigns.profile
      |> Profiles.change_profile(params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, :profile_form, form)}
  end

  def handle_event("validate_profile", _params, socket), do: {:noreply, socket}

  def handle_event("save_profile", %{"profile" => params}, socket) do
    with true <- socket.assigns.profile_editable?,
         true <- socket.assigns.profile_editing?,
         {:ok, profile} <-
           Profiles.update_profile(socket.assigns.current_user, socket.assigns.profile, params),
         {:ok, profile} <- save_uploaded_photo(socket, profile) do
      {:noreply,
       socket
       |> assign(:profile, profile)
       |> assign(:profile_form, to_form(Profiles.change_profile(profile)))
       |> assign(:profile_editing?, false)
       |> put_flash(:info, "Анкета сохранена.")}
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, assign(socket, :profile_form, to_form(changeset))}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось сохранить анкету.")}
    end
  end

  def handle_event("leave_chat", _params, socket) do
    {:noreply, leave_chat(socket)}
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

  def handle_event("load_preferences", _params, %{assigns: %{current_user: %{} = _user}} = socket) do
    {:noreply, socket}
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

  defp restore_user_session(_token, _session_token, %{assigns: %{joined?: true}} = socket),
    do: socket

  defp restore_user_session(token, session_token, socket) do
    with {:ok, user} <- UserAuth.verify(token),
         {:ok, session_id} <- UserAuth.verify_chat_session(session_token, user.nickname),
         {:ok, restored} <-
           Chatlans.restore_session(
             @room_id,
             user.nickname,
             socket.assigns.presence_key,
             nil,
             session_id: session_id,
             identity_key: Visits.user_identity_key(user)
           ),
         {:ok, visit} <-
           Visits.start_visit(user, DateTime.utc_now(), session_id: session_id) do
      socket =
        socket
        |> assign(:nickname, restored.nickname)
        |> assign(:presence_key, restored.presence_key)
        |> assign(:chat_session_token, session_token)
        |> assign(:chat_session_id, session_id)
        |> assign(:identity_key, Visits.user_identity_key(user))
        |> assign(:guest_identity_token, nil)
        |> assign(:current_user, user)
        |> assign(:visit, visit)
        |> assign(:entrance_error, nil)
        |> apply_registered_preferences(user)
        |> assign(:joined?, true)
        |> assign_nickname_form()
        |> assign_settings_form()

      track_presence(socket)

      log_session("restored_registered", socket)

      socket
      |> assign(:online, Chatlans.list_online(@room_id))
      |> sync_user_auth(user)
      |> push_event("focus-message-input", %{})
    else
      reason ->
        Logger.warning(
          "session_restore_failed kind=registered reason=#{session_failure_reason(reason)}"
        )

        socket
    end
  end

  defp restore_guest_session(_params, %{assigns: %{joined?: true}} = socket), do: socket

  defp restore_guest_session(params, socket) do
    nickname = Chatlans.normalize_nickname(params["nickname"], nil)

    with nickname when not is_nil(nickname) <- nickname,
         {:ok, identity_key, guest_identity_token} <- guest_identity_from_params(params, nickname),
         session_token = session_token_for_restore(params["session_token"], nickname),
         {:ok, session_id} <- UserAuth.verify_chat_session(session_token, nickname),
         {:ok, restored} <-
           Chatlans.restore_session(
             @room_id,
             nickname,
             socket.assigns.presence_key,
             nil,
             guest?: true,
             session_id: session_id,
             identity_key: identity_key
           ),
         {:ok, visit} <-
           Visits.start_visit(restored.nickname, DateTime.utc_now(),
             session_id: session_id,
             identity_key: identity_key
           ) do
      socket =
        socket
        |> assign(:nickname, restored.nickname)
        |> assign(:presence_key, restored.presence_key)
        |> assign(:chat_session_token, session_token)
        |> assign(:chat_session_id, session_id)
        |> assign(:identity_key, identity_key)
        |> assign(:guest_identity_token, guest_identity_token)
        |> assign(:visit, visit)
        |> assign(:entrance_error, nil)
        |> assign_preferences(params, allow_nickname?: true)
        |> assign(:preference_nickname, restored.nickname)
        |> assign(:joined?, true)
        |> assign_nickname_form()
        |> assign_settings_form()

      track_presence(socket)

      log_session("restored_guest", socket)

      socket
      |> assign(:online, Chatlans.list_online(@room_id))
      |> maybe_save_guest_preferences(nil)
      |> push_event("focus-message-input", %{})
    else
      reason ->
        Logger.warning(
          "session_restore_failed kind=guest reason=#{session_failure_reason(reason)}"
        )

        socket
    end
  end

  defp restore_connection_session(socket) do
    case get_connect_params(socket) || %{} do
      %{"user_auth_token" => token, "chat_session_token" => session_token}
      when is_binary(token) and is_binary(session_token) ->
        restore_user_session(token, session_token, socket)

      %{
        "guest_nickname" => nickname,
        "theme_id" => theme_id,
        "appearance" => appearance
      } = params
      when is_binary(nickname) ->
        restore_guest_session(
          %{
            "nickname" => nickname,
            "session_token" => Map.get(params, "guest_session_token"),
            "identity_token" => Map.get(params, "guest_identity_token"),
            "theme_id" => theme_id,
            "appearance" => appearance,
            "font_id" => Map.get(params, "font_id"),
            "font_style" => Map.get(params, "font_style"),
            "message_sound_enabled" => Map.get(params, "message_sound_enabled")
          },
          socket
        )

      _ ->
        socket
    end
  end

  defp identity_for_entrance(%{} = user, _nickname),
    do: {Visits.user_identity_key(user), nil}

  defp identity_for_entrance(nil, nickname) do
    identity_id = Ecto.UUID.generate()
    {Visits.guest_identity_key(identity_id), UserAuth.sign_guest_identity(nickname, identity_id)}
  end

  defp guest_identity_from_params(params, nickname) do
    case UserAuth.verify_guest_identity(params["identity_token"], nickname) do
      {:ok, identity_id} ->
        {:ok, Visits.guest_identity_key(identity_id), params["identity_token"]}

      {:error, :invalid_identity} ->
        with {:ok, session_id} <- UserAuth.verify_chat_session(params["session_token"], nickname) do
          {:ok, Visits.guest_identity_key(session_id),
           UserAuth.sign_guest_identity(nickname, session_id)}
        end
    end
  end

  defp session_token_for_restore(session_token, nickname) do
    case UserAuth.verify_chat_session(session_token, nickname) do
      {:ok, _session_id} -> session_token
      {:error, :invalid_session} -> UserAuth.sign_chat_session(nickname)
    end
  end

  defp leave_chat(socket) do
    guest? = is_nil(socket.assigns.current_user)

    if socket.assigns.joined? do
      log_session("leave_requested", socket)
      :ok = broadcast_stopped_typing(socket)

      Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)

      :ok =
        Chatlans.announce_departure(
          @room_id,
          socket.assigns.nickname,
          socket.assigns.identity_key
        )
    end

    MediaShares.close_peer(@room_id, socket.assigns.presence_key)

    socket
    |> cancel_async(:music_search)
    |> cancel_async(:gif_search)
    |> close_visit()
    |> assign(:joined?, false)
    |> assign(:chat_session_token, nil)
    |> assign(:chat_session_id, nil)
    |> assign(:identity_key, nil)
    |> assign(:guest_identity_token, nil)
    |> assign(:current_user, nil)
    |> assign(:profile, nil)
    |> assign(:settings_open?, false)
    |> assign(:registration_open?, false)
    |> assign(:feedback_open?, false)
    |> assign(:screen, :login)
    |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
    |> assign(:media_error, nil)
    |> assign_nickname_form()
    |> assign(:online, Chatlans.list_online(@room_id))
    |> assign(:typing_peers, %{})
    |> assign(:music_pending?, false)
    |> assign(:music_results, [])
    |> assign(:music_page, 1)
    |> assign(:music_search_message_id, nil)
    |> assign(:gif_pending?, false)
    |> assign(:gif_results, [])
    |> assign(:gif_search_message_id, nil)
    |> push_event("clear-user-auth", %{})
    |> maybe_clear_guest_session(guest?)
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

  def handle_async(:music_search, _result, %{assigns: %{music_search_message_id: nil}} = socket) do
    {:noreply, assign(socket, :music_pending?, false)}
  end

  def handle_async(:music_search, {:ok, {:ok, tracks}}, %{assigns: %{joined?: true}} = socket) do
    entries = music_entries(tracks)

    {:noreply,
     socket
     |> assign(:music_pending?, false)
     |> assign(:music_results, entries)
     |> assign(:music_page, 1)
     |> assign(:message_error, nil)
     |> replace_music_search_result(
       "Музыка",
       "Выбери трек для общей комнаты.",
       entries,
       1
     )}
  end

  def handle_async(:music_search, _result, %{assigns: %{joined?: false}} = socket) do
    {:noreply, assign(socket, :music_pending?, false)}
  end

  def handle_async(:music_search, {:ok, {:error, :not_found}}, socket) do
    {:noreply,
     socket
     |> assign(:music_pending?, false)
     |> replace_music_search_result("Музыка", "Ничего не найдено. Попробуй другой запрос.")}
  end

  def handle_async(:music_search, {:ok, {:error, :query_too_long}}, socket) do
    {:noreply,
     socket
     |> assign(:music_pending?, false)
     |> replace_music_search_result("Поиск музыки", "Запрос слишком длинный.")}
  end

  def handle_async(:music_search, _result, socket) do
    {:noreply,
     socket
     |> assign(:music_pending?, false)
     |> replace_music_search_result("Поиск музыки", "Не удалось найти музыку. Попробуй ещё раз.")}
  end

  def handle_async(:gif_search, _result, %{assigns: %{gif_search_message_id: nil}} = socket) do
    {:noreply, assign(socket, :gif_pending?, false)}
  end

  def handle_async(:gif_search, {:ok, {:ok, gifs}}, %{assigns: %{joined?: true}} = socket) do
    {:noreply,
     socket
     |> assign(:gif_pending?, false)
     |> assign(:gif_results, gifs)
     |> assign(:message_error, nil)
     |> replace_gif_search_result(
       "GIF",
       "Выбери GIF — она будет отправлена в общую комнату.",
       gif_entries(gifs)
     )}
  end

  def handle_async(:gif_search, _result, %{assigns: %{joined?: false}} = socket) do
    {:noreply, socket |> assign(:gif_pending?, false) |> assign(:gif_results, [])}
  end

  def handle_async(:gif_search, {:ok, {:error, :not_found}}, socket) do
    {:noreply,
     socket
     |> assign(:gif_pending?, false)
     |> assign(:gif_results, [])
     |> replace_gif_search_result("GIF", "Ничего не найдено. Попробуй другой запрос.")}
  end

  def handle_async(:gif_search, {:ok, {:error, :query_too_long}}, socket) do
    {:noreply,
     socket
     |> assign(:gif_pending?, false)
     |> replace_gif_search_result("Поиск GIF", "Запрос слишком длинный.")}
  end

  def handle_async(:gif_search, _result, socket) do
    {:noreply,
     socket
     |> assign(:gif_pending?, false)
     |> replace_gif_search_result("Поиск GIF", "Не удалось найти GIF. Попробуй ещё раз.")}
  end

  @impl true
  def handle_info({:message_created, message}, socket) do
    {:noreply, socket |> insert_message(message) |> maybe_notify_about_message(message)}
  end

  def handle_info({:message_reacted, message}, socket) do
    {:noreply, insert_message(socket, message)}
  end

  def handle_info({:drawing_segment, segment}, %{assigns: %{joined?: true}} = socket) do
    {:noreply, push_event(socket, "drawing-segment", segment)}
  end

  def handle_info({:drawing_segment, _segment}, socket), do: {:noreply, socket}

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
    {:noreply, socket |> insert_message(message) |> maybe_notify_about_message(message)}
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
      log_session("connection_terminated", socket)
      :ok = broadcast_stopped_typing(socket)
      Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)

      :ok =
        Chatlans.schedule_departure(
          @room_id,
          socket.assigns.nickname,
          socket.assigns.identity_key
        )
    end

    MediaShares.close_peer(@room_id, socket.assigns.presence_key)

    :ok
  end

  defp send_public_message(body, socket) do
    result =
      if socket.assigns.joined? do
        send_chatlan_public_message(body, socket)
      else
        {:error, :not_joined}
      end

    case result do
      {:ok, message, user} ->
        socket =
          socket
          |> assign(:current_user, user)
          |> insert_message(message)
          |> clear_message_input()
          |> update_presence()

        if message.recipient == Bot.name() do
          start_bot_reply(message.body, socket)
        else
          {:noreply, socket}
        end

      {:ok, message} ->
        socket = socket |> insert_message(message) |> clear_message_input()

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

  defp execute_command(body, socket) do
    case Commands.parse(body) do
      :not_command ->
        :not_a_command

      {:ok, :help} ->
        {:handled,
         {:noreply,
          socket
          |> insert_command_result(:help, "Команды", "Доступные текстовые команды:", [
            %{label: "/помощь", description: "список команд"},
            %{label: "/кто", description: "первые 10 чатлан онлайн"},
            %{label: "/выход", description: "выйти из чата"},
            %{label: "/инфо ник", description: "открыть анкету"},
            %{label: "/игнор ник", description: "скрыть или вернуть сообщения"},
            %{label: "/игноры", description: "показать список игноров"},
            %{label: "/музыка запрос", description: "найти трек и открыть плеер"},
            %{label: "/гиф запрос", description: "найти и отправить GIF"},
            %{label: "/очистить", description: "очистить окно чата только у себя"}
          ])
          |> clear_message_input()}}

      {:ok, :who} ->
        chatlans = socket.assigns.online |> Enum.take(10) |> Enum.map(& &1.nickname)

        body =
          if chatlans == [],
            do: "Сейчас никого нет онлайн.",
            else: "Нажми на ник, чтобы обратиться к чатланину."

        {:handled,
         {:noreply,
          socket
          |> insert_command_result(
            :who,
            "Сейчас онлайн",
            body,
            Enum.map(chatlans, &%{nickname: &1})
          )
          |> clear_message_input()}}

      {:ok, :exit} ->
        {:handled, {:noreply, leave_chat(socket)}}

      {:ok, :clear} ->
        {:handled, {:noreply, socket |> clear_message_frame() |> clear_message_input()}}

      {:ok, {:info, nickname}} ->
        {:handled,
         {:noreply,
          socket
          |> open_profile(nickname)
          |> insert_command_result(:info, "Анкета", "Открыта анкета чатланина #{nickname}.")
          |> clear_message_input()}}

      {:ok, {:toggle_ignore, nickname}} ->
        {ignored_nicknames, body} =
          if MapSet.member?(socket.assigns.ignored_nicknames, nickname) do
            {MapSet.delete(socket.assigns.ignored_nicknames, nickname),
             "Сообщения #{nickname} снова показываются."}
          else
            {MapSet.put(socket.assigns.ignored_nicknames, nickname),
             "Сообщения #{nickname} скрыты. Повтори команду, чтобы вернуть их."}
          end

        {:handled,
         {:noreply,
          socket
          |> assign(:ignored_nicknames, ignored_nicknames)
          |> filter_ignored_messages()
          |> insert_command_result(:ignore, "Игнор", body)
          |> clear_message_input()}}

      {:ok, {:music, query}} ->
        start_music_search(query, socket)

      {:ok, {:gif, query}} ->
        start_gif_search(query, socket)

      {:ok, :ignores} ->
        nicknames = socket.assigns.ignored_nicknames |> MapSet.to_list() |> Enum.sort()
        body = if nicknames == [], do: "Список игноров пуст.", else: "Скрытые чатлане:"

        {:handled,
         {:noreply,
          socket
          |> insert_command_result(
            :ignores,
            "Игноры",
            body,
            Enum.map(nicknames, &%{nickname: &1})
          )
          |> clear_message_input()}}

      {:error, :nickname_required} ->
        {:handled,
         {:noreply,
          socket
          |> insert_command_result(
            :error,
            "Команда не выполнена",
            "Укажи ник: /инфо ник или /игнор ник."
          )
          |> clear_message_input()}}

      {:error, :music_query_required} ->
        {:handled,
         {:noreply,
          socket
          |> insert_command_result(
            :error,
            "Поиск музыки",
            "Укажи запрос: /музыка исполнитель или название."
          )
          |> clear_message_input()}}

      {:error, :gif_query_required} ->
        {:handled,
         {:noreply,
          socket
          |> insert_command_result(:error, "Поиск GIF", "Укажи запрос: /гиф эмоция или сюжет.")
          |> clear_message_input()}}

      {:error, :unknown_command} ->
        {:handled,
         {:noreply,
          socket
          |> insert_command_result(
            :error,
            "Неизвестная команда",
            "Используй /помощь, чтобы увидеть список команд."
          )
          |> clear_message_input()}}
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

  defp start_music_search(_query, %{assigns: %{music_pending?: true}} = socket) do
    {:handled, {:noreply, assign(socket, :message_error, "Дождись окончания поиска музыки.")}}
  end

  defp start_music_search(query, socket) do
    search_message_id = "music-search-#{System.unique_integer([:positive])}"

    socket =
      socket
      |> remove_music_search_result()
      |> assign(:music_pending?, true)
      |> assign(:music_results, [])
      |> assign(:music_page, 1)
      |> assign(:music_search_message_id, search_message_id)
      |> assign(:message_error, nil)
      |> insert_command_result(:music, "Поиск музыки", "Ищу «#{query}»…", [], search_message_id)
      |> clear_message_input()

    {:handled, {:noreply, start_async(socket, :music_search, fn -> Music.search(query) end)}}
  end

  defp start_gif_search(_query, %{assigns: %{gif_pending?: true}} = socket) do
    {:handled, {:noreply, assign(socket, :message_error, "Дождись окончания поиска GIF.")}}
  end

  defp start_gif_search(query, socket) do
    search_message_id = "gif-search-#{System.unique_integer([:positive])}"

    socket =
      socket
      |> remove_gif_search_result()
      |> assign(:gif_pending?, true)
      |> assign(:gif_results, [])
      |> assign(:gif_search_message_id, search_message_id)
      |> assign(:message_error, nil)
      |> insert_command_result(:gif, "Поиск GIF", "Ищу «#{query}»…", [], search_message_id)
      |> clear_message_input()

    {:handled, {:noreply, start_async(socket, :gif_search, fn -> Gifs.search(query) end)}}
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

  defp send_chatlan_gif(gif, %{assigns: %{current_user: %{} = user}} = socket) do
    case Messages.send_registered_gif(
           user,
           @room_id,
           gif,
           public_message_attrs("", socket),
           message_security_subject(socket)
         ) do
      {:ok, _message, updated_user} ->
        {:noreply,
         socket
         |> assign(:current_user, updated_user)
         |> assign(:gif_results, [])
         |> remove_gif_search_result()
         |> update_presence()}

      {:error, reason} ->
        {:noreply, assign(socket, :message_error, message_error(reason))}
    end
  end

  defp send_chatlan_gif(gif, socket) do
    case Messages.send_gif(
           socket.assigns.nickname,
           @room_id,
           gif,
           public_message_attrs("", socket),
           message_security_subject(socket)
         ) do
      {:ok, _message} ->
        {:noreply, socket |> assign(:gif_results, []) |> remove_gif_search_result()}

      {:error, reason} ->
        {:noreply, assign(socket, :message_error, message_error(reason))}
    end
  end

  defp send_chatlan_music(track, %{assigns: %{current_user: %{} = user}} = socket) do
    case Messages.send_registered_music(
           user,
           @room_id,
           track,
           public_message_attrs("", socket),
           message_security_subject(socket)
         ) do
      {:ok, _message, updated_user} ->
        {:noreply,
         socket
         |> assign(:current_user, updated_user)
         |> assign(:music_results, [])
         |> assign(:music_page, 1)
         |> remove_music_search_result()
         |> update_presence()}

      {:error, reason} ->
        {:noreply, assign(socket, :message_error, message_error(reason))}
    end
  end

  defp send_chatlan_music(track, socket) do
    case Messages.send_music(
           socket.assigns.nickname,
           @room_id,
           track,
           public_message_attrs("", socket),
           message_security_subject(socket)
         ) do
      {:ok, _message} ->
        {:noreply,
         socket
         |> assign(:music_results, [])
         |> assign(:music_page, 1)
         |> remove_music_search_result()}

      {:error, reason} ->
        {:noreply, assign(socket, :message_error, message_error(reason))}
    end
  end

  defp assign_preferences(socket, params, opts \\ []) do
    theme_id = Themes.normalize_theme_id(params["theme_id"], socket.assigns.theme_id)
    appearance = Appearance.from_params(params, socket.assigns.appearance)
    font_id = Typography.normalize_font_id(params["font_id"], socket.assigns.font_id)
    font_style = Typography.normalize_font_style(params["font_style"], socket.assigns.font_style)

    message_sound_enabled =
      normalize_message_sound_enabled(
        params["message_sound_enabled"],
        socket.assigns.message_sound_enabled
      )

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
    |> assign(:font_id, font_id)
    |> assign(:font_style, font_style)
    |> assign(:message_sound_enabled, message_sound_enabled)
    |> assign_active_colors()
  end

  defp assign_settings_form(socket) do
    socket
    |> assign(:settings_theme_id, socket.assigns.theme_id)
    |> assign(:settings_appearance, socket.assigns.appearance)
    |> assign(:settings_font_id, socket.assigns.font_id)
    |> assign(:settings_font_style, socket.assigns.font_style)
    |> assign(:settings_message_sound_enabled, socket.assigns.message_sound_enabled)
    |> assign(:settings_form, to_form(public_preferences(socket), as: :preferences))
  end

  defp assign_settings_draft(socket, params) do
    theme_id = Themes.normalize_theme_id(params["theme_id"], socket.assigns.theme_id)
    appearance = Appearance.from_params(params, socket.assigns.appearance)
    font_id = Typography.normalize_font_id(params["font_id"], socket.assigns.font_id)
    font_style = Typography.normalize_font_style(params["font_style"], socket.assigns.font_style)

    message_sound_enabled =
      normalize_message_sound_enabled(
        params["message_sound_enabled"],
        socket.assigns.message_sound_enabled
      )

    preferences = %{
      "nickname" => socket.assigns.nickname,
      "theme_id" => theme_id,
      "appearance" => appearance,
      "font_id" => font_id,
      "font_style" => font_style,
      "message_sound_enabled" => message_sound_enabled
    }

    socket
    |> assign(:settings_theme_id, theme_id)
    |> assign(:settings_appearance, appearance)
    |> assign(:settings_font_id, font_id)
    |> assign(:settings_font_style, font_style)
    |> assign(:settings_message_sound_enabled, message_sound_enabled)
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

  defp assign_feedback_form(socket) do
    assign(
      socket,
      :feedback_form,
      to_form(Feedback.change_entry(socket.assigns.current_user), as: :feedback)
    )
  end

  defp public_preferences(socket) do
    %{
      "nickname" => socket.assigns.nickname,
      "theme_id" => socket.assigns.theme_id,
      "appearance" => socket.assigns.appearance,
      "font_id" => socket.assigns.font_id,
      "font_style" => socket.assigns.font_style,
      "message_sound_enabled" => socket.assigns.message_sound_enabled,
      "session_token" => socket.assigns.chat_session_token,
      "identity_token" => socket.assigns.guest_identity_token
    }
  end

  defp track_presence(socket) do
    result =
      Chatlans.track(
        self(),
        @room_id,
        socket.assigns.presence_key,
        public_appearance(socket)
      )

    if match?({:ok, _}, result) do
      :ok = Chatlans.cancel_scheduled_departure(@room_id, socket.assigns.identity_key)
      log_session("connection_tracked", socket)
    else
      Logger.warning("session_connection_track_failed nickname=#{socket.assigns.nickname}")
    end

    result
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
      |> assign(:font_id, Typography.default_font_id())
      |> assign(:font_style, Typography.default_font_style())
      |> assign(:message_sound_enabled, false)
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

  defp maybe_clear_guest_session(socket, true), do: push_event(socket, "clear-guest-session", %{})
  defp maybe_clear_guest_session(socket, false), do: socket

  defp rerender_messages(socket) do
    Enum.reduce(socket.assigns.message_items, socket, fn message, socket ->
      stream_insert(socket, :messages, message)
    end)
  end

  defp reset_messages(socket, messages) do
    visible_messages = visible_messages(messages, socket.assigns.ignored_nicknames)

    socket
    |> assign(:all_message_items, messages)
    |> assign(:message_items, visible_messages)
    |> stream(:messages, visible_messages, reset: true)
  end

  defp insert_features_notice(socket) do
    sent_at = DateTime.utc_now()

    insert_message(socket, %{
      id: "features-notice-#{System.unique_integer([:positive])}",
      kind: :system,
      system_variant: :features,
      author: "system",
      title: "Новое в чате",
      features: [
        %{icon: "hero-command-line", label: "Команды", text: "/помощь"},
        %{icon: "hero-musical-note", label: "Музыка", text: "/музыка"},
        %{icon: "hero-film", label: "GIF", text: "/гиф"},
        %{icon: "hero-chat-bubble-bottom-center-text", label: "Фидбэк", text: "в меню"},
        %{icon: "hero-puzzle-piece", label: "Игры", text: "в меню"}
      ],
      recipient: nil,
      reactions: %{},
      theme_id: Themes.default_theme_id(),
      appearance: Appearance.default(),
      sent_at: DateTime.to_iso8601(sent_at),
      at: Calendar.strftime(sent_at, "%H:%M:%S")
    })
  end

  defp insert_message(socket, message) do
    all_messages = replace_message(socket.assigns.all_message_items, message)
    socket = assign(socket, :all_message_items, all_messages)

    if visible_message?(message, socket.assigns.ignored_nicknames) do
      case Enum.find(socket.assigns.message_items, &(to_string(&1.id) == to_string(message.id))) do
        ^message ->
          socket

        _existing_message ->
          messages = replace_message(socket.assigns.message_items, message)

          socket
          |> assign(:message_items, messages)
          |> stream_insert(:messages, message)
      end
    else
      socket
    end
  end

  defp maybe_notify_about_message(socket, message) do
    if socket.assigns.message_sound_enabled and message.author != socket.assigns.nickname and
         Map.get(message, :recipient) == socket.assigns.nickname do
      push_event(socket, "play-message-notification", %{})
    else
      socket
    end
  end

  defp normalize_message_sound_enabled(nil, current) when is_boolean(current), do: current
  defp normalize_message_sound_enabled(value, _current), do: value in [true, "true", "1", "on"]

  defp open_profile(socket, nickname) do
    case Profiles.get_by_nickname(nickname) do
      {:ok, profile} ->
        editable? =
          not is_nil(socket.assigns.current_user) and
            socket.assigns.current_user.id == profile.user_id

        socket
        |> assign(:profile, profile)
        |> assign(:profile_editable?, editable?)
        |> assign(:profile_editing?, false)
        |> assign(:profile_form, to_form(Profiles.change_profile(profile)))

      {:error, :not_found} ->
        profile = Profiles.guest_profile(nickname)

        socket
        |> assign(:profile, profile)
        |> assign(:profile_editable?, false)
        |> assign(:profile_editing?, false)
        |> assign(:profile_form, to_form(Profiles.change_profile(profile)))
    end
  end

  defp insert_command_result(socket, command, title, body, entries \\ [], id \\ nil, extra \\ %{}) do
    sent_at = DateTime.utc_now()

    insert_message(
      socket,
      Map.merge(
        %{
          id: id || "command-#{System.unique_integer([:positive])}",
          kind: :command,
          command: command,
          author: "system",
          title: title,
          body: body,
          entries: entries,
          recipient: nil,
          reactions: %{},
          sent_at: sent_at,
          at: Calendar.strftime(sent_at, "%H:%M")
        },
        extra
      )
    )
  end

  defp replace_gif_search_result(socket, title, body, entries \\ []) do
    case socket.assigns.gif_search_message_id do
      nil ->
        insert_command_result(socket, :gif, title, body, entries)

      id ->
        insert_command_result(socket, :gif, title, body, entries, id)
    end
  end

  defp replace_music_search_result(socket, title, body, entries \\ [], page \\ 1) do
    page = music_page(page, entries) || 1
    pagination = music_pagination(entries, page)
    page_entries = music_page_entries(entries, page)

    case socket.assigns.music_search_message_id do
      nil -> insert_command_result(socket, :music, title, body, page_entries, nil, pagination)
      id -> insert_command_result(socket, :music, title, body, page_entries, id, pagination)
    end
  end

  defp remove_gif_search_result(%{assigns: %{gif_search_message_id: nil}} = socket), do: socket

  defp remove_gif_search_result(socket) do
    message_id = socket.assigns.gif_search_message_id
    message = Enum.find(socket.assigns.message_items, &(to_string(&1.id) == message_id))

    socket =
      socket
      |> assign(
        :all_message_items,
        Enum.reject(socket.assigns.all_message_items, &(to_string(&1.id) == message_id))
      )
      |> assign(
        :message_items,
        Enum.reject(socket.assigns.message_items, &(to_string(&1.id) == message_id))
      )
      |> assign(:gif_search_message_id, nil)

    if message, do: stream_delete(socket, :messages, message), else: socket
  end

  defp remove_music_search_result(%{assigns: %{music_search_message_id: nil}} = socket),
    do: socket

  defp remove_music_search_result(socket) do
    message_id = socket.assigns.music_search_message_id
    message = Enum.find(socket.assigns.message_items, &(to_string(&1.id) == message_id))

    socket =
      socket
      |> assign(
        :all_message_items,
        Enum.reject(socket.assigns.all_message_items, &(to_string(&1.id) == message_id))
      )
      |> assign(
        :message_items,
        Enum.reject(socket.assigns.message_items, &(to_string(&1.id) == message_id))
      )
      |> assign(:music_search_message_id, nil)

    if message, do: stream_delete(socket, :messages, message), else: socket
  end

  defp music_entries(tracks) do
    Enum.with_index(tracks, 1)
    |> Enum.map(fn {track, index} ->
      Map.put(track, :type, :track) |> Map.put(:id, index)
    end)
  end

  defp music_page(value, entries) when is_binary(value) do
    case Integer.parse(value) do
      {page, ""} -> music_page(page, entries)
      _invalid -> nil
    end
  end

  defp music_page(page, entries) when is_integer(page) and is_list(entries) do
    if page in 1..music_page_count(entries), do: page, else: nil
  end

  defp music_page(_value, _entries), do: nil

  defp music_page_count(entries), do: max(1, ceil(length(entries) / @music_page_size))

  defp music_page_entries(entries, page) do
    entries
    |> Enum.drop((page - 1) * @music_page_size)
    |> Enum.take(@music_page_size)
  end

  defp music_pagination([], _page), do: %{}

  defp music_pagination(entries, page) do
    %{music_page: page, music_pages: music_page_count(entries)}
  end

  defp gif_entries(gifs) do
    Enum.map(gifs, fn gif ->
      Map.put(gif, :type, :gif)
    end)
  end

  defp filter_ignored_messages(socket) do
    messages =
      visible_messages(socket.assigns.all_message_items, socket.assigns.ignored_nicknames)

    socket
    |> assign(:message_items, messages)
    |> stream(:messages, messages, reset: true)
  end

  defp visible_messages(messages, ignored_nicknames),
    do: Enum.filter(messages, &visible_message?(&1, ignored_nicknames))

  defp visible_message?(message, ignored_nicknames),
    do: not MapSet.member?(ignored_nicknames, Map.get(message, :author))

  defp replace_message(messages, message) do
    case Enum.find_index(messages, &(to_string(&1.id) == to_string(message.id))) do
      nil -> messages ++ [message]
      index -> List.replace_at(messages, index, message)
    end
  end

  defp preferences_error(%Ecto.Changeset{}), do: "Не удалось сохранить настройки."

  defp public_appearance(socket) do
    Chatlans.appearance_attrs(
      socket.assigns.nickname,
      socket.assigns.theme_id,
      socket.assigns.appearance,
      registered?: not is_nil(socket.assigns.current_user),
      rank: Ranks.for_user(socket.assigns.current_user),
      session_id: socket.assigns.chat_session_id,
      identity_key: socket.assigns.identity_key
    )
  end

  defp send_chatlan_public_message(body, %{assigns: %{current_user: %{} = user}} = socket) do
    Messages.send_registered_public_message(
      user,
      @room_id,
      public_message_attrs(body, socket),
      message_security_subject(socket)
    )
  end

  defp send_chatlan_public_message(body, socket) do
    Messages.send_public_message(
      socket.assigns.nickname,
      @room_id,
      public_message_attrs(body, socket),
      message_security_subject(socket)
    )
  end

  defp public_message_attrs(body, socket) do
    %{
      "body" => body,
      "theme_id" => socket.assigns.theme_id,
      "appearance" => socket.assigns.appearance,
      "font_id" => socket.assigns.font_id,
      "font_style" => socket.assigns.font_style,
      "recipient_nicknames" => Enum.map(socket.assigns.online, & &1.nickname)
    }
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

  defp clear_message_frame(socket) do
    socket
    |> assign(:message_items, [])
    |> stream(:messages, [], reset: true)
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

  defp feedback_error(:rate_limited), do: "Слишком много пожеланий. Попробуй позже."
  defp feedback_error(_reason), do: "Не удалось отправить пожелание."

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
    push_event(socket, "save-user-auth", %{
      token: UserAuth.sign(user),
      session_token: socket.assigns.chat_session_token
    })
  end

  defp renew_chat_session(socket) do
    session_token =
      UserAuth.sign_chat_session(socket.assigns.nickname, socket.assigns.chat_session_id)

    socket = assign(socket, :chat_session_token, session_token)

    if socket.assigns.current_user do
      sync_user_auth(socket, socket.assigns.current_user)
    else
      maybe_save_guest_preferences(socket, nil)
    end
  end

  defp close_visit(socket) do
    if is_binary(socket.assigns.identity_key) and
         not Chatlans.identity_online?(@room_id, socket.assigns.identity_key) do
      {:ok, _visit} = Visits.finish_active_visit(socket.assigns.identity_key)
    end

    assign(socket, :visit, nil)
  end

  defp log_session(event, socket) do
    visit_id = socket.assigns[:visit] && socket.assigns.visit.id
    kind = if socket.assigns.current_user, do: "registered", else: "guest"

    Logger.info(
      "session_#{event} nickname=#{socket.assigns.nickname} visit_id=#{visit_id || "none"} kind=#{kind}"
    )
  end

  defp log_entrance_attempt(nickname, password) do
    Logger.info(
      "session_login_attempt nickname=#{nickname || "invalid"} password_present=#{password_present?(password)}"
    )
  end

  defp log_entrance_failure(nickname, reason) do
    Logger.warning(
      "session_login_failed nickname=#{nickname || "invalid"} reason=#{session_failure_reason(reason)}"
    )
  end

  defp password_present?(password) when is_binary(password), do: String.trim(password) != ""
  defp password_present?(_password), do: false

  defp session_failure_reason({:error, reason}) when is_atom(reason), do: Atom.to_string(reason)
  defp session_failure_reason(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp session_failure_reason(_reason), do: "unexpected"
end
