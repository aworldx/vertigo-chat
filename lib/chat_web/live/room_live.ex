# Назначение файла: LiveView общей комнаты чата, связывает UI, Presence и контекст сообщений.
defmodule ChatWeb.RoomLive do
  use ChatWeb, :live_view

  alias Chat.Accounts
  alias Chat.Appearance
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Profiles
  alias Chat.Themes
  alias ChatWeb.AuthComponents
  alias ChatWeb.GalleryAuth
  alias ChatWeb.RoomComponents
  alias ChatWeb.ShellComponents

  @room_id "lobby"

  @impl true
  def mount(_params, _session, socket) do
    nickname = Chatlans.guest_nickname()
    presence_key = Chatlans.guest_presence_key()

    socket =
      socket
      |> assign(:nickname, nickname)
      |> assign(:presence_key, presence_key)
      |> assign(:preference_nickname, nil)
      |> assign(:theme_id, Themes.default_theme_id())
      |> assign(:themes, Themes.list())
      |> assign(:theme_modes, Themes.list_modes())
      |> assign(:appearance, Appearance.default())
      |> assign_active_colors()
      |> assign(:joined?, false)
      |> assign(:current_user, nil)
      |> assign(:profile, nil)
      |> assign(:profile_form, nil)
      |> assign(:profile_editable?, false)
      |> assign(:settings_open?, false)
      |> assign(:screen, :login)
      |> assign(:entrance_error, nil)
      |> assign(:registration_error, nil)
      |> assign(:online, [])
      |> assign_nickname_form()
      |> assign_registration_form()
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign_settings_form()
      |> stream(:messages, Messages.list_recent_messages(@room_id))
      |> allow_upload(:profile_photo,
        accept: ~w(.jpg .jpeg .png .webp),
        max_entries: 1,
        max_file_size: 1_500_000
      )

    socket =
      if connected?(socket) do
        Messages.subscribe(@room_id)

        assign(socket, :online, Chatlans.list_online(@room_id))
      else
        socket
      end

    {:ok, socket}
  end

  @impl true
  def handle_event("enter_chat", %{"entrance" => params}, socket) do
    nickname = Chatlans.normalize_nickname(params["nickname"], socket.assigns.nickname)

    case Accounts.authorize_entrance(nickname, params["password"]) do
      {:ok, user} ->
        socket =
          socket
          |> assign(:nickname, nickname)
          |> assign(:current_user, user)
          |> assign(:entrance_error, nil)
          |> reset_colors_for_new_nickname(nickname)
          |> assign(:joined?, true)
          |> assign_nickname_form()
          |> assign_settings_form()
          |> stream(:messages, Messages.list_recent_messages(@room_id), reset: true)

        track_presence(socket)

        {:noreply,
         socket
         |> assign(:online, Chatlans.list_online(@room_id))
         |> push_event("save-chat-preferences", public_preferences(socket))
         |> sync_gallery_auth(user)}

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
    case Accounts.register_user(params) do
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
    message_sent? =
      socket.assigns.joined? &&
        match?(
          {:ok, _message},
          Messages.send_public_message(socket.assigns.nickname, @room_id, %{
            "body" => body,
            "theme_id" => socket.assigns.theme_id,
            "appearance" => socket.assigns.appearance
          })
        )

    socket = assign(socket, :message_form, to_form(%{"body" => ""}, as: :message))

    socket =
      if message_sent? do
        push_event(socket, "clear-message-input", %{})
      else
        socket
      end

    {:noreply, socket}
  end

  def handle_event("send_message", _params, socket) do
    {:noreply, assign(socket, :message_form, to_form(%{"body" => ""}, as: :message))}
  end

  def handle_event("start_private_message", %{"nickname" => nickname}, socket) do
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
      Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)
    end

    socket =
      socket
      |> assign(:joined?, false)
      |> assign(:current_user, nil)
      |> assign(:profile, nil)
      |> assign(:settings_open?, false)
      |> assign(:screen, :login)
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign_nickname_form()
      |> assign(:online, Chatlans.list_online(@room_id))
      |> push_event("clear-gallery-auth", %{})

    {:noreply, socket}
  end

  def handle_event("toggle_settings", _params, socket) do
    {:noreply, assign(socket, :settings_open?, !socket.assigns.settings_open?)}
  end

  def handle_event("preview_preferences", %{"preferences" => params}, socket) do
    socket =
      socket
      |> assign_preferences(params)
      |> assign_settings_form()
      |> update_presence()

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
    socket =
      socket
      |> assign_preferences(params)
      |> assign(:settings_open?, false)
      |> assign_settings_form()
      |> update_presence()

    {:noreply, push_event(socket, "save-chat-preferences", public_preferences(socket))}
  end

  @impl true
  def handle_info({:message_created, message}, socket) do
    {:noreply, stream_insert(socket, :messages, message)}
  end

  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff"}, socket) do
    {:noreply, assign(socket, :online, Chatlans.list_online(@room_id))}
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
    assign(socket, :settings_form, to_form(public_preferences(socket), as: :preferences))
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

  defp public_appearance(socket) do
    Chatlans.appearance_attrs(
      socket.assigns.nickname,
      socket.assigns.theme_id,
      socket.assigns.appearance
    )
  end

  defp assign_active_colors(socket) do
    assign(socket, :theme_mode, Themes.mode_for_theme(socket.assigns.theme_id))
  end

  defp entrance_error(:not_found), do: "Такой ник не зарегистрирован."
  defp entrance_error(:invalid_password), do: "Неверный пароль."

  defp entrance_error(:password_required),
    do: "Этот ник зарегистрирован. Введи пароль, чтобы войти."

  defp entrance_error(_reason), do: "Не удалось войти с этим ником и паролем."

  defp registration_error(changeset) do
    cond do
      Keyword.has_key?(changeset.errors, :nickname) ->
        "Ник должен быть свободным и состоять из 3–24 букв, цифр, _ или -."

      Keyword.has_key?(changeset.errors, :password) ->
        "Пароль должен быть не короче 6 символов."

      true ->
        "Не удалось зарегистрироваться."
    end
  end

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

  defp sync_gallery_auth(socket, nil), do: push_event(socket, "clear-gallery-auth", %{})

  defp sync_gallery_auth(socket, user) do
    push_event(socket, "save-gallery-auth", %{token: GalleryAuth.sign(user)})
  end
end
