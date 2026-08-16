# Назначение файла: Phoenix Presence для отслеживания пользователей онлайн в realtime-комнатах.
defmodule ChatWeb.Presence do
  @moduledoc """
  Tracks online chat participants through Phoenix Presence.
  """
  use Phoenix.Presence,
    otp_app: :chat,
    pubsub_server: Chat.PubSub
end
