# Назначение файла: стартовая настройка ExUnit и режима Ecto sandbox для тестов.
ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(Chat.Repo, :manual)
