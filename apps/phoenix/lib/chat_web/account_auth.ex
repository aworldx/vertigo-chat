defmodule ChatWeb.AccountAuth do
  import Phoenix.Component

  alias Chat.Accounts

  def sign_login(user), do: Phoenix.Token.sign(ChatWeb.Endpoint, "account-login", user.id)

  def verify_login(token) when is_binary(token) do
    with {:ok, id} <- Phoenix.Token.verify(ChatWeb.Endpoint, "account-login", token, max_age: 60),
         %Chat.Accounts.User{is_game_guest: false} = user <- Accounts.get_user(id) do
      {:ok, user}
    else
      _ -> {:error, :invalid_token}
    end
  end

  def verify_login(_), do: {:error, :invalid_token}

  def on_mount(:default, _params, session, socket) do
    user = session |> Map.get("account_user_id") |> Accounts.get_user()

    {:cont,
     socket
     |> assign(:current_account_user, user)
     |> assign(:account_signed_out?, session["account_signed_out"] == true)}
  end
end
