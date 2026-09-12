defmodule Chat.MediaTest do
  use ChatWeb.ConnCase, async: false

  alias Chat.{Accounts, Gallery, Media, MusicChart, Profiles, Repo}

  setup do
    previous = Application.get_env(:chat, Media)

    Application.put_env(:chat, Media,
      enabled: true,
      endpoint: "https://storage.example.test",
      public_base_url: "https://storage.example.test/vertigo",
      region: "kz-1",
      bucket: "vertigo",
      access_key_id: "test-access",
      secret_access_key: "test-secret",
      request_options: [plug: {Req.Test, __MODULE__}]
    )

    on_exit(fn ->
      if previous,
        do: Application.put_env(:chat, Media, previous),
        else: Application.delete_env(:chat, Media)
    end)

    objects = start_supervised!({Agent, fn -> %{} end})

    Req.Test.stub(__MODULE__, fn conn ->
      case conn.method do
        "PUT" ->
          assert ["AWS4-HMAC-SHA256 " <> _] = get_req_header(conn, "authorization")
          bytes = Req.Test.raw_body(conn)
          Agent.update(objects, &Map.put(&1, conn.request_path, bytes))
          send_resp(conn, 200, "")

        "GET" ->
          assert [] == get_req_header(conn, "authorization")
          send_resp(conn, 200, Agent.get(objects, &Map.fetch!(&1, conn.request_path)))
      end
    end)

    {:ok, user} = Accounts.register_user(%{"nickname" => "s3_owner", "password" => "secret123"})
    %{user: user, objects: objects}
  end

  test "new profile uploads store original and generated thumbnail in S3", %{
    user: user,
    conn: conn,
    objects: objects
  } do
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)
    assert {:ok, saved} = Profiles.put_photo(user, profile, png(), "image/png")
    assert saved.photo == nil
    assert saved.thumbnail == nil
    assert is_binary(saved.photo_key)
    assert is_binary(saved.thumbnail_key)
    assert map_size(Agent.get(objects, & &1)) == 2

    assert redirected_to(get(conn, "/profiles/s3_owner/photo")) ==
             Media.public_url(saved.photo_key)

    assert redirected_to(get(build_conn(), "/profiles/s3_owner/photo/thumbnail")) ==
             Media.public_url(saved.thumbnail_key)

    assert ChatWeb.ProfilesLive.thumbnail_url(%{saved | user: user}) ==
             "/profiles/s3_owner/photo/thumbnail"

    [policy] = get_resp_header(get(build_conn(), "/profiles"), "content-security-policy")
    assert policy =~ "img-src 'self' data: blob: https://storage.example.test"
    assert policy =~ "media-src 'self' blob: https://storage.example.test"
  end

  test "replacing an S3 profile photo replaces both media references", %{user: user} do
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)
    {:ok, first} = Profiles.put_photo(user, profile, png(), "image/png")
    {:ok, replacement} = Media.Thumbnail.generate(png())
    assert {:ok, second} = Profiles.put_photo(user, first, replacement, "image/webp")
    assert second.photo_key != first.photo_key
    assert second.thumbnail_key
    assert second.photo == nil
    assert second.thumbnail == nil

    assert Profiles.photo_resource(user.nickname) ==
             {:redirect, Media.public_url(second.photo_key)}
  end

  test "unauthorized and over-quota uploads never write to S3", %{user: user, objects: objects} do
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)

    assert {:error, :invalid_photo} =
             Profiles.put_photo(%{user | id: user.id + 1}, profile, png(), "image/png")

    assert {:error, :statist_required} = Gallery.upload_photo(user, png(), "image/png")
    assert Agent.get(objects, & &1) == %{}
  end

  test "gallery and music uploads use S3 without storing binary data", %{user: user} do
    user =
      user
      |> Ecto.Changeset.change(chat_seconds: 72_000, public_message_count: 200)
      |> Repo.update!()

    assert {:ok, photo} = Gallery.upload_photo(user, png(), "image/png")
    assert photo.image == nil
    assert photo.thumbnail == nil
    assert photo.image_key
    assert photo.thumbnail_key
    assert {:ok, track} = MusicChart.add_track(user, "Track", "ID3test", "audio/mpeg")
    assert track.audio == nil
    assert {:redirect, _} = MusicChart.audio_resource(track.id)

    assert redirected_to(get(build_conn(), "/music-chart/tracks/#{track.id}")) ==
             Media.public_url(track.audio_key)

    assert redirected_to(get(build_conn(), "/gallery/photos/#{photo.id}/thumbnail")) ==
             Media.public_url(photo.thumbnail_key)
  end

  test "migration creates missing previews, verifies bytes and is resumable", %{
    user: user,
    objects: objects
  } do
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)
    Repo.update!(Ecto.Changeset.change(profile, photo: png(), photo_content_type: "image/png"))
    Repo.insert!(%Gallery.Photo{user_id: user.id, image: png(), content_type: "image/png"})

    Repo.insert!(%MusicChart.Track{
      user_id: user.id,
      title: "Legacy",
      audio: "ID3legacy",
      content_type: "audio/mpeg"
    })

    counts = Media.Migration.run()
    assert counts == %{Profiles.Profile => 1, Gallery.Photo => 1, MusicChart.Track => 1}
    assert map_size(Agent.get(objects, & &1)) == 5
    assert Repo.get!(Profiles.Profile, profile.id).photo == nil
    assert Repo.one!(Gallery.Photo).thumbnail_key
    assert Repo.one!(MusicChart.Track).audio == nil
    assert Enum.all?(Media.Migration.run(), fn {_, count} -> count == 0 end)
  end

  test "failed public verification preserves the previous photo and legacy bytes", %{user: user} do
    {:ok, profile} = Profiles.get_by_nickname(user.nickname)

    profile =
      Repo.update!(Ecto.Changeset.change(profile, photo: png(), photo_content_type: "image/png"))

    Req.Test.stub(__MODULE__, fn conn ->
      if conn.method == "PUT", do: send_resp(conn, 200, ""), else: send_resp(conn, 403, "Denied")
    end)

    assert {:error, :storage_unavailable} =
             Profiles.put_photo(user, profile, png() <> <<0>>, "image/png")

    assert_raise RuntimeError, ~r/Media migration failed/, fn -> Media.Migration.run() end
    saved = Repo.get!(Profiles.Profile, profile.id)
    assert saved.photo == png()
    assert saved.photo_key == nil
  end

  test "thumbnail is a real WebP bounded to 480 pixels" do
    assert {:ok, thumbnail} = Media.Thumbnail.generate(png())
    assert Chat.Uploads.valid_image?(thumbnail, "image/webp")
    path = Path.join(System.tmp_dir!(), "thumbnail-test-#{Ecto.UUID.generate()}.webp")

    try do
      File.write!(path, thumbnail)
      executable = System.find_executable("magick") || System.find_executable("identify")
      args = if Path.basename(executable) == "magick", do: ["identify"], else: []
      assert {"480 320", 0} = System.cmd(executable, args ++ ["-format", "%w %h", path])
    after
      File.rm(path)
    end

    assert {:error, _} = Media.Thumbnail.generate("not an image")
  end

  defp png, do: File.read!(Path.expand("../fixtures/media.png", __DIR__))
end
