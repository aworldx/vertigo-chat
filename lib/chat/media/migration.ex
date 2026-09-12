defmodule Chat.Media.Migration do
  @moduledoc "Resumable media migration. Back up the database and pause writes before running."
  import Ecto.Query
  alias Chat.{Media, Repo}

  def run do
    unless Media.enabled?(), do: raise("S3_ENABLED must be true")

    for schema <- [Chat.Profiles.Profile, Chat.Gallery.Photo, Chat.MusicChart.Track], into: %{} do
      {schema, migrate_schema(schema, 0, 0)}
    end
  end

  defp migrate_schema(schema, cursor, count) do
    ids =
      Repo.all(
        from row in schema, where: row.id > ^cursor, order_by: row.id, limit: 25, select: row.id
      )

    case ids do
      [] ->
        count

      _ ->
        migrated = Enum.count(ids, &migrate_row(schema, &1))
        migrate_schema(schema, List.last(ids), count + migrated)
    end
  end

  defp migrate_row(schema, id) do
    result =
      Repo.transaction(
        fn ->
          row = Repo.one!(from row in schema, where: row.id == ^id, lock: "FOR UPDATE")

          changes =
            for {field, key_field, _type} <- Media.fields(schema),
                is_binary(Map.get(row, field)) and is_nil(Map.get(row, key_field)),
                into: %{},
                do: {field, Map.fetch!(row, field)}

          if map_size(changes) == 0 do
            false
          else
            # force_change includes unchanged legacy bytes in the storage operation.
            changeset =
              Enum.reduce(changes, Ecto.Changeset.change(row), fn {field, bytes}, cs ->
                Ecto.Changeset.force_change(cs, field, bytes)
              end)

            with {:ok, stored} <- Media.persist(changeset),
                 {:ok, _} <- Repo.update(stored) do
              true
            else
              {:error, _} -> Repo.rollback(:media_migration_failed)
            end
          end
        end,
        timeout: 180_000
      )

    case result do
      {:ok, changed?} ->
        changed?

      {:error, _} ->
        raise "Media migration failed for #{inspect(schema)} id=#{id}; original database bytes retained"
    end
  end
end
