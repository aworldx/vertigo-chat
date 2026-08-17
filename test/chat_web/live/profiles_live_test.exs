# Назначение файла: LiveView-тесты каталога анкет, поиска и пагинации.
defmodule ChatWeb.ProfilesLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Profiles

  test "renders and filters profiles by nickname or name", %{conn: conn} do
    {:ok, alpha} =
      Accounts.register_user(%{"nickname" => "alpha_user", "password" => "secret123"})

    {:ok, beta} =
      Accounts.register_user(%{"nickname" => "beta_user", "password" => "secret123"})

    {:ok, beta_profile} = Profiles.get_by_nickname(beta.nickname)
    {:ok, _profile} = Profiles.update_profile(beta, beta_profile, %{"name" => "Алиса"})

    {:ok, view, _html} = live(conn, ~p"/profiles")

    assert has_element?(view, "#profile-search")
    assert has_element?(view, "[data-profile-nickname='#{alpha.nickname}']")
    assert has_element?(view, "[data-profile-nickname='#{beta.nickname}']")

    view
    |> form("#profile-search", search: %{query: "Алиса"})
    |> render_change()

    assert has_element?(view, "[data-profile-nickname='#{beta.nickname}']")
    refute has_element?(view, "[data-profile-nickname='#{alpha.nickname}']")
  end

  test "paginates the profile catalogue", %{conn: conn} do
    for number <- 1..13 do
      nickname = "user_#{String.pad_leading(Integer.to_string(number), 2, "0")}"
      {:ok, _user} = Accounts.register_user(%{"nickname" => nickname, "password" => "secret123"})
    end

    {:ok, view, _html} = live(conn, ~p"/profiles")

    assert has_element?(view, "#profiles-next")
    refute has_element?(view, "[data-profile-nickname='user_13']")

    view |> element("#profiles-next") |> render_click()

    assert has_element?(view, "#profiles-page-2")
    assert has_element?(view, "[data-profile-nickname='user_13']")
    assert has_element?(view, "#profiles-previous")
  end
end
