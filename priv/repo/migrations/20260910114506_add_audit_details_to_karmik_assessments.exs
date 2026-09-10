defmodule Chat.Repo.Migrations.AddAuditDetailsToKarmikAssessments do
  use Ecto.Migration

  def change do
    alter table(:karmik_assessments) do
      add :chatlan_nickname, :string
      add :message_body, :text
      add :verdict, :string
      add :reason, :string
    end

    create index(:karmik_assessments, [:assessed_on, :inserted_at])
  end
end
