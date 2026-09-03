# Назначение файла: подписывает и проверяет короткоживущую авторизацию пользователя между вкладками.
defmodule ChatWeb.UserAuth do
  alias Chat.Accounts
  alias Chat.Accounts.User

  @salt "user-auth"
  @chat_session_salt "chat-session"
  @session_max_age :timer.minutes(5) |> div(1_000)

  def sign(%User{id: user_id}) do
    Phoenix.Token.sign(ChatWeb.Endpoint, @salt, user_id)
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

  def sign_chat_session(nickname, session_id \\ Ecto.UUID.generate())
      when is_binary(nickname) and is_binary(session_id) do
    Phoenix.Token.sign(ChatWeb.Endpoint, @chat_session_salt, %{
      "id" => session_id,
      "nickname" => nickname
    })
  end

  def verify_chat_session(token, nickname) when is_binary(token) and is_binary(nickname) do
    with {:ok, %{"id" => session_id, "nickname" => ^nickname}} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @chat_session_salt, token,
             max_age: @session_max_age
           ),
         {:ok, _uuid} <- Ecto.UUID.cast(session_id) do
      {:ok, session_id}
    else
      _invalid -> {:error, :invalid_session}
    end
  end

  def verify_chat_session(_token, _nickname), do: {:error, :invalid_session}

  def session_max_age, do: @session_max_age
end
