defmodule ChatWeb.API.V1.ProfileControllerTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Profiles

  test "public catalogue returns a stable projection, search and pagination", %{conn: conn} do
    for number <- 1..13 do
      nickname = "api_user_#{String.pad_leading(Integer.to_string(number), 2, "0")}"
      {:ok, _user} = Accounts.register_user(%{"nickname" => nickname, "password" => "secret123"})
    end

    response = get(conn, ~p"/api/v1/profiles")
    body = json_response(response, 200)
    assert length(body["data"]) == 12

    assert body["meta"] == %{
             "page" => 1,
             "page_size" => 12,
             "total" => 13,
             "total_pages" => 2,
             "query" => ""
           }

    assert hd(body["data"])["nickname"] == "api_user_01"
    assert get_resp_header(response, "cache-control") == ["no-store"]

    second_page = conn |> get(~p"/api/v1/profiles?page=2") |> json_response(200)
    assert [%{"nickname" => "api_user_13"}] = second_page["data"]
    assert second_page["meta"]["page"] == 2

    clamped = conn |> get(~p"/api/v1/profiles?page=999") |> json_response(200)
    assert clamped["meta"]["page"] == 2

    filtered = conn |> get(~p"/api/v1/profiles?q=api_user_13") |> json_response(200)
    assert [%{"nickname" => "api_user_13"}] = filtered["data"]
    assert filtered["meta"]["total"] == 1
  end

  test "searches Cyrillic names and exposes only existing public profile fields", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{
        "nickname" => "api_alice",
        "password" => "secret123",
        "email" => "private@example.com"
      })

    {:ok, profile} = Profiles.get_by_nickname(user.nickname)

    {:ok, _} =
      Profiles.update_profile(user, profile, %{
        "name" => "Алиса",
        "birth_date" => "1994-05-18",
        "gender" => "female",
        "about" => "<script>alert(1)</script>"
      })

    body = conn |> get(~p"/api/v1/profiles?#{%{q: "  Алиса  "}}") |> json_response(200)
    assert [data] = body["data"]
    assert body["meta"]["query"] == "Алиса"

    assert Enum.sort(Map.keys(data)) ==
             Enum.sort(
               ~w(nickname name gender birth_date about photo_url thumbnail_url rank progress)
             )

    assert data["birth_date"] == "1994-05-18"
    assert data["photo_url"] == nil
    assert data["thumbnail_url"] == nil

    assert data["rank"] == %{
             "title" => "Зритель первого ряда",
             "icon_url" => "/images/ranks/ticket.svg"
           }

    assert data["progress"] == %{"public_messages" => 0, "chat_hours" => 0}

    detail = conn |> get(~p"/api/v1/profiles/#{user.nickname}") |> json_response(200)
    assert detail == %{"data" => data}
    refute Jason.encode!(detail) =~ "private@example.com"
    refute Jason.encode!(detail) =~ user.password_hash
  end

  test "returns photo URLs rather than bytes or storage keys", %{conn: conn} do
    {:ok, user} = Accounts.register_user(%{"nickname" => "api_photo", "password" => "secret123"})
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)

    profile
    |> Ecto.Changeset.change(
      photo_key: "private-storage-key",
      thumbnail_key: "private-thumbnail-key"
    )
    |> Chat.Repo.update!()

    response = conn |> get(~p"/api/v1/profiles/#{user.nickname}") |> json_response(200)
    assert response["data"]["photo_url"] == "/profiles/api_photo/photo"
    assert response["data"]["thumbnail_url"] == "/profiles/api_photo/photo/thumbnail"
    refute Jason.encode!(response) =~ "private-storage-key"
    refute Jason.encode!(response) =~ "private-thumbnail-key"
  end

  test "empty results and missing details have distinct contracts", %{conn: conn} do
    body = conn |> get(~p"/api/v1/profiles?q=missing") |> json_response(200)
    assert body["data"] == []
    assert body["meta"]["total"] == 0
    assert body["meta"]["total_pages"] == 1

    assert %{"error" => %{"code" => "not_found", "message" => _}} =
             conn |> get(~p"/api/v1/profiles/missing") |> json_response(404)
  end

  test "malformed or excessive query parameters return JSON validation errors", %{conn: conn} do
    for params <- [
          %{q: String.duplicate("я", 81)},
          %{q: ["nested"]},
          %{page: "0"},
          %{page: "-1"},
          %{page: "1oops"},
          %{page: "2147483648"},
          %{page: ["1"]}
        ] do
      assert %{"error" => %{"code" => "invalid_params"}} =
               conn |> get(~p"/api/v1/profiles", params) |> json_response(422)
    end
  end
end
