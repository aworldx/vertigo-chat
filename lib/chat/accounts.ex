# Назначение файла: контекст регистрации и входа зарегистрированных пользователей чата.
defmodule Chat.Accounts do
  @moduledoc """
  Registers chat users and verifies registered-user passwords.
  """

  import Ecto.Query

  alias Chat.Accounts.Password
  alias Chat.Accounts.User
  alias Chat.Appearance
  alias Chat.Chatlans
  alias Chat.Profiles
  alias Chat.Repo
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes
  alias Chat.Typography

  def register_user(attrs), do: register_user(attrs, nil)

  def register_user(attrs, subject) when is_nil(subject) or is_struct(subject, Subject) do
    nickname = Chatlans.normalize_nickname(attrs["nickname"] || attrs[:nickname], nil)

    attrs =
      attrs
      |> stringify_keys()
      |> Map.put("nickname", nickname)

    changeset = User.registration_changeset(%User{}, attrs)

    cond do
      not changeset.valid? ->
        {:error, changeset}

      true ->
        register_valid_user(changeset, subject)
    end
  end

  def registered_nickname?(nickname) do
    nickname = Chatlans.normalize_nickname(nickname, nil)

    if nickname do
      Repo.exists?(from(user in User, where: user.nickname == ^nickname))
    else
      false
    end
  end

  def get_user(id) when is_integer(id), do: Repo.get(User, id)
  def get_user(_id), do: nil

  def authenticate(nickname, password) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    password = normalize_password(password)

    cond do
      is_nil(nickname) -> {:error, :invalid_nickname}
      password == "" -> {:error, :missing_password}
      true -> verify_registered_user(nickname, password)
    end
  end

  def authorize_entrance(nickname, password) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    password = normalize_password(password)

    cond do
      is_nil(nickname) -> {:error, :invalid_nickname}
      password != "" -> authenticate(nickname, password)
      registered_nickname?(nickname) -> {:error, :password_required}
      true -> {:ok, nil}
    end
  end

  def update_preferences(%User{} = user, attrs) do
    preferences = normalize_preferences(attrs, user_preferences(user))

    user
    |> User.preferences_changeset(preferences)
    |> Repo.update()
  end

  def user_preferences(%User{} = user) do
    %{
      "theme_id" => Themes.normalize_theme_id(user.theme_id),
      "appearance" => Appearance.normalize(user.appearance),
      "font_id" => Typography.normalize_font_id(user.font_id),
      "font_style" => Typography.normalize_font_style(user.font_style),
      "message_sound_enabled" => user.message_sound_enabled
    }
  end

  defp verify_registered_user(nickname, password) do
    user = Repo.get_by(User, nickname: nickname)

    cond do
      is_nil(user) -> {:error, :not_found}
      Password.verify(password, user.password_hash) -> {:ok, user}
      true -> {:error, :invalid_password}
    end
  end

  defp register_valid_user(changeset, subject) do
    Repo.transaction(fn ->
      with {:ok, user} <- Repo.insert(changeset),
           {:ok, _profile} <- Profiles.create_for_user(user),
           :ok <- Security.claim_registration(subject) do
        user
      else
        {:error, :registration_limit_reached} -> Repo.rollback(:rate_limited)
        {:error, failed_changeset} -> Repo.rollback(failed_changeset)
      end
    end)
  end

  defp normalize_password(password) when is_binary(password), do: password
  defp normalize_password(_password), do: ""

  defp normalize_preferences(attrs, current) do
    attrs = stringify_keys(attrs)

    %{
      "theme_id" => Themes.normalize_theme_id(attrs["theme_id"], current["theme_id"]),
      "appearance" => Appearance.from_params(attrs, current["appearance"]),
      "font_id" => Typography.normalize_font_id(attrs["font_id"], current["font_id"]),
      "font_style" => Typography.normalize_font_style(attrs["font_style"], current["font_style"]),
      "message_sound_enabled" =>
        normalize_message_sound_enabled(
          attrs["message_sound_enabled"],
          current["message_sound_enabled"]
        )
    }
  end

  defp normalize_message_sound_enabled(nil, current) when is_boolean(current), do: current
  defp normalize_message_sound_enabled(value, _current), do: value in [true, "true", "1", "on"]

  defp stringify_keys(attrs) do
    Map.new(attrs, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end
end
