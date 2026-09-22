# Назначение файла: web-адаптер преобразования данных LiveView-соединения в Security.Subject.
defmodule ChatWeb.ClientSecurity do
  @moduledoc false

  alias Chat.Security.Subject

  def subject_from_socket(socket, connection_id) do
    client_ip =
      case Phoenix.LiveView.get_connect_info(socket, :peer_data) do
        %{address: address} -> address |> :inet.ntoa() |> to_string()
        _missing_peer_data -> nil
      end

    Subject.guest(client_ip, connection_id)
  end

  def for_user(%Subject{} = subject, %{id: user_id}) do
    Subject.with_actor(subject, user_id)
  end

  def for_user(%Subject{} = subject, nil), do: subject
end
