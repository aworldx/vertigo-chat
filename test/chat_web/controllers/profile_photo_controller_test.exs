defmodule ChatWeb.ProfilePhotoControllerTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Profiles

  test "serves a saved profile photo", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "photo_owner", "password" => "secret123"})

    {:ok, profile} = Profiles.get_by_nickname(user.nickname)
    bytes = <<0x89, "PNG\r\n", 0x1A, "\n", "test">>

    assert {:ok, _profile} = Profiles.put_photo(user, profile, bytes, "image/png")

    conn = get(conn, ~p"/profiles/photo_owner/photo")

    assert response(conn, :ok) == bytes
    assert ["image/png" <> _charset] = get_resp_header(conn, "content-type")
  end

  test "returns not found for a profile without a photo", %{conn: conn} do
    {:ok, _user} = Accounts.register_user(%{"nickname" => "no_photo", "password" => "secret123"})

    assert get(conn, ~p"/profiles/no_photo/photo") |> response(:not_found) == ""
  end
end
