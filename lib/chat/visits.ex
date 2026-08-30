# Назначение файла: контекст истории входов и выходов чатлан за последние двое суток.
defmodule Chat.Visits do
  @moduledoc "История сессий присутствия в чате."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Chatlans
  alias Chat.Repo
  alias Chat.Visits.Visit

  @history_hours 48

  def start_visit(subject, entered_at \\ DateTime.utc_now())

  def start_visit(%User{} = user, entered_at) do
    start_visit(user.nickname, entered_at, user.id)
  end

  def start_visit(nickname, entered_at) do
    start_visit(nickname, entered_at, nil)
  end

  defp start_visit(nickname, entered_at, user_id) do
    nickname = Chatlans.normalize_nickname(nickname, nil)

    %Visit{}
    |> Visit.entrance_changeset(%{
      nickname: nickname,
      entered_at: normalize_datetime(entered_at),
      user_id: user_id
    })
    |> Repo.insert()
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
  end

  def history_hours, do: @history_hours

  defp normalize_datetime(%DateTime{} = datetime), do: DateTime.truncate(datetime, :second)

  defp increment_chat_time(%Visit{user_id: nil}, _left_at), do: :ok

  defp increment_chat_time(%Visit{user_id: user_id, entered_at: entered_at}, left_at) do
    seconds = max(DateTime.diff(left_at, entered_at, :second), 0)

    User
    |> where([user], user.id == ^user_id)
    |> Repo.update_all(inc: [chat_seconds: seconds])

    :ok
  end
end
