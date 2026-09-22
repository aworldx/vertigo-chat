# Назначение файла: LiveView-тесты каталога анкет, поиска и пагинации.
defmodule ChatWeb.ProfilesLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Profiles
  alias ChatWeb.ProfilesLive

  test "renders and filters profiles by nickname or name", %{conn: conn} do
    {:ok, alpha} =
      Accounts.register_user(%{"nickname" => "alpha_user", "password" => "secret123"})

    {:ok, beta} =
      Accounts.register_user(%{"nickname" => "beta_user", "password" => "secret123"})

    {:ok, beta_profile} = Profiles.get_by_nickname(beta.nickname)
    {:ok, _profile} = Profiles.update_profile(beta, beta_profile, %{"name" => "Алиса"})

    {:ok, view, _html} = live(conn, ~p"/profiles/live")

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

    {:ok, view, _html} = live(conn, ~p"/profiles/live")

    assert has_element?(view, "#profiles-next")
    refute has_element?(view, "[data-profile-nickname='user_13']")

    view |> element("#profiles-next") |> render_click()

    assert has_element?(view, "#profiles-page-2")
    assert has_element?(view, "[data-profile-nickname='user_13']")
    assert has_element?(view, "#profiles-previous")
  end

  test "opens a profile and provides a gallery-style photo viewer", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "profile_viewer", "password" => "secret123"})

    {:ok, profile} = Profiles.get_by_nickname(user.nickname)

    {:ok, profile} =
      Profiles.update_profile(user, profile, %{
        "name" => "Алиса",
        "gender" => "female",
        "birth_date" => "1994-05-18",
        "about" => "Текст полной анкеты"
      })

    assert {:ok, _profile} =
             Profiles.put_photo(
               user,
               profile,
               <<0x89, "PNG\r\n", 0x1A, "\n", "test">>,
               "image/png"
             )

    {:ok, view, _html} = live(conn, ~p"/profiles/live")

    view
    |> element("[data-profile-nickname='profile_viewer']")
    |> render_click()

    assert has_element?(view, "#profile-viewer[role='dialog']")
    assert has_element?(view, "#profile-viewer-title", "profile_viewer")
    assert has_element?(view, "#profile-viewer", "Алиса")
    assert has_element?(view, "#profile-viewer", "Текст полной анкеты")

    assert has_element?(
             view,
             "#open-profile-photo[data-profile-lightbox-open][aria-haspopup='dialog'] img"
           )

    assert has_element?(view, "#open-profile-photo img[src='/profiles/profile_viewer/photo']")

    assert has_element?(view, "#profile-photo-lightbox[phx-update='ignore'][aria-hidden='true']")

    view |> element("#close-profile-viewer") |> render_click()
    refute has_element?(view, "#profile-viewer")
  end

  test "presents every supported gender label" do
    assert ProfilesLive.gender_label("male") == "Мужской"
    assert ProfilesLive.gender_label("female") == "Женский"
    assert ProfilesLive.gender_label("other") == "Другой"
    assert ProfilesLive.gender_label(nil) == "Не указан"
  end
end
