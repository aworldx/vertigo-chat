defmodule Chat.Feedback do
  @moduledoc "Stores private product feedback from registered chatlans and guests."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Feedback.Entry
  alias Chat.Repo
  alias Chat.Security
  alias Chat.Security.Subject

  def list_entries do
    Repo.all(from entry in Entry, order_by: [desc: entry.inserted_at], preload: [:user])
  end

  def change_entry(user, attrs \\ %{}) when is_map(attrs) do
    attrs = feedback_attrs(user, attrs)
    Entry.changeset(%Entry{}, attrs)
  end

  def submit(user, attrs, %Subject{} = subject) when is_map(attrs) do
    changeset = change_entry(user, attrs)

    with :ok <- Security.allow_feedback(subject),
         {:ok, entry} <- Repo.insert(put_user(changeset, user)) do
      {:ok, entry}
    end
  end

  def submit(_user, _attrs, %Subject{}), do: {:error, :invalid_feedback}

  defp feedback_attrs(%User{} = user, attrs), do: Map.put(attrs, "name", user.nickname)
  defp feedback_attrs(nil, attrs), do: attrs

  defp put_user(changeset, %User{id: user_id}),
    do: Ecto.Changeset.put_change(changeset, :user_id, user_id)

  defp put_user(changeset, nil), do: changeset
end
