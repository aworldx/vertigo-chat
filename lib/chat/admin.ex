defmodule Chat.Admin do
  @moduledoc """
  Authorizes administrative workflows.
  """

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Emojis
  alias Chat.Feedback
  alias Chat.Karmik
  alias Chat.Repo

  @table_limit 100

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

  @doc "Returns a read-only preview of a public database table for an administrator."
  @spec database_overview(User.t() | nil, String.t() | nil) ::
          {:ok,
           %{
             columns: [String.t()],
             rows: [[term()]],
             selected_table: String.t() | nil,
             tables: [String.t()]
           }}
          | {:error, :forbidden | :database}
  def database_overview(%User{} = user, requested_table) do
    if Accounts.admin?(user),
      do: load_database_overview(requested_table),
      else: {:error, :forbidden}
  end

  def database_overview(_user, _requested_table), do: {:error, :forbidden}

  def create_emoji(%User{} = user, code, image, content_type) do
    if Accounts.admin?(user),
      do: Emojis.create(code, image, content_type),
      else: {:error, :forbidden}
  end

  def create_emoji(_user, _code, _image, _content_type), do: {:error, :forbidden}

  defp load_database_overview(requested_table) do
    with {:ok, %{rows: table_rows}} <- Repo.query(public_tables_query()),
         tables <- Enum.map(table_rows, &hd/1),
         selected_table <- select_table(tables, requested_table),
         {:ok, columns, rows} <- load_table(selected_table) do
      {:ok, %{tables: tables, selected_table: selected_table, columns: columns, rows: rows}}
    else
      _ -> {:error, :database}
    end
  end

  defp load_table(nil), do: {:ok, [], []}

  defp load_table(table) do
    quoted_table = quote_identifier(table)

    with {:ok, %{rows: column_rows}} <- Repo.query(columns_query(), [table]),
         {:ok, %{rows: rows}} <-
           Repo.query("SELECT * FROM #{quoted_table} LIMIT $1", [@table_limit]) do
      {:ok, Enum.map(column_rows, &hd/1), rows}
    else
      _ -> {:error, :database}
    end
  end

  defp select_table([], _requested_table), do: nil

  defp select_table(tables, requested_table) do
    if requested_table in tables, do: requested_table, else: List.first(tables)
  end

  defp quote_identifier(identifier), do: "\"#{String.replace(identifier, "\"", "\"\"")}\""

  defp public_tables_query do
    """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
    """
  end

  defp columns_query do
    """
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
    """
  end
end
