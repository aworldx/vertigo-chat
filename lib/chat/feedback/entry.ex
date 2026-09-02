defmodule Chat.Feedback.Entry do
  use Ecto.Schema

  import Ecto.Changeset

  schema "feedback_entries" do
    belongs_to :user, Chat.Accounts.User
    field :name, :string
    field :body, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:name, :body])
    |> validate_required([:name, :body])
    |> validate_length(:name, min: 2, max: 40)
    |> validate_length(:body, min: 3, max: 2_000)
  end
end
