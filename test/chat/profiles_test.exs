# Назначение файла: тесты контекста анкет и проверки прав владельца.
defmodule Chat.ProfilesTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Profiles

  test "loads a registered user's profile and lets only its owner update it" do
    {:ok, owner} =
      Accounts.register_user(%{"nickname" => "profile_owner", "password" => "secret123"})

    {:ok, stranger} =
      Accounts.register_user(%{"nickname" => "profile_other", "password" => "secret123"})

    assert {:ok, profile} = Profiles.get_by_nickname(owner.nickname)
    assert profile.user.nickname == owner.nickname

    assert {:error, :forbidden} = Profiles.update_profile(stranger, profile, %{"name" => "Нет"})

    assert {:ok, updated} =
             Profiles.update_profile(owner, profile, %{
               "name" => "Алекс",
               "birth_date" => "1990-05-12",
               "gender" => "other",
               "about" => "Люблю Phoenix"
             })

    assert updated.name == "Алекс"
    assert updated.birth_date == ~D[1990-05-12]
    assert updated.about == "Люблю Phoenix"
  end

  test "rejects oversized and unsupported profile photos" do
    {:ok, owner} =
      Accounts.register_user(%{"nickname" => "photo_owner", "password" => "secret123"})

    {:ok, profile} = Profiles.get_by_nickname(owner.nickname)

    assert {:error, :invalid_photo} =
             Profiles.put_photo(owner, profile, :binary.copy(<<0>>, 1_500_001), "image/webp")

    assert {:error, :invalid_photo} =
             Profiles.put_photo(owner, profile, <<1, 2, 3>>, "image/svg+xml")
  end

  test "lists profiles with search and pagination" do
    {:ok, first} =
      Accounts.register_user(%{"nickname" => "alpha_user", "password" => "secret123"})

    {:ok, second} =
      Accounts.register_user(%{"nickname" => "beta_user", "password" => "secret123"})

    {:ok, third} =
      Accounts.register_user(%{"nickname" => "gamma_user", "password" => "secret123"})

    {:ok, second_profile} = Profiles.get_by_nickname(second.nickname)
    {:ok, _profile} = Profiles.update_profile(second, second_profile, %{"name" => "Алиса"})

    first_page = Profiles.list_profiles(page: 1, page_size: 2)
    assert first_page.total == 3
    assert first_page.total_pages == 2
    assert Enum.map(first_page.profiles, & &1.user.nickname) == [first.nickname, second.nickname]

    search_result = Profiles.list_profiles(search: "Алиса")
    assert [profile] = search_result.profiles
    assert profile.user.nickname == second.nickname
    assert third.nickname == "gamma_user"
  end
end
