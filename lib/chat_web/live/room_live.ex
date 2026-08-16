# Назначение файла: LiveView общей комнаты чата, связывает UI, Presence и контекст сообщений.
defmodule ChatWeb.RoomLive do
  use ChatWeb, :live_view

  alias Chat.Appearance
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Themes

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
      |> assign(:settings_open?, false)
      |> assign(:online, [])
      |> assign_nickname_form()
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign_settings_form()
      |> stream(:messages, Messages.list_recent_messages(@room_id))

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
  def handle_event("enter_chat", %{"entrance" => %{"nickname" => nickname}}, socket) do
    nickname = Chatlans.normalize_nickname(nickname, socket.assigns.nickname)

    socket =
      socket
      |> assign(:nickname, nickname)
      |> reset_colors_for_new_nickname(nickname)
      |> assign(:joined?, true)
      |> assign_nickname_form()
      |> assign_settings_form()
      |> stream(:messages, Messages.list_recent_messages(@room_id), reset: true)

    track_presence(socket)

    {:noreply,
     socket
     |> assign(:online, Chatlans.list_online(@room_id))
     |> push_event("save-chat-preferences", public_preferences(socket))}
  end

  def handle_event("send_message", %{"message" => %{"body" => body}}, socket) do
    if socket.assigns.joined? do
      Messages.send_public_message(socket.assigns.nickname, @room_id, %{
        "body" => body,
        "theme_id" => socket.assigns.theme_id,
        "appearance" => socket.assigns.appearance
      })
    end

    {:noreply, assign(socket, :message_form, to_form(%{"body" => ""}, as: :message))}
  end

  def handle_event("leave_chat", _params, socket) do
    if socket.assigns.joined? do
      Chatlans.untrack(self(), @room_id, socket.assigns.presence_key)
    end

    socket =
      socket
      |> assign(:joined?, false)
      |> assign(:settings_open?, false)
      |> assign(:message_form, to_form(%{"body" => ""}, as: :message))
      |> assign_nickname_form()
      |> assign(:online, Chatlans.list_online(@room_id))

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
      to_form(%{"nickname" => socket.assigns.nickname}, as: :entrance)
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

  defp mode_colors(appearance, mode_id) do
    Appearance.for_mode(appearance, mode_id)
  end

  defp appearance_style(%{appearance: appearance}) do
    Appearance.style(appearance)
  end

  defp appearance_style(appearance) do
    Appearance.style(appearance)
  end
end
