# Назначение файла: тесты типизированной границы между web-соединением и security-правилами.
defmodule Chat.SecuritySubjectTest do
  use ExUnit.Case, async: true

  alias Chat.Security
  alias Chat.Security.Subject
  alias ChatWeb.ClientSecurity

  test "keeps trusted client metadata outside form params" do
    guest = Subject.guest("192.0.2.10", "connection-1")

    assert guest.actor_id == nil
    assert guest.client_ip == "192.0.2.10"
    assert Subject.registration_identity(guest) == {:ip, "192.0.2.10"}
    assert ClientSecurity.for_user(guest, nil) == guest

    registered = ClientSecurity.for_user(guest, %{id: 42})
    assert registered.actor_id == 42
    assert registered.client_ip == guest.client_ip
    assert :ok = Security.allow_message(registered)
  end

  test "uses the connection identity when no client ip exists" do
    internal = Subject.internal(:maintenance)

    assert internal.connection_id == {:internal, :maintenance}

    assert Subject.registration_identity(internal) ==
             {:connection, {:internal, :maintenance}}
  end

  test "builds a subject from LiveView peer data and handles an absent peer" do
    socket = %Phoenix.LiveView.Socket{
      private: %{connect_info: %{peer_data: %{address: {127, 0, 0, 1}}}}
    }

    assert %Subject{client_ip: "127.0.0.1", connection_id: :connected} =
             ClientSecurity.subject_from_socket(socket, :connected)

    socket_without_peer = %Phoenix.LiveView.Socket{private: %{connect_info: %{}}}

    assert %Subject{client_ip: nil, connection_id: :disconnected} =
             ClientSecurity.subject_from_socket(socket_without_peer, :disconnected)
  end
end
