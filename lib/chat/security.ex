# Назначение файла: единые серверные правила ограничения опасной частоты действий.
defmodule Chat.Security do
  @moduledoc "Серверные лимиты сообщений и создания учётных записей."

  alias Chat.Repo
  alias Chat.Security.RateLimiter
  alias Chat.Security.RegistrationGuard

  @message_rules [{3, 2_000}, {12, 60_000}]
  @guest_ip_message_rules [{30, 60_000}]

  def allow_message({:client, ip, _connection_id} = identity) do
    with :ok <- RateLimiter.check({:message, identity}, @message_rules),
         :ok <- RateLimiter.check({:message_ip, ip}, @guest_ip_message_rules) do
      :ok
    end
  end

  def allow_message(identity), do: RateLimiter.check({:message, identity}, @message_rules)

  def claim_registration(nil), do: :ok

  def claim_registration(identity) do
    attrs = %{
      "fingerprint" => registration_fingerprint(identity),
      "day" => Date.utc_today()
    }

    case %RegistrationGuard{} |> RegistrationGuard.changeset(attrs) |> Repo.insert() do
      {:ok, _guard} -> :ok
      {:error, %Ecto.Changeset{}} -> {:error, :registration_limit_reached}
    end
  end

  defp registration_fingerprint(identity) do
    identity
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.url_encode64(padding: false)
  end
end
