# Назначение файла: доменный контекст Кармика — оценка сообщений, дневной лимит и изменение кармы.
defmodule Chat.Karmik do
  @moduledoc "Осторожно выдаёт карму зарегистрированным чатланам за явную доброту или травлю."

  import Ecto.Query

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Bot.Usage
  alias Chat.Karmik.Assessment
  alias Chat.Messages
  alias Chat.Repo

  @daily_limit 2

  def review(message, provider \\ provider())

  def review(message, provider) when is_map(message) and is_atom(provider) do
    with :text <- Map.get(message, :kind),
         %User{} = user <- Accounts.get_registered_user_by_nickname(Map.get(message, :author)),
         :ok <- eligible_for_assessment(user, Map.get(message, :id)),
         :ok <- within_token_budget(),
         {:ok, %{verdict: verdict, reason: reason, usage: usage}} <-
           provider.assess(Map.get(message, :body)),
         {:ok, _usage_state} <- Usage.record(usage),
         delta when delta in [-1, 1] <- delta_for(verdict),
         {:ok, updated_user} <- apply_assessment(user, message, delta, verdict, reason) do
      _ = Messages.announce_karmik_assessment(updated_user.nickname, "lobby", delta)

      Phoenix.PubSub.broadcast(
        Chat.PubSub,
        Messages.room_topic("lobby"),
        {:karmik_karma_changed, updated_user.id}
      )

      Phoenix.PubSub.broadcast(
        Chat.PubSub,
        Messages.room_topic("lobby"),
        {:karmik_activity, if(delta == 1, do: :happy, else: :angry)}
      )

      {:ok, updated_user}
    else
      :neutral -> {:ok, :neutral}
      nil -> {:ok, :not_registered}
      {:error, _reason} = error -> error
      _other -> {:ok, :ignored}
    end
  end

  def review(_message, _provider), do: {:ok, :ignored}

  def list_recent_assessments(limit \\ 50) when is_integer(limit) do
    limit = limit |> max(1) |> min(100)

    from(assessment in Assessment,
      order_by: [desc: assessment.inserted_at, desc: assessment.id],
      limit: ^limit
    )
    |> Repo.all()
  end

  defp apply_assessment(%User{} = user, message, delta, verdict, reason)
       when is_map(message) and delta in [-1, 1] and verdict in [:good, :bad] and
              is_binary(reason) do
    message_id = Map.get(message, :id)
    message_body = Map.get(message, :body)

    Repo.transaction(fn ->
      user = Repo.one!(from(user in User, where: user.id == ^user.id, lock: "FOR UPDATE"))
      assessed_on = Date.utc_today()

      cond do
        Repo.exists?(
          from(a in Assessment, where: a.user_id == ^user.id and a.room_message_id == ^message_id)
        ) ->
          Repo.rollback(:already_assessed)

        Repo.aggregate(
          from(a in Assessment, where: a.user_id == ^user.id and a.assessed_on == ^assessed_on),
          :count
        ) >= @daily_limit ->
          Repo.rollback(:daily_limit_reached)

        true ->
          %Assessment{}
          |> Assessment.changeset(%{
            user_id: user.id,
            room_message_id: message_id,
            delta: delta,
            assessed_on: assessed_on,
            chatlan_nickname: user.nickname,
            message_body: message_body,
            verdict: Atom.to_string(verdict),
            reason: String.slice(String.trim(reason), 0, 300)
          })
          |> Repo.insert!()

          {1, _} = Repo.update_all(from(u in User, where: u.id == ^user.id), inc: [karma: delta])
          Repo.get!(User, user.id)
      end
    end)
  end

  defp apply_assessment(_user, _message, _delta, _verdict, _reason),
    do: {:error, :invalid_assessment}

  defp eligible_for_assessment(%User{} = user, message_id) when is_integer(message_id) do
    assessed_on = Date.utc_today()

    cond do
      Repo.exists?(
        from(a in Assessment, where: a.user_id == ^user.id and a.room_message_id == ^message_id)
      ) ->
        {:error, :already_assessed}

      Repo.aggregate(
        from(a in Assessment, where: a.user_id == ^user.id and a.assessed_on == ^assessed_on),
        :count
      ) >= @daily_limit ->
        {:error, :daily_limit_reached}

      true ->
        :ok
    end
  end

  defp eligible_for_assessment(_user, _message_id), do: {:error, :invalid_assessment}

  defp within_token_budget do
    if Usage.available?(), do: :ok, else: {:error, :daily_token_limit_reached}
  end

  defp delta_for(:good), do: 1
  defp delta_for(:bad), do: -1
  defp delta_for(:neutral), do: :neutral

  defp provider do
    Application.get_env(:chat, __MODULE__, []) |> Keyword.get(:provider, Chat.Karmik.OpenAI)
  end
end
