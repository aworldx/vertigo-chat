defmodule ChatWeb.ProfilePhotoController do
  use ChatWeb, :controller

  def show(conn, %{"nickname" => nickname}) do
    ChatWeb.MediaResponse.send(conn, Chat.Profiles.photo_resource(nickname))
  end

  def thumbnail(conn, %{"nickname" => nickname}) do
    ChatWeb.MediaResponse.send(conn, Chat.Profiles.photo_resource(nickname, :thumbnail))
  end
end
