# Назначение файла: Ecto Repo, единая точка подключения приложения к PostgreSQL.
defmodule Chat.Repo do
  use Ecto.Repo,
    otp_app: :chat,
    adapter: Ecto.Adapters.Postgres
end
