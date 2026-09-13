defmodule ChatWeb.NavigationTest do
  use ChatWeb.ConnCase

  test "mobile sections use the same separate tabs as the desktop menu", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/chat")

    for section <- ~w(music-chart profiles library gallery games visits articles help) do
      assert has_element?(
               view,
               "#mobile-main-menu a[id][href='/#{section}'][target='vertigo-#{section}']"
             )

      assert has_element?(
               view,
               "nav > a[href='/#{section}'][target='vertigo-#{section}'], " <>
                 "#games-main-menu a[href='/#{section}'][target='vertigo-#{section}'], " <>
                 "#about-main-menu a[href='/#{section}'][target='vertigo-#{section}']"
             )
    end

    refute has_element?(view, "#mobile-main-menu a:not([target])")
  end
end
