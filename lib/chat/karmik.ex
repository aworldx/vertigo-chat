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
           provider.assess(%{
             message: Map.take(message, [:author, :body]),
             context:
               Messages.list_text_messages_before("lobby", message.id)
               |> Enum.map(&Map.take(&1, [:author, :body]))
           }),
         {:ok, _usage_state} <- Usage.record(usage),
         delta when delta in [-1, 1] <- delta_for(verdict),
         {:ok, updated_user} <- apply_assessment(user, message, delta, verdict, reason) do
      announce_assessment(updated_user, delta)

      {:ok, updated_user}
    else
      :neutral -> {:ok, :neutral}
      nil -> {:ok, :not_registered}
      {:error, _reason} = error -> error
      _other -> {:ok, :ignored}
    end
  end

  def review(_message, _provider), do: {:ok, :ignored}

  def review_batch(messages, provider \\ provider()) when is_list(messages) do
    messages =
      messages
      |> Enum.filter(&match?(%{kind: :text, id: id} when is_integer(id), &1))
      |> Enum.uniq_by(& &1.id)
      |> Enum.sort_by(& &1.id)
      |> Enum.take(-12)

    eligible =
      for message <- messages,
          %User{} = user <- [Accounts.get_registered_user_by_nickname(message.author)],
          eligible_for_assessment(user, message.id) == :ok,
          into: %{},
          do: {message.id, {user, message}}

    if map_size(eligible) == 0 do
      {:ok, []}
    else
      input = %{
        messages: Enum.map(messages, &Map.take(&1, [:id, :author, :body])),
        eligible_message_ids: eligible |> Map.keys() |> Enum.sort(),
        context:
          Messages.list_text_messages_before("lobby", hd(messages).id)
          |> Enum.map(&Map.take(&1, [:author, :body]))
      }

      with :ok <- within_token_budget(),
           {:ok, %{assessments: assessments, usage: usage}} <- provider.assess_batch(input),
           {:ok, _usage_state} <- Usage.record(usage),
           :ok <- validate_batch(assessments, eligible) do
        results =
          Enum.map(assessments, fn assessment ->
            {user, message} = Map.fetch!(eligible, assessment.message_id)

            case delta_for(assessment.verdict) do
              :neutral ->
                {:ok, :neutral}

              delta ->
                case apply_assessment(user, message, delta, assessment.verdict, assessment.reason) do
                  {:ok, updated_user} ->
                    announce_assessment(updated_user, delta)
                    {:ok, updated_user}

                  error ->
                    error
                end
            end
          end)

        {:ok, results}
      end
    end
  end

  defp validate_batch(assessments, eligible) when is_list(assessments) do
    valid? =
      Enum.all?(assessments, fn
        %{message_id: id, verdict: verdict, reason: reason}
        when verdict in [:good, :bad, :neutral] and is_binary(reason) ->
          Map.has_key?(eligible, id) and String.trim(reason) != "" and
            String.length(reason) <= 300

        _ ->
          false
      end)

    if valid? do
      user_ids =
        Enum.map(assessments, fn assessment ->
          {user, _message} = Map.fetch!(eligible, assessment.message_id)
          user.id
        end)

      if length(user_ids) == length(Enum.uniq(user_ids)),
        do: :ok,
        else: {:error, :invalid_assessment}
    else
      {:error, :invalid_assessment}
    end
  end

  defp validate_batch(_assessments, _eligible), do: {:error, :invalid_assessment}

  defp announce_assessment(user, delta) do
    _ = Messages.announce_karmik_assessment(user.nickname, "lobby", delta)

    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic("lobby"),
      {:karmik_karma_changed, user.id}
    )

    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic("lobby"),
      {:karmik_activity, if(delta == 1, do: :happy, else: :angry)}
    )
  end

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
