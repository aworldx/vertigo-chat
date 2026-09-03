# Назначение файла: контекст истории входов и выходов чатлан за последние двое суток.
defmodule Chat.Visits do
  @moduledoc "История сессий присутствия в чате."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Chatlans
  alias Chat.Repo
  alias Chat.Visits.Visit

  @history_hours 48
  @stale_after_seconds 300

  def start_visit(subject, entered_at \\ DateTime.utc_now(), opts \\ [])

  def start_visit(%User{} = user, entered_at, opts) do
    start_visit(user.nickname, entered_at, user.id, opts)
  end

  def start_visit(nickname, entered_at, opts) do
    start_visit(nickname, entered_at, nil, opts)
  end

  defp start_visit(nickname, entered_at, user_id, opts) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    session_id = Keyword.get(opts, :session_id)

    case active_visit(session_id) do
      %Visit{} = visit ->
        {:ok, visit}

      nil ->
        %Visit{}
        |> Visit.entrance_changeset(%{
          nickname: nickname,
          session_id: session_id,
          entered_at: normalize_datetime(entered_at),
          user_id: user_id
        })
        |> Repo.insert()
    end
  end

  def finish_visit(visit, left_at \\ DateTime.utc_now())

  def finish_visit(%Visit{left_at: nil} = visit, left_at) do
    left_at = normalize_datetime(left_at)

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
  end

  def finish_visit(%Visit{} = visit, _left_at), do: {:ok, visit}

  @doc """
  Finishes active visits whose session has disappeared from the online chat.

  A short grace period allows a browser refresh to reconnect and reuse the
  same active visit before it is considered abandoned.
  """
  def cleanup_stale_visits(opts \\ []) do
    now = opts |> Keyword.get(:now, DateTime.utc_now()) |> normalize_datetime()
    cutoff = DateTime.add(now, -@stale_after_seconds, :second)
    {online_session_ids, online_nicknames} = online_participants()

    Visit
    |> where([visit], is_nil(visit.left_at))
    |> where([visit], visit.updated_at < ^cutoff)
    |> Repo.all()
    |> Enum.reject(fn visit ->
      MapSet.member?(online_session_ids, visit.session_id) or
        MapSet.member?(online_nicknames, visit.nickname)
    end)
    |> Enum.each(fn visit ->
      finish_visit(visit, stale_left_at(visit, now))
    end)

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

  defp online_participants do
    online = Chatlans.list_online("lobby")

    {
      online |> Enum.map(&Map.get(&1, :session_id)) |> Enum.reject(&is_nil/1) |> MapSet.new(),
      online |> Enum.map(& &1.nickname) |> MapSet.new()
    }
  end

  defp normalize_datetime(%DateTime{} = datetime), do: DateTime.truncate(datetime, :second)

  defp active_visit(session_id) when is_binary(session_id) do
    Repo.one(
      from visit in Visit, where: visit.session_id == ^session_id and is_nil(visit.left_at)
    )
  end

  defp active_visit(_session_id), do: nil

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

  # Presence tells us whether a connection is still alive. Once it disappears,
  # account for only the reconnect grace period even if the janitor runs late.
  defp stale_left_at(%Visit{updated_at: updated_at, entered_at: entered_at}, now) do
    last_seen_at = updated_at || entered_at
    grace_ended_at = DateTime.add(last_seen_at, @stale_after_seconds, :second)

    if DateTime.compare(grace_ended_at, now) == :gt, do: now, else: grace_ended_at
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
