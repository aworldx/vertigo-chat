# Назначение файла: контекст истории входов и выходов чатлан за последние двое суток.
defmodule Chat.Visits do
  @moduledoc "История сессий присутствия в чате."

  import Ecto.Query

  alias Chat.Chatlans
  alias Chat.Repo
  alias Chat.Visits.Visit

  @history_hours 48

  def start_visit(nickname, entered_at \\ DateTime.utc_now()) do
    nickname = Chatlans.normalize_nickname(nickname, nil)

    %Visit{}
    |> Visit.entrance_changeset(%{
      nickname: nickname,
      entered_at: normalize_datetime(entered_at)
    })
    |> Repo.insert()
  end

  def finish_visit(visit, left_at \\ DateTime.utc_now())

  def finish_visit(%Visit{left_at: nil} = visit, left_at) do
    visit
    |> Visit.exit_changeset(normalize_datetime(left_at))
    |> Repo.update()
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
end
