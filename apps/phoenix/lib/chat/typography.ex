# Назначение файла: доступные гарнитуры и начертания пользовательского интерфейса чата.
defmodule Chat.Typography do
  @moduledoc """
  Defines the user-selectable typefaces and font styles for the chat interface.
  """

  @default_font_id "theme"
  @default_font_style "normal"

  @fonts [
    %{id: "theme", name: "Как у выбранной темы"},
    %{id: "sans", name: "Современный · Manrope"},
    %{id: "display", name: "Плакатный · Oswald"},
    %{id: "serif", name: "Газетный · Georgia"}
  ]

  @font_styles [
    %{id: "normal", name: "Обычный"},
    %{id: "italic", name: "Курсив"}
  ]

  def default_font_id, do: @default_font_id
  def default_font_style, do: @default_font_style
  def list, do: @fonts
  def list_styles, do: @font_styles
  def ids, do: Enum.map(@fonts, & &1.id)
  def style_ids, do: Enum.map(@font_styles, & &1.id)

  def normalize_font_id(font_id, fallback \\ @default_font_id) do
    if font_id in ids(), do: font_id, else: fallback
  end

  def normalize_font_style(font_style, fallback \\ @default_font_style) do
    if font_style in style_ids(), do: font_style, else: fallback
  end
end
