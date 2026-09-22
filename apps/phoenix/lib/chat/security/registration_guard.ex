# Назначение файла: суточный постоянный маркер регистрации с одного сетевого адреса.
defmodule Chat.Security.RegistrationGuard do
  use Ecto.Schema

  import Ecto.Changeset

  schema "security_registration_guards" do
    field :fingerprint, :string
    field :day, :date

    timestamps(type: :utc_datetime)
  end

  def changeset(guard, attrs) do
    guard
    |> cast(attrs, [:fingerprint, :day])
    |> validate_required([:fingerprint, :day])
    |> unique_constraint([:fingerprint, :day])
  end
end
