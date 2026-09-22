# Назначение файла: тесты контекста анкет и проверки прав владельца.
defmodule Chat.ProfilesTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Profiles
  alias Chat.Profiles.Profile

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

  test "handles absent and guest profiles without writing data" do
    assert {:error, :not_found} = Profiles.get_by_nickname("missing_user")

    guest = Profiles.guest_profile("guest_user")
    assert %Profile{} = guest
    assert guest.user.nickname == "guest_user"
  end

  test "normalizes invalid catalogue options" do
    assert %{profiles: [], page: 1, page_size: 12, total_pages: 1} = Profiles.list_profiles()

    assert %{page: 1, page_size: 12} =
             Profiles.list_profiles(search: nil, page: "invalid", page_size: 0)

    assert %{page: 1} = Profiles.list_profiles(page: nil)

    assert %{profiles: []} = Profiles.list_profiles(search: "%' OR 1=1 --")
  end

  test "stores a valid profile photo for its owner" do
    {:ok, owner} =
      Accounts.register_user(%{"nickname" => "photo_writer", "password" => "secret123"})

    {:ok, profile} = Profiles.get_by_nickname(owner.nickname)
    assert {:ok, updated} = Profiles.put_photo(owner, profile, png_bytes(), "image/png")
    assert updated.photo == png_bytes()
    assert updated.photo_content_type == "image/png"
  end

  test "validates future birth dates and optional profile fields" do
    changeset =
      Profiles.change_profile(%Profile{}, %{"birth_date" => Date.add(Date.utc_today(), 1)})

    assert %{birth_date: [_message]} = errors_on(changeset)

    assert Profiles.change_profile(%Profile{}, %{}).valid?
  end

  defp png_bytes, do: <<0x89, "PNG\r\n", 0x1A, "\n", "test">>
end
