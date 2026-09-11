defmodule ChatWeb.AccountAuth do
  import Phoenix.Component

  alias Chat.Accounts

  def on_mount(:default, _params, session, socket) do
    user = session |> Map.get("account_user_id") |> Accounts.get_user()
    {:cont, assign(socket, :current_account_user, user)}
  end
end
