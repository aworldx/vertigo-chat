# Назначение файла: единые серверные правила ограничения опасной частоты действий.
defmodule Chat.Security do
  @moduledoc "Серверные лимиты сообщений, медиавложений и создания учётных записей."

  alias Chat.Repo
  alias Chat.Security.RateLimiter
  alias Chat.Security.RegistrationGuard
  alias Chat.Security.Subject

  @message_rules [{3, 2_000}, {12, 60_000}]
  @guest_ip_message_rules [{30, 60_000}]
  @media_share_rules [{3, 60_000}, {10, 3_600_000}]
  @feedback_rules [{2, 60_000}, {8, 3_600_000}]

  def allow_message(%Subject{actor_id: actor_id}) when is_integer(actor_id) do
    RateLimiter.check({:message, {:user, actor_id}}, @message_rules)
  end

  def allow_message(%Subject{client_ip: nil, connection_id: connection_id}) do
    RateLimiter.check({:message, {:client, nil, connection_id}}, @message_rules)
  end

  def allow_message(%Subject{client_ip: ip, connection_id: connection_id}) do
    identity = {:client, ip, connection_id}

    with :ok <- RateLimiter.check({:message, identity}, @message_rules),
         :ok <- RateLimiter.check({:message_ip, ip}, @guest_ip_message_rules) do
      :ok
    end
  end

  def allow_media_share(%Subject{actor_id: actor_id}) when is_integer(actor_id) do
    RateLimiter.check({:media_share, {:user, actor_id}}, @media_share_rules)
  end

  def allow_media_share(%Subject{}), do: {:error, :registration_required}

  def allow_feedback(%Subject{actor_id: actor_id}) when is_integer(actor_id) do
    RateLimiter.check({:feedback, {:user, actor_id}}, @feedback_rules)
  end

  def allow_feedback(%Subject{client_ip: nil, connection_id: connection_id}) do
    RateLimiter.check({:feedback, {:client, nil, connection_id}}, @feedback_rules)
  end

  def allow_feedback(%Subject{client_ip: ip, connection_id: connection_id}) do
    RateLimiter.check({:feedback, {:client, ip, connection_id}}, @feedback_rules)
  end

  def claim_registration(nil), do: :ok

  def claim_registration(%Subject{} = subject) do
    if registration_guard_enabled?() do
      attrs = %{
        "fingerprint" => registration_fingerprint(Subject.registration_identity(subject)),
        "day" => Date.utc_today()
      }

      case %RegistrationGuard{} |> RegistrationGuard.changeset(attrs) |> Repo.insert() do
        {:ok, _guard} -> :ok
        {:error, %Ecto.Changeset{}} -> {:error, :registration_limit_reached}
      end
    else
      :ok
    end
  end

  defp registration_fingerprint(identity) do
    identity
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.url_encode64(padding: false)
  end

  defp registration_guard_enabled? do
    Application.get_env(:chat, :registration_guard_enabled?, true)
  end
end
