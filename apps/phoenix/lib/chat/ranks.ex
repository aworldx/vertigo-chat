# Назначение файла: правила киношных званий зарегистрированных пользователей и учет их прогресса.
defmodule Chat.Ranks do
  @moduledoc "Киношные звания за публичные фразы и время в чате."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Repo

  @ranks [
    %{title: "Зритель первого ряда", icon: "ticket", messages: 0, hours: 0},
    %{title: "Киноман", icon: "users-group", messages: 50, hours: 5},
    %{title: "Статист", icon: "armchair", messages: 200, hours: 20},
    %{title: "Исполнитель эпизода", icon: "movie", messages: 600, hours: 60},
    %{title: "Актёр второго плана", icon: "star", messages: 1_500, hours: 150},
    %{title: "Звезда экрана", icon: "device-tv", messages: 3_500, hours: 350},
    %{title: "Сценарист", icon: "file-text", messages: 7_000, hours: 700},
    %{title: "Продюсер", icon: "cash", messages: 12_000, hours: 1_200},
    %{title: "Режиссёр-постановщик", icon: "camera", messages: 20_000, hours: 2_000},
    %{title: "Режиссер", icon: "theater", messages: 35_000, hours: 3_500}
  ]

  @feature_unlocks %{
    "Киноман" => "Можно добавлять статьи в библиотеку",
    "Статист" => "Можно добавлять фотографии в фотоальбом"
  }

  def for_user(user, active_seconds \\ 0)

  def for_user(%User{} = user, active_seconds) when is_integer(active_seconds) do
    messages = max(user.public_message_count || 0, 0)
    seconds = max((user.chat_seconds || 0) + active_seconds, 0)

    @ranks
    |> Enum.filter(fn rank -> messages >= rank.messages and seconds >= rank.hours * 3600 end)
    |> List.last()
  end

  def for_user(nil, _active_seconds), do: nil

  def public_message_sent(%User{} = user) do
    {1, _} =
      User
      |> where([user_row], user_row.id == ^user.id)
      |> Repo.update_all(inc: [public_message_count: 1])

    {:ok, Repo.get!(User, user.id)}
  end

  def rank_definitions, do: @ranks

  def feature_unlock(rank), do: Map.get(@feature_unlocks, rank.title)

  def can_add_library_articles?(%User{} = user), do: meets_rank?(user, "Киноман")
  def can_add_library_articles?(_user), do: false

  def can_add_gallery_photos?(%User{} = user), do: meets_rank?(user, "Статист")
  def can_add_gallery_photos?(_user), do: false

  defp meets_rank?(user, title) do
    required_rank = Enum.find(@ranks, &(&1.title == title))

    user.public_message_count >= required_rank.messages and
      user.chat_seconds >= required_rank.hours * 3600
  end
end
