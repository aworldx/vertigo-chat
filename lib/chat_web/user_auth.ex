# Назначение файла: подписывает и проверяет авторизацию, ограниченную текущей вкладкой браузера.
defmodule ChatWeb.UserAuth do
  alias Chat.Accounts
  alias Chat.Accounts.User

  @salt "user-auth"
  @chat_session_salt "chat-session"
  @guest_identity_salt "guest-identity"
  # Tokens are stored only in sessionStorage, so closing the tab ends the session.
  # An idle or background tab must remain restorable indefinitely.
  @session_max_age :infinity

  def sign(%User{id: user_id}) do
    Phoenix.Token.sign(ChatWeb.Endpoint, @salt, user_id, max_age: @session_max_age)
  end

  def verify(token) when is_binary(token) do
    with {:ok, user_id} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @salt, token, max_age: @session_max_age),
         %User{} = user <- Accounts.get_user(user_id) do
      {:ok, user}
    else
      _invalid -> {:error, :invalid_token}
    end
  end

  def verify(_token), do: {:error, :invalid_token}

  def sign_chat_resume(nickname, session_id, resume_secret)
      when is_binary(nickname) and is_binary(session_id) and is_binary(resume_secret) do
    Phoenix.Token.sign(
      ChatWeb.Endpoint,
      @chat_session_salt,
      %{"id" => session_id, "nickname" => nickname, "resume_secret" => resume_secret},
      max_age: @session_max_age
    )
  end

  def verify_chat_resume(token, nickname) when is_binary(token) and is_binary(nickname) do
    with {:ok, %{"id" => session_id, "nickname" => ^nickname, "resume_secret" => secret}} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @chat_session_salt, token,
             max_age: @session_max_age
           ),
         {:ok, _uuid} <- Ecto.UUID.cast(session_id),
         true <- is_binary(secret) and byte_size(secret) >= 32 do
      {:ok, {session_id, secret}}
    else
      _invalid -> {:error, :invalid_session}
    end
  end

  def verify_chat_resume(_token, _nickname), do: {:error, :invalid_session}

  def sign_guest_identity(nickname, identity_id \\ Ecto.UUID.generate())
      when is_binary(nickname) and is_binary(identity_id) do
    Phoenix.Token.sign(
      ChatWeb.Endpoint,
      @guest_identity_salt,
      %{"id" => identity_id, "nickname" => nickname},
      max_age: @session_max_age
    )
  end

  def verify_guest_identity(token, nickname) when is_binary(token) and is_binary(nickname) do
    with {:ok, %{"id" => identity_id, "nickname" => ^nickname}} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @guest_identity_salt, token,
             max_age: @session_max_age
           ),
         {:ok, _uuid} <- Ecto.UUID.cast(identity_id) do
      {:ok, identity_id}
    else
      _invalid -> {:error, :invalid_identity}
    end
  end

  def verify_guest_identity(_token, _nickname), do: {:error, :invalid_identity}

  def session_max_age, do: @session_max_age
end
