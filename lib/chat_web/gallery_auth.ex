# Назначение файла: подписывает и проверяет короткоживущую авторизацию фотоальбома между вкладками.
defmodule ChatWeb.GalleryAuth do
  alias Chat.Accounts
  alias Chat.Accounts.User

  @salt "gallery-auth"
  @max_age 86_400

  def sign(%User{id: user_id}) do
    Phoenix.Token.sign(ChatWeb.Endpoint, @salt, user_id)
  end

  def verify(token) when is_binary(token) do
    with {:ok, user_id} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @salt, token, max_age: @max_age),
         %User{} = user <- Accounts.get_user(user_id) do
      {:ok, user}
    else
      _invalid -> {:error, :invalid_token}
    end
  end

  def verify(_token), do: {:error, :invalid_token}
end
