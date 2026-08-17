# Назначение файла: контекст внешнего вида чатланина: цвета ника/текста для режимов фона и CSS-представление.
defmodule Chat.Appearance do
  @moduledoc """
  Owns chatlan appearance settings for dark/light background modes.
  """

  alias Chat.Themes

  @defaults %{
    "dark" => %{"nickname_color" => "#fcd34d", "text_color" => "#e4e4e7"},
    "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
  }

  def default, do: @defaults

  def normalize(appearance) when is_map(appearance) do
    Map.new(Themes.mode_ids(), fn mode_id ->
      defaults = Map.fetch!(@defaults, mode_id)
      colors = Map.get(appearance, mode_id, %{})

      {mode_id,
       %{
         "nickname_color" =>
           normalize_color(colors["nickname_color"], defaults["nickname_color"]),
         "text_color" => normalize_color(colors["text_color"], defaults["text_color"])
       }}
    end)
  end

  def normalize(_appearance), do: default()

  def from_params(params, current_appearance) do
    submitted_appearance =
      params
      |> Map.get("appearance", params)
      |> case do
        appearance when is_map(appearance) -> appearance
        _appearance -> %{}
      end
      |> Map.take(Themes.mode_ids())

    current_appearance
    |> Map.merge(submitted_appearance)
    |> normalize()
  end

  def for_mode(appearance, mode_id) do
    mode_id = Themes.normalize_mode_id(mode_id)
    defaults = Map.fetch!(@defaults, mode_id)
    colors = Map.get(appearance || %{}, mode_id, %{})

    %{
      "nickname_color" => normalize_color(colors["nickname_color"], defaults["nickname_color"]),
      "text_color" => normalize_color(colors["text_color"], defaults["text_color"])
    }
  end

  defp normalize_color("#" <> hex = color, fallback) when byte_size(hex) == 6 do
    if Regex.match?(~r/\A#[0-9a-fA-F]{6}\z/, color), do: String.downcase(color), else: fallback
  end

  defp normalize_color(_color, fallback), do: fallback
end
