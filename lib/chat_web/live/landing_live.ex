# Назначение файла: публичная главная страница, вход и регистрация в чате.
defmodule ChatWeb.LandingLive do
  use ChatWeb, :live_view

  alias Chat.{Chatlans, Sessions}
  alias ChatWeb.{AuthComponents, ClientSecurity, UserAuth}

  @impl true
  def mount(_params, _session, socket) do
    presence_key = Chatlans.guest_presence_key()
    params = if connected?(socket), do: get_connect_params(socket), else: %{}

    {:ok,
     socket
     |> assign(:page_title, "Общение, знакомства и игры")
     |> assign(:og_title, "Vertigo — у каждого своя история")
     |> assign(
       :meta_description,
       "Vertigo — русскоязычный чат для общения, знакомств и игр. Входи гостем или зарегистрируй ник без почты и телефона: сохраняй прогресс и открывай новые возможности."
     )
     |> assign(:canonical_path, ~p"/")
     |> assign(:presence_key, presence_key)
     |> assign(:security_subject, ClientSecurity.subject_from_socket(socket, presence_key))
     |> assign(
       :can_resume?,
       is_binary(params["chat_session_token"] || params["guest_session_token"])
     )
     |> assign(:screen, :login)
     |> assign(:entrance_error, nil)
     |> assign(:registration_error, nil)
     |> assign(:pending_session, nil)
     |> assign(:nickname_form, entrance_form())
     |> assign(
       :registration_form,
       to_form(%{"nickname" => "", "password" => ""}, as: :registration)
     )}
  end

  @impl true
  def handle_event(event, _params, %{assigns: %{pending_session: %Sessions.Session{}}} = socket)
      when event in ["enter_chat", "register_user"],
      do: {:noreply, prepare_navigation(socket)}

  def handle_event("enter_chat", %{"entrance" => params}, socket) do
    case Sessions.enter("lobby", params["nickname"], params["password"],
           presence_key: socket.assigns.presence_key
         ) do
      {:ok, session} ->
        finish_entrance(socket, session)

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:entrance_error, AuthComponents.entrance_error(reason))
         |> assign(:nickname_form, entrance_form(params["nickname"]))}
    end
  end

  def handle_event("register_user", %{"registration" => params}, socket) do
    case Sessions.register_and_enter("lobby", params, socket.assigns.security_subject,
           presence_key: socket.assigns.presence_key
         ) do
      {:ok, session} ->
        finish_entrance(socket, session)

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:registration_error, AuthComponents.registration_error(reason))
         |> assign(
           :registration_form,
           to_form(%{"nickname" => params["nickname"], "password" => ""}, as: :registration)
         )}
    end
  end

  def handle_event("show_registration", _params, socket),
    do: {:noreply, socket |> assign(:screen, :registration) |> assign(:registration_error, nil)}

  def handle_event("show_login", _params, socket),
    do: {:noreply, socket |> assign(:screen, :login) |> assign(:entrance_error, nil)}

  def handle_event(
        "chat_session_saved",
        _params,
        %{assigns: %{pending_session: %Sessions.Session{}}} = socket
      ),
      do: {:noreply, push_navigate(socket, to: ~p"/chat")}

  def handle_event("chat_session_saved", _params, socket), do: {:noreply, socket}

  def handle_event("chat_storage_failed", _params, socket) do
    if socket.assigns.pending_session, do: Sessions.leave(socket.assigns.pending_session, self())

    {:noreply,
     socket
     |> assign(:pending_session, nil)
     |> assign(:screen, :login)
     |> assign(
       :entrance_error,
       "Разреши хранение данных сайта в этой вкладке и повтори вход. Если ты только что зарегистрировался, твой ник уже сохранён — введи его и пароль."
     )}
  end

  defp finish_entrance(socket, session) do
    {:ok, _message} = Sessions.announce_join(session)

    {:noreply,
     socket
     |> assign(:pending_session, session)
     |> assign(:entrance_error, nil)
     |> assign(:registration_error, nil)
     |> prepare_navigation()}
  end

  defp entrance_form(nickname \\ ""),
    do: to_form(%{"nickname" => nickname, "password" => ""}, as: :entrance)

  defp prepare_navigation(socket) do
    session = socket.assigns.pending_session

    push_event(socket, "prepare-chat-navigation", %{
      nickname: session.nickname,
      session_token:
        UserAuth.sign_chat_resume(session.nickname, session.session_id, session.resume_secret),
      user_token: if(session.user, do: UserAuth.sign(session.user)),
      identity_token:
        if(session.guest_identity_id,
          do: UserAuth.sign_guest_identity(session.nickname, session.guest_identity_id)
        )
    })
  end
end
