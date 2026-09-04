defmodule Chat.Admin do
  @moduledoc """
  Authorizes administrative workflows.
  """

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Feedback

  @spec list_feedback(User.t() | nil) :: {:ok, [Chat.Feedback.Entry.t()]} | {:error, :forbidden}
  def list_feedback(%User{} = user) do
    if Accounts.admin?(user), do: {:ok, Feedback.list_entries()}, else: {:error, :forbidden}
  end

  def list_feedback(_user), do: {:error, :forbidden}
end
