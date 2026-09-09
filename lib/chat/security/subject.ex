# Назначение файла: типизированный доверенный субъект для серверных security-проверок.
defmodule Chat.Security.Subject do
  @moduledoc "Доверенные данные пользователя и соединения, отделённые от параметров формы."

  @enforce_keys [:connection_id]
  defstruct [:actor_id, :client_ip, :connection_id, :identity_key]

  def guest(client_ip, connection_id) do
    %__MODULE__{client_ip: client_ip, connection_id: connection_id}
  end

  def internal(connection_id) do
    %__MODULE__{connection_id: {:internal, connection_id}}
  end

  def with_actor(%__MODULE__{} = subject, actor_id) when is_integer(actor_id) do
    %{subject | actor_id: actor_id}
  end

  def with_identity(%__MODULE__{} = subject, identity_key) when is_binary(identity_key) do
    %{subject | identity_key: identity_key}
  end

  def registration_identity(%__MODULE__{client_ip: client_ip}) when not is_nil(client_ip),
    do: {:ip, client_ip}

  def registration_identity(%__MODULE__{connection_id: connection_id}),
    do: {:connection, connection_id}
end
