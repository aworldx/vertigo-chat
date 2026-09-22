defmodule ChatWeb.API.V1.ProfileJSON do
  use ChatWeb, :verified_routes

  alias Chat.Ranks

  def index(%{result: result, query: query}) do
    %{
      data: Enum.map(result.profiles, &profile/1),
      meta: Map.take(result, [:page, :page_size, :total, :total_pages]) |> Map.put(:query, query)
    }
  end

  def show(%{profile: profile}), do: %{data: profile(profile)}

  # An explicit public projection: never serialize the Ecto user or photo bytes.
  defp profile(profile) do
    user = profile.user
    rank = Ranks.for_user(user)
    photo_url = photo_url(profile)

    %{
      nickname: user.nickname,
      name: profile.name,
      gender: profile.gender,
      birth_date: profile.birth_date,
      about: profile.about,
      photo_url: photo_url,
      thumbnail_url:
        if(is_binary(profile.thumbnail_key),
          do: ~p"/profiles/#{user.nickname}/photo/thumbnail",
          else: photo_url
        ),
      rank: %{title: rank.title, icon_url: ~p"/images/ranks/#{rank.icon <> ".svg"}"},
      progress: %{
        public_messages: user.public_message_count,
        chat_hours: div(user.chat_seconds, 3600)
      }
    }
  end

  defp photo_url(%{photo: nil, photo_key: nil}), do: nil
  defp photo_url(%{user: user}), do: ~p"/profiles/#{user.nickname}/photo"
end
