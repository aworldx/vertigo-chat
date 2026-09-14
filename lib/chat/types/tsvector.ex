defmodule Chat.Types.TSVector do
  @moduledoc false

  @behaviour Ecto.Type

  @impl true
  def type, do: :tsvector

  @impl true
  def cast(value), do: {:ok, value}

  @impl true
  def load(value), do: {:ok, value}

  @impl true
  def dump(value), do: {:ok, value}

  @impl true
  def embed_as(_format), do: :self

  @impl true
  def equal?(left, right), do: left == right
end
