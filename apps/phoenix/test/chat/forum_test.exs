defmodule Chat.ForumTest do
  use Chat.DataCase, async: false

  alias Chat.{Accounts, Forum}

  @secret "a forum secret which is deliberately longer than thirty two bytes"

  setup do
    previous = Application.get_env(:chat, Forum)
    Application.put_env(:chat, Forum, discourse_connect_secret: @secret)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:chat, Forum, previous),
        else: Application.delete_env(:chat, Forum)
    end)
  end

  test "signs a DiscourseConnect response with the stable user id and avatar URL" do
    {:ok, user} =
      Accounts.register_user(%{
        nickname: "forum_member",
        password: "secret123",
        email: "MEMBER@example.com"
      })

    params = signed_request("https://forum.example.com/session/sso_login")

    assert {:ok, response} =
             Forum.discourse_connect_response(
               user,
               params,
               "https://chat.example.com/profiles/forum_member/photo"
             )

    assert response.return_url == "https://forum.example.com/session/sso_login"
    assert response.sig == signature(response.sso)

    assert %{
             "external_id" => external_id,
             "username" => "forum_member",
             "email" => "member@example.com",
             "require_activation" => "true",
             "avatar_url" => "https://chat.example.com/profiles/forum_member/photo"
           } = response.sso |> Base.decode64!() |> URI.decode_query()

    assert external_id == Integer.to_string(user.id)
  end

  test "does not create an SSO response without an email" do
    {:ok, user} = Accounts.register_user(%{nickname: "forum_no_email", password: "secret123"})

    assert user.email == nil

    assert {:error, :email_required} =
             Forum.discourse_connect_response(
               user,
               signed_request("https://forum.example.com/session/sso_login")
             )
  end

  test "rejects a request with an invalid signature" do
    {:ok, user} =
      Accounts.register_user(%{
        nickname: "forum_invalid",
        password: "secret123",
        email: "member@example.com"
      })

    assert {:error, :invalid_request} =
             Forum.discourse_connect_response(user, %{
               "sso" =>
                 Base.encode64("nonce=test&return_sso_url=https%3A%2F%2Fforum.example.com"),
               "sig" => "invalid"
             })
  end

  defp signed_request(return_url) do
    sso =
      URI.encode_query(%{"nonce" => "test-nonce", "return_sso_url" => return_url})
      |> Base.encode64()

    %{"sso" => sso, "sig" => signature(sso)}
  end

  defp signature(payload),
    do: :crypto.mac(:hmac, :sha256, @secret, payload) |> Base.encode16(case: :lower)
end
