# Назначение файла: проверяет, что токены вкладки не истекают из-за бездействия.
defmodule ChatWeb.UserAuthTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias ChatWeb.UserAuth

  test "restores registered and guest sessions older than the former idle limit" do
    {:ok, user} = Accounts.register_user(%{nickname: "long_lived_auth", password: "secret123"})
    signed_at = System.system_time(:second) - 301
    session_id = Ecto.UUID.generate()

    registered_token =
      Phoenix.Token.sign(ChatWeb.Endpoint, "user-auth", user.id, signed_at: signed_at, max_age: 1)

    guest_token =
      Phoenix.Token.sign(
        ChatWeb.Endpoint,
        "chat-session",
        %{"id" => session_id, "nickname" => "long_lived_guest"},
        signed_at: signed_at,
        max_age: 1
      )

    assert :infinity = UserAuth.session_max_age()
    assert {:ok, restored_user} = UserAuth.verify(registered_token)
    assert restored_user.id == user.id
    assert {:ok, ^session_id} = UserAuth.verify_chat_session(guest_token, "long_lived_guest")
  end
end
