defmodule Chat.Repo.Migrations.SeedEmojiTags do
  use Ecto.Migration

  @tags ~w(
    вау
    восторг
    радость
    счастье
    любовь
    смех
    хаха
    улыбка
    грусть
    печаль
    тоска
    хнык
    злость
    удивление
    недоумение
    не_понял
    одобрение
    спасибо
    привет
    пока
    усталость
    стыд
    страх
    беспредел
    котики
  )

  def up do
    Enum.each(@tags, fn tag ->
      execute(
        "INSERT INTO emoji_tags (name, inserted_at, updated_at) VALUES ('#{tag}', NOW(), NOW()) ON CONFLICT (name) DO NOTHING"
      )
    end)
  end

  def down do
    quoted_tags = @tags |> Enum.map(&"'#{&1}'") |> Enum.join(", ")
    execute("DELETE FROM emoji_tags WHERE name IN (#{quoted_tags})")
  end
end
