# Назначение файла: Ecto-схема публичной статьи библиотеки и правил редактора.
defmodule Chat.Library.Article do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  @max_body_length 12_000

  schema "library_articles" do
    field :title, :string
    field :body, :string
    field :series, :string
    field :part_number, :integer

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def changeset(article, attrs) do
    article
    |> cast(attrs, [:title, :body, :series, :part_number])
    |> update_change(:title, &normalize_text/1)
    |> update_change(:body, &String.trim/1)
    |> update_change(:series, &normalize_optional_text/1)
    |> validate_required([:title, :body])
    |> validate_length(:title, max: 160)
    |> validate_length(:body, max: @max_body_length)
    |> validate_length(:series, max: 120)
    |> validate_number(:part_number, greater_than: 0, less_than_or_equal_to: 999)
    |> clear_part_without_series()
  end

  def max_body_length, do: @max_body_length

  defp normalize_text(value), do: String.trim(value)

  defp normalize_optional_text(value) do
    case String.trim(value) do
      "" -> nil
      normalized -> normalized
    end
  end

  defp clear_part_without_series(changeset) do
    if get_field(changeset, :series) do
      changeset
    else
      put_change(changeset, :part_number, nil)
    end
  end
end
