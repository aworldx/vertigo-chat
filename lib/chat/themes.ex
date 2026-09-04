# Назначение файла: контекст визуальных тем чата и режимов фона, к которым эти темы относятся.
defmodule Chat.Themes do
  @moduledoc """
  Defines available chat visual themes and their dark/light background modes.
  """

  @default_theme_id "vertigo"
  @default_mode_id "dark"

  @modes [
    %{id: "dark", name: "Тёмный фон"},
    %{id: "light", name: "Светлый фон"}
  ]

  @themes [
    %{id: "vertigo", name: "Vertigo", mode: "dark"},
    %{id: "dark", name: "Тёмная", mode: "dark"},
    %{id: "night_sky", name: "Ночное небо", mode: "dark"},
    %{id: "newspaper", name: "Газета", mode: "light"}
  ]

  @retired_theme_ids %{"light" => "newspaper"}

  def default_theme_id, do: @default_theme_id

  def list, do: @themes

  def list_modes, do: @modes

  def ids, do: Enum.map(@themes, & &1.id)

  def mode_ids, do: Enum.map(@modes, & &1.id)

  def get(theme_id) do
    Enum.find(@themes, &(&1.id == theme_id)) || get(@default_theme_id)
  end

  def normalize_theme_id(theme_id, fallback \\ @default_theme_id) do
    cond do
      theme_id in ids() -> theme_id
      Map.has_key?(@retired_theme_ids, theme_id) -> Map.fetch!(@retired_theme_ids, theme_id)
      fallback in ids() -> fallback
      true -> @default_theme_id
    end
  end

  def normalize_mode_id(mode_id, fallback \\ @default_mode_id) do
    if mode_id in mode_ids(), do: mode_id, else: fallback
  end

  def mode_for_theme(theme_id) do
    theme_id
    |> get()
    |> Map.fetch!(:mode)
    |> normalize_mode_id()
  end
end
