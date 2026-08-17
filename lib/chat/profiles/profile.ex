# Назначение файла: Ecto-схема анкеты зарегистрированного пользователя.
defmodule Chat.Profiles.Profile do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "profiles" do
    field(:name, :string)
    field(:birth_date, :date)
    field(:gender, :string)
    field(:about, :string)
    field(:photo, :binary)
    field(:photo_content_type, :string)

    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [:name, :birth_date, :gender, :about])
    |> validate_length(:name, max: 80)
    |> validate_inclusion(:gender, ["male", "female", "other"], allow_nil: true)
    |> validate_length(:about, max: 1_000)
    |> validate_birth_date()
  end

  def photo_changeset(profile, photo, content_type) do
    change(profile, photo: photo, photo_content_type: content_type)
  end

  defp validate_birth_date(changeset) do
    case get_field(changeset, :birth_date) do
      nil ->
        changeset

      date ->
        if Date.compare(date, Date.utc_today()) == :gt,
          do: add_error(changeset, :birth_date, "не может быть в будущем"),
          else: changeset
    end
  end
end
