defmodule Chat.Admin do
  @moduledoc """
  Authorizes administrative workflows.
  """

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Emojis
  alias Chat.Feedback
  alias Chat.Karmik

  @spec list_feedback(User.t() | nil) :: {:ok, [Chat.Feedback.Entry.t()]} | {:error, :forbidden}
  def list_feedback(%User{} = user) do
    if Accounts.admin?(user), do: {:ok, Feedback.list_entries()}, else: {:error, :forbidden}
  end

  def list_feedback(_user), do: {:error, :forbidden}

  def list_emojis(%User{} = user) do
    if Accounts.admin?(user), do: {:ok, Emojis.list()}, else: {:error, :forbidden}
  end

  def list_emojis(_user), do: {:error, :forbidden}

  def list_karmik_assessments(%User{} = user) do
    if Accounts.admin?(user),
      do: {:ok, Karmik.list_recent_assessments()},
      else: {:error, :forbidden}
  end

  def list_karmik_assessments(_user), do: {:error, :forbidden}

  def create_emoji(%User{} = user, code, image, content_type) do
    if Accounts.admin?(user),
      do: Emojis.create(code, image, content_type),
      else: {:error, :forbidden}
  end

  def create_emoji(_user, _code, _image, _content_type), do: {:error, :forbidden}
end
