defmodule Chat.Repo.Migrations.AddTriggersToEmojiTags do
  use Ecto.Migration

  def up do
    alter table(:emoji_tags) do
      add :triggers, {:array, :string}, null: false, default: []
    end

    execute("""
    UPDATE emoji_tags
    SET triggers = CASE name
      WHEN 'грусть' THEN ARRAY['печаль', 'груст', '😢']
      WHEN 'смех' THEN ARRAY['хаха', '😂']
      WHEN 'вау' THEN ARRAY['😮', 'восторг']
      WHEN 'недоумение' THEN ARRAY['не понял']
      WHEN 'хнык' THEN ARRAY['😢']
      ELSE ARRAY[]::varchar[]
    END
    """)
  end

  def down do
    alter table(:emoji_tags) do
      remove :triggers
    end
  end
end
