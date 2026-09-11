# Назначение файла: контекст истории входов и выходов чатлан за последние двое суток.
defmodule Chat.Visits do
  @moduledoc "История сессий присутствия в чате."

  import Ecto.Query
  require Logger

  alias Chat.Accounts.User
  alias Chat.Chatlans
  alias Chat.Repo
  alias Chat.Visits.Visit

  @history_hours 48
  @stale_after_seconds 300

  def start_visit(subject, entered_at \\ DateTime.utc_now(), opts \\ [])

  def start_visit(%User{} = user, entered_at, opts) do
    start_visit(
      user.nickname,
      entered_at,
      user.id,
      Keyword.put_new(opts, :identity_key, user_identity_key(user))
    )
  end

  def start_visit(nickname, entered_at, opts) do
    start_visit(nickname, entered_at, nil, opts)
  end

  defp start_visit(nickname, entered_at, user_id, opts) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    session_id = Keyword.get(opts, :session_id)
    identity_key = Keyword.get(opts, :identity_key, legacy_identity_key(nickname, session_id))

    case active_visit(identity_key) do
      %Visit{} = visit ->
        Logger.info("session_visit_reused nickname=#{nickname} visit_id=#{visit.id}")
        {:ok, visit}

      nil ->
        changeset =
          Visit.entrance_changeset(%Visit{user_id: user_id}, %{
            nickname: nickname,
            identity_key: identity_key,
            session_id: session_id,
            entered_at: normalize_datetime(entered_at)
          })

        # A concurrent entrance may win the unique identity constraint. Keep
        # the outer session transaction usable for reading the winning visit.
        case Repo.insert(changeset, mode: :savepoint) do
          {:error, _changeset} ->
            case active_visit(identity_key) || active_visit_for_session(session_id) do
              %Visit{} = visit ->
                Logger.info(
                  "session_visit_reused_after_conflict nickname=#{nickname} visit_id=#{visit.id}"
                )

                {:ok, visit}

              nil ->
                if changeset.valid? do
                  Logger.warning(
                    "session_visit_start_failed nickname=#{nickname} reason=database_constraint"
                  )
                end

                {:error, changeset}
            end

          {:ok, visit} = result ->
            Logger.info("session_visit_started nickname=#{nickname} visit_id=#{visit.id}")
            result

          result ->
            result
        end
    end
  end

  def finish_visit(visit, left_at \\ DateTime.utc_now())

  def finish_visit(%Visit{left_at: nil} = visit, left_at) do
    left_at = normalize_datetime(left_at)

    result =
      Repo.transaction(fn ->
        query =
          from current_visit in Visit,
            where: current_visit.id == ^visit.id and is_nil(current_visit.left_at)

        case Repo.update_all(query, set: [left_at: left_at, updated_at: left_at]) do
          {1, _} ->
            increment_chat_time(visit, left_at)
            Repo.get!(Visit, visit.id)

          {0, _} ->
            Repo.get!(Visit, visit.id)
        end
      end)

    if match?({:ok, %Visit{left_at: ^left_at}}, result) do
      Logger.info("session_visit_finished nickname=#{visit.nickname} visit_id=#{visit.id}")
    end

    result
  end

  def finish_visit(%Visit{} = visit, _left_at), do: {:ok, visit}

  def register_visit(%Visit{} = visit, %User{} = user) do
    visit
    |> Ecto.Changeset.change(user_id: user.id, identity_key: user_identity_key(user))
    |> Repo.update()
  end

  @doc """
  Finishes active visits whose session has disappeared from the online chat.

  A short grace period allows a browser refresh to reconnect and reuse the
  same active visit before it is considered abandoned.
  """
  def cleanup_stale_visits(opts \\ []) do
    now = opts |> Keyword.get(:now, DateTime.utc_now()) |> normalize_datetime()
    cutoff = DateTime.add(now, -@stale_after_seconds, :second)
    online_identity_keys = online_identity_keys()

    stale_visits =
      Visit
      |> where([visit], is_nil(visit.left_at))
      |> where(
        [visit],
        visit.id not in subquery(
          from session in Chat.Sessions.ChatSession,
            where: not is_nil(session.visit_id),
            select: session.visit_id
        )
      )
      |> where([visit], visit.updated_at < ^cutoff)
      |> Repo.all()
      |> Enum.reject(&MapSet.member?(online_identity_keys, &1.identity_key))

    Enum.each(stale_visits, &finish_visit(&1, now))

    if stale_visits != [] do
      Logger.warning("session_stale_visits_closed count=#{length(stale_visits)}")
    end

    :ok
  end

  def list_recent_visits(opts \\ []) do
    since =
      opts
      |> Keyword.get_lazy(:since, fn ->
        DateTime.add(DateTime.utc_now(), -@history_hours, :hour)
      end)
      |> normalize_datetime()

    Visit
    |> where([visit], visit.entered_at >= ^since)
    |> order_by([visit], desc: visit.entered_at, desc: visit.id)
    |> Repo.all()
    |> collapse_active_visits()
  end

  def history_hours, do: @history_hours

  def finish_active_visit(identity_key, left_at \\ DateTime.utc_now())

  def finish_active_visit(identity_key, left_at) when is_binary(identity_key) do
    case active_visit(identity_key) do
      nil -> {:ok, nil}
      visit -> finish_visit(visit, left_at)
    end
  end

  def finish_active_visit(_identity_key, _left_at), do: {:ok, nil}

  def touch_active_visit(identity_key, touched_at \\ DateTime.utc_now())

  def touch_active_visit(identity_key, touched_at) when is_binary(identity_key) do
    touched_at = normalize_datetime(touched_at)

    Visit
    |> where([visit], visit.identity_key == ^identity_key and is_nil(visit.left_at))
    |> Repo.update_all(set: [updated_at: touched_at])

    :ok
  end

  def touch_active_visit(_identity_key, _touched_at), do: :ok

  def user_identity_key(%User{id: id}), do: "user:" <> to_string(id)
  def guest_identity_key(identity_id) when is_binary(identity_id), do: "guest:" <> identity_id

  defp online_identity_keys do
    "lobby"
    |> Chatlans.list_online()
    |> Enum.map(&Map.get(&1, :identity_key))
    |> Enum.reject(&is_nil/1)
    |> MapSet.new()
  end

  defp normalize_datetime(%DateTime{} = datetime), do: DateTime.truncate(datetime, :second)

  defp active_visit(identity_key) when is_binary(identity_key) do
    Repo.one(
      from visit in Visit, where: visit.identity_key == ^identity_key and is_nil(visit.left_at)
    )
  end

  defp active_visit(_identity_key), do: nil

  defp active_visit_for_session(session_id) when is_binary(session_id) do
    Repo.one(
      from visit in Visit, where: visit.session_id == ^session_id and is_nil(visit.left_at)
    )
  end

  defp active_visit_for_session(_session_id), do: nil

  defp legacy_identity_key(_nickname, session_id) when is_binary(session_id),
    do: guest_identity_key(session_id)

  defp legacy_identity_key(_nickname, _session_id), do: "legacy:" <> Ecto.UUID.generate()

  defp collapse_active_visits(visits) do
    {visits, _nicknames} =
      Enum.reduce(visits, {[], MapSet.new()}, fn
        %Visit{left_at: nil, nickname: nickname} = visit, {acc, nicknames} ->
          if MapSet.member?(nicknames, nickname) do
            {acc, nicknames}
          else
            {[visit | acc], MapSet.put(nicknames, nickname)}
          end

        visit, {acc, nicknames} ->
          {[visit | acc], nicknames}
      end)

    Enum.reverse(visits)
  end

  defp increment_chat_time(%Visit{user_id: nil}, _left_at), do: :ok

  defp increment_chat_time(%Visit{user_id: user_id, entered_at: entered_at}, left_at) do
    seconds = max(DateTime.diff(left_at, entered_at, :second), 0)

    User
    |> where([user], user.id == ^user_id)
    |> Repo.update_all(inc: [chat_seconds: seconds])

    :ok
  end
end
